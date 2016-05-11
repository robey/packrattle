"use strict";

import pr from "../../lib";

import "should";
import "source-map-support/register";

describe("Parser.onFail", () => {
  it("overrides an inner failure", () => {
    const p = pr.alt(/\d+/, "hello").onFail("Expected number or greeting");
    (() => p.run("a")).should.throw(/number or greeting/);
  });

  it("combines across an alt", () => {
    const p = pr.alt(
      pr(/\d+/).named("number"),
      "hello"
    );

    (() => p.run("a")).should.throw(/number or 'hello'/);
  });

  it("picks up a new name across an alt", () => {
    const p = pr.alt(
      pr(/\d+/).named("number"),
      "hello"
    ).named("widget");

    (() => p.run("a")).should.throw(/widget/);
  });

  it("executes onFail for unresolvable loops", () => {
    const number = pr.regex(/\d+/);
    // this is unresolvable, because it can never finish "failing" p until it gets the result from p.
    const p = pr.alt(
      number,
      [ () => p, ".", () => p ]
    ).named("numbers");

    (() => p.run("ice", { debugger: console.log })).should.throw(/numbers/);
  });
});
