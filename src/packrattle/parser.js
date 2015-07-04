"use strict";

const engine = require("./engine");
const resolve = require("./resolve");

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
    options.describe = list => list.join();
    delete options.wrap;
  }

  if (!options.describe) options.describe = name;

  return new Parser(name, options.children, options.describe, matcher);
}


/*
 * internal use: not intended to be created by users.
 */
class Parser {
  constructor(name, nested, describe, matcher) {
    this.name = name;
    this.nested = nested;
    this.describe = describe;
    this.matcher = matcher;
    this.id = ParserId;
    ParserId += 1;
    // detect and avoid loops when displaying debug strings:
    this.recursing = false;
  }

  toString() {
    return `Parser[${this.id}, ${this.name}]`;
  }

  inspect() {
    if (this.recursing) return "...";
    if (typeof this.describe == "string") return this.describe;
    this.recursing = true;
    const list = this.children.map(p => resolve(p).inspect());
    this.recursing = false;
    this.describe = this.describe(list);
    return this.describe;
  }

  execute(text, options = {}) {
    return new engine.Engine(text, options).execute(this);
  }

  // consume an entire text with this parser. convert failure into an exception.
  run(text, options = {}) {
    // FIXME: consume
    const rv = this.execute(text, options);
    if (!rv.ok) {
      const error = new Error(rv.value);
      error.state = rv.state;
      throw error;
    }
    return rv.value;
  }
}


exports.newParser = newParser;
exports.Parser = Parser;
