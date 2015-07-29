"use strict";

// detect missing Symbol :(
let haveSymbol = true;
try {
  Symbol;
} catch (error) {
  haveSymbol = false;
}

const ID = haveSymbol ? Symbol("id") : "__packrattle_Symbol_id";
let LazyId = 0;

/*
 * convert a "parser" into an actual Parser object.
 * - could be a lazy function that evaluates to a Parser
 * - could be a simple data type like regex that is "implicitly" a Parser
 *
 * if you'd like te cache the results of function evaluations, pass an empty object as `functionCache`.
 */
module.exports = exports = function resolve(parser, functionCache = null) {
  if (typeof parser == "function") {
    if (!parser[ID]) {
      // give every lazy parser an id so we can cache them.
      LazyId++;
      parser[ID] = LazyId;
    }
    const id = parser[ID];
    if (functionCache && functionCache[id]) {
      parser = functionCache[id];
    } else {
      parser = parser();
      if (functionCache) functionCache[id] = parser;
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
