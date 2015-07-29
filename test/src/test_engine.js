"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Engine", () => {
  describe("implicitly", () => {
    it("turns strings into parsers", () => {
      const p = pr.chain("abc", "123", (a, b) => b + a);
      p.run("abc123").should.eql("123abc");
    });

    it("turns regexes into parsers", () => {
      const p = pr.chain("wut", /\d+/, (a, b) => a + ":" + b[0]);
      p.run("wut999").should.eql("wut:999");
    });

    it("strings together a chained sequence", () => {
      const p = [ "abc", pr.drop(/\d+/), "xyz" ];
      const m = pr(p).execute("abc11xyz");
      m.value.should.eql([ "abc", "xyz" ]);
      m.state.pos.should.eql(8);
    });
  });

  describe("lazily resolves", () => {
    it("a nested parser", () => {
      const p = pr.chain(pr.string(":"), () => pr.regex(/\w+/), (a, b) => [ a, b ]);
      const rv = p.execute(":hello")
      rv.state.pos.should.equal(6);
      rv.value[0].should.eql(":");
      rv.value[1][0].should.eql("hello");
    });

    it("only once", () => {
      let count = 0;
      const lazy = () => {
        count++;
        return pr.regex(/\w+/);
      };
      const p1 = pr.chain(":", lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p2 = pr.chain(":h", lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p = pr.alt(pr.chain(p1, "?", (a, b) => b), p2);

      p.run(":hello").should.eql([ ":h", "ELLO" ]);
      count.should.equal(1);
      p.run(":g?").should.eql("?");
      count.should.equal(1);
      p.run(":howdy").should.eql([ ":h", "OWDY" ]);
      count.should.equal(1);
    });

    it("supports drop for lazy parsers", () => {
      const p = pr.drop(() => "abc");
      const m = p.execute("abc");
      (m.value == null).should.eql(true);
      m.state.pos.should.eql(3);
    });
  });

  it("only executes a parser once per string/position", () => {
    let count = 0;

    const dupe = pr("dupe").onMatch(x => {
      count++;
      return x;
    });
    const p = pr.alt(
      pr.chain(dupe, "1", (a, b) => b),
      pr.chain(dupe, "2", (a, b) => b)
    );

    p.run("dupe2").should.eql("2");
    count.should.eql(1);
  });
});
