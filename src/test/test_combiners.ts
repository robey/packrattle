import { FailedMatch, packrattle, SuccessfulMatch } from "../";

import "should";
import "source-map-support/register";

describe("combiners", () => {
  it("chain", () => {
    const p = packrattle.chain(packrattle.string("abc"), packrattle.string("123"), (a, b) => b + a);
    (() => p.run("123")).should.throw(/'abc'/);
    p.run("abc123").should.eql("123abc");
  });

  it("parser.then", () => {
    const p = packrattle.string("abc").then(packrattle.string("123"));
    let rv = p.execute("abc123");
    rv.match.should.eql(true);
    (rv as SuccessfulMatch<[ string, string ]>).pos.should.equal(6);
    (rv as SuccessfulMatch<[ string, string ]>).value.should.eql([ "abc", "123" ]);

    rv = p.execute("abcd");
    rv.match.should.eql(false);
    (rv as FailedMatch<[ string, string ]>).startpos.should.equal(3);
    (rv as FailedMatch<[ string, string ]>).message.should.match(/123/);

    rv = p.execute("123");
    rv.match.should.eql(false);
    (rv as FailedMatch<[ string, string ]>).startpos.should.equal(0);
    (rv as FailedMatch<[ string, string ]>).message.should.match(/abc/);
  });

  // seq tests are in test_seq.js.

  it("alt", () => {
    const p = packrattle.alt("hello", "goodbye");
    (() => p.run("cat")).should.throw(/'hello'/);
    p.run("hello").should.eql("hello");
    p.run("goodbye").should.eql("goodbye");
  });

  it("parser.or", () => {
    const p = packrattle.string("hello").or(packrattle.string("goodbye"));
    (() => p.run("cat")).should.throw(/'hello'/);
    p.run("hello").should.eql("hello");
    p.run("goodbye").should.eql("goodbye");
  });

  describe("optional", () => {
    it("optional", () => {
      const p = packrattle.optional(packrattle.regex(/\d+/).map(m => m[0]));
      const m1 = p.execute("34.") as SuccessfulMatch<string | undefined>;
      m1.match.should.eql(true);
      m1.pos.should.eql(2);
      (m1.value || "").should.eql("34");
      const m2 = p.execute("no") as SuccessfulMatch<string | undefined>;
      m2.pos.should.eql(0);
      (m2.value === undefined).should.eql(true);
    });

    it("optionalOr", () => {
      const p = packrattle.optionalOr(packrattle.regex(/\d+/).map(m => m[0]), "?");
      let m = p.execute("34.");
      m.match.should.eql(true);
      (m as SuccessfulMatch<string>).pos.should.eql(2);
      (m as SuccessfulMatch<string>).value.should.eql("34");
      m = p.execute("no");
      (m as SuccessfulMatch<string>).pos.should.eql(0);
      (m as SuccessfulMatch<string>).value.should.eql("?");
    });

    it("parser.optional", () => {
      const p = packrattle.regex(/\d+/).map(m => m[0]).optional();
      let m = p.execute("34.") as SuccessfulMatch<string | undefined>;
      m.pos.should.eql(2);
      (m.value || "").should.eql("34");
      m = p.execute("no") as SuccessfulMatch<string | undefined>;
      m.pos.should.eql(0);
      (m.value === undefined).should.eql(true);
    });

    it("parser.optionalOr", () => {
      const p = packrattle.regex(/\d+/).map(m => m[0]).optionalOr("?");
      let m = p.execute("34.") as SuccessfulMatch<string>;
      m.pos.should.eql(2);
      m.value.should.eql("34");
      m = p.execute("no") as SuccessfulMatch<string>;
      m.pos.should.eql(0);
      m.value.should.eql("?");
    });

    it("advances position correctly past an optional", () => {
      const p = packrattle.seq(
        /[b]+/,
        packrattle.regex(/c/).optional().map((m, span) => ({ start: span.start, end: span.end })),
        packrattle.regex(/[d]+/)
      );
      const rv = p.execute("bbbd") as SuccessfulMatch<any>;
      rv.match.should.eql(true);
      rv.value[1].should.eql({ start: 3, end: 3 });
      rv.value[2][0].should.eql("d");
    });

    it("tries both the success and failure sides", () => {
      const p = packrattle.seq(
        packrattle.optional(packrattle.regex(/\d+/)),
        packrattle.alt(
          "z",
          "9y"
        )
      );
      const rv1 = p.execute("33z") as SuccessfulMatch<any[]>;
      rv1.match.should.eql(true);
      rv1.value[1].should.eql("z");
      const rv2 = p.execute("9y") as SuccessfulMatch<any[]>;
      rv2.match.should.eql(true);
      rv2.value[1].should.eql("9y");
      // consumes either "49" or nothing:
      const rv3 = p.execute("49y");
      rv3.match.should.eql(false);
    });
  });

  it("check", () => {
    const p = packrattle.check(packrattle.string("hello"));
    const m = p.execute("hello") as SuccessfulMatch<string>;
    m.match.should.eql(true);
    m.pos.should.eql(0);
    m.value.should.eql("hello");
  });

  it("parser.check", () => {
    const p = packrattle.string("hello").check();
    const m = p.execute("hello") as SuccessfulMatch<string>;
    m.match.should.eql(true);
    m.pos.should.eql(0);
    m.value.should.eql("hello");
  });

  it("check within a sequence", () => {
    const p = packrattle.seq("hello", packrattle.check(packrattle.string("there")), "th");
    const m = p.execute("hellothere") as SuccessfulMatch<any[]>;
    m.match.should.eql(true);
    m.pos.should.eql(7);
    m.value.should.eql([ "hello", "there", "th" ]);
    (() => p.run("helloth")).should.throw(/there/);
  });

  it("not", () => {
    const p = packrattle.not(packrattle.string("hello"));
    const m = p.execute("cat") as SuccessfulMatch<null>;
    m.pos.should.eql(0);
    (m.value == null).should.eql(true);
    (() => p.run("hello")).should.throw(/hello/);
  });

  it("parser.not", () => {
    const p = packrattle.string("hello").not();
    const m = p.execute("cat") as SuccessfulMatch<null>;
    m.pos.should.eql(0);
    (m.value == null).should.eql(true);
    (() => p.run("hello")).should.throw(/hello/);
  });
});
