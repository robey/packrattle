import {
  alt, matchRegex, matchString, MatchSuccess, Parser, reduce, repeat, repeatSeparated, seq, seqIgnore
} from "..";

import "should";
import "source-map-support/register";

interface Ast {
  op: string;
  left: number | Ast;
  right: number | Ast;
}

describe("Parser example", () => {
  function binary(left: number | Ast, op: string, right: number | Ast): Ast {
    return { op, left, right } as Ast;
  }

  function ws<T>(p: Parser<string, T>): Parser<string, T> {
    return seqIgnore(matchRegex(/\s+/), p).map(x => x[0]);
  }

  const number = ws(matchRegex(/\d+/)).map(m => parseInt(m[0], 10));
  const parens: Parser<string, any[]> = seq(ws(matchString("(")), () => expr, ws(matchString(")")));
  const atom = alt(number, parens.map(e => e[1]));
  const term = reduce(
    ws(alt(matchString("*"), matchString("/"), matchString("%"))),
    atom,
    { first: x => x, next: binary }
  );
  const expr = reduce(ws(alt(matchString("+"), matchString("-"))), term, { first: x => x, next: binary });

  it("recognizes a number", () => {
    const rv = expr.execute("900");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql(900);
    }
  });

  it("recognizes addition", () => {
    const rv = expr.consume().execute("2 + 3");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql({ op: "+", left: 2, right: 3 });
    }
  });

  it("recognizes a complex expression", () => {
    const rv = expr.consume().execute("1 + 2 * 3 + 4 * (5 + 6)");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql({
        op: "+",
        left: {
          op: "+",
          left: 1,
          right: {
            op: "*",
            left: 2,
            right: 3
          }
        },
        right: {
          op: "*",
          left: 4,
          right: {
            op: "+",
            left: 5,
            right: 6
          }
        }
      });
    }
  });

  it("can add with reduce", () => {
    const num: Parser<string, number> = matchRegex(/\d+/).map(m => parseInt(m[0], 10));
    const expr: Parser<string, number> = reduce(
      matchString("+"),
      num,
      { first: n => n, next: (sum: number, op: string, n: number) => sum + n }
    );
    const rv = expr.consume().execute("2+3+4");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.end.should.equal(5);
      rv.value.should.equal(9);
    }
  });

  it("csv", () => {
    const csv = repeatSeparated(
      matchRegex(/,/),
      matchRegex(/([^,]*)/).map(m => m[0])
    );
    const rv = csv.consume().execute("this,is,csv");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql([ "this", "is", "csv" ]);
    }
  });

  it("parses alternatives in priority (left to right) order", () => {
    const abc = matchString("abc");
    const wordOrSep = alt(matchRegex(/\s+/), matchRegex(/\S+/)).map(m => ({ word: m[0] }));
    const line = repeat(alt<string, string | { word: string }>(abc, wordOrSep));

    const fs = require("fs");
    fs.writeFileSync("test.dot", line.toDot());
    const makeDot = (text: string) => fs.writeFileSync("work.dot", text);

    const rv = line.consume().execute("abcabc def", { makeDot, logger: console.log });
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql([ "abc", "abc", { word: " " }, { word: "def" } ]);
    }
  });

  it("obeys leftmost/depth precedence in the face of ambiguity", () => {
    const expr = repeat(
      alt<string, string | string[]>(
        repeat(alt(matchString("++"), matchString("--")), { min: 1 }),
        matchRegex(/\S+/).map(m => m[0]),
        matchRegex(/\s+/).map(() => "*")
      )
    );
    let rv = expr.consume().execute("++--");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql([ [ "++", "--" ] ]);
    }
    rv = expr.consume().execute("++y++ --++ ++");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql([ [ "++" ], "y++", "*", [ "--", "++" ], "*", [ "++" ] ]);
    }
  });
});
