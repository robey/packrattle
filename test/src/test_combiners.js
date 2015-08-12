"use strict";

import pr from "../../lib";

require("should");
require("source-map-support").install();

describe("combiners", () => {
  it("chain", () => {
    const p = pr.chain("abc", "123", (a, b) => b + a);
    (() => p.run("123")).should.throw(/'abc'/);
    p.run("abc123").should.eql("123abc");
  });

  it("parser.then", () => {
    const p = pr.string("abc").then(pr.string("123"));
    let rv = p.execute("abc123");
    rv.ok.should.eql(true);
    rv.state.pos.should.equal(6);
    rv.value.should.eql([ "abc", "123" ]);
    rv = p.execute("abcd");
    rv.ok.should.eql(false);
    rv.state.pos.should.equal(3);
    rv.value.should.match(/123/);
    rv = p.execute("123")
    rv.ok.should.eql(false);
    rv.state.pos.should.equal(0);
    rv.value.should.match(/abc/);
  });

  // seq tests are in test_seq.js.

  it("alt", () => {
    const p = pr.alt("hello", "goodbye");
    (() => p.run("cat")).should.throw(/'hello'/);
    p.run("hello").should.eql("hello");
    p.run("goodbye").should.eql("goodbye");
  });

  it("parser.or", () => {
    const p = pr.string("hello").or(pr.string("goodbye"));
    (() => p.run("cat")).should.throw(/'hello'/);
    p.run("hello").should.eql("hello");
    p.run("goodbye").should.eql("goodbye");
  });

  it("drop", () => {
    const p = pr.drop("abc");
    let m = p.execute("abc");
    m.state.pos.should.eql(3);
    (m.value == null).should.eql(true);
  });

  it("parser.drop", () => {
    const p = pr("abc").drop();
    let m = p.execute("abc");
    m.state.pos.should.eql(3);
    (m.value == null).should.eql(true);
  });

  describe("optional", () => {
    it("optional", () => {
      const p = pr.optional(/\d+/, "?");
      let m = p.execute("34.");
      m.state.pos.should.eql(2);
      m.value[0].should.eql("34");
      m = p.execute("no");
      m.state.pos.should.eql(0);
      m.value.should.eql("?");
    });

    it("parser.optional", () => {
      const p = pr(/\d+/).optional("?");
      let m = p.execute("34.");
      m.state.pos.should.eql(2);
      m.value[0].should.eql("34");
      m = p.execute("no");
      m.state.pos.should.eql(0);
      m.value.should.eql("?");
    });

    it("advances position correctly past an optional", () => {
      const p = pr([
        /[b]+/,
        pr(/c/).optional().map((m, span) => ({ start: span.start, end: span.end })),
        pr(/[d]+/)
      ]);
      const rv = p.execute("bbbd");
      rv.ok.should.eql(true);
      rv.value[1].should.eql({ start: 3, end: 4 });
      rv.value[2][0].should.eql("d");
    });

    it("tries both the success and failure sides", () => {
      const p = pr([
        pr.optional(/\d+/),
        pr.alt(
          "z",
          "9y"
        )
      ]);
      const rv1 = p.execute("33z");
      rv1.ok.should.eql(true);
      rv1.value[1].should.eql("z");
      const rv2 = p.execute("9y");
      rv2.ok.should.eql(true);
      rv2.value[0].should.eql("9y");
      // consumes either "49" or nothing:
      const rv3 = p.execute("49y");
      rv3.ok.should.eql(false);
    });
  });

  it("check", () => {
    const p = pr.check("hello");
    const m = p.execute("hello");
    m.ok.should.eql(true);
    m.state.pos.should.eql(0);
    m.value.should.eql("hello");
  });

  it("parser.check", () => {
    const p = pr("hello").check();
    const m = p.execute("hello");
    m.ok.should.eql(true);
    m.state.pos.should.eql(0);
    m.value.should.eql("hello");
  });

  it("check within a sequence", () => {
    const p = pr([ "hello", pr.check("there"), "th" ]);
    const m = p.execute("hellothere");
    m.ok.should.eql(true);
    m.state.pos.should.eql(7);
    m.value.should.eql([ "hello", "there", "th" ]);
    (() => p.run("helloth")).should.throw(/there/);
  });

  it("not", () => {
    const p = pr.not("hello");
    const m = p.execute("cat");
    m.state.pos.should.eql(0);
    m.value.should.eql("");
    (() => p.run("hello")).should.throw(/hello/);
  });

  it("parser.not", () => {
    const p = pr.string("hello").not();
    const m = p.execute("cat");
    m.state.pos.should.eql(0);
    m.value.should.eql("");
    (() => p.run("hello")).should.throw(/hello/);
  });
});
