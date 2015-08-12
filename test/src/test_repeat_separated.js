"use strict";

import pr, { regex, repeatSeparated } from "../../lib";

require("should");
require("source-map-support").install();

describe("Parser.repeatSeparated", () => {
  it("works", () => {
    const p = pr.repeatSeparated("hi", ",").consume();
    const rv = p.execute("hi,hi,hi");
    rv.state.pos.should.equal(8);
    rv.value.should.eql([ "hi", "hi", "hi" ]);
  });

  describe("comma-separated numbers", () => {
    const p = repeatSeparated(regex(/\d+/).onMatch(x => x[0]), /\s*,\s*/);

    it("matches one", () => {
      const rv = p.consume().execute("98");
      rv.state.pos.should.equal(2);
      rv.value.should.eql([ "98" ]);
    });

    it("matches several", () => {
      const rv = p.consume().execute("98, 99 ,100");
      rv.state.pos.should.equal(11);
      rv.value.should.eql([ "98", "99", "100" ]);
    })

    it("map", () => {
      const rv = p.onMatch(x => x.map(n => parseInt(n, 10))).consume().execute("98, 99 ,100");
      rv.state.pos.should.equal(11);
      rv.value.should.eql([ 98, 99, 100 ]);
    });

    it("ignores trailing separators", () => {
      const p2 = pr([ p, pr(/[^\d]+/).map(m => m[0]) ]);
      const rv = p2.consume().execute("98, wut");
      rv.state.pos.should.equal(7);
      rv.value.should.eql([ [ "98" ], ", wut" ]);
    });
  });
});
