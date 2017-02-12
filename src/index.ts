export { Match, MatchFailure, MatchSuccess } from "./matcher";
// export { newParser, Parser } from "./packrattle/parser";
export { PriorityQueue } from "./priority_queue";
export { PromiseSet } from "./promise_set";
// export { Line, Span } from "./packrattle/span";

// need to do in two parts, so tsc understands that the simple/combo parsers below are of known type.
import { Parser } from "./parser";
export { Parser };

// import { simple } from "./packrattle/simple";
// import { alt, chain, check, not, optional, optionalOr, repeat, RepeatOptions, seq } from "./packrattle/combiners";
// import { reduce, ReduceOptions, repeatIgnore, repeatSeparated, seqIgnore } from "./packrattle/convenience";
// import { resolve } from "./packrattle/resolve";

// export { ReduceOptions, RepeatOptions };

import { simple } from "./simple";
const end = simple.end();
const matchRegex = simple.matchRegex;
const matchString = simple.matchString;
const reject = simple.reject();
const succeed = simple.succeed;
export { end, matchRegex, matchString, reject, succeed };

export { chain, seq } from "./combiners";

// const packrattle = {
//   end: simple.end(),
//   reject: simple.reject(),
//   succeed: simple.succeed,
//   string: simple.string,
//   regex: simple.regex,
//
//   alt,
//   build: resolve,
//   chain,
//   check,
//   not,
//   optional,
//   optionalOr,
//   reduce,
//   repeat,
//   repeatIgnore,
//   repeatSeparated,
//   seq,
//   seqIgnore
// };
