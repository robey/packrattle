"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.onMatch", () => {
  it("transforms a match", () => {
    const p = pr("hello").onMatch((value, state) => [ value.toUpperCase(), state.start, state.end ]);
    (() => p.run("cat")).should.throw(/hello/);
    p.execute("hellon").value.should.eql([ "HELLO", 0, 5 ]);
  });

  it("transforms a match into a constant", () => {
    const p = pr("hello").onMatch("yes");
    const rv = p.execute("hello");
    rv.value.should.eql("yes");
    rv.state.pos.should.equal(5);
  });

  it("transforms a match into a failure on exception", () => {
    const p = pr("hello").onMatch(value => {
      throw new Error("utter failure");
    });
    (() => p.run("hello")).should.throw(/utter failure/);
  });

  const a = "foo";
  const m = pr("foo");
  const f = s => pr(s + "bar");
  const g = s => pr(s + "baz");

  function shouldBeIdentical(p1, p2, input) {
    const rv1 = p1.execute(input);
    const rv2 = p2.execute(input);
    rv1.ok.should.equal(true);
    rv2.ok.should.equal(true);
    rv1.value.should.equal(rv2.value);
  }

  it("satisfies monad left identity", () => {
    const p1 = pr.succeed(a).onMatch(f);
    const p2 = f(a);
    shouldBeIdentical(p1, p2, "foobar");
  });

  it("satisfies monad right identity", () => {
    const p1 = m.onMatch(pr.succeed);
    const p2 = m;
    shouldBeIdentical(p1, p2, "foo");
  });

  it("satisfies monad associativity", () => {
    const p1 = m.onMatch(f).onMatch(g);
    const p2 = m.onMatch(s => f(s).onMatch(g));
    shouldBeIdentical(p1, p2, "foofoobarfoobarbaz");
  });

  it("fails if a nested parser fails", () => {
    const p = m.onMatch(() => pr.reject.onFail("no foo"));
    const rv = p.execute("foo");
    rv.ok.should.equal(false);
    rv.value.should.equal("no foo");
  });
});
