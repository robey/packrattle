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

    // it "strings together a chained sequence", ->
    //   p = [ "abc", pr.drop(/\d+/), "xyz" ]
    //   parse(p, "abc11xyz").should.eql [ [ "abc", "xyz" ], 8 ]
  });

  describe("lazily resolves", () => {
    it("a nested parser", () => {
      const p = pr.chain(pr.string(":"), () => pr.regex(/\w+/), (a, b) => [ a, b ]);
      const rv = p.execute(":hello")
      rv.state.pos.should.equal(6);
      rv.value[0].should.eql(":");
      rv.value[1][0].should.eql("hello");
    });

    // it "only once", ->
    //   count = 0
    //   p = pr.seq ":", ->
    //     count++
    //     pr.regex(/\w+/).onMatch (m) -> m[0].toUpperCase()
    //   parse(p, ":hello").should.eql [ [ ":", "HELLO" ], 6 ]
    //   count.should.equal(1)
    //   parse(p, ":goodbye").should.eql [ [ ":", "GOODBYE" ], 8 ]
    //   count.should.equal(1)
    //
    // it "supports drop for lazy parsers", ->
    //   p = pr.drop(-> "abc")
    //   parse(p, "abc").should.eql [ null, 3]
  });
});
