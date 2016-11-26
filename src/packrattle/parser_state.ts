import { Engine } from "./engine";
import { FailedMatch, Match, SuccessfulMatch } from "./match";
import { Parser } from "./parser";
import { PromiseSet } from "./promise_set";
import { simple } from "./simple";

/*
 * parser state, used internally.
 */
export class ParserState<T> {
  constructor(
    // text position at the start of the current parser
    public readonly pos: number,
    // debugging indicator: how nested is this parser
    public readonly depth: number,
    // which parser is currently operating?
    public readonly parser: Parser<T>,
    // link back to whatever engine executed me
    public readonly engine: Engine,
    // where to store results for this state
    public readonly result: PromiseSet<Match<T>>
  ) {
    // empty for speed. always use one of the methods or factories.
  }

  inspect() {
    return `ParserState[${this.pos}](depth=${this.depth}, parser.id=${this.parser.id})`;
  }

  // /*
  //  * return a new ParserState with the position advanced `n` places.
  //  * `startpos` is unchanged.
  //  * FIXME: only called when we're about to call success anyway.
  //  */
  // advance(n) {
  //   const rv = new ParserState();
  //   rv.pos = this.pos + n;
  //   rv.startpos = this.pos;
  //   rv.depth = this.depth;
  //   rv.parser = this.parser;
  //   rv.engine = this.engine;
  //   return rv;
  // }

  /*
   * jump to a new parser, increasing the parse depth and reseting the start
   * position.
   */
  next<U>(parser: Parser<U>, pos: number, result: PromiseSet<Match<U>>): ParserState<U> {
    return new ParserState<U>(pos, this.depth + 1, parser, this.engine, result);
  }

  /*
   * convenient (unique) string id
   */
  get id(): string {
    return this.parser ? `${this.parser.id}:${this.pos}` : "start";
  }

  /*
   * current text being parsed
   */
  get text(): string {
    return this.engine.text;
  }

  /*
   * schedule another parser to run, and return the PromiseSet that will
   * eventually contain the result.
   */
  schedule<U>(parser: Parser<U>, pos: number, validCheck?: () => boolean): PromiseSet<Match<U>> {
    return this.engine.schedule<U>(this, parser, pos, validCheck);
  }

  success(value: T, advance: number = 0, commit: boolean = false): Match<T> {
    return new SuccessfulMatch<T>(this.pos, this.pos + advance, this, value, commit);
  }

  failure(errorMessage?: string, commit = false): Match<T> {
    // use "Expected (current parser)" as the default failure message.
    let generated = false;
    if (errorMessage === undefined) {
      if (this.parser !== undefined) {
        errorMessage = "Expected " + this.parser.inspect();
      } else {
        errorMessage = "?";
      }
      generated = true;
    }
    return new FailedMatch<T>(this.pos, this, errorMessage, commit, generated);
  }
}


export function newParserState(engine: Engine): ParserState<null> {
  // just fill with bogus values. engine will call 'next' before starting.
  return new ParserState(0, 0, simple.end(), engine, new PromiseSet<Match<null>>());
}
