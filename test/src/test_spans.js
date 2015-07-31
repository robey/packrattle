"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser.onMatch spans", () => {
  it("cover a string", () => {
    const p = pr("abc").onMatch((m, span) => span);
    const rv = p.execute("abc");
    rv.ok.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover a regex", () => {
    const p = pr(/ab+c/).onMatch((m, span) => span);
    const rv = p.execute("abc");
    rv.ok.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("survive an alt", () => {
    const p = pr.alt("xyz", pr("abc").onMatch((m, span) => span));
    const rv = p.execute("abc");
    rv.ok.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover an alt", () => {
    const p = pr.alt("xyz", "abc").onMatch((m, span) => span);
    const rv = p.execute("abc");
    rv.ok.should.eql(true);
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(3);
  });

  it("cover a sequence", () => {
    const p = pr.seq("xyz", "abc").onMatch((m, span) => span);
    const rv = p.execute("xyzabc");
    rv.ok.should.eql(true)
    rv.value.start.should.eql(0);
    rv.value.end.should.eql(6);
  });

  it("cover a combination", () => {
    const p = pr.seq(
      "abc",
      pr.optional(/\s+/),
      pr.alt(
        /\d+/,
        pr.seq("x", /\d+/, "x").onMatch((m, span) => span)
      ),
      pr.optional("?")
    ).onMatch((m, span) => [ m, span ]);
    const rv = p.execute("abc x99x?");
    rv.ok.should.eql(true);
    const [ m, state ] = rv.value;
    state.start.should.eql(0);
    state.end.should.eql(9);
    m[2].start.should.eql(4);
    m[2].end.should.eql(8);
  });

  it("crosses line boundaries", () => {
    const p = pr.seq(
      /\w+/,
      /\s+/,
      pr("line\nbreak").onMatch((m, span) => span),
      /\s+/,
      /\w+/
    );
    const rv = p.execute("hello line\nbreak ok");
    rv.ok.should.eql(true);
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
    const p = pr.seq(pr(/\w+/).commit(), /\d+/);
    const rv = p.execute("hello???");
    rv.ok.should.eql(false);
    const span = rv.state.span();
    span.toSquiggles().should.eql([
      "hello???",
      "     ~"
    ]);
    span.start.should.eql(5);
    span.end.should.eql(6);
  });

  it("survives chains of maps", () => {
    const p = pr.seq(/[a-z]+/, /\d+/)
      .map((match, span) => match[0][0] + match[1][0])
      .map((match, span) => match.toUpperCase() + span.end);
    const rv = p.execute("what34");
    rv.ok.should.eql(true);
    rv.value.should.eql("WHAT346");
    const span = rv.state.span();
    span.start.should.eql(0);
    span.end.should.eql(6);
  });
});
