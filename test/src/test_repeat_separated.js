"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.repeatSeparated", () => {
  it("works", () => {
    const p = pr.repeatSeparated("hi", ",");
    const rv = p.execute("hi,hi,hi");
    rv.state.pos.should.equal(8);
    rv.value.should.eql([ "hi", "hi", "hi" ]);
  });

  describe("comma-separated numbers", () => {
    const p = pr.repeatSeparated(pr.regex(/\d+/).onMatch(x => x[0]), /\s*,\s*/);

    it("matches one", () => {
      const rv = p.execute("98");
      rv.state.pos.should.equal(2);
      rv.value.should.eql([ "98" ]);
    });

    it("matches several", () => {
      const rv = p.execute("98, 99 ,100");
      rv.state.pos.should.equal(11);
      rv.value.should.eql([ "98", "99", "100" ]);
    })

    it("map", () => {
      const rv = p.onMatch(x => x.map(n => parseInt(n, 10))).execute("98, 99 ,100");
      rv.state.pos.should.equal(11);
      rv.value.should.eql([ 98, 99, 100 ]);
    });

    it("ignores trailing separators", () => {
      const rv = p.execute("98, wut");
      rv.state.pos.should.equal(2);
      rv.value.should.eql([ "98" ]);
    });
  });
});
