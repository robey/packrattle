import { packrattle, Parser } from "..";

import "should";
import "source-map-support/register";

describe("Parser.onFail", () => {
  it("overrides an inner failure", () => {
    const p = packrattle.alt(/\d+/, "hello").onFail("Expected number or greeting");
    (() => p.run("a")).should.throw(/number or greeting/);
  });

  it("combines across an alt", () => {
    const p = packrattle.alt(
      packrattle.regex(/\d+/).named("number"),
      "hello"
    );

    (() => p.run("a")).should.throw(/number or 'hello'/);
  });

  it("picks up a new name across an alt", () => {
    const p = packrattle.alt(
      packrattle.regex(/\d+/).named("number"),
      "hello"
    ).named("widget");

    (() => p.run("a")).should.throw(/widget/);
  });

  it("executes onFail for unresolvable loops", () => {
    const number = packrattle.regex(/\d+/);
    // this is unresolvable, because it can never finish "failing" p until it gets the result from p.
    const p: Parser<any> = packrattle.alt(
      number,
      packrattle.seq(() => p, ".", () => p),
      packrattle.seq("i", () => p)
    ).named("numbers");

    (() => p.run("ice")).should.throw(/numbers/);
  });
});
