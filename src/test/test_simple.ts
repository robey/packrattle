import { end, MatchFailure, matchRegex, matchString, MatchSuccess, reject, succeed } from "../";

import "should";
import "source-map-support/register";

describe("simple parsers", () => {
  it("reject", () => {
    (() => reject.run("")).should.throw(/rejected/);
  });

  it("succeed", () => {
    succeed("foo").run("").should.eql("foo");
  });

  it("end", () => {
    (end.execute("") instanceof MatchSuccess).should.eql(true);
    (end.execute("a") instanceof MatchFailure).should.eql(true);
  });

  it("literal string", () => {
    const p = matchString("hello");
    (() => p.run("cat")).should.throw(/hello/);
    const rv = p.execute("hellon");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.start.should.eql(0);
      rv.span.end.should.eql(5);
      rv.value.should.eql("hello");
    }
  });

  it("consumes the whole string", () => {
    const p = matchString("hello").consume();
    const rv = p.execute("hello");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.start.should.eql(0);
      rv.span.end.should.eql(5);
      rv.value.should.eql("hello");
    }
    (() => p.run("hello!")).should.throw(/end/);
  });

  it("regex", () => {
    const p = matchRegex(/h(i)?/);
    (() => p.run("no")).should.throw(/h\(i\)\?/);
    const rv = p.execute("hit");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.start.should.eql(0);
      rv.span.end.should.eql(2);
      rv.value[0].should.eql("hi");
      rv.value[1].should.eql("i");
    }
  });
});
