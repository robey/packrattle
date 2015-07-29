"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.commit", () => {
  it("can commit to an alternative", () => {
    const p = pr([
      pr("!").commit(),
      pr(/\d+/).onFail("! must be a number")
    ]).or([ "@", /\d+/ ]).onMatch(a => [ a[0], a[1][0] ]);
    let rv = p.execute("!3")
    rv.ok.should.equal(true);
    rv.value.should.eql([ "!", "3" ]);
    rv = p.execute("@55");
    rv.ok.should.equal(true);
    rv.value.should.eql([ "@", "55" ]);
    rv = p.execute("!ok");
    rv.ok.should.equal(false);
    rv.value.should.eql("! must be a number");
    rv = p.execute("@ok");
    rv.ok.should.equal(false);
    rv.value.should.not.eql("! must be a number");
  });

  it("aborts nested alternatives", () => {
    const p = pr.alt(
      [
        /\d+/,
        pr.alt(
          [ pr("!").commit(), "0" ],
          /[!a-z0-9]+/
        )
      ],
      [ "2", "!", /\d+/ ]
    );
    const rv = p.execute("2!9");
    rv.ok.should.equal(false);
    rv.value.should.match(/Expected '0'/);
  });

  it("is remembered through a chain", () => {
    const p = pr.alt(
      [ pr("!").commit(), "x", "y", /\d+/ ],
      /.xyz/
    );
    const rv = p.execute("!xyz");
    rv.ok.should.equal(false);
  });

  it("is remembered through nested chains", () => {
    const p = pr.alt(
      pr.seq(
        [ pr("!").commit(), "x" ],
        "y"
      ),
      /.xz/
    );
    const rv = p.execute("!xz");
    rv.ok.should.equal(false);
  });

  it("is remembered through an exception", () => {
    const p = pr.alt(
      pr([ pr("!").commit(), "x", "y" ]).onMatch(m => {
        throw new Error("Y!");
      }),
      /.xyz/
    );
    const rv = p.execute("!xyz");
    rv.ok.should.equal(false);
  });

  it("doesn't persist through new alternatives", () => {
    const p = pr.alt(
      pr([ pr("b").commit(), "x", pr.alt(
        /[a-z]z/,
        pr([ pr("m").commit(), "q" ]),
        /[a-z]a/
      )]),
      /[a-z]/
    );
    let rv = p.execute("bxma");
    rv.ok.should.equal(false);
    rv = p.execute("bxmq");
    rv.ok.should.equal(true);
  });

  it("works in an optional branch", () => {
    const p = pr([ "a", pr([ pr("zz").commit(), "q" ]).optional(), /[a-z]{3}/ ]);
    const rv = p.execute("azzc");
    rv.ok.should.equal(false);
  });
});
