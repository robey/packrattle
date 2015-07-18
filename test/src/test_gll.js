"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser GLL flow", () => {
  it("balances parens", () => {
    const p = pr.alt(pr([ "(", () => p, ")" ]).onMatch(x => ":" + x[1]), "x", "");
    const pc = p.consume();
    pc.execute("(x)").value.should.eql(":x");
    pc.execute("((x))").value.should.eql("::x");
    pc.execute("((x)").ok.should.eql(false);
    pc.execute("(x))").ok.should.eql(false);
  });

  it("accepts doubles", () => {
    const p = pr.alt([ () => p, () => p ], "qx");
    const pc = p.consume();
    pc.execute("qx").value.should.eql("qx");
    pc.execute("qxqx").value.should.eql([ "qx", "qx" ]);
    pc.execute("qxqxqx").value.should.eql([ [ "qx", "qx" ], "qx" ]);
  });

  it("tracks a bunch of leading zeros", () => {
    // 0 p | \d
    const p = pr.alt([ "0", () => p ], pr(/\d/).onMatch(n => n[0]));
    const pc = p.consume();
    pc.execute("9").value.should.eql("9");
    pc.execute("09").value.should.eql([ "0", "9" ]);
    pc.execute("009").value.should.eql([ "0", [ "0", "9" ] ]);
    pc.execute("0009").value.should.eql([ "0", [ "0", ["0", "9" ] ] ]);
  });

  it("left-recurses", () => {
    // p p $ | x
    const p = pr.alt([ () => p, () => p, "$" ], "x");
    const pc = p.consume();
    pc.execute("x").value.should.eql("x");
    pc.execute("xx$").value.should.eql([ "x", "x", "$" ]);
    pc.execute("xx$xx$$").value.should.eql([ [ "x", "x", "$" ], [ "x", "x", "$" ], "$" ]);
    pc.execute("xx$xx$").ok.should.eql(false);
  });

  it("adds numbers", () => {
    // p + p | \d+
    const p = pr.alt(
      pr([ () => p, "+", () => p ]).onMatch(x => x[0] + x[2]),
      pr(/\d+/).onMatch(x => parseInt(x, 10))
    );
    const pc = p.consume();
    pc.execute("23").value.should.eql(23);
    pc.execute("2+3").value.should.eql(5);
    pc.execute("23+100+9").value.should.eql(132);
  });
});
