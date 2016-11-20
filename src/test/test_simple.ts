import { packrattle } from "../";

import "should";
import "source-map-support/register";

describe("simple parsers", () => {
  it("reject", () => {
    (() => packrattle.reject.run("")).should.throw(/rejected/);
  });

  it("succeed", () => {
    packrattle.succeed("foo").run("").should.eql("foo");
  });

  it("end", () => {
    (packrattle.end.run("") == null).should.eql(true);
    (() => packrattle.end.run("a")).should.throw(/end/);
  });

  it("literal string", () => {
    const p = packrattle.string("hello");
    (() => p.run("cat")).should.throw(/hello/);
    const rv = p.execute("hellon");
    rv.pos.should.eql(5);
    (rv.value || "").should.eql("hello");
  });

  it("consumes the whole string", () => {
    const p = packrattle.string("hello")/*.consume()*/;
    const rv = p.execute("hello");
    rv.pos.should.eql(5);
    (rv.value || "").should.eql("hello");
    (() => p.run("hello!")).should.throw(/end/);
  });

  it("regex", () => {
    const p = packrattle.regex(/h(i)?/);
    (() => p.run("no")).should.throw(/h\(i\)\?/);
    const rv = p.execute("hit");
    rv.pos.should.equal(2);
    (rv.value || [])[0].should.eql("hi");
    (rv.value || [])[1].should.eql("i");
  });
});
