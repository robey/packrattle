import { FailedMatch, packrattle, Parser, SuccessfulMatch } from "../";

import "should";
import "source-map-support/register";

describe("Parser.map", () => {
  it("transforms a match", () => {
    const p = packrattle.string("hello").map((value, state) => [ value.toUpperCase(), state.start, state.end ]);
    (() => p.run("cat")).should.throw(/hello/);
    p.run("hello").should.eql([ "HELLO", 0, 5 ]);
  });

  it("transforms a match into a constant", () => {
    const p = packrattle.string("hello").map("yes");
    const rv = p.execute("hello");
    rv.match.should.eql(true);
    (rv as SuccessfulMatch<string>).value.should.eql("yes");
    (rv as SuccessfulMatch<string>).pos.should.equal(5);
  });

  it("transforms a match into a failure on exception", () => {
    const p = packrattle.string("hello").map(_ => {
      throw new Error("utter failure");
    });
    (() => p.run("hello")).should.throw(/utter failure/);
  });

  it("onFail", () => {
    const p = packrattle.string("hello").onFail("Try a greeting.");
    (() => p.run("cat")).should.throw("Try a greeting.");
    p.run("hello").should.eql("hello");
  });


  // ----- monad tests

  const a = "foo";
  const m = packrattle.string("foo");
  const f = (s: string) => packrattle.string(s + "bar");
  const g = (s: string) => packrattle.string(s + "baz");

  function shouldBeIdentical<A, B>(p1: Parser<A>, p2: Parser<B>, input: string) {
    const rv1 = p1.execute(input);
    const rv2 = p2.execute(input);
    rv1.match.should.equal(true);
    rv2.match.should.equal(true);
    (rv1 as SuccessfulMatch<A>).value.should.equal((rv2 as SuccessfulMatch<B>).value);
  }

  it("satisfies monad left identity", () => {
    const p1 = packrattle.succeed(a).flatmap(f);
    const p2 = f(a);
    shouldBeIdentical(p1, p2, "foobar");
  });

  it("satisfies monad right identity", () => {
    const p1 = m.flatmap(packrattle.succeed);
    const p2 = m;
    shouldBeIdentical(p1, p2, "foo");
  });

  it("satisfies monad associativity", () => {
    const p1 = m.flatmap(f).flatmap(g);
    const p2 = m.flatmap(s => f(s).flatmap(g));
    shouldBeIdentical(p1, p2, "foobarbaz");
  });

  it("fails if a nested parser fails", () => {
    const p = m.flatmap(() => packrattle.reject.onFail("no foo"));
    const rv = p.execute("foo");
    rv.match.should.equal(false);
    (rv as FailedMatch<null>).message.should.equal("no foo");
  });
});
