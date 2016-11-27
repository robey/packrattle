import { packrattle, Parser, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Parser GLL flow", () => {
  it("balances parens", () => {
    const p: Parser<string> = packrattle.alt(packrattle.seq("(", () => p, ")").map(x => ":" + x[1]), "x", "");
    const pc = p.consume();
    (pc.execute("(x)") as SuccessfulMatch<string>).value.should.eql(":x");
    (pc.execute("((x))") as SuccessfulMatch<string>).value.should.eql("::x");
    pc.execute("((x)").match.should.eql(false);
    pc.execute("(x))").match.should.eql(false);
  });

  it("accepts doubles", () => {
    const p: Parser<string> = packrattle.alt(packrattle.seq(() => p, () => p), "qx");
    const pc = p.consume();
    (pc.execute("qx") as SuccessfulMatch<any>).value.should.eql("qx");
    (pc.execute("qxqx") as SuccessfulMatch<any>).value.should.eql([ "qx", "qx" ]);
    (pc.execute("qxqxqx") as SuccessfulMatch<any>).value.should.eql([ [ "qx", "qx" ], "qx" ]);
  });

  it("tracks a bunch of leading zeros", () => {
    // 0 p | \d
    const p: Parser<any> = packrattle.alt(packrattle.seq("0", () => p), packrattle.regex(/\d/).map(n => n[0]));
    const pc = p.consume();
    (pc.execute("9") as SuccessfulMatch<any>).value.should.eql("9");
    (pc.execute("09") as SuccessfulMatch<any>).value.should.eql([ "0", "9" ]);
    (pc.execute("009") as SuccessfulMatch<any>).value.should.eql([ "0", [ "0", "9" ] ]);
    (pc.execute("0009") as SuccessfulMatch<any>).value.should.eql([ "0", [ "0", ["0", "9" ] ] ]);
  });

  it("left-recurses", () => {
    // p p $ | x
    const p: Parser<any> = packrattle.alt(packrattle.seq(() => p, () => p, "$"), "x");
    const pc = p.consume();
    (pc.execute("x") as SuccessfulMatch<any>).value.should.eql("x");
    (pc.execute("xx$") as SuccessfulMatch<any>).value.should.eql([ "x", "x", "$" ]);
    (pc.execute("xx$xx$$") as SuccessfulMatch<any>).value.should.eql([ [ "x", "x", "$" ], [ "x", "x", "$" ], "$" ]);
    pc.execute("xx$xx$").match.should.eql(false);
  });

  it("adds numbers", () => {
    // p + p | \d+
    const p: Parser<number> = packrattle.alt(
      packrattle.seq(() => p, "+", () => p).map(x => x[0] + x[2]),
      packrattle.regex(/\d+/).map(x => parseInt(x[0], 10))
    );
    const pc = p.consume();
    (pc.execute("23") as SuccessfulMatch<number>).value.should.eql(23);
    (pc.execute("2+3") as SuccessfulMatch<number>).value.should.eql(5);
    (pc.execute("23+100+9") as SuccessfulMatch<number>).value.should.eql(132);
  });
});
