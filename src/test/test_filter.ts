import { matchRegex, MatchSuccess  } from "..";

import "should";
import "source-map-support/register";

describe("Parser.filter", () => {
  it("matches with a condition", () => {
    const p = matchRegex(/\d+/).filter(match => parseInt(match[0], 10) % 2 == 0, "Expected an even number");
    (() => p.run("103")).should.throw(/even number/);
    const m = p.execute("104");
    (m instanceof MatchSuccess).should.eql(true);
    if (m instanceof MatchSuccess) {
      m.span.end.should.eql(3);
      m.value[0].should.eql("104");
    }
  });

  it("can be called filter", () => {
    // only allow numbers when the length is even.
    const p = matchRegex(/\d+/).filter((match, span) => span.end % 2 == 0, "Expected an even length!");
    (() => p.run("103")).should.throw(/even length/);
    p.run("14")[0].should.eql("14");
  });

  it("builds a good default message", () => {
    const p = matchRegex(/\d+/).filter((match, span) => span.end % 2 == 0);
    (() => p.run("103")).should.throw(/Expected ??d??/);
  });
});
