import { packrattle, Parser, SuccessfulMatch } from "..";

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

  function ws<T>(p: Parser<T>): Parser<T> {
    return packrattle.seqIgnore(packrattle.regex(/\s+/), p).map(x => x[0]);
  }

  const number = ws(packrattle.regex(/\d+/)).map(m => parseInt(m[0], 10));
  const parens: Parser<any[]> = packrattle.seq(ws(packrattle.string("(")), () => expr, ws(packrattle.string(")")));
  const atom = packrattle.alt(number, parens.map(e => e[1]));
  const term = packrattle.reduce(ws(packrattle.alt("*", "/", "%")), atom, { first: x => x, next: binary });
  const expr = packrattle.reduce(ws(packrattle.alt("+", "-")), term, { first: x => x, next: binary });

  it("recognizes a number", () => {
    const rv = expr.execute("900");
    rv.match.should.eql(true);
    (rv as SuccessfulMatch<number>).value.should.eql(900);
  });

  it("recognizes addition", () => {
    const rv = expr.consume().execute("2 + 3") as SuccessfulMatch<Ast>;
    rv.match.should.eql(true);
    rv.value.should.eql({ op: "+", left: 2, right: 3 });
  });

  it("recognizes a complex expression", () => {
    const rv = expr.consume().execute("1 + 2 * 3 + 4 * (5 + 6)") as SuccessfulMatch<Ast>;
    rv.match.should.eql(true);
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
  });

  it("can add with reduce", () => {
    const num: Parser<number> = packrattle.regex(/\d+/).map(m => parseInt(m[0], 10));
    const expr: Parser<number> = packrattle.reduce(
      packrattle.string("+"),
      num,
      { first: n => n, next: (sum: number, op: string, n: number) => sum + n }
    );
    const rv = expr.consume().execute("2+3+4") as SuccessfulMatch<number>;
    rv.match.should.eql(true);
    rv.pos.should.equal(5);
    rv.value.should.equal(9);
  });

  it("csv", () => {
    const csv = packrattle.repeatSeparated(
      packrattle.regex(/,/),
      packrattle.regex(/([^,]*)/).map(m => m[0])
    );
    const rv = csv.consume().execute("this,is,csv") as SuccessfulMatch<string[]>;
    rv.match.should.eql(true);
    rv.value.should.eql([ "this", "is", "csv" ]);
  });

  it("parses alternatives in priority (left to right) order", () => {
    const abc = packrattle.string("abc");
    const wordOrSep = packrattle.alt(packrattle.regex(/\s+/), packrattle.regex(/\S+/)).map(m => ({ word: m[0] }));
    const line = packrattle.repeat(packrattle.alt(abc, wordOrSep));
    const rv = line.consume().execute("abcabc def") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    rv.value.should.eql([ "abc", "abc", { word: " " }, { word: "def" } ]);
  });

  it("obeys leftmost/depth precedence in the face of ambiguity", () => {
    const expr = packrattle.repeat(
      packrattle.alt(
        packrattle.repeat(packrattle.alt("++", "--"), { min: 1 }),
        packrattle.regex(/\S+/).map(m => m[0]),
        packrattle.regex(/\s+/).map(() => "*")
      )
    );
    let rv = expr.consume().execute("++--") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    rv.value.should.eql([ [ "++", "--" ] ]);
    rv = expr.consume().execute("++y++ --++ ++") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    rv.value.should.eql([ [ "++" ], "y++", "*", [ "--", "++" ], "*", [ "++" ] ]);
  });
});
