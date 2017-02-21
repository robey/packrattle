import { Parser, matchString, MatchSuccess, succeed } from "../";

import "should";
import "source-map-support/register";

describe("Parser.map", () => {
  it("transforms a match", () => {
    const p = matchString("hello").map((value, span) => [ value.toUpperCase(), span.start, span.end ]);
    (() => p.run("cat")).should.throw(/hello/);
    p.run("hello").should.eql([ "HELLO", 0, 5 ]);
  });

  it("transforms a match into a constant", () => {
    const p = matchString("hello").map("yes");
    const rv = p.execute("hello");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql("yes");
      rv.span.end.should.equal(5);
    }
  });

  it("transforms a match into a failure on exception", () => {
    const p = matchString("hello").map(_ => {
      throw new Error("utter failure");
    });
    (() => p.run("hello")).should.throw(/utter failure/);
  });

  it("mapError", () => {
    const p = matchString("hello").mapError("Try a greeting.");
    (() => p.run("cat")).should.throw("Try a greeting.");
    p.run("hello").should.eql("hello");
  });
});
