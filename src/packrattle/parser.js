"use strict";

const combiners = require("./combiners");
const engine = require("./engine");
const resolve = require("./resolve");
const strings = require("./strings");

let ParserId = 1;

const __cache = {};

/*
 * create a new Parser object:
 * - name: type of parser, in one word ("alt", "optional", ...)
 * - options:
 *   - children: list of nested parsers, if this is a combiner
 *   - describe: `(children: Array(String)) => String`
 *     - returns a description of the parser for debugging, including children,
 *       like "x or y or z"
 * - matcher: `(parser, state, results) => void`
 *   - parser: effectively `this`
 *   - state: `ParserState` current text and position
 *   - results: `ResultSet` container for eventual result (success or failure)
 */
function newParser(name, options = {}, matcher) {
  if (!matcher) {
    // options is optional.
    matcher = options;
    options = {};
  }

  if (options.wrap) {
    options.children = [ options.wrap ];
    if (!options.describe) options.describe = list => name + ":" + list.join();
    delete options.wrap;
  }

  if (!options.describe) options.describe = name;

  const parser = new Parser(name, options.children, options.describe, matcher);
  parser.cacheable = options.cacheable;
  parser.extraCacheKey = options.extraCacheKey;
  return parser;
}


/*
 * internal use: not intended to be created by users (use `newParser` above).
 */
class Parser {
  constructor(name, children, describe, matcher) {
    this.name = name;
    this.children = children;
    this.describe = describe;
    this.matcher = matcher;
    this.id = ParserId;
    ParserId += 1;
    // detect and avoid loops when displaying debug strings:
    this.recursing = false;
    // set when all lazy and implicit parsers have been resolved:
    this.resolved = false;
  }

  toString() {
    return `Parser[${this.id}, ${this.name}]`;
  }

  inspect() {
    if (this.recursing) return "...";
    if (typeof this.describe == "string") return this.describe;
    this.recursing = true;
    this.resolve();
    const list = (this.children || []).map(p => {
      return (p.children && p.children.length > 1) ? ("(" + p.inspect() + ")") : p.inspect();
    });
    this.recursing = false;
    this.describe = this.describe(list);
    return this.describe;
  }

  // create a dot graph of the parser nesting
  toDot(maxLength = 40) {
    const seen = {};
    const nodes = [];
    const edges = [];

    function traverse(parser) {
      seen[parser.id] = true;
      nodes.push({ id: parser.id, name: parser.name, description: parser.inspect() });
      (parser.children || []).forEach(p => {
        edges.push({ from: parser.id, to: p.id });
        if (!seen[p.id]) traverse(p);
      });
    }

    this.resolve();
    traverse(this);

    const data = [
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

  // helper for debugging inside node
  writeDotFile(filename, maxLength) {
    require("fs").writeFileSync(filename, this.toDot(maxLength));
  }

  resolve(functionCache = null) {
    // we won't perfectly cache loops, but that's fine.
    if (this.resolved) return this;
    this.resolved = true;

    if (this.children) {
      if (!functionCache) functionCache = {};
      try {
        this.children = this.children.map(p => resolve(p, functionCache).resolve(functionCache));
      } catch (error) {
        error.message += " (inside " + this.name + ")";
        throw error;
      }
    }

    // if this parser can be cached, do so. if one like it already exists, return that one and let this one vanish.
    this._computeCacheKey();
    if (this.cacheKey) {
      if (__cache[this.cacheKey]) return __cache[this.cacheKey];
      __cache[this.cacheKey] = this;
    }
    return this;
  }

  // computed during resolve phase.
  _computeCacheKey() {
    if (!this.cacheable) return null;
    if (this.cacheKey) return this.cacheKey;

    // if it's a simple parser (no children), it must have a simple string description to be cacheable.
    if (!this.children || this.children.length == 0) {
      if (!(typeof this.describe == "string")) return null;
      this.cacheKey = this.name + ":" + strings.quote(this.describe);
      if (this.extraCacheKey) this.cacheKey += "&" + strings.quote(this.extraCacheKey);
      return this.cacheKey;
    }

    // all children must be cacheable (and already cached).
    let ok = true;
    this.children.forEach(p => {
      if (!p.cacheKey) ok = false;
    });
    if (!ok) return null;
    this.cacheKey = this.name + ":" + this.children.map(p => strings.quote(p.cacheKey)).join("&");
    if (this.extraCacheKey) this.cacheKey += "&" + strings.quote(this.extraCacheKey);
    return this.cacheKey;
  }

  execute(text, options = {}) {
    this.resolve();
    return new engine.Engine(text, options).execute(this);
  }

  // return a parser that asserts that the string ends after this parser.
  consume() {
    const simple = require("./simple");
    const combiners = require("./combiners");
    return combiners.chain(this, simple.end, (a, b) => a);
  }

  // consume an entire text with this parser. convert failure into an exception.
  run(text, options = {}) {
    const rv = this.consume().execute(text, options);
    if (!rv.ok) {
      const error = new Error(rv.value);
      error.span = rv.state.span();
      throw error;
    }
    return rv.value;
  }

  // ----- transforms

  // transforms the result of a parser if it succeeds.
  // f(value, span)
  map(f) {
    return newParser("map", { wrap: this }, (state, results) => {
      state.schedule(this).then(match => {
        if (!match.ok) return results.add(match);
        if (typeof f != "function") return results.add(match.withValue(f));

        try {
          const rv = f(match.value, match.state.span());
          if (rv instanceof Parser) {
            match.state.schedule(rv).then(m => results.add(m));
          } else {
            results.add(match.withValue(rv));
          }
        } catch (error) {
          results.add(match.toError(error.toString()));
        }
      });
    });
  }

  onMatch(f) { return this.map(f); }

  // transforms the error message of a parser
  onFail(newMessage) {
    return newParser("onFail", { wrap: this }, (state, results) => {
      state.schedule(this).then(match => {
        results.add(match.ok ? match : match.toError(newMessage));
      });
    });
  }

  // transforms the error message of a parser, but only if it hasn't been already.
  named(description) {
    return newParser("onFail", { wrap: this, describe: description }, (state, results) => {
      state.schedule(this).then(match => {
        results.add(match.commit ?
          match :
          match.changeGeneratedMessage("Expected " + description)
        );
      });
    });
  }

  // only succeed if f(value, state) returns true. optional failure message.
  matchIf(f, message) {
    return newParser("filter", { wrap: this }, (state, results) => {
      state.schedule(this).then(match => {
        if (match.ok && !f(match.value, match.state.span())) {
          results.add(state.failure(message));
        } else {
          results.add(match);
        }
      });
    });
  }

  filter(f, message) { return this.matchIf(f, message); }


  // ----- convenience methods for accessing the combinators

  then(...parsers) { return combiners.seq(this, ...parsers); }

  or(...parsers) { return combiners.alt(this, ...parsers); }

  drop() { return combiners.drop(this); }

  optional(defaultValue = "") { return combiners.optional(this, defaultValue); }

  check() { return combiners.check(this); }

  commit() { return combiners.commit(this); }

  not() { return combiners.not(this); }

  repeat(options) { return combiners.repeat(this, options); }

  times(count) { return combiners.repeat(this, { min: count, max: count }); }
}


exports.newParser = newParser;
exports.Parser = Parser;
