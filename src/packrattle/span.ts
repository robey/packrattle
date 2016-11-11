export class Line {
  constructor(
    public readonly lineNumber: number,
    public readonly startOfLine: number,
    public readonly endOfLine: number,
    public readonly xpos: number
  ) {
    // pass.
  }
}

/*
 * given an absolute position within text, calculate the line # and the
 * horizontal offset within that line.
 */
function calculateLine(text: string, pos: number) {
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

  return new Line(lineNumber, startOfLine, endOfLine, pos - startOfLine);
}

/*
 * span of text corresponding to a matching segment of the string.
 * this is effectively immutable.
 */
export class Span {
  private _startLine?: Line;
  private _endLine?: Line;

  constructor(public readonly text: string, public readonly start: number, public readonly end: number) {
    if (this.end == this.start) this.end++;
  }

  inspect() {
    return `Span(${this.start} -> ${this.end})`;
  }

  get startLine(): Line {
    if (this._startLine) return this._startLine;
    this._startLine = calculateLine(this.text, this.start);
    return this._startLine;
  }

  get endLine(): Line {
    if (this._endLine) return this._endLine;
    this._endLine = calculateLine(this.text, this.end);
    return this._endLine;
  }

  /*
   * find the full line corresponding to the beginning of this span, and "mark"
   * the span with `~` characters. returns a two-element array containing the
   * full line and the line with squiggles.
   */
  toSquiggles(): [ string, string ] {
    // for a span covering multiple lines, just show the first line.
    let endxpos = (this.endLine.lineNumber != this.startLine.lineNumber) ? this.startLine.endOfLine : this.endLine.xpos;
    if (endxpos == this.startLine.xpos) endxpos++;

    let squiggles = "";
    for (let i = 0; i < this.startLine.xpos; i++) squiggles += " ";
    for (let i = this.startLine.xpos; i < endxpos; i++) squiggles += "~";
    return [ this.text.slice(this.startLine.startOfLine, this.startLine.endOfLine), squiggles ];
  }

  /*
   * return a segment of the line "around" (left and right of) the start of
   * this span.
   */
  around(width: number): string {
    const line = this.startLine;
    const text = this.text.slice(line.startOfLine, line.endOfLine);

    let left = line.xpos - width;
    let right = line.xpos + width;
    if (left < 0) left = 0;
    if (right >= text.length) right = text.length - 1;
    return text.slice(left, line.xpos) + "[" + (text[line.xpos] || "") + "]" + text.slice(line.xpos + 1, right + 1);
  }

  /*
   * return a span covering both this span and another.
   */
  merge(other: Span): Span {
    if (this.start < other.start) {
      return new Span(this.text, this.start, other.end);
    } else {
      return new Span(this.text, other.start, this.end);
    }
  }
}
