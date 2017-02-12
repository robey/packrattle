import { fail, success } from "./matcher";
import { Parser } from "./parser";

/*
 * simple "building block" parsers.
 */
export class Simple {
  // matches the end of the string.
  end(): Parser<any, null> {
    const parser: Parser<any, null> = new Parser<any, null>("end", { cacheable: true }, children => (stream, index) => {
      return index == stream.length ? success(index, index, null) : fail(index, parser);
    });
    return parser;
  }

    // never matches anything.
  reject(): Parser<any, null> {
    const parser: Parser<any, null> = new Parser<any, null>(
      "reject",
      { cacheable: true },
      children => (stream, index) => fail(index, "rejected")
    );
    return parser;
  }

  // always matches without consuming input and yields the given value.
  succeed<T>(value: T): Parser<any, T> {
    return new Parser<any, T>("succeed", { cacheable: true }, children => (stream, index) => {
      return success(index, index, value);
    });
  }

  // matches a literal string.
  matchString(s: string): Parser<string, string> {
    const len = s.length;
    const parser: Parser<string, string> = new Parser<string, string>(
      "string",
      { cacheable: true, describe: () => `'${s}'` },
      children => {
        return (stream, index) => {
          const segment = stream.slice(index, index + len);
          return segment == s ? success(index, index + len, s) : fail(index, parser);
        };
      }
    );
    return parser;
  }

  // matches a regex.
  matchRegex(r: RegExp): Parser<string, RegExpExecArray> {
    const i = r.ignoreCase ? "i" : "";
    const m = r.multiline ? "m" : "";
    const source = r.source[0] == "^" ? r.source : ("^" + r.source);
    const r2 = new RegExp(source, i + m);
    const parser: Parser<string, RegExpExecArray> = new Parser<string, RegExpExecArray>(
      "regex",
      { cacheable: true, describe: () => r.toString() },
      children => {
        return (stream, index) => {
          const m = r2.exec(stream.slice(index) as string);
          return m ? success(index, index + m[0].length, m) : fail(index, parser);
        };
      }
    );
    return parser;
  }
}

export const simple = new Simple();
