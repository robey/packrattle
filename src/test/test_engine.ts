import { alt, chain, matchRegex, matchString, MatchSuccess, parser, seq } from "..";

import "should";
import "source-map-support/register";

describe("Engine", () => {
  describe("implicitly", () => {
    it("turns strings into parsers", () => {
      const p = chain(matchString("abc"), matchString("123"), (a, b) => b + a);
      p.run("abc123").should.eql("123abc");
    });

    it("turns regexes into parsers", () => {
      const p = chain(matchString("wut"), matchRegex(/\d+/), (a, b) => a + ":" + b[0]);
      p.run("wut999").should.eql("wut:999");
    });

    it("strings together a chained sequence", () => {
      const p = seq(matchString("abc"), matchRegex(/\d+/).map(m => ""), matchString("xyz"));
      const m = p.execute("abc11xyz");
      (m instanceof MatchSuccess).should.eql(true);
      if (m instanceof MatchSuccess) {
        m.value.should.eql([ "abc", "", "xyz" ]);
        m.span.end.should.eql(8);
      }
    });
  });

  describe("lazily resolves", () => {
    it("a nested parser", () => {
      const p = chain(
        matchString(":"),
        parser(() => matchRegex(/\w+/)),
        (a, b) => [ a, b ]
      );
      const rv = p.execute(":hello");
      (rv instanceof MatchSuccess).should.eql(true);
      if (rv instanceof MatchSuccess) {
        rv.span.end.should.equal(6);
        rv.value[0].should.eql(":");
        rv.value[1][0].should.eql("hello");
      }
    });

    it("only once", () => {
      let count = 0;
      const lazy = parser(() => {
        count++;
        return matchRegex(/\w+/);
      });
      const p1 = chain(matchString(":"), lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p2 = chain(matchString(":h"), lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p = alt<string, any>(chain(p1, matchString("?"), (a, b) => b), p2);

      p.run(":hello").should.eql([ ":h", "ELLO" ]);
      count.should.equal(1);
      p.run(":g?").should.eql("?");
      count.should.equal(1);
      p.run(":howdy").should.eql([ ":h", "OWDY" ]);
      count.should.equal(1);
    });
  });

  it("only executes a parser once per string/position", () => {
    let count = 0;

    const dupe = matchString("dupe").map(x => {
      count++;
      return x;
    });
    const p = alt(
      chain(dupe, matchString("1"), (a, b) => b),
      chain(dupe, matchString("2"), (a, b) => b)
    );

    p.run("dupe2").should.eql("2");
    count.should.eql(1);
  });

  // it("stops immediately on an exception", () => {
  //   let canary = false;
  //   const problematic = alt(
  //     matchString("a").map(_ => {
  //       throw new Error("help!");
  //     }),
  //     matchRegex(/[a-z]/).map(_ => {
  //       canary = true;
  //     })
  //   );
  //   (() => problematic.run("a")).should.throw(/help/);
  //   canary.should.eql(false);
  // });
});
