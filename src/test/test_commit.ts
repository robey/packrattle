import { FailedMatch, packrattle, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Parser.commit", () => {
  it("can commit to an alternative", () => {
    const p = packrattle.resolve([
      packrattle.resolve("!").commit(),
      packrattle.resolve(/\d+/).onFail("! must be a number")
    ]).or(packrattle.seq("@", /\d+/)).onMatch(a => [ a[0], a[1][0] ]);
    p.run("!3").should.eql([ "!", "3" ]);
    p.run("@55").should.eql([ "@", "55" ]);
    (() => p.run("!ok")).should.throw("! must be a number");
    (() => p.run("@ok")).should.not.throw("! must be a number");
  });

  it("aborts nested alternatives", () => {
    const p = packrattle.alt(
      packrattle.seq(
        /\d+/,
        packrattle.alt(
          [ packrattle.string("!").commit(), "0" ],
          /[!a-z0-9]+/
        )
      ),
      packrattle.seq("2", "!", /\d+/)
    );
    (() => p.run("2!9")).should.throw(/Expected '0'/);
  });

  it("is remembered through a chain", () => {
    const p = packrattle.alt(
      packrattle.seq(packrattle.string("!").commit(), "x", "y", /\d+/),
      /.xyz/
    );
    (() => p.run("!xyz")).should.throw(/Expected ..d+./);
  });

  it("is remembered through nested chains", () => {
    const p = packrattle.alt(
      packrattle.seq(
        [ packrattle.string("!").commit(), "x" ],
        "y"
      ),
      /.xz/
    );
    (() => p.run("!xz")).should.throw(/Expected 'y'/);
  });

  it("doesn't persist through new alternatives", () => {
    const p = packrattle.alt(
      packrattle.seq(
        packrattle.string("b").commit(),
        "x",
        packrattle.alt(
          /[a-z]z/,
          packrattle.seq(packrattle.string("m").commit(), "q"),
          /[a-z]a/
        )
      ),
      /[a-z]/
    );
    (() => p.run("bxma")).should.throw(/Expected 'q'/);
    p.run("bxmq").should.eql([ "b", "x", [ "m", "q" ] ]);
  });

  it("works in an optional branch", () => {
    const p = packrattle.seq("a", packrattle.seq(packrattle.string("zz").commit(), "q").optional(), /[a-z]{3}/);
    (() => p.run("azzc")).should.throw(/Expected optional/);
  });
});
