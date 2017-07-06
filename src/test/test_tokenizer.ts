import { alt, Tokenizer, seq } from "../";

import "should";
import "source-map-support/register";

enum TokenType {
  NUMBER,
  OPAREN,
  CPAREN,
  GE,
  GREATER,
  BIND,
  Z,
  UNKNOWN
}

describe("makeTokenizer", () => {
  it("simple", () => {
    const t = new Tokenizer(TokenType, {
      strings: [
        [ "(", TokenType.OPAREN ],
        [ ")", TokenType.CPAREN ],
      ],
      regex: [
        { token: TokenType.NUMBER, regex: /\d+/, value: m => m[0] }
      ]
    });

    const tokens = t.parser.run("34(9)");
    tokens.map(t => t.toString()).join(",").should.eql("NUMBER(34),OPAREN((),NUMBER(9),CPAREN())");
    (() => t.parser.run("(3)!")).should.throw(/end/);
  });

  it("strings in order", () => {
    const t = new Tokenizer(TokenType, {
      strings: [
        [ ">=", TokenType.GE ],
        [ ">", TokenType.GREATER ],
        [ "=", TokenType.BIND ]
      ],
      regex: [
        { token: TokenType.NUMBER, regex: /\d+/, value: m => m[0] }
      ]
    });

    t.parser.run("34>9").map(t => t.toString()).join(",").should.eql("NUMBER(34),GREATER(>),NUMBER(9)");
    t.parser.run("34>=9").map(t => t.toString()).join(",").should.eql("NUMBER(34),GE(>=),NUMBER(9)");
  });

  it("skips whitespace", () => {
    const t = new Tokenizer(TokenType, {
      ignore: [ /\s+/ ],
      regex: [
        { token: TokenType.NUMBER, regex: /\d+/, value: m => m[0] }
      ]
    });

    t.parser.run("34 9").map(t => t.toString()).join(",").should.eql("NUMBER(34),NUMBER(9)");
    t.parser.run(" 34   9\t").map(t => t.toString()).join(",").should.eql("NUMBER(34),NUMBER(9)");
  });

  it("accrues errors", () => {
    const t = new Tokenizer(TokenType, {
      ignore: [ /\s+/ ],
      regex: [
        { token: TokenType.NUMBER, regex: /\d+/, value: m => m[0] }
      ],
      fallback: TokenType.UNKNOWN
    });

    t.parser.run("34 ? 9").map(t => t.toStringWithSpan()).join(",").should.eql(
      "NUMBER(34)[0...2],UNKNOWN(?)[3...4],NUMBER(9)[5...6]"
    );
    t.parser.run("34 ?? 9").map(t => t.toStringWithSpan()).join(",").should.eql(
      "NUMBER(34)[0...2],UNKNOWN(??)[3...5],NUMBER(9)[6...7]"
    );
  });

  it("parses tokens", () => {
    const t = new Tokenizer(TokenType, {
      strings: [
        [ "(", TokenType.OPAREN ],
        [ ")", TokenType.CPAREN ],
        [ "z", TokenType.Z ]
      ],
      regex: [
        { token: TokenType.NUMBER, regex: /\d+/, value: m => m[0] }
      ]
    });

    const p = seq(
      t.match(TokenType.OPAREN),
      alt(t.match(TokenType.NUMBER), t.match(TokenType.Z)),
      t.match(TokenType.CPAREN)
    ).map(list => {
      return list[1].id == TokenType.Z ? "z" : list[1].value;
    });

    p.run(t.parser.run("(34)")).should.eql("34");
    p.run(t.parser.run("(z)")).should.eql("z");
    (() => p.run(t.parser.run("((34)"))).should.throw(/Expected NUMBER or 'z'/);
  });
});
