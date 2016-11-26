import { seq } from "./combiners";
import { Parser } from "./parser";
import { simple } from "./simple";

// // detect missing Symbol :(
// let haveSymbol = true;
// try {
//   Symbol;
// } catch (error) {
//   haveSymbol = false;
// }

const ID = "__packrattle_cache_id";
let LazyId = 0;

export type LazyParser1 = string | RegExp | Parser<any>;
export type LazyParser2 = LazyParser1 | Array<LazyParser1>;
export type LazyParser = LazyParser2 | (() => LazyParser2);

/*
 * convert a "parser" into an actual Parser object.
 * - could be a lazy function that evaluates to a Parser
 * - could be a simple data type like regex that is "implicitly" a Parser
 *
 * if you'd like te cache the results of function evaluations, pass an empty object as `functionCache`.
 */
export function resolve(parser: LazyParser, functionCache: { [key: string]: LazyParser2 } = {}): Parser<any> {
  if (typeof parser == "function") {
    if (!parser[ID]) {
      // give every lazy parser an id so we can cache them.
      LazyId++;
      parser[ID] = LazyId.toString();
    }

    const id = parser[ID];
    if (functionCache[id]) {
      parser = functionCache[id];
    } else {
      parser = parser();
      functionCache[id] = parser;
    }
  }

  // implicits:
  if (typeof parser == "string") return simple.string(parser);
  if (parser instanceof RegExp) return simple.regex(parser);
  if (Array.isArray(parser)) return seq(...parser);

  if (!(parser instanceof Parser)) throw new Error("Unable to resolve parser: " + parser);
  return parser;
}
