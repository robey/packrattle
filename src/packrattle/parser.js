"use strict";

const combiners = require("./combiners");
const engine = require("./engine");
const resolve = require("./resolve");
const util = require("util");

let ParserId = 1;

/* create a new Parser object:
 * - name: type of parser, in one word ("alt", "optional", ...)
 * - children: list of nested parsers, if this is a combiner
 * - describe: `(children: Array(String)) => String`
 *   - returns a description of the parser for debugging, including children,
 *     like "x or y or z"
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
    options.describe = list => name + ":" + list.join();
    delete options.wrap;
  }

  if (!options.describe) options.describe = name;

  return new Parser(name, options.children, options.describe, matcher);
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

  resolve(cache = null) {
    if (this.resolved) return;
    this.resolved = true;
    if (!this.children) return;

    if (!cache) cache = {};
    this.children = this.children.map(p => resolve(p, cache));
    this.children.forEach(p => p.resolve(cache));
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
      error.state = rv.state;
      throw error;
    }
    return rv.value;
  }

  // ----- transforms

  // transforms the result of a parser if it succeeds.
  // f(value, span)
  onMatch(f) {
    return newParser("onMatch", { wrap: this }, (state, results) => {
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

  map(f) { return this.onMatch(f); }

  // transforms the error message of a parser
  onFail(newMessage) {
    return newParser("onFail", { wrap: this }, (state, results) => {
      state.schedule(this).then(match => {
        results.add((match.ok || match.abort) ? match : match.toError(newMessage));
      });
    });
  }


  // ----- convenience methods for accessing the combinators

  then(p) { return combiners.chain(this, p, (a, b) => [ a, b ]); }

  or(...parsers) { return combiners.alt(this, ...parsers); }

  drop() { return combiners.drop(this); }
}


exports.newParser = newParser;
exports.Parser = Parser;
