export { Match, MatchFailure, MatchSuccess, Span } from "./matcher";
export { PriorityQueue } from "./priority_queue";
export { PromiseSet } from "./promise_set";
// export { Line, Span } from "./packrattle/span";

// need to do in two parts, so tsc understands that the simple/combo parsers below are of known type.
import { Parser, parser } from "./parser";
export { Parser, parser };

// import { alt, chain, check, not, optional, optionalOr, repeat, RepeatOptions, seq } from "./packrattle/combiners";
// import { reduce, ReduceOptions, repeatIgnore, repeatSeparated, seqIgnore } from "./packrattle/convenience";

// export { ReduceOptions, RepeatOptions };

import { simple } from "./simple";
const end = simple.end();
const matchRegex = simple.matchRegex;
const matchString = simple.matchString;
const reject = simple.reject();
const succeed = simple.succeed;
export { end, matchRegex, matchString, reject, succeed };

export { alt, chain, check, not, optional, optionalOr, seq } from "./combiners";

// const packrattle = {
//   check,
//   not,
//   reduce,
//   repeat,
//   repeatIgnore,
//   repeatSeparated,
//   seqIgnore
// };
