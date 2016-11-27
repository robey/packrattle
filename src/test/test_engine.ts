import { packrattle, Parser, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Engine", () => {
  describe("implicitly", () => {
    it("turns strings into parsers", () => {
      const p = packrattle.chain(packrattle.string("abc"), packrattle.string("123"), (a, b) => b + a);
      p.run("abc123").should.eql("123abc");
    });

    it("turns regexes into parsers", () => {
      const p = packrattle.chain(packrattle.string("wut"), packrattle.regex(/\d+/), (a, b) => a + ":" + b[0]);
      p.run("wut999").should.eql("wut:999");
    });

    it("strings together a chained sequence", () => {
      const p = [ "abc", packrattle.regex(/\d+/).map(m => ""), "xyz" ];
      const m = packrattle.seq(...p).execute("abc11xyz") as SuccessfulMatch<any[]>;
      m.value.should.eql([ "abc", "", "xyz" ]);
      m.pos.should.eql(8);
    });
  });

  describe("lazily resolves", () => {
    it("a nested parser", () => {
      const p = packrattle.chain(
        packrattle.string(":"),
        packrattle.build(() => packrattle.regex(/\w+/)),
        (a, b) => [ a, b ]
      );
      const rv = p.execute(":hello") as SuccessfulMatch<[ string, any ]>;
      rv.pos.should.equal(6);
      rv.value[0].should.eql(":");
      rv.value[1][0].should.eql("hello");
    });

    it("only once", () => {
      let count = 0;
      const lazy = packrattle.build(() => {
        count++;
        return packrattle.regex(/\w+/);
      });
      const p1 = packrattle.chain(packrattle.string(":"), lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p2 = packrattle.chain(packrattle.string(":h"), lazy, (a, b) => [ a, b[0].toUpperCase() ]);
      const p = packrattle.alt(packrattle.chain(p1, packrattle.string("?"), (a, b) => b), p2);

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

    const dupe = packrattle.string("dupe").map(x => {
      count++;
      return x;
    });
    const p = packrattle.alt(
      packrattle.chain(dupe, packrattle.string("1"), (a, b) => b),
      packrattle.chain(dupe, packrattle.string("2"), (a, b) => b)
    );

    p.run("dupe2").should.eql("2");
    count.should.eql(1);
  });

  it("stops immediately on an exception", () => {
    let canary = false;
    const problematic = packrattle.alt(
      packrattle.string("a").map(_ => {
        throw new Error("help!");
      }),
      packrattle.regex(/[a-z]/).map(_ => {
        canary = true;
      })
    );
    (() => problematic.run("a")).should.throw(/help/);
    canary.should.eql(false);
  });
});
