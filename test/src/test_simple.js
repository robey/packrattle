"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("simple parsers", () => {
  it("reject", () => {
    (() => pr.reject.run("")).should.throw(/rejected/);
  });

  it("succeed", () => {
    pr.succeed("foo").run("").should.eql("foo");
  });

  it("end", () => {
    (pr.end.run("") == null).should.eql(true);
    (() => pr.end.run("a")).should.throw(/end/);
  })

  it("literal string", () => {
    const p = pr.string("hello");
    (() => p.run("cat")).should.throw(/hello/);
    const rv = p.execute("hellon");
    rv.state.pos.should.eql(5);
    rv.value.should.eql("hello");
  });

  it("consumes the whole string", () => {
    const p = pr.string("hello").consume();
    const rv = p.execute("hello");
    rv.state.pos.should.eql(5);
    rv.value.should.eql("hello");
    (() => p.run("hello!")).should.throw(/end/);
  });

  it("regex", () => {
    const p = pr.regex(/h(i)?/);
    (() => p.run("no")).should.throw(/h\(i\)\?/);
    const rv = p.execute("hit");
    rv.state.pos.should.equal(2);
    rv.value[0].should.eql("hi");
    rv.value[1].should.eql("i");
  });
});
