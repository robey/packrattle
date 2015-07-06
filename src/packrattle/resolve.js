"use strict";

const ID = Symbol("id");
let LazyId = 0;

/*
 * convert a "parser" into an actual Parser object.
 * - could be a lazy function that evaluates to a Parser
 * - could be a simple data type like regex that is "implicitly" a Parser
 *
 * if you'd like te cache the results of function evaluations, pass in `cache`.
 */
module.exports = exports = function resolve(parser, cache = null) {
  if (typeof parser == "function") {
    if (!parser[ID]) {
      // give every lazy parser an id so we can cache them.
      LazyId++;
      parser[ID] = LazyId;
    }
    const id = parser[ID];
    if (cache && cache[id]) {
      parser = cache[id];
    } else {
      parser = parser();
      if (cache) cache[id] = parser;
    }
  }

  // avoid 'require' loops.
  const combiners = require("./combiners");
  const Parser = require("./parser").Parser;
  const simple = require("./simple");

  // implicits:
  if (typeof parser == "string") parser = simple.string(parser);
  if (typeof parser == "object" && parser.constructor.name == "RegExp") parser = simple.regex(parser);
  if (Array.isArray(parser)) parser = combiners.seq(...parser);

  if (!(parser instanceof Parser)) throw new Error("Unable to resolve parser: " + parser);
  return parser;
}
