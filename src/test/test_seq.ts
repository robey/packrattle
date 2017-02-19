import { MatchFailure, matchRegex, matchString, MatchSuccess, optionalOr, parser, seq } from "..";

import "should";
import "source-map-support/register";

describe("Parser.seq", () => {
  it("strings together a chained sequence", () => {
    const p = seq(
      matchString("abc"),
      matchString("123").map(() => ""),
      matchString("xyz")
    );
    const rv = p.execute("abc123xyz") as MatchSuccess<string[]>;
    rv.span.end.should.equal(9);
    rv.value.should.eql([ "abc", "", "xyz" ]);
  });

  it("can lazily chain a sequence", () => {
    let hits = 0;
    const p = seq(
      () => {
        hits += 1;
        return matchString("abc");
      },
      () => {
        hits += 1;
        return matchString("123").map(() => "456");
      },
      () => {
        hits += 1;
        return matchString("xyz");
      }
    );

    hits.should.equal(0);
    const rv = p.execute("abc123xyz") as MatchSuccess<string[]>;
    hits.should.equal(3);
    rv.span.end.should.equal(9);
    rv.value.should.eql([ "abc", "456", "xyz" ]);
  });

  it("can sequence optional elements", () => {
    const p = seq(matchString("abc"), optionalOr(matchRegex(/\d+/).map(m => m[0]), ""), matchString("xyz"));
    let rv = p.execute("abcxyz") as MatchSuccess<string[]>;
    rv.span.end.should.equal(6);
    rv.value.should.eql([ "abc", "", "xyz" ]);
    rv = p.execute("abc99xyz") as MatchSuccess<string[]>;
    rv.span.end.should.equal(8);
    rv.value.should.eql([ "abc", "99", "xyz" ]);
  });

  it("handles regexen in a sequence", () => {
    const p = seq(matchRegex(/\s*/), matchString("if"));
    const rv = p.execute("   if");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.span.end.should.equal(5);
      rv.value[0][0].should.eql("   ");
      rv.value[1].should.eql("if");
    }
    const rv2 = p.execute("if");
    (rv2 instanceof MatchSuccess).should.eql(true);
    if (rv2 instanceof MatchSuccess) {
      rv2.span.end.should.equal(2);
      rv2.value[0][0].should.eql("");
      rv2.value[1].should.eql("if");
    }
    const rv3 = p.execute(";  if");
    (rv3 instanceof MatchFailure).should.eql(true);
    if (rv3 instanceof MatchFailure) {
      rv3.span.start.should.equal(0);
      rv3.message.should.match(/if/);
    }
  });
});
