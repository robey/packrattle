// import { alt, chain, check, commit, drop, not, optional, repeat, seq } from "./combiners";
// import resolve from "./resolve";
// import { quote } from "./strings";

import { alt, chain, check, commit, optional, optionalOr } from "./combiners";
import { Engine, EngineOptions } from "./engine";
import { FailedMatch, Match, SuccessfulMatch } from "./match";
import { ParserState } from "./parser_state";
import { PromiseSet } from "./promise_set";
import { LazyParser, LazyParser2, resolve } from "./resolve";
import { simple } from "./simple";
import { Span } from "./span";
import { quote } from "./strings";

let ParserId = 1;

// private cache of generated parsers:
const __cache: { [key: string]: Parser<any> } = {};

export interface ParserOptions {
  // list of nested parsers, if this is a combining parser:
  children?: LazyParser[];

  // for debugging, how to produce a description of this parser (like
  // "x or y or z"):
  describe?: (children: string[]) => string;

  // is this parser stateless? exactly the same as any other porser with the
  // same name and children? packrattle will replace all duplicates with
  // references to a single object.
  cacheable?: boolean;

  // kind of a hack: is there some other way the parser could vary, that
  // should be used as a variant when caching?
  extraCacheKey?: string;
}

/*
 * the meat of a parser: given a state (text & position), and a list of
 * child parsers (which may be resolved & merged from the initial list),
 * determine success or failure and indicate it on the state object.
 */
export type Matcher<T> = (state: ParserState<T>, children: Parser<any>[]) => void;

/*
 * create a new Parser object:
 *   - name: type of parser, in one word ("alt", "optional", ...)
 *   - options: see above
 *   - matcher: see above
 */
export function newParser<T>(name: string, options: ParserOptions = {}, matcher: Matcher<T>): Parser<T> {
  const children = options.children || [];
  const describe = options.describe || ((list: string[]) => {
    if (list.length == 0) return name;
    return name + ":" + list.join(",");
  });

  return new Parser<T>(name, children, describe, matcher, options.cacheable || false, options.extraCacheKey);
}


/*
 * internal use: not intended to be created by users (use `newParser` above).
 */
export class Parser<T> {
  readonly id: number;

  // detect and avoid loops when displaying debug strings:
  private recursing = false;

  // cache description once we've computed it
  private description?: string;

  // children, once we've resolved them
  private children?: Parser<any>[];

  // set when all lazy and implicit parsers have been resolved:
  private resolved = false;

  // if this parser is cacheable, this is its unique key:
  private cacheKey: string;


  constructor(
    public readonly name: string,
    public readonly originalChildren: LazyParser[],
    public readonly describe: (children: string[]) => string,
    public readonly matcher: Matcher<T>,
    public readonly cacheable: boolean,
    public readonly extraCacheKey?: string
  ) {
    this.id = ParserId++;
  }

  toString(): string {
    return `Parser[${this.id}, ${this.name}]`;
  }

  inspect(): string {
    if (this.description) return this.description;
    if (this.recursing) return "...";
    this.recursing = true;
    this.resolve();
    const list = (this.children || []).map(p => {
      return (p.children && p.children.length > 1) ? ("(" + p.inspect() + ")") : p.inspect();
    });
    this.recursing = false;
    this.description = this.describe(list);
    return this.description;
  }

  // // create a dot graph of the parser nesting
  // toDot(maxLength = 40) {
  //   const seen = {};
  //   const nodes = [];
  //   const edges = [];
  //
  //   function traverse(parser) {
  //     seen[parser.id] = true;
  //     nodes.push({ id: parser.id, name: parser.name, description: parser.inspect() });
  //     (parser.children || []).forEach(p => {
  //       edges.push({ from: parser.id, to: p.id });
  //       if (!seen[p.id]) traverse(p);
  //     });
  //   }
  //
  //   this.resolve();
  //   traverse(this);
  //
  //   const data = [
  //     "digraph packrattle {",
  //     "  node [fontname=Courier];"
  //   ];
  //   data.push("");
  //   edges.forEach(e => {
  //     data.push(`  "${e.from}" -> "${e.to}";`);
  //   });
  //   data.push("");
  //   nodes.forEach(n => {
  //     let description = n.description;
  //     if (description.length > maxLength) description = description.slice(0, maxLength) + "...";
  //     description = description.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  //     const name = n.name.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  //     const label = `[${n.id}] ${name}` + (name == description ? "" : "\\n" + description);
  //     data.push(`  "${n.id}" [label="${label}", shape=rect];`);
  //   });
  //   data.push("}");
  //   return data.join("\n") + "\n";
  // }
  //
  // // helper for debugging inside node
  // writeDotFile(filename, maxLength) {
  //   require("fs").writeFileSync(filename, this.toDot(maxLength));
  // }

  resolve(functionCache: { [key: string]: LazyParser2 } = {}) {
    if (this.children) return;

    try {
      this.children = this.originalChildren.map(p => resolve(p, functionCache));
      this.children.forEach(p => p.resolve(functionCache));
    } catch (error) {
      error.message += " (inside " + this.name + ")";
      throw error;
    }

    // if this parser can be cached, do so. if one like it already exists, return that one and let this one vanish.
    this.computeCacheKey();
    if (this.cacheKey) {
      if (__cache[this.cacheKey]) return __cache[this.cacheKey];
      __cache[this.cacheKey] = this;
    }
    return this;
  }

  // computed during resolve phase.
  private computeCacheKey() {
    if (!this.cacheable) return;
    if (this.cacheKey) return;

    // if it's a simple parser (no children), it must have a simple string description to be cacheable.
    if (!this.children || this.children.length == 0) {
      this.inspect();
      if (!this.description) return;
      this.cacheKey = this.name + ":" + quote(this.description);
      if (this.extraCacheKey) this.cacheKey += "&" + quote(this.extraCacheKey);
      return;
    }

    // all children must be cacheable (and already cached).
    let ok = true;
    this.children.forEach(p => {
      if (!p.cacheKey) ok = false;
    });
    if (!ok) return;
    this.cacheKey = this.name + ":" + this.children.map(p => quote(p.cacheKey)).join("&");
    if (this.extraCacheKey) this.cacheKey += "&" + quote(this.extraCacheKey);
    return this.cacheKey;
  }

  // called by engine.
  match(state: ParserState<T>) {
    this.matcher(state, this.children || []);
  }

  execute(text: string, options: EngineOptions = {}): Match<T> {
    this.resolve();
    return new Engine(text, options).execute(this);
  }

  // return a parser that asserts that the string ends after this parser.
  consume(): Parser<T> {
    return chain(this, simple.end(), (a, _b) => a);
  }

  // consume an entire text with this parser. convert failure into an exception.
  run(text: string, options = {}): T {
    const rv = this.consume().execute(text, options);
    if (rv instanceof FailedMatch) throw new ParseError(rv.message, rv.span());
    return rv.value;
  }

  // ----- transforms

  // transforms the result of a parser if it succeeds.
  // f(value, span)
  map<U>(f: U | ((item: T, span: Span) => U)): Parser<U> {
    return newParser<U>("map", { children: [ this ] }, state => {
      state.schedule(this, state.pos).then(match => {
        if (match instanceof FailedMatch) {
          state.result.add(match.forState(state));
          return;
        }

        const rv = (typeof f === "function") ? f(match.value, match.span()) : f;
        // used to be able to return a new Parser here, but i can't come up
        // with any practical use for it.
        state.result.add(match.merge(match, state, rv));
      });
    });
  }

  flatmap<U>(f: (item: T, span: Span) => Parser<U>): Parser<U> {
    return newParser<U>("flatmap", { children: [ this ] }, state => {
      state.schedule(this, state.pos).then(match => {
        if (match instanceof FailedMatch) {
          state.result.add(match.forState(state));
          return;
        }

        state.schedule(f(match.value, match.span()), state.pos).then(m => state.result.add(m));
      });
    });
  }

  onMatch<U>(f: (item: T, span: Span) => U): Parser<U> { return this.map(f); }

  // transforms the error message of a parser
  onFail(newMessage: string): Parser<T> {
    return newParser<T>("onFail", { children: [ this ] }, state => {
      state.schedule(this, state.pos).then(match => {
        state.result.add(match instanceof SuccessfulMatch ? match : match.withMessage(newMessage));
      });
    });
  }

  // transforms the error message of a parser, but only if it hasn't been already.
  named(description: string): Parser<T> {
    return newParser<T>("onFail", { children: [ this ], describe: () => description }, state => {
      state.schedule(this, state.pos).then(match => {
        state.result.add(match.commit || match instanceof SuccessfulMatch ?
          match :
          match.withMessage("Expected " + description)
        );
      });
    });
  }

  // // only succeed if f(value, state) returns true. optional failure message.
  // matchIf(f, message) {
  //   return newParser("filter", { wrap: this }, (state, results) => {
  //     state.schedule(this).then(match => {
  //       if (match.ok && !f(match.value, match.state.span())) {
  //         results.add(state.failure(message));
  //       } else {
  //         results.add(match);
  //       }
  //     });
  //   });
  // }
  //
  // filter(f, message) { return this.matchIf(f, message); }


  // ----- convenience methods for accessing the combinators

  then<U>(p: Parser<U>): Parser<[ T, U ]> { return chain(this, p, (a: T, b: U) => [ a, b ] as [ T, U ]); }

  or<U>(p: Parser<U>): Parser<T | U> { return alt(this, p); }

  // drop() { return drop(this); }

  optional(): Parser<T | undefined> { return optional(this); }

  optionalOr(defaultValue: T) { return optionalOr<T>(this, defaultValue); }

  check(): Parser<T> { return check(this); }

  commit(): Parser<T> { return commit(this); }

  // not() { return not(this); }
  //
  // repeat(options) { return repeat(this, options); }
  //
  // times(count) { return repeat(this, { min: count, max: count }); }
}

export class ParseError extends Error {
  name = "ParseError";

  constructor(public message: string, public span: Span) {
    super(message);
  }
}
