"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("combiners", () => {
  it("chain", () => {
    const p = pr.chain("abc", "123", (a, b) => b + a);
    (() => p.run("123")).should.throw(/'abc'/);
    p.run("abc123").should.eql("123abc");
  });

  it("parser.then", () => {
    const p = pr("abc").then(pr("123"));
    (() => p.run("123")).should.throw(/'abc'/);
    p.run("abc123").should.eql([ "abc", "123" ]);
  });

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
});
