import { packrattle, Span, SuccessfulMatch } from "..";

import "should";
import "source-map-support/register";

describe("Parser.map span", () => {
  it("cover a string", () => {
    const p = packrattle.string("abc").map((m, span) => span);
    const rv = p.execute("abc") as SuccessfulMatch<Span>;
    rv.match.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover a regex", () => {
    const p = packrattle.regex(/ab+c/).map((m, span) => span);
    const rv = p.execute("abc") as SuccessfulMatch<Span>;
    rv.match.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("survive an alt", () => {
    const p = packrattle.alt("xyz", packrattle.string("abc").map((m, span) => span));
    const rv = p.execute("abc") as SuccessfulMatch<Span>;
    rv.match.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover an alt", () => {
    const p = packrattle.alt("xyz", "abc").map((m, span) => span);
    const rv = p.execute("abc") as SuccessfulMatch<Span>;
    rv.match.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover a sequence", () => {
    const p = packrattle.seq("xyz", "abc").map((m, span) => span);
    const rv = p.execute("xyzabc") as SuccessfulMatch<Span>;
    rv.match.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(6);
  });

  it("cover a combination", () => {
    const p = packrattle.seq(
      "abc",
      packrattle.regex(/\s+/).optional(),
      packrattle.alt(
        /\d+/,
        packrattle.seq("x", /\d+/, "x").map((m, span) => span)
      ),
      packrattle.string("?").optional()
    ).map((m, span) => [ m, span ]);
    const rv = p.execute("abc x99x?") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    const [ m, state ] = rv.value as [ any[], Span ];
    state.start.should.eql(0);
    state.end.should.eql(9);
    m[2].start.should.eql(4);
    m[2].end.should.eql(8);
  });

  it("crosses line boundaries", () => {
    const p = packrattle.seq(
      /\w+/,
      /\s+/,
      packrattle.string("line\nbreak").map((m, span) => span),
      /\s+/,
      /\w+/
    );
    const rv = p.execute("hello line\nbreak ok") as SuccessfulMatch<any[]>;
    rv.match.should.eql(true);
    const span = rv.value[2];
    span.start.should.eql(6);
    span.startLine.lineNumber.should.eql(0);
    span.startLine.xpos.should.eql(6);
    span.end.should.eql(16);
    span.endLine.lineNumber.should.eql(1);
    span.endLine.xpos.should.eql(5);
    span.toSquiggles().should.eql([
      "hello line",
      "      ~~~~"
    ]);
  });

  it("marks errors", () => {
    const p = packrattle.seq(packrattle.regex(/\w+/).commit(), /\d+/);
    const rv = p.execute("hello???");
    rv.match.should.eql(false);
    const span = rv.span();
    span.toSquiggles().should.eql([
      "hello???",
      "     ~"
    ]);
    span.start.should.eql(5);
    span.end.should.eql(5);
  });

  it("survives chains of maps", () => {
    const p = packrattle.seq(/[a-z]+/, /\d+/)
      .map(match => match[0][0] + match[1][0])
      .map((match, span) => match.toUpperCase() + span.end);
    const rv = p.execute("what34") as SuccessfulMatch<string>;
    rv.match.should.eql(true);
    rv.value.should.eql("WHAT346");
    const span = rv.span();
    span.start.should.eql(0);
    span.end.should.eql(6);
  });
});
