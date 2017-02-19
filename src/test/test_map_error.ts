import { alt, matchRegex, matchString, Parser, seq } from "..";

import "should";
import "source-map-support/register";

describe("Parser.mapError", () => {
  it("overrides an inner failure", () => {
    const p = alt<string, any>(matchRegex(/\d+/), matchString("hello")).mapError("Expected number or greeting");
    (() => p.run("a")).should.throw(/number or greeting/);
  });

  it("combines across an alt", () => {
    const p = alt<string, any>(
      matchRegex(/\d+/).named("number"),
      matchString("hello")
    );

    (() => p.run("a")).should.throw(/number or 'hello'/);
  });

  it("picks up a new name across an alt", () => {
    const p = alt<string, any>(
      matchRegex(/\d+/).named("number"),
      matchString("hello")
    ).named("widget");

    (() => p.run("a")).should.throw(/widget/);
  });

  it("executes mapError for unresolvable loops", () => {
    const number = matchRegex(/\d+/);
    // this is unresolvable, because it can never finish "failing" p until it gets the result from p.
    const p: Parser<string, any> = alt<string, any>(
      number,
      seq(() => p, matchString("."), () => p),
      seq(matchString("i"), () => p)
    ).named("numbers");

    (() => p.run("ice")).should.throw(/numbers/);
  });
});
