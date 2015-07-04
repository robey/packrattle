const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser", () => {
  it("reject", () => {
    (() => pr.reject.run("")).should.throw(/rejected/);
  });

  it("succeed", () => {
    pr.succeed("foo").run("").should.eql("foo");
  });

  it("end", () => {
    (pr.end.run("") == null).should.eql(true);
    (() => pr.end.run("a")).should.throw(/end/);
  })
});





  //
  // it "literal string", ->
  //   p = pr.string("hello")
  //   (-> p.run("cat")).should.throw /hello/
  //   parse(p, "hellon").should.eql [ "hello", 5 ]
  //
