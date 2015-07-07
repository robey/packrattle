"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.matchIf", () => {
  it("matches with a condition", () => {
    const p = pr.regex(/\d+/).matchIf(s => parseInt(s[0], 10) % 2 == 0).onFail("Expected an even number");
    (() => p.run("103")).should.throw(/even number/);
    const m = p.execute("104");
    m.state.pos.should.eql(3);
    m.value[0].should.eql("104");
  });
});
