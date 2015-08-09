"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

function matchSpan(m) {
  const span = m.state.span()
  return [ m.value, span.start, span.end ];
}

describe("Parser.repeat", () => {
  it("0 or more", () => {
    const p = pr.repeat("hi");
    matchSpan(p.consume().execute("")).should.eql([ [], 0, 1 ]);
    matchSpan(p.consume().execute("hi")).should.eql([ [ "hi" ], 0, 2 ]);
    matchSpan(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
  });

  it("2 or 3", () => {
    const p = pr.repeat("hi", { min: 2, max: 3 });
    (() => p.run("hi")).should.throw(/'hi'\{2, 3}/);
    matchSpan(p.consume().execute("hihi")).should.eql([ [ "hi", "hi" ], 0, 4 ]);
    matchSpan(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
    (() => p.run("hihihihi")).should.throw(/end/);
  });

  it("isn't always greedy", () => {
    const p = pr([ pr.repeat("hi"), "hip" ]);
    p.run("hihihip").should.eql([ [ "hi", "hi" ], "hip" ]);
  });

  it("nested", () => {
    const p = pr([ pr.repeat([ "hi", pr.repeat("!") ]), /[x]+/ ]).map(match => match[0]);
    const rv = p.consume().execute("hi!hi!!!hix");
    rv.state.pos.should.equal(11);
    rv.value.should.eql([
      [ "hi", [ "!" ] ],
      [ "hi", [ "!", "!", "!" ] ],
      [ "hi", [] ]
    ]);
  });

  it("with whitespace ignoring", () => {
    const p = pr([ pr.repeatIgnore("hi", /\s+/), "!" ]).map(match => match[0]);
    matchSpan(p.execute("hi  hihi!")).should.eql([ [ "hi", "hi", "hi" ], 0, 9 ]);
  });

  it("and honors nested drops", () => {
    let p = pr("123").drop().repeat();
    let rv = p.execute("123123");
    rv.ok.should.equal(true);
    rv.value.should.eql([]);
    p = pr("123").drop().times(2);
    rv = p.execute("123123");
    rv.ok.should.equal(true);
    rv.value.should.eql([]);
  });

  it("but throws an error if there's no progress", () => {
    const p = pr.repeat("");
    (() => p.execute("?")).should.throw(/isn't making progress/);
  });

  it("repeatSeparated too", () => {
    const p = pr.repeatSeparated(pr(/\d+/).map(m => m[0]), ",", { min: 1, max: 3 }).consume();
    matchSpan(p.execute("3")).should.eql([ [ "3" ], 0, 1 ]);
    (() => p.run("3,")).should.throw(/end/);
    matchSpan(p.execute("3,4")).should.eql([ [ "3", "4" ], 0, 3 ]);
    matchSpan(p.execute("3,40")).should.eql([ [ "3", "40" ], 0, 4 ]);
    matchSpan(p.execute("3,40,5")).should.eql([ [ "3", "40", "5" ], 0, 6 ]);
    (() => p.run("3,40,5,6")).should.throw(/end/);
  });

  it("aborts if a repeating phrase aborts", () => {
    const ws = pr(/\s*/).drop();
    const operand = pr(/\d+/).onMatch(m => m[0]).onFail("Expected operand");
    const operator = pr([ ws, pr.alt("+", "-"), ws ]).commit().onMatch(m => m[0]);
    const algebra = pr.reduce(operand, operator, {
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
      error.span.end.should.eql(4);
    }

    try {
      algebra.run("3 + 5 +");
      throw new Error("nope");
    } catch (error) {
      error.message.should.eql("Expected operand");
      error.span.start.should.eql(7);
      error.span.end.should.eql(8);
    }
  });
});
