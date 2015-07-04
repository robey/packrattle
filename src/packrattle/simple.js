"use strict";

const parser = require("./parser");

/*
 * simple "building block" parsers.
 */

// matches the end of the string.
const end = parser.newParser("end", (state, results) => {
  results.add(state.pos == state.text.length ? state.success() : state.failure());
});

// never matches anything.
const reject = parser.newParser("reject", (state, results) => {
  results.add(state.failure("rejected"));
});

// always matches without consuming input and yields the given value.
function succeed(value) {
  return parser.newParser("succeed", (state, results) => {
    results.add(state.success(value));
  });
}


exports.end = end;
exports.reject = reject;
exports.succeed = succeed;
