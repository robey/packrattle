"use strict";

const match = require("./match");

/*
 * given an absolute position within text, calculate the line # and the
 * horizontal offset within that line.
 */
function calculateLine(text, pos) {
  let lineNumber = 0;
  let startOfLine = 0;
  for (let i = 0; i < pos; i++) {
    if (text[i] == "\n") {
      startOfLine = i + 1;
      lineNumber++;
    }
  }

  let endOfLine = pos;
  while (endOfLine < text.length && text[endOfLine] != "\n") endOfLine++;

  return { lineNumber, startOfLine, endOfLine, xpos: pos - startOfLine };
}

/*
 * span of text corresponding to a matching segment of the string.
 * this is effectively immutable.
 */
class Span {
  constructor(text, start, end) {
    this.text = text;
    this.start = start;
    this.end = end;
    if (this.end == this.start) this.end++;
    this._startLine = null;
    this._endLine = null;
  }

  toString() {
    return `Span(${this.start} -> ${this.end})`;
  }

  get startLine() {
    if (this._startLine) return this._startLine;
    this._startLine = calculateLine(this.text, this.start);
    return this._startLine;
  }

  get endLine() {
    if (this._endLine) return this._endLine;
    this._endLine = calculateLine(this.text, this.end);
    return this._endLine;
  }

  /*
   * find the full line corresponding to the beginning of this span, and "mark"
   * the span with `~` characters. returns a two-element array containing the
   * full line and the line with squiggles.
   */
  toSquiggles() {
    // for a span covering multiple lines, just show the first line.
    let endxpos = (this.endLine.lineNumber != this.startLine.lineNumber) ? this.startLine.endOfLine : this.endLine.xpos;
    if (endxpos == this.startLine.xpos) endxpos++;

    let squiggles = ""
    for (let i = 0; i < this.startLine.xpos; i++) squiggles += " ";
    for (let i = this.startLine.xpos; i < endxpos; i++) squiggles += "~";
    return [ this.text.slice(this.startLine.startOfLine, this.startLine.endOfLine), squiggles ];
  }

  /*
   * return a segment of the line "around" (left and right of) the start of
   * this span.
   */
  around(width) {
    const line = this.startLine;
    const text = this.text.slice(line.startOfLine, line.endOfLine);

    let left = line.xpos - width;
    let right = line.xpos + width;
    if (left < 0) left = 0;
    if (right >= line.length) right = text.length - 1;
    return text.slice(left, line.xpos) + "[" + (text[line.xpos] || "") + "]" + text.slice(line.xpos + 1, right + 1);
  }
}


/*
 * parser state, used internally.
 * - pos: current text position (next char to parse)
 * - startpos: text position at the start of the current parser
 * - depth: debugging indicator: how nested is this parser
 * - parser: which parser is currently operating
 * - engine: link back to whatever engine executed me
 */
class ParserState {
  constructor() {
    // empty for speed. always use one of the methods or factories.
  }

  toString() {
    return `ParserState[${this.startpos} -> ${this.pos}](depth=${this.depth}, parser.id=${this.parser.id})`;
  }

  /*
   * return a new ParserState with the position advanced `n` places.
   * `startpos` is unchanged.
   */
  advance(n) {
    const rv = new ParserState();
    rv.pos = this.pos + n;
    rv.startpos = this.pos;
    rv.depth = this.depth;
    rv.parser = this.parser;
    rv.engine = this.engine;
    return rv;
  }

  /*
   * jump to a new parser, marking the state as one-deeper and a new parser id.
   */
  next(parser) {
    const rv = new ParserState();
    rv.pos = this.pos;
    rv.startpos = this.pos;
    rv.depth = this.depth + 1;
    rv.parser = parser;
    rv.engine = this.engine;
    return rv;
  }

  /*
   * return a state with a span covering both this state and another.
   */
  merge(other) {
    const rv = new ParserState();
    rv.depth = this.depth;
    rv.parser = this.parser;
    rv.engine = this.engine;
    rv.startpos = Math.min(this.startpos, other.startpos);
    rv.pos = Math.max(this.pos, other.pos);
    return rv;
  }

  /*
   * return the covering span of the current match.
   */
  span() {
    return new Span(this.engine.text, this.startpos, this.pos);
  }

  /*
   * convenient (unique) string id
   */
  get id() {
    return this.parser ? `${this.parser.id}:${this.pos}` : "start";
  }

  /*
   * current text being parsed
   */
  get text() {
    return this.engine.text;
  }

  /*
   * schedule another parser to run, and return the ResultSet that will
   * eventually contain the result.
   */
  schedule(parser, condition) {
    return this.engine.schedule(this.next(parser), condition);
  }

  success(value, commit = false) {
    return new match.Match(true, this, { value, commit });
  }

  failure(value, commit = false) {
    // use "Expected (current parser)" as the default failure message.
    let generated = false;
    if (!value && this.parser) {
      value = "Expected " + this.parser.inspect();
      generated = true;
    }
    return new match.Match(false, this, { value, commit, generated });
  }
}


function newParserState(engine) {
  const rv = new ParserState();
  rv.pos = 0;
  rv.startpos = 0;
  rv.depth = 0;
  rv.parser = null;
  rv.engine = engine;
  return rv;
}


exports.newParserState = newParserState;
exports.ParserState = ParserState;
exports.Span = Span;
