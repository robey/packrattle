import { Match, matchRegex, matchString, MatchSuccess, repeat, seq } from "..";

import "should";
import "source-map-support/register";

function matchSpan<T>(m: Match<T>): [ T, number, number ] {
  if (!(m instanceof MatchSuccess)) throw new Error("failed");
  return [ m.value, m.span.start, m.span.end ];
}

describe("Parser.repeat", () => {
  it("0 or more", () => {
    const p = repeat(matchString("hi"));
    matchSpan<string[]>(p.consume().execute("")).should.eql([ [], 0, 0 ]);
    matchSpan<string[]>(p.consume().execute("hi")).should.eql([ [ "hi" ], 0, 2 ]);
    matchSpan<string[]>(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
  });

  it("2 or 3", () => {
    const p = repeat(matchString("hi"), { min: 2, max: 3 });
    (() => p.run("hi")).should.throw(/'hi'\{2, 3}/);
    matchSpan<string[]>(p.consume().execute("hihi")).should.eql([ [ "hi", "hi" ], 0, 4 ]);
    matchSpan<string[]>(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
    (() => p.run("hihihihi")).should.throw(/end/);
  });

  it("isn't always greedy", () => {
    const p = seq(repeat(matchString("hi")), "hip");
    p.run("hihihip").should.eql([ [ "hi", "hi" ], "hip" ]);
  });

  it("nested", () => {
    const p = seq(
      repeat(
        seq(
          matchString("hi"),
          repeat(matchString("!"))
        )
      ),
      /[x]+/
    ).map(match => match[0]);
    const rv = p.consume().execute("hi!hi!!!hix");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.end.should.equal(11);
      rv.value.should.eql([
        [ "hi", [ "!" ] ],
        [ "hi", [ "!", "!", "!" ] ],
        [ "hi", [] ]
      ]);
    }
  });

  it("but throws an error if there's no progress", () => {
    const p = repeat(matchString(""), { min: 1 });
    (() => p.execute("?")).should.throw(/isn't making progress/);

    const p2 = repeat(matchRegex(/x?/), { min: 4 });
    (() => p.execute("xxxz")).should.throw(/isn't making progress/);
  });
});
