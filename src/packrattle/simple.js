"use strict";

import { newParser } from "./parser";

/*
 * simple "building block" parsers.
 */

// matches the end of the string.
export const end = newParser("end", (state, results) => {
  results.add(state.pos == state.text.length ? state.success() : state.failure());
});

// never matches anything.
export const reject = newParser("reject", (state, results) => {
  results.add(state.failure("rejected"));
});

// always matches without consuming input and yields the given value.
export function succeed(value) {
  return newParser("succeed", (state, results) => {
    results.add(state.success(value));
  });
}

// matches a literal string.
export function string(s) {
  const len = s.length;
  return newParser("string", { cacheable: true, describe: `'${s}'` }, (state, results) => {
    const segment = state.text.slice(state.pos, state.pos + len);
    results.add(segment == s ? state.advance(len).success(segment) : state.failure());
  });
}

// matches a regex.
export function regex(r) {
  const i = r.ignoreCase ? "i" : "";
  const m = r.multiline ? "m" : "";
  const source = r.source[0] == "^" ? r.source : ("^" + r.source);
  const r2 = new RegExp(source, i + m);
  return newParser("regex", { cacheable: true, describe: r.toString() }, (state, results) => {
    const m = r2.exec(state.text.slice(state.pos));
    results.add(m ? state.advance(m[0].length).success(m) : state.failure());
  });
}
