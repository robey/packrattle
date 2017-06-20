import { chain, seq } from "./combiners";
import { Engine, EngineOptions } from "./engine";
import {
  defer, fail, mapMatch, Match, Matcher, MatchFailure, MatchResult, MatchSuccess, schedule, Sequence, Span
} from "./matcher";
import { simple } from "./simple";
import { quote } from "./strings";

export type LazyParser<A, Out> = Parser<A, Out> | (() => Parser<A, Out>);

export class ParseError extends Error {
  name = "ParseError";

  constructor(public message: string, public span: Span) {
    super(message);
  }
}

export interface ParserOptions<A, Out> {
  // list of nested parsers, if this is a combining parser:
  children?: LazyParser<A, any>[];

  // for debugging, how to produce a description of this parser (like
  // "x or y or z"):
  describe?: (children: string[]) => string;

  // is this parser stateless? exactly the same as any other porser with the
  // same name and children? packrattle will replace all duplicates with
  // references to a single object, using the description as a cache key.
  cacheable?: boolean;
}

function defaultDescribe(name: string): (children: string[]) => string {
  return (children: string[]) => {
    if (children.length == 0) return name;
    return name + ":" + children.join(",");
  };
}

let ParserId = 1;

// private cache of generated parsers:
const __cache: { [key: string]: Parser<any, any> } = {};

/*
 * a Parser that's created by one of the top-level functions. it tries to
 * match a Sequence<A> and generate an Out.
 *
 * after being resolved, it can be converted into a ResolvedParser, which is
 * smaller and has all its dependent links resolved.
 */
export class Parser<A, Out> {
  readonly id: number;

  // actual children, once we've resolved them
  children: Parser<A, any>[];

  // actual matcher, once we've resolved children
  matcher: Matcher<A, Out>;

  // cache description once we've computed it
  description: string;

  // if this parser is cacheable, this is its unique key:
  private cacheKey: string;

  // detect and avoid loops when displaying debug strings:
  private recursing = false;


  /*
   * - name: type of parser, in one word ("alt", "optional", ...)
   * - options: see above
   * - matcher: function to create a Matcher out of the resolved children,
   *     once we know them
   */
  constructor(
    public readonly name: string,
    public options: ParserOptions<A, Out>,
    public generateMatcher: (children: Parser<A, any>[]) => Matcher<A, Out>
  ) {
    this.id = ParserId++;
  }

  toString(): string {
    return `Parser[${this.id}, ${this.name}]`;
  }

  inspect(): string {
    return this.description ? `Parser[${this.id}, ${this.description}]` : `(unresolved ${this.id})`;
  }

  // fill in children, description, cacheKey. cache if we can.
  // may return a different Parser (because an identical one is in the cache).
  resolve(): Parser<A, Out> {
    this.unlazyChildren();
    this.getDescription();
    return this.uniqify();
  }

  // fill in 'childen' so we have a tree of actual Parsers instead of LazyParsers.
  private unlazyChildren(functionCache: FunctionCache<A, Out> = {}) {
    if (this.children) return;
    try {
      this.children = (this.options.children || []).map(p => unlazy(p, functionCache));
      this.children.forEach(p => p.unlazyChildren(functionCache));
    } catch (error) {
      error.message += " (inside " + this.name + ")";
      throw error;
    }
  }

  // flll in 'description'. recursive.
  private getDescription(): string {
    if (this.description) return this.description;
    if (this.recursing) return "...";
    this.recursing = true;
    const list = this.children.map(p => {
      return (p.children && p.children.length > 1) ? ("(" + p.getDescription() + ")") : p.getDescription();
    });
    this.recursing = false;
    this.description = (this.options.describe || defaultDescribe(this.name))(list);
    return this.description;
  }

  /*
   * depth-first traversal to replace nodes with cached nodes if they're
   * cacheable and equivalent. this way, we may be able to reuse results in
   * far-off parts of the parse tree.
   * we can't cache cycles, sadly.
   */
  private uniqify(): Parser<A, Out> {
    if (this.cacheKey) return __cache[this.cacheKey];

    if (this.recursing || !this.options) return this;
    this.recursing = true;
    this.children = this.children.map(p => p.uniqify());
    this.recursing = false;

    if (this.options.cacheable) {
      if (this.children.length == 0) {
        this.cacheKey = this.name + ":" + quote(this.description);
      } else {
        // cacheable children will all have a cache key set from the 'resolve' call above.
        const cacheable = this.children.reduce((sum, child) => sum && child.cacheKey !== undefined, true);
        if (cacheable) this.cacheKey = this.name + "(" + this.children.map(p => quote(p.cacheKey)).join(",") + ")";
      }

      if (this.cacheKey) {
        if (__cache[this.cacheKey]) return __cache[this.cacheKey];
        __cache[this.cacheKey] = this;
      }
    }

    this.matcher = this.generateMatcher(this.children);
    delete this.options;
    delete this.generateMatcher;

    return this;
  }

  execute(stream: Sequence<A>, options: EngineOptions = {}): Match<Out> {
    return new Engine(stream, options).execute(this.resolve());
  }

  // return a parser that asserts that the string ends after this parser.
  consume(): Parser<A, Out> {
    return chain<A, Out, null, Out>(this, simple.end(), (a, _b) => a);
  }

  // consume an entire text with this parser. convert failure into an exception.
  run(stream: Sequence<A>, options: EngineOptions = {}): Out {
    const rv = this.consume().execute(stream, options);
    // really want 'match' statement here.
    if (rv instanceof MatchFailure) {
      throw new ParseError(rv.message, rv.span);
    } else if (rv instanceof MatchSuccess) {
      return rv.value;
    } else {
      throw new Error("impossible");
    }
  }

  // ----- transforms

  // transforms the result of a parser if it succeeds.
  // f(value, span)
  map<U>(f: U | ((item: Out, span: Span) => U)): Parser<A, U> {
    return new Parser<A, U>("map", { children: [ this ] }, children => {
      return (stream, index) => {
        return schedule<A, Out, U>(children[0], index, (match: Match<Out>) => {
          return mapMatch<A, Out, U>(match, (span, value) => {
            let rv: MatchResult<A, U>;
            if (typeof f === "function") {
              try {
                rv = [ new MatchSuccess(span, f(value, span)) ];
              } catch (error) {
                const priority = error["priority"] || 0;
                rv = [ new MatchFailure(span, error.message, priority) ];
              }
            } else {
              rv = [ new MatchSuccess(span, f) ];
            }
            return rv;
          });
        });
      };
    });
  }

  // only succeed if f(value, state) returns true. optional failure message.
  filter(f: (value: Out, span: Span) => boolean, message?: string): Parser<A, Out> {
    return new Parser<A, Out>("filter", { children: [ this ] }, children => {
      return (stream, index) => {
        return schedule<A, Out, Out>(children[0], index, (match: Match<Out>) => {
          return mapMatch<A, Out, Out>(match, (span, value) => {
            return f(value, span) ? [ match ] : fail(span.start, message || children[0]);
          });
        });
      };
    });
  }

  // transforms the error message of a parser, if the previous error message
  // has the same or lower priority, and didn't get any deeper into the string.
  mapError(newMessage: string, priority: number = 0, describe?: () => string): Parser<A, Out> {
    return new Parser<A, Out>("mapError", { children: [ this ], describe }, children => {
      return (stream, index) => {
        return schedule<A, Out, Out>(children[0], index, (match: Match<Out>) => {
          if ((match instanceof MatchFailure) && match.span.start == index && priority >= match.priority) {
            return [ new MatchFailure(match.span, newMessage, priority) ];
          } else {
            return [ match ];
          }
        });
      };
    });
  }

  named(description: string, priority: number = 0): Parser<A, Out> {
    return this.mapError("Expected " + description, priority, () => description);
  }

  // create a dot graph of the parser nesting
  toDot(maxLength: number = 40): string {
    const seen: { [id: number]: boolean } = {};
    const nodes: { id: number, name: string, description: string }[] = [];
    const edges: { from: number, to: number }[] = [];

    function traverse(parser: Parser<A, any>) {
      seen[parser.id] = true;
      nodes.push({ id: parser.id, name: parser.name, description: parser.description });
      parser.children.forEach(p => {
        edges.push({ from: parser.id, to: p.id });
        if (!seen[p.id]) traverse(p);
      });
    }

    traverse(this.resolve());

    const data: string[] = [
      "digraph packrattle {",
      "  node [fontname=Courier];"
    ];
    data.push("");
    edges.forEach(e => {
      data.push(`  "${e.from}" -> "${e.to}";`);
    });
    data.push("");
    nodes.forEach(n => {
      let description = n.description;
      if (description.length > maxLength) description = description.slice(0, maxLength) + "...";
      description = description.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      const name = n.name.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      const label = `[${n.id}] ${name}` + (name == description ? "" : "\\n" + description);
      data.push(`  "${n.id}" [label="${label}", shape=rect];`);
    });
    data.push("}");
    return data.join("\n") + "\n";
  }
}


const ID = "__packrattle_cache_id";
let LazyId = 0;
export type FunctionCache<A, Out> = { [key: string]: Parser<A, Out> };
type Cacheable = { __packrattle_cache_id?: string };

/*
 * convert a "parser-like object" into an actual Parser object.
 * - could be a lazy function that evaluates to a Parser
 * - could be a simple data type like regex that is "implicitly" a Parser
 *
 * if you'd like te cache the results of function evaluations, pass an empty object as `functionCache`.
 */
function unlazy<A, Out>(parser: LazyParser<A, Out>, functionCache: FunctionCache<A, Out>): Parser<A, Out> {
  if (typeof parser == "function") {
    let id = (parser as Cacheable).__packrattle_cache_id;
    if (id === undefined) {
      // give every lazy parser an id so we can cache them.
      (parser as Cacheable).__packrattle_cache_id = id = (LazyId++).toString();
    }

    if (functionCache[id]) {
      parser = functionCache[id];
    } else {
      parser = parser();
      functionCache[id] = parser;
    }
  }

  if (!(parser instanceof Parser)) throw new Error("Unable to resolve parser: " + parser);
  return parser;
}

export function parser<A, Out>(parser: LazyParser<A, Out>): Parser<A, Out> {
  return unlazy(parser, {});
}
