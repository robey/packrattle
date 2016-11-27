export { FailedMatch, Match, SuccessfulMatch } from "./packrattle/match";
export { newParser, Parser } from "./packrattle/parser";
export { PriorityQueue } from "./packrattle/priority_queue";
export { PromiseSet } from "./packrattle/promise_set";
export { Line, Span } from "./packrattle/span";

import { Parser } from "./packrattle/parser";
import { simple } from "./packrattle/simple";
import { alt, chain, check, not, optional, optionalOr, repeat, RepeatOptions, seq } from "./packrattle/combiners";
import { reduce, ReduceOptions, repeatIgnore, repeatSeparated, seqIgnore } from "./packrattle/convenience";
import { resolve } from "./packrattle/resolve";

export { ReduceOptions, RepeatOptions };

// import resolve from "./packrattle/resolve";
//
// resolve.build = resolve;
//
// // for backward compatibility, put everything on the default exported function.
//
// import * as combiners from "./packrattle/combiners";
// for (const k in combiners) resolve[k] = combiners[k];
//
// import * as parser from "./packrattle/parser";
// for (const k in parser) resolve[k] = parser[k];
//
// import * as parser_state from "./packrattle/parser_state";
// for (const k in parser_state) resolve[k] = parser_state[k];
//
// import PriorityQueue from "./packrattle/priority_queue";
// resolve.PriorityQueue = PriorityQueue;
//
// import * as simple from "./packrattle/simple";
// for (const k in simple) resolve[k] = simple[k];
//
// // export "default": babel can't do this anymore.
// module.exports = resolve;

const packrattle = {
  end: simple.end(),
  reject: simple.reject(),
  succeed: simple.succeed,
  string: simple.string,
  regex: simple.regex,

  alt,
  build: resolve,
  chain,
  check,
  not,
  optional,
  optionalOr,
  reduce,
  repeat,
  repeatIgnore,
  repeatSeparated,
  seq,
  seqIgnore
};

export { packrattle };
