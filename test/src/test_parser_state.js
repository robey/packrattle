const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Span", () => {
  const text = "line one\nline two\nline 3\n\nline 4";

  function verify(line, lineno, xpos) {
    const lines = text.split("\n");
    line.lineNumber.should.eql(lineno);
    line.xpos.should.eql(xpos);
    text.slice(line.startOfLine, line.endOfLine).should.eql(lines[line.lineNumber]);
  }

  it("finds the current line", () => {
    verify(new pr.Span(text, 0, 1).startLine, 0, 0);
    verify(new pr.Span(text, 5, 6).startLine, 0, 5);
    verify(new pr.Span(text, 7, 8).startLine, 0, 7);
    verify(new pr.Span(text, 8, 9).startLine, 0, 8);
    verify(new pr.Span(text, 9, 10).startLine, 1, 0);
    verify(new pr.Span(text, 20, 21).startLine, 2, 2);
    verify(new pr.Span(text, 25, 26).startLine, 3, 0);
    verify(new pr.Span(text, 26, 27).startLine, 4, 0);
    verify(new pr.Span(text, 31, 32).startLine, 4, 5);
  });

  it("can make squiggles", () => {
    new pr.Span(text, 5, 8).toSquiggles().should.eql([ "line one", "     ~~~" ]);
    new pr.Span(text, 27, 28).toSquiggles().should.eql([ "line 4", " ~" ]);
  });

  it("can find text around", () => {
    new pr.Span(text, 5, 6).around(2).should.eql("e [o]ne");
    new pr.Span(text, 0, 1).around(2).should.eql("[l]in");
    new pr.Span(text, 7, 8).around(2).should.eql("on[e]");
    new pr.Span(text, 10, 11).around(4).should.eql("l[i]ne t");
  });
});
