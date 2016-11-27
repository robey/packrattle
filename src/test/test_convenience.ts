import { Match, packrattle, Span, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

function withSpan<A>(value: A, span: Span): [ A, number, number ] {
  return [ value, span.start, span.end ];
}

describe("convenience", () => {
  describe("seqIgnore", () => {
    it("basic", () => {
      const p = packrattle.seqIgnore(
        packrattle.regex(/\s+/),
        packrattle.string("abc"),
        packrattle.string("xyz"),
        packrattle.string("ghk")
      );

      p.run("abcxyzghk").should.eql([ "abc", "xyz", "ghk" ]);
      p.run("   abc xyz\tghk").should.eql([ "abc", "xyz", "ghk" ]);
    });

    it("skips whitespace lazily", () => {
      let hits = 0;
      const p = packrattle.seqIgnore(
        packrattle.build(() => {
          hits += 1;
          return packrattle.regex(/\s+/);
        }),
        packrattle.build(() => {
          hits += 1;
          return packrattle.string("abc");
        }),
        packrattle.build(() => {
          hits += 1;
          return packrattle.string("xyz");
        }),
        packrattle.build(() => {
          hits += 1;
          return packrattle.string("ghk");
        })
      );

      hits.should.eql(4);
      const rv = p.execute("   abc xyz\tghk") as SuccessfulMatch<string[]>;
      hits.should.eql(4);
      rv.match.should.eql(true);
      rv.value.should.eql([ "abc", "xyz", "ghk" ]);

      p.run(" abc  xyzghk").should.eql([ "abc", "xyz", "ghk" ]);
      hits.should.eql(4);
    });
  });

  it("repeatIgnore", () => {
    const p = packrattle.seq(
      packrattle.repeatIgnore(packrattle.regex(/\s+/), packrattle.string("hi")),
      "!"
    ).map(match => match[0]);
    const match = p.execute("hi  hihi!") as SuccessfulMatch<any[]>;
    match.startpos.should.eql(0);
    match.pos.should.eql(9);
    match.value.should.eql([ "hi", "hi", "hi" ]);
  });

  describe("repeatSeparated", () => {
    it("basic", () => {
      const p = packrattle.repeatSeparated(packrattle.string(","), packrattle.string("hi"));
      p.map(withSpan).run("hi,hi,hi").should.eql([ [ "hi", "hi", "hi" ], 0, 8 ])
    });

    it("min/max", () => {
      const p = packrattle.repeatSeparated(
        packrattle.string(","),
        packrattle.regex(/\d+/).map(m => m[0]),
        { min: 1, max: 3 }
      );
      p.map(withSpan).run("3").should.eql([ [ "3" ], 0, 1 ]);
      (() => p.run("3,")).should.throw(/end/);
      p.map(withSpan).run("3,4").should.eql([ [ "3", "4" ], 0, 3 ]);
      p.map(withSpan).run("3,40").should.eql([ [ "3", "40" ], 0, 4 ]);
      p.map(withSpan).run("3,40,5").should.eql([ [ "3", "40", "5" ], 0, 6 ]);
      (() => p.run("3,40,5,6")).should.throw(/end/);
    });

    describe("comma-separated numbers", () => {
      const p = packrattle.repeatSeparated(
        packrattle.regex(/\s*,\s*/),
        packrattle.regex(/\d+/).onMatch(x => x[0])
      );

      it("matches one", () => {
        const rv = p.consume().execute("98") as SuccessfulMatch<string[]>;
        rv.pos.should.equal(2);
        rv.value.should.eql([ "98" ]);
      });

      it("matches several", () => {
        const rv = p.consume().execute("98, 99 ,100") as SuccessfulMatch<string[]>;
        rv.pos.should.equal(11);
        rv.value.should.eql([ "98", "99", "100" ]);
      });

      it("map", () => {
        const p2 = p.onMatch(x => x.map(n => parseInt(n, 10)));
        const rv = p2.consume().execute("98, 99 ,100") as SuccessfulMatch<number[]>;
        rv.pos.should.equal(11);
        rv.value.should.eql([ 98, 99, 100 ]);
      });

      it("ignores trailing separators", () => {
        const p2 = packrattle.seq(p, packrattle.regex(/[^\d]+/).map(m => m[0]));
        const rv = p2.consume().execute("98, wut") as SuccessfulMatch<any[]>;
        rv.pos.should.equal(7);
        rv.value.should.eql([ [ "98" ], ", wut" ]);
      });
    });
  });

  describe("reduce", () => {
    it("basic", () => {
      const p = packrattle.reduce(
        packrattle.regex(/\d+/),
        packrattle.regex(/[a-z]+/),
        {
          first: m => m[0],
          next: (sum, num, word) => sum + "-" + num[0] + "-" + word[0]
        }
      );
      p.run("a4x6bc900xyz").should.eql("a-4-x-6-bc-900-xyz");
    });

    it("aborts if a repeating phrase aborts", () => {
      const ws = packrattle.regex(/\s*/);
      const operand = packrattle.regex(/\d+/).map(m => m[0]).onFail("Expected operand");
      const operator = packrattle.seq(
        ws,
        packrattle.alt(packrattle.string("+"), packrattle.string("-")),
        ws
      ).commit().map(m => m[1]);
      const algebra = packrattle.reduce(operator, operand, {
        first: x => x,
        next: (left, op, right) => ({ binary: op, left, right })
      });

      algebra.run("3 + 2").should.eql({ binary: "+", left: "3", right: "2" });

      try {
        algebra.run("3 +");
        throw new Error("nope");
      } catch (error) {
        error.message.should.eql("Expected operand");
        error.span.start.should.eql(3);
        error.span.end.should.eql(3);
      }

      try {
        algebra.run("3 + 5 +");
        throw new Error("nope");
      } catch (error) {
        error.message.should.eql("Expected operand");
        error.span.start.should.eql(7);
        error.span.end.should.eql(7);
      }
    });
  });
});
