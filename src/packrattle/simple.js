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

// matches a literal string.
function string(s) {
  const len = s.length;
  return parser.newParser(`'${s}'`, (state, results) => {
    const segment = state.text.slice(state.pos, state.pos + len);
    results.add(segment == s ? state.advance(len).success(segment) : state.failure());
  });
}


exports.end = end;
exports.reject = reject;
exports.string = string;
exports.succeed = succeed;
