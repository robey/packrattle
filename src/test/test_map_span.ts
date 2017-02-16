import { alt, MatchFailure, matchRegex, matchString, MatchSuccess, optional, seq, SourceSpan, Span } from "..";

import "should";
import "source-map-support/register";

describe("Parser.map span", () => {
  it("cover a string", () => {
    const p = matchString("abc").map((m, span) => span);
    const rv = p.execute("abc");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.start.should.eql(0);
      rv.value.end.should.eql(3);
    }
  });

  it("cover a regex", () => {
    const p = matchRegex(/ab+c/).map((m, span) => span);
    const rv = p.execute("abc");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.start.should.eql(0);
      rv.value.end.should.eql(3);
    }
  });

  it("survive an alt", () => {
    const p = alt("xyz", matchString("abc").map((m, span) => span));
    const rv = p.execute("abc");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      (rv as any).value.start.should.eql(0);
      (rv as any).value.end.should.eql(3);
    }
  });

  it("cover an alt", () => {
    const p = alt("xyz", "abc").map((m, span) => span);
    const rv = p.execute("abc");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.start.should.eql(0);
      rv.value.end.should.eql(3);
    }
  });

  it("cover a sequence", () => {
    const p = seq("xyz", "abc").map((m, span) => span);
    const rv = p.execute("xyzabc");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.start.should.eql(0);
      rv.value.end.should.eql(6);
    }
  });

  it("cover a combination", () => {
    const p = seq(
      "abc",
      optional(matchRegex(/\s+/)),
      alt(
        /\d+/,
        seq("x", /\d+/, "x").map((m, span) => span)
      ),
      optional(matchString("?"))
    ).map((m, span) => [ m, span ]);
    const rv = p.consume().execute("abc x99x?");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      const [ m, state ] = rv.value as [ any[], Span ];
      state.start.should.eql(0);
      state.end.should.eql(9);
      m[2].start.should.eql(4);
      m[2].end.should.eql(8);
    }
  });

  it("crosses line boundaries", () => {
    const p = seq(
      /\w+/,
      /\s+/,
      matchString("line\nbreak").map((m, span) => span),
      /\s+/,
      /\w+/
    );
    const source = "hello line\nbreak ok";
    const rv = p.consume().execute(source);
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      const span = rv.value[2];
      span.start.should.eql(6);
      span.end.should.eql(16);
      const sourceSpan = new SourceSpan(source, span);
      sourceSpan.startLine.lineNumber.should.eql(0);
      sourceSpan.startLine.xpos.should.eql(6);
      sourceSpan.endLine.lineNumber.should.eql(1);
      sourceSpan.endLine.xpos.should.eql(5);
      sourceSpan.toSquiggles().should.eql([
        "hello line",
        "      ~~~~"
      ]);
    }
  });

  it("marks errors", () => {
    const p = seq(matchRegex(/\w+/), /\d+/);
    const source = "hello???";
    const rv = p.execute(source);
    (rv instanceof MatchFailure).should.eql(true);
    const sourceSpan = new SourceSpan(source, rv.span);
    sourceSpan.toSquiggles().should.eql([
      "hello???",
      "     ~"
    ]);
    sourceSpan.span.start.should.eql(5);
    sourceSpan.span.end.should.eql(5);
  });

  it("survives chains of maps", () => {
    const p = seq(/[a-z]+/, /\d+/)
      .map(match => match[0][0] + match[1][0])
      .map((match, span) => match.toUpperCase() + span.end);
    const rv = p.execute("what34");
    (rv instanceof MatchSuccess).should.eql(true);
    if (rv instanceof MatchSuccess) {
      rv.value.should.eql("WHAT346");
      rv.span.start.should.eql(0);
      rv.span.end.should.eql(6);
    }
  });
});
