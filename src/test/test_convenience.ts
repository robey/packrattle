import {
  alt, matchRegex, matchString, MatchSuccess, Parser, reduce, repeatIgnore, repeatSeparated, seq, seqIgnore, Span
} from "..";

import "should";
import "source-map-support/register";

function withSpan<A>(value: A, span: Span): [ A, number, number ] {
  return [ value, span.start, span.end ];
}

describe("convenience", () => {
  describe("seqIgnore", () => {
    it("basic", () => {
      const p = seqIgnore(
        matchRegex(/\s+/),
        matchString("abc"),
        matchString("xyz"),
        matchString("ghk")
      );

      p.run("abcxyzghk").should.eql([ "abc", "xyz", "ghk" ]);
      p.run("   abc xyz\tghk").should.eql([ "abc", "xyz", "ghk" ]);
    });

    it("skips whitespace lazily", () => {
      let hits = 0;
      const p = seqIgnore(
        () => {
          hits += 1;
          return matchRegex(/\s+/);
        },
        () => {
          hits += 1;
          return matchString("abc");
        },
        () => {
          hits += 1;
          return matchString("xyz");
        },
        () => {
          hits += 1;
          return matchString("ghk");
        }
      );

      hits.should.eql(0);
      const rv = p.execute("   abc xyz\tghk");
      hits.should.eql(4);
      (rv instanceof MatchSuccess).should.eql(true);
      if (rv instanceof MatchSuccess) {
        rv.value.should.eql([ "abc", "xyz", "ghk" ]);
      }

      p.run(" abc  xyzghk").should.eql([ "abc", "xyz", "ghk" ]);
      hits.should.eql(4);
    });
  });

  it("repeatIgnore", () => {
    const p = seq(
      repeatIgnore(matchRegex(/\s+/), matchString("hi")),
      matchString("!")
    ).map(match => match[0]);
    const match = p.execute("hi  hihi!");
    (match instanceof MatchSuccess).should.eql(true);
    if (match instanceof MatchSuccess) {
      match.span.start.should.eql(0);
      match.span.end.should.eql(9);
      match.value.should.eql([ "hi", "hi", "hi" ]);
    }
  });

  describe("repeatSeparated", () => {
    it("basic", () => {
      const p = repeatSeparated(matchString(","), matchString("hi"));
      p.map(withSpan).run("hi,hi,hi").should.eql([ [ "hi", "hi", "hi" ], 0, 8 ])
    });

    it("min/max", () => {
      const p = repeatSeparated(
        matchString(","),
        matchRegex(/\d+/).map(m => m[0]),
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
      const p = repeatSeparated(
        matchRegex(/\s*,\s*/),
        matchRegex(/\d+/).map(x => x[0])
      );

      it("matches one", () => {
        const rv = p.consume().execute("98");
        (rv instanceof MatchSuccess).should.eql(true);
        if (rv instanceof MatchSuccess) {
          rv.span.end.should.equal(2);
          rv.value.should.eql([ "98" ]);
        }
      });

      it("matches several", () => {
        const rv = p.consume().execute("98, 99 ,100");
        (rv instanceof MatchSuccess).should.eql(true);
        if (rv instanceof MatchSuccess) {
          rv.span.end.should.equal(11);
          rv.value.should.eql([ "98", "99", "100" ]);
        }
      });

      it("map", () => {
        const p2 = p.map(x => x.map(n => parseInt(n, 10)));
        const rv = p2.consume().execute("98, 99 ,100");
        (rv instanceof MatchSuccess).should.eql(true);
        if (rv instanceof MatchSuccess) {
          rv.span.end.should.equal(11);
          rv.value.should.eql([ 98, 99, 100 ]);
        }
      });

      it("ignores trailing separators", () => {
        const p2 = seq(p, matchRegex(/[^\d]+/).map(m => m[0]));
        const rv = p2.consume().execute("98, wut");
        (rv instanceof MatchSuccess).should.eql(true);
        if (rv instanceof MatchSuccess) {
          rv.span.end.should.equal(7);
          rv.value.should.eql([ [ "98" ], ", wut" ]);
        }
      });
    });
  });

  describe("reduce", () => {
    it("basic", () => {
      const p: Parser<string, string> = reduce(
        matchRegex(/\d+/),
        matchRegex(/[a-z]+/),
        {
          first: m => m[0],
          next: (sum, num, word) => sum + "-" + num[0] + "-" + word[0]
        }
      );
      p.run("a4x6bc900xyz").should.eql("a-4-x-6-bc-900-xyz");
    });

    it("aborts if a repeating phrase aborts", () => {
      const ws = matchRegex(/\s*/);
      const operand = matchRegex(/\d+/).map(m => m[0]).mapError("Expected operand");
      const operator = seq(
        ws,
        alt(matchString("+"), matchString("-")),
        ws
      ).map(m => m[1]);
      const algebra: Parser<string, any> = reduce(operator, operand, {
        first: x => x,
        next: (left, op, right) => ({ binary: op, left, right })
      });

      algebra.run("3 + 2").should.eql({ binary: "+", left: "3", right: "2" });

      try {
        algebra.run("3 +");
        throw new Error("nope");
      } catch (error) {
        error.message.should.eql("Expected end");
        error.span.start.should.eql(1);
        error.span.end.should.eql(1);
      }

      try {
        algebra.run("3 + 5 +");
        throw new Error("nope");
      } catch (error) {
        error.message.should.eql("Expected end");
        error.span.start.should.eql(5);
        error.span.end.should.eql(5);
      }
    });
  });
});
