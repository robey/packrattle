"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.seq", () => {
  it("strings together a chained sequence", () => {
    const p = pr.seq(
      pr.string("abc"),
      pr.string("123").drop(),
      pr.string("xyz")
    );
    const rv = p.execute("abc123xyz");
    rv.state.pos.should.equal(9);
    rv.value.should.eql([ "abc", "xyz" ]);
  });

  it("can lazily chain a sequence", () => {
    let hits = 0;
    const p = pr.seq(
      () => {
        hits += 1;
        return pr.string("abc");
      },
      () => {
        hits += 1;
        return pr.string("123").drop();
      },
      () => {
        hits += 1;
        return pr.string("xyz");
      }
    );

    hits.should.equal(0);
    const rv = p.execute("abc123xyz");
    hits.should.equal(3);
    rv.state.pos.should.equal(9);
    rv.value.should.eql([ "abc", "xyz" ]);
  });

  it("can sequence optional elements", () => {
    const p = pr([ "abc", pr.optional(/\d+/), "xyz" ]);
    let rv = p.execute("abcxyz");
    rv.state.pos.should.equal(6);
    rv.value.should.eql([ "abc", "xyz" ]);
    rv = p.execute("abc99xyz");
    rv.state.pos.should.equal(8);
    rv.value[0].should.eql("abc");
    rv.value[1][0].should.eql("99");
    rv.value[2].should.eql("xyz");
  });

  it("skips a dropped element at the end", () => {
    const p = pr([ "abc", pr.optional(/\d+/).drop(), pr.optional(/\w+/).drop() ]);
    let rv = p.execute("abcj");
    rv.state.pos.should.equal(4);
    rv.value.should.eql([ "abc" ]);
    rv = p.execute("abc99");
    rv.state.pos.should.equal(5);
    rv.value.should.eql([ "abc" ]);
  });

  it("skips whitespace inside seqIgnore()", () => {
    const p = pr.seqIgnore(/\s+/, "abc", "xyz", "ghk");
    let rv = p.execute("abcxyzghk");
    rv.ok.should.equal(true);
    rv.value.should.eql([ "abc", "xyz", "ghk" ]);
    rv = p.execute("   abc xyz\tghk");
    rv.ok.should.equal(true);
    rv.value.should.eql([ "abc", "xyz", "ghk" ]);
  });

  it("skips whitespace lazily", () => {
    let hits = 0;
    const p = pr.seqIgnore(
      () => {
        hits += 1;
        return /\s+/;
      },
      () => {
        hits += 1;
        return pr.string("abc");
      },
      () => {
        hits += 1;
        return pr.string("xyz");
      },
      () => {
        hits += 1;
        return pr.string("ghk");
      }
    );
    hits.should.equal(0);
    const rv = p.execute("   abc xyz\tghk");
    hits.should.equal(4);
    rv.ok.should.equal(true);
    rv.value.should.eql([ "abc", "xyz", "ghk" ]);
  });

  it("handles regexen in a sequence", () => {
    const p = pr.seq(/\s*/, "if");
    let rv = p.execute("   if");
    rv.ok.should.eql(true);
    rv.state.pos.should.equal(5);
    rv.value[0][0].should.eql("   ");
    rv.value[1].should.eql("if");
    rv = p.execute("if");
    rv.ok.should.eql(true);
    rv.state.pos.should.equal(2);
    rv.value[0][0].should.eql("");
    rv.value[1].should.eql("if");
    rv = p.execute(";  if");
    rv.ok.should.eql(false);
    rv.state.pos.should.equal(0);
    rv.value.should.match(/if/);
  });
});
