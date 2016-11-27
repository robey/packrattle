import { Match, packrattle, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

function matchSpan<T>(m: Match<T>): [ T, number, number ] {
  if (!(m instanceof SuccessfulMatch)) throw new Error("failed");
  const span = m.span();
  return [ m.value, span.start, span.end ];
}

describe("Parser.repeat", () => {
  it("0 or more", () => {
    const p = packrattle.repeat(packrattle.string("hi"));
    matchSpan(p.consume().execute("")).should.eql([ [], 0, 0 ]);
    matchSpan(p.consume().execute("hi")).should.eql([ [ "hi" ], 0, 2 ]);
    matchSpan(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
  });

  it("2 or 3", () => {
    const p = packrattle.repeat(packrattle.string("hi"), { min: 2, max: 3 });
    (() => p.run("hi")).should.throw(/'hi'\{2, 3}/);
    matchSpan(p.consume().execute("hihi")).should.eql([ [ "hi", "hi" ], 0, 4 ]);
    matchSpan(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
    (() => p.run("hihihihi")).should.throw(/end/);
  });

  it("Parser.repeat", () => {
    const p = packrattle.string("hi").repeat({ min: 2, max: 3 });
    (() => p.run("hi")).should.throw(/'hi'\{2, 3}/);
    matchSpan(p.consume().execute("hihi")).should.eql([ [ "hi", "hi" ], 0, 4 ]);
    matchSpan(p.consume().execute("hihihi")).should.eql([ [ "hi", "hi", "hi" ], 0, 6 ]);
    (() => p.run("hihihihi")).should.throw(/end/);
  });

  it("Parser.times", () => {
    const p = packrattle.string("hi").times(2);
    (() => p.run("hi")).should.throw(/'hi'\{2, 2}/);
    matchSpan(p.consume().execute("hihi")).should.eql([ [ "hi", "hi" ], 0, 4 ]);
    (() => p.run("hihihi")).should.throw(/end/);
    (() => p.run("hihihihi")).should.throw(/end/);
  });

  it("isn't always greedy", () => {
    const p = packrattle.seq(packrattle.repeat(packrattle.string("hi")), "hip");
    p.run("hihihip").should.eql([ [ "hi", "hi" ], "hip" ]);
  });

  it("nested", () => {
    const p = packrattle.seq(
      packrattle.repeat(
        packrattle.seq(
          packrattle.string("hi"),
          packrattle.repeat(packrattle.string("!"))
        )
      ),
      /[x]+/
    ).map(match => match[0]);
    const rv = p.consume().execute("hi!hi!!!hix") as SuccessfulMatch<any[]>;
    rv.pos.should.equal(11);
    rv.value.should.eql([
      [ "hi", [ "!" ] ],
      [ "hi", [ "!", "!", "!" ] ],
      [ "hi", [] ]
    ]);
  });

  it("but throws an error if there's no progress", () => {
    const p = packrattle.repeat(packrattle.string(""), { min: 1 });
    (() => p.execute("?")).should.throw(/isn't making progress/);

    const p2 = packrattle.repeat(packrattle.regex(/x?/), { min: 4 });
    (() => p.execute("xxxz")).should.throw(/isn't making progress/);
  });
});
