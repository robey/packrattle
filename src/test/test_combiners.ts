import { alt, chain, MatchFailure, matchRegex, matchString, MatchSuccess, optional, optionalOr, seq } from "../";

import "should";
import "source-map-support/register";

describe("combiners", () => {
  it("chain", () => {
    const p = chain(matchString("abc"), matchString("123"), (a, b) => b + a);
    (() => p.run("123")).should.throw(/'abc'/);
    p.run("abc123").should.eql("123abc");

    let rv = p.execute("abc123");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.start.should.eql(0);
      rv.span.end.should.eql(6);
      rv.value.should.eql("123abc");
    }
  });

  // seq tests are in test_seq.js.

  it("alt", () => {
    const p = alt("hello", "goodbye");
    (() => p.run("cat")).should.throw(/'hello'/);
    p.run("hello").should.eql("hello");
    p.run("goodbye").should.eql("goodbye");
  });

  describe("optional", () => {
    it("optional", () => {
      const p = optional(matchRegex(/\d+/).map(m => m[0]));
      const m1 = p.consume().execute("34");
      (m1 instanceof MatchSuccess).should.eql(true);
      if (m1 instanceof MatchSuccess) {
        m1.span.end.should.eql(2);
        (m1.value || "").should.eql("34");
      }
      const m2 = p.execute("no");
      (m2 instanceof MatchSuccess).should.eql(true);
      if (m2 instanceof MatchSuccess) {
        m2.span.end.should.eql(0);
        (m2.value === undefined).should.eql(true);
      }
    });

    it("optionalOr", () => {
      const p = optionalOr(matchRegex(/\d+/).map(m => m[0]), "?");
      const m1 = p.consume().execute("34");
      (m1 instanceof MatchSuccess).should.eql(true);
      if (m1 instanceof MatchSuccess) {
        m1.span.end.should.eql(2);
        m1.value.should.eql("34");
      }
      const m2 = p.execute("no");
      (m2 instanceof MatchSuccess).should.eql(true);
      if (m2 instanceof MatchSuccess) {
        m2.span.end.should.eql(0);
        m2.value.should.eql("?");
      }
    });

    it("advances position correctly past an optional", () => {
      const p = seq(
        /[b]+/,
        optional(matchRegex(/c/)).map((m, span) => ({ start: span.start, end: span.end })),
        matchRegex(/[d]+/)
      );
      const rv = p.execute("bbbd");
      (rv instanceof MatchSuccess).should.eql(true);
      if (rv instanceof MatchSuccess) {
        rv.value[1].should.eql({ start: 3, end: 3 });
        rv.value[2][0].should.eql("d");
      }
    });

    it("tries both the success and failure sides", () => {
      const p = seq(
        optional(matchRegex(/\d+/)),
        alt(
          "z",
          "9y"
        )
      );
      const rv1 = p.execute("33z");
      (rv1 instanceof MatchSuccess).should.eql(true);
      if (rv1 instanceof MatchSuccess) {
        rv1.value[1].should.eql("z");
      }
      const rv2 = p.execute("9y");
      (rv2 instanceof MatchSuccess).should.eql(true);
      if (rv2 instanceof MatchSuccess) {
        rv2.value[1].should.eql("9y");
      }
      // consumes either "49" or nothing:
      const rv3 = p.execute("49y",);
      (rv3 instanceof MatchFailure).should.eql(true);
    });
  });

//   it("check", () => {
//     const p = packrattle.check(packrattle.string("hello"));
//     const m = p.execute("hello") as SuccessfulMatch<string>;
//     m.match.should.eql(true);
//     m.pos.should.eql(0);
//     m.value.should.eql("hello");
//   });
//
//   it("parser.check", () => {
//     const p = packrattle.string("hello").check();
//     const m = p.execute("hello") as SuccessfulMatch<string>;
//     m.match.should.eql(true);
//     m.pos.should.eql(0);
//     m.value.should.eql("hello");
//   });
//
//   it("check within a sequence", () => {
//     const p = packrattle.seq("hello", packrattle.check(packrattle.string("there")), "th");
//     const m = p.execute("hellothere") as SuccessfulMatch<any[]>;
//     m.match.should.eql(true);
//     m.pos.should.eql(7);
//     m.value.should.eql([ "hello", "there", "th" ]);
//     (() => p.run("helloth")).should.throw(/there/);
//   });
//
//   it("not", () => {
//     const p = packrattle.not(packrattle.string("hello"));
//     const m = p.execute("cat") as SuccessfulMatch<null>;
//     m.pos.should.eql(0);
//     (m.value == null).should.eql(true);
//     (() => p.run("hello")).should.throw(/hello/);
//   });
//
//   it("parser.not", () => {
//     const p = packrattle.string("hello").not();
//     const m = p.execute("cat") as SuccessfulMatch<null>;
//     m.pos.should.eql(0);
//     (m.value == null).should.eql(true);
//     (() => p.run("hello")).should.throw(/hello/);
//   });
});
