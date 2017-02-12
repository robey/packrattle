import { Parser, matchString, MatchSuccess, succeed } from "../";

import "should";
import "source-map-support/register";

describe("Parser.map", () => {
  it("transforms a match", () => {
    const p = matchString("hello").map((value, span) => [ value.toUpperCase(), span.start, span.end ]);
    (() => p.run("cat")).should.throw(/hello/);
    p.run("hello").should.eql([ "HELLO", 0, 5 ]);
  });

  it("transforms a match into a constant", () => {
    const p = matchString("hello").map("yes");
    const rv = p.execute("hello");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql("yes");
      rv.span.end.should.equal(5);
    }
  });

  it("transforms a match into a failure on exception", () => {
    const p = matchString("hello").map(_ => {
      throw new Error("utter failure");
    });
    (() => p.run("hello")).should.throw(/utter failure/);
  });

  it("mapError", () => {
    const p = matchString("hello").mapError("Try a greeting.");
    (() => p.run("cat")).should.throw("Try a greeting.");
    p.run("hello").should.eql("hello");
  });


  // // ----- monad tests
  //
  // const a = "foo";
  // const m = matchString("foo");
  // const f = (s: string) => matchString(s + "bar");
  // const g = (s: string) => matchString(s + "baz");
  //
  // function shouldBeIdentical<T1, T2>(p1: Parser<string, T1>, p2: Parser<string, T2>, input: string) {
  //   const rv1 = p1.execute(input);
  //   const rv2 = p2.execute(input);
  //   (rv1 instanceof MatchSuccess).should.eql(true);
  //   (rv2 instanceof MatchSuccess).should.eql(true);
  //   if ((rv1 instanceof MatchSuccess) && (rv2 instanceof MatchSuccess)) {
  //     rv1.value.should.eql(rv2.value);
  //   }
  // }
  //
  // it("satisfies monad left identity", () => {
  //   const p1 = succeed(a).flatmap(f);
  //   const p2 = f(a);
  //   shouldBeIdentical(p1, p2, "foobar");
  // });
  //
//   it("satisfies monad right identity", () => {
//     const p1 = m.flatmap(packrattle.succeed);
//     const p2 = m;
//     shouldBeIdentical(p1, p2, "foo");
//   });
//
//   it("satisfies monad associativity", () => {
//     const p1 = m.flatmap(f).flatmap(g);
//     const p2 = m.flatmap(s => f(s).flatmap(g));
//     shouldBeIdentical(p1, p2, "foobarbaz");
//   });
//
//   it("fails if a nested parser fails", () => {
//     const p = m.flatmap(() => packrattle.reject.onFail("no foo"));
//     const rv = p.execute("foo");
//     rv.match.should.equal(false);
//     (rv as FailedMatch<null>).message.should.equal("no foo");
//   });
});
