import { alt, repeat } from "./combiners";
import { fail, mergeSpan, Span, success } from "./matcher";
import { Parser } from "./parser";
import { simple } from "./simple";

/*
 * Tokens must come from a typescript enum or similar (name -> number) map.
 * Each token is represented by a number, and the enum object is used to
 * convert the numbers into strings for debug/display.
 *
 * You can create a typescript enum in raw js by doing something like:
 *
 *     // same as: enum Token { Identifier = 4 }
 *     Token[Token["Identifier"] = 4] = "Identifier";
 *
 * Tokens < 0 are reserved for internal use.
 */

const TOKEN_WHITESPACE = -1;

// the general type of typescript enums
export interface Enumish {
  [id: number]: string;
}

/*
 * A token has an id (usually an enum, or a number in raw js), a span of
 * text that it covers, and optionally a value (usually the parsed form of
 * the span of text).
 */
export class Token {
  // we track the Enumish too, for debugging.
  constructor(public tokens: Enumish, public id: number, public span: Span, public value?: string) {
    // pass
  }

  toString(): string {
    if (this.tokens[this.id] === undefined) {
      switch (this.id) {
        case TOKEN_WHITESPACE: return "<whitespace>";
        default: return "?";
      }
    }

    if (this.value === undefined || this.value == null) {
      return this.tokens[this.id];
    }
    return this.tokens[this.id] + "(" + this.value.toString() + ")";
  }

  toStringWithSpan(): string {
    return this.toString() + this.span.toString();
  }

  inspect(): string {
    return this.toStringWithSpan();
  }
}


export interface TokenRules {
  // table of all tokens, so we can print their names for debugging
  tokens: Enumish;

  // list of regex to drop completely (usually whitespace)
  ignore?: RegExp[];

  // list of literal strings (in priority order) to turn into literal tokens
  strings?: [ string, number ][];

  // list of regex matchers that will generate tokens
  regex?: TokenRegexRule[];

  // arbitrary parsers are ok too
  parsers?: Parser<string, Token>[];

  // if present, catch unparsable strings and convert them to this token:
  fallback?: number;
}


export interface TokenRegexRule {
  // token id
  token: number;

  // what to match
  regex: RegExp;

  // a function that will convert the match object to a value
  value?: (match: RegExpExecArray) => string;
}


/*
 * A tokenizer parses a stream of tokens from a string.
 */
export function makeTokenizer(rules: TokenRules): Parser<string, Token[]> {
  // would be nice to merge all ignores into a single regex, but js makes that difficult.
  const ignore = (rules.ignore || []).map(r => {
    return simple.matchRegex(r).map((m, span) => new Token(rules.tokens, TOKEN_WHITESPACE, span));
  });
  const strings = (rules.strings || []).map(([ s, id ]) => {
    return simple.matchString(s).map((m, span) => new Token(rules.tokens, id, span, s));
  });

  const regexes = (rules.regex || []).map(rule => {
    // build a function out of rule.value if it's not already.
    return simple.matchRegex(rule.regex).map((m, span) => {
      return new Token(rules.tokens, rule.token, span, rule.value ? rule.value(m) : m[0]);
    });
  });

  const fallback = (rules.fallback === undefined) ?
    [] :
    [ simple.matchRegex(/./).map((m, span) => new Token(rules.tokens, rules.fallback || 0, span, m[0])) ];

  return repeat(alt(...(ignore.concat(rules.parsers || [], strings, regexes, fallback)))).map(tokenList => {
    // drop whitespace, and coalesce errors.
    const rv: Token[] = [];
    tokenList.forEach(t => {
      if (t.id == TOKEN_WHITESPACE) return;
      if (
        rules.fallback !== undefined &&
        t.id == rules.fallback &&
        rv.length > 0 &&
        rv[rv.length - 1].id == rules.fallback
      ) {
        const span = mergeSpan(rv[rv.length - 1].span, t.span);
        rv[rv.length - 1] = new Token(rules.tokens, t.id, span, (rv[rv.length - 1].value || "") + (t.value || ""));
      } else {
        rv.push(t);
      }
    });
    return rv;
  });
}

// matches a literal string.
export function matchToken(tokens: Enumish, id: number): Parser<Token, Token> {
  const parser: Parser<Token, Token> = new Parser<Token, Token>(
    "token",
    { cacheable: true, describe: () => `Token(${tokens[id]})` },
    children => {
      return (stream, index) => {
        return stream[index].id == id ? success(index, index + 1, stream[index]) : fail(index, parser);
      };
    }
  );
  return parser;
}
