"use strict";

import pr from "../../lib";

require("should");
require("source-map-support").install();

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
  })
});
