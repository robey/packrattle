import { alt, repeat } from "./combiners";
import { fail, mergeSpan, Span, success } from "./matcher";
import { Parser } from "./parser";
import { simple } from "./simple";


// the general type of typescript enums
export interface Enumish {
  [id: number]: string;
}

const WHITESPACE = -1;

export class TokenType {
  shortName: string;

  constructor(public tokenizer: Tokenizer, public id: number, public name: string) {
    this.shortName = name;
  }
}

/*
 * A token matches a TokenType, a span of text that it covers, and optionally
 * a value (usually the parsed form of the span of text).
 */
export class Token {
  // we track the Enumish too, for debugging.
  constructor(public tokenType: TokenType, public span: Span, public value: string) {
    // pass
  }

  toString(): string {
    if (this.value === undefined || this.value == null) {
      return this.tokenType.name;
    }
    return this.tokenType.name + "(" + this.value.toString() + ")";
  }

  toStringWithSpan(): string {
    return this.toString() + this.span.toString();
  }

  inspect(): string {
    return this.toStringWithSpan();
  }
}

export interface TokenRules {
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


export class Tokenizer {
  public tokenTypes: TokenType[] = [];
  public parser: Parser<string, Token[]>;

  constructor(enumLike: Enumish, public rules: TokenRules) {
    // really awkward way to iterate over the enum:
    Object.keys(enumLike).filter(key => key.match(/^\d+$/)).forEach(key => {
      const id = parseInt(key, 10);
      this.tokenTypes[id] = new TokenType(this, id, enumLike[id]);
    })
    this.tokenTypes[WHITESPACE] = new TokenType(this, WHITESPACE, "<whitespace>");

    // give friendly names to any tokens that are just string matches
    (this.rules.strings || []).forEach(([ s, id ]) => {
      this.tokenTypes[id].shortName = "'" + s + "'";
    });

    this.parser = this.makeParser();
  }

  /*
   * generate a token at a span, in case you want to forge some tokens.
   */
  token(id: number, span: Span, value: string): Token {
    return new Token(this.tokenTypes[id], span, value);
  }

  private makeParser(): Parser<string, Token[]> {
    // would be nice to merge all ignores into a single regex, but js makes that difficult.
    const ignore = (this.rules.ignore || []).map(r => {
      return simple.matchRegex(r).map((m, span) => new Token(this.tokenTypes[WHITESPACE], span, m[0]));
    });
    // FIXME: shouldn't this prioritize long strings before short?
    const strings = (this.rules.strings || []).map(([ s, id ]) => {
      return simple.matchString(s).map((m, span) => new Token(this.tokenTypes[id], span, s));
    });

    const regexes = (this.rules.regex || []).map(rule => {
      return simple.matchRegex(rule.regex).map((m, span) => {
        return new Token(this.tokenTypes[rule.token], span, rule.value ? rule.value(m) : m[0]);
      });
    });

    let fallback: Parser<string, Token>[] = [];
    const fallbackRule = this.rules.fallback;
    if (fallbackRule !== undefined) {
      fallback.push(simple.matchRegex(/./).map((m, span) => new Token(this.tokenTypes[fallbackRule], span, m[0])));
    }

    return repeat(alt(...(ignore.concat(this.rules.parsers || [], strings, regexes, fallback)))).map(tokenList => {
      // drop whitespace, and coalesce errors.
      const rv: Token[] = [];
      tokenList.forEach(t => {
        if (t.tokenType.id == WHITESPACE) return;
        if (
          this.rules.fallback !== undefined &&
          t.tokenType.id == this.rules.fallback &&
          rv.length > 0 &&
          rv[rv.length - 1].tokenType.id == this.rules.fallback
        ) {
          const span = mergeSpan(rv[rv.length - 1].span, t.span);
          rv[rv.length - 1] = new Token(t.tokenType, span, (rv[rv.length - 1].value || "") + (t.value || ""));
        } else {
          rv.push(t);
        }
      });
      return rv;
    });
  }

  match(id: number): Parser<Token, Token> {
    return this.matchOneOf(id);
  }

  matchOneOf(...ids: number[]): Parser<Token, Token> {
    const p: Parser<Token, Token> = new Parser<Token, Token>(
      "token",
      { cacheable: true, describe: () => ids.map(id => this.tokenTypes[id].shortName).join(" or ") },
      children => {
        return (stream, index) => {
          if (index < 0 || index >= stream.length) return fail(index, p);
          return ids.indexOf(stream[index].tokenType.id) >= 0 ?
            success(index, index + 1, stream[index]) :
            fail(index, p);
        };
      }
    );
    return p;
  }
}
