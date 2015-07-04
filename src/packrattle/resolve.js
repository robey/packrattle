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
  const Parser = require("./parser").Parser;

  // FIXME: implicits

  if (!(parser instanceof Parser)) throw new Error("Unable to resolve parser: " + parser);
  return parser;
}
