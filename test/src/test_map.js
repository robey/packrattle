"use strict";

import pr, { string } from "../../lib";

require("should");
require("source-map-support").install();

describe("Parser.map", () => {
  it("transforms a match", () => {
    const p = pr("hello").map((value, state) => [ value.toUpperCase(), state.start, state.end ]);
    (() => p.run("cat")).should.throw(/hello/);
    p.execute("hellon").value.should.eql([ "HELLO", 0, 5 ]);
  });

  it("transforms a match into a constant", () => {
    const p = pr("hello").map("yes");
    const rv = p.execute("hello");
    rv.value.should.eql("yes");
    rv.state.pos.should.equal(5);
  });

  it("transforms a match into a failure on exception", () => {
    const p = pr("hello").map(value => {
      throw new Error("utter failure");
    });
    (() => p.run("hello")).should.throw(/utter failure/);
  });

  it("onFail", () => {
    const p = string("hello").onFail("Try a greeting.");
    (() => p.run("cat")).should.throw("Try a greeting.");
    p.execute("hellon").value.should.eql("hello");
  });


  // ----- monad tests

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
    const p1 = pr.succeed(a).map(f);
    const p2 = f(a);
    shouldBeIdentical(p1, p2, "foobar");
  });

  it("satisfies monad right identity", () => {
    const p1 = m.map(pr.succeed);
    const p2 = m;
    shouldBeIdentical(p1, p2, "foo");
  });

  it("satisfies monad associativity", () => {
    const p1 = m.map(f).map(g);
    const p2 = m.map(s => f(s).map(g));
    shouldBeIdentical(p1, p2, "foofoobarfoobarbaz");
  });

  it("fails if a nested parser fails", () => {
    const p = m.map(() => pr.reject.onFail("no foo"));
    const rv = p.execute("foo");
    rv.ok.should.equal(false);
    rv.value.should.equal("no foo");
  });
});
