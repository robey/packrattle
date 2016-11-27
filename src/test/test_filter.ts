import { packrattle, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Parser.filter", () => {
  it("matches with a condition", () => {
    const p = packrattle.regex(/\d+/).matchIf(match => parseInt(match[0], 10) % 2 == 0, "Expected an even number");
    (() => p.run("103")).should.throw(/even number/);
    const m = p.execute("104") as SuccessfulMatch<RegExpExecArray>;
    m.pos.should.eql(3);
    m.value[0].should.eql("104");
  });

  it("can be called filter", () => {
    // only allow numbers when the length is even.
    const p = packrattle.regex(/\d+/).filter((match, span) => span.endLine.xpos % 2 == 0, "Expected an even length!");
    (() => p.run("103")).should.throw(/even length/);
    p.run("14")[0].should.eql("14");
  });

  it("builds a good default message", () => {
    const p = packrattle.regex(/\d+/).filter((match, span) => span.endLine.xpos % 2 == 0);
    (() => p.run("103")).should.throw(/Expected filter/);
  });
});
