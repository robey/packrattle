"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.filter", () => {
  it("matches with a condition", () => {
    const p = pr.regex(/\d+/).matchIf(match => parseInt(match[0], 10) % 2 == 0, "Expected an even number");
    (() => p.run("103")).should.throw(/even number/);
    const m = p.execute("104");
    m.state.pos.should.eql(3);
    m.value[0].should.eql("104");
  });

  it("can be called filter", () => {
    // only allow numbers when the length is even.
    const p = pr.regex(/\d+/).filter((match, span) => span.endLine.xpos % 2 == 0, "Expected an even length!");
    (() => p.run("103")).should.throw(/even length/);
    p.run("14")[0].should.eql("14");
  });

  it("builds a good default message", () => {
    const p = pr.regex(/\d+/).filter((match, span) => span.endLine.xpos % 2 == 0);
    (() => p.run("103")).should.throw(/Expected filter/);
  });
});
