import { alt, matchRegex, matchString, MatchSuccess, Parser, seq } from "..";

import "should";
import "source-map-support/register";

describe("Parser GLL flow", () => {
  it("balances parens", () => {
    const p: Parser<string, string> = alt(
      seq(matchString("("), () => p, matchString(")")).map(x => ":" + x[1]),
      matchString("x"),
      matchString("")
    );
    const pc = p.consume();
    (pc.execute("(x)") as MatchSuccess<string>).value.should.eql(":x");
    (pc.execute("((x))") as MatchSuccess<string>).value.should.eql("::x");
    (pc.execute("((x)") instanceof MatchSuccess).should.eql(false);
    (pc.execute("(x))") instanceof MatchSuccess).should.eql(false);
  });

  it("accepts doubles", () => {
    const p: Parser<string, any> = alt<string, any>(seq(() => p, () => p), matchString("qx"));
    const pc = p.consume();
    (pc.execute("qx") as MatchSuccess<any>).value.should.eql("qx");
    (pc.execute("qxqx") as MatchSuccess<any>).value.should.eql([ "qx", "qx" ]);
    (pc.execute("qxqxqx") as MatchSuccess<any>).value.should.eql([ [ "qx", "qx" ], "qx" ]);
  });

  it("tracks a bunch of leading zeros", () => {
    // 0 p | \d
    const p: Parser<string, any> = alt<string, any>(seq(matchString("0"), () => p), matchRegex(/\d/).map(n => n[0]));
    const pc = p.consume();
    (pc.execute("9") as MatchSuccess<any>).value.should.eql("9");
    (pc.execute("09") as MatchSuccess<any>).value.should.eql([ "0", "9" ]);
    (pc.execute("009") as MatchSuccess<any>).value.should.eql([ "0", [ "0", "9" ] ]);
    (pc.execute("0009") as MatchSuccess<any>).value.should.eql([ "0", [ "0", ["0", "9" ] ] ]);
  });

  it("left-recurses", () => {
    // p p $ | x
    const p: Parser<string, any> = alt<string, any>(seq(() => p, () => p, matchString("$")), matchString("x"));
    const pc = p.consume();
    (pc.execute("x") as MatchSuccess<any>).value.should.eql("x");
    (pc.execute("xx$") as MatchSuccess<any>).value.should.eql([ "x", "x", "$" ]);
    (pc.execute("xx$xx$$") as MatchSuccess<any>).value.should.eql([ [ "x", "x", "$" ], [ "x", "x", "$" ], "$" ]);
    (pc.execute("xx$xx$") instanceof MatchSuccess).should.eql(false);
  });

  it("adds numbers", () => {
    // p + p | \d+
    const p: Parser<any, number> = alt(
      seq(() => p, matchString("+"), () => p).map(x => x[0] + x[2]),
      matchRegex(/\d+/).map(x => parseInt(x[0], 10))
    );
    const pc = p.consume();
    (pc.execute("23") as MatchSuccess<number>).value.should.eql(23);
    (pc.execute("2+3") as MatchSuccess<number>).value.should.eql(5);
    (pc.execute("23+100+9") as MatchSuccess<number>).value.should.eql(132);
  });
});
