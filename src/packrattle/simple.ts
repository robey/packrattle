import { newParser, Parser } from "./parser";

/*
 * simple "building block" parsers.
 */
export class Simple {
  // matches the end of the string.
  end(): Parser<null> {
    return newParser<null>("end", { cacheable: true }, (state, children) => {
      state.result.add(state.pos == state.text.length ? state.success(null) : state.failure());
    });
  }

  // never matches anything.
  reject(): Parser<null> {
    return newParser<null>("reject", { cacheable: true }, (state, children) => {
      state.result.add(state.failure("rejected"));
    });
  }

  // always matches without consuming input and yields the given value.
  succeed<T>(value: T): Parser<T> {
    return newParser<T>("succeed", { cacheable: true }, (state, children) => {
      state.result.add(state.success(value));
    });
  }

  // matches a literal string.
  string(s: string): Parser<string> {
    const len = s.length;
    return newParser<string>("string", { cacheable: true, describe: () => `'${s}'` }, (state, children) => {
      const segment = state.text.slice(state.pos, state.pos + len);
      state.result.add(segment == s ? state.success(segment, len) : state.failure());
    });
  }

  // matches a regex.
  regex(r: RegExp): Parser<RegExpExecArray> {
    const i = r.ignoreCase ? "i" : "";
    const m = r.multiline ? "m" : "";
    const source = r.source[0] == "^" ? r.source : ("^" + r.source);
    const r2 = new RegExp(source, i + m);
    return newParser<RegExpExecArray>("regex", { cacheable: true, describe: () => r.toString() }, (state, children) => {
      const m = r2.exec(state.text.slice(state.pos));
      state.result.add(m ? state.success(m, m[0].length) : state.failure());
    });
  }
}

export const simple = new Simple();
