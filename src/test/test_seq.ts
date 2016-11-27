import { FailedMatch, packrattle, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Parser.seq", () => {
  it("strings together a chained sequence", () => {
    const p = packrattle.seq(
      packrattle.string("abc"),
      packrattle.string("123").map(() => ""),
      packrattle.string("xyz")
    );
    const rv = p.execute("abc123xyz") as SuccessfulMatch<string[]>;
    rv.pos.should.equal(9);
    rv.value.should.eql([ "abc", "", "xyz" ]);
  });

  it("can lazily chain a sequence", () => {
    let hits = 0;
    const p = packrattle.seq(
      () => {
        hits += 1;
        return packrattle.string("abc");
      },
      () => {
        hits += 1;
        return packrattle.string("123").map(() => "456");
      },
      () => {
        hits += 1;
        return packrattle.string("xyz");
      }
    );

    hits.should.equal(0);
    const rv = p.execute("abc123xyz") as SuccessfulMatch<string[]>;
    hits.should.equal(3);
    rv.pos.should.equal(9);
    rv.value.should.eql([ "abc", "456", "xyz" ]);
  });

  it("can sequence optional elements", () => {
    const p = packrattle.build([ "abc", packrattle.regex(/\d+/).map(m => m[0]).optionalOr(""), "xyz" ]);
    let rv = p.execute("abcxyz") as SuccessfulMatch<string[]>;
    rv.pos.should.equal(6);
    rv.value.should.eql([ "abc", "", "xyz" ]);
    rv = p.execute("abc99xyz") as SuccessfulMatch<string[]>;
    rv.pos.should.equal(8);
    rv.value.should.eql([ "abc", "99", "xyz" ]);
  });

  it("handles regexen in a sequence", () => {
    const p = packrattle.seq(/\s*/, "if");
    let rv = p.execute("   if") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    rv.pos.should.equal(5);
    rv.value[0][0].should.eql("   ");
    rv.value[1].should.eql("if");
    rv = p.execute("if") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    rv.pos.should.equal(2);
    rv.value[0][0].should.eql("");
    rv.value[1].should.eql("if");
    const rv2 = p.execute(";  if") as FailedMatch<any[]>;
    rv2.match.should.eql(false);
    rv2.startpos.should.equal(0);
    rv2.message.should.match(/if/);
  });
});
