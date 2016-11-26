import { ParserState } from "./parser_state";
import { Span } from "./span";
import { quote } from "./strings";


export abstract class BaseMatch<T> {
  public readonly match: boolean;
  public readonly startpos: number;
  public readonly state: ParserState<T>;
  public readonly commit: boolean;

  abstract inspect(): string;

  /*
   * return the covering span of the current match.
   */
  abstract span(): Span;

  /*
   * determine how "important" this match is (larger number: higher priority).
   */
  get priority() {
    // higher startpos is better.
    let rv = this.startpos;
    // commit is even better.
    if (this.commit) rv += Math.pow(2, 40);
    return rv;
  }
}


export class FailedMatch<T> extends BaseMatch<T> {
  match = false;

  constructor(
    public readonly startpos: number,
    public readonly state: ParserState<T>,
    public readonly message: string,
    public readonly commit: boolean,
    public readonly generated: boolean
  ) {
    super();
  }

  inspect(): string {
    const fields = [
      "state=" + this.state.id,
      "span=" + this.span().inspect(),
      "error='" + quote(this.message) + "'"
    ];
    if (this.commit) fields.push("commit");
    if (this.generated) fields.push("generated");
    return `FailedMatch(${fields.join(", ")}`;
  }

  span(): Span {
    return new Span(this.state.text, this.startpos, this.startpos);
  }

  /*
   * for combiners: convert this error into an error for a state higher up
   * the tree.
   */
  forState<U>(state: ParserState<U>, commit: boolean = false): FailedMatch<U> {
    return new FailedMatch(this.startpos, state, this.message, this.commit || commit, this.generated);
  }

  withMessage(message: string): FailedMatch<T> {
    return new FailedMatch<T>(this.startpos, this.state, message, this.commit, false);
  }
}


export class SuccessfulMatch<T> extends BaseMatch<T> {
  match = true;

  constructor(
    public readonly startpos: number,
    public readonly pos: number,
    public readonly state: ParserState<T>,
    public readonly value: T,
    public readonly commit: boolean
  ) {
    super();
  }

  inspect(): string {
    const fields = [
      "state=" + this.state.id,
      "span=" + this.span().inspect(),
      "value='" + quote(this.value["inspect"] ? this.value["inspect"]() : this.value) + "'"
    ];
    if (this.commit) fields.push("commit");
    return `SuccessfulMatch(${fields.join(", ")}`;
  }

  span(): Span {
    return new Span(this.state.text, this.startpos, this.pos);
  }

  /*
   * return a match with a span covering both this one and another.
   */
  merge<U>(other: SuccessfulMatch<any>, state: ParserState<U>, newValue: U): SuccessfulMatch<U> {
    const startpos = Math.min(this.startpos, other.startpos);
    const pos = Math.max(this.pos, other.pos);
    const commit = this.commit || other.commit;
    return new SuccessfulMatch<U>(startpos, pos, state, newValue, commit);
  }
}


export type Match<T> = FailedMatch<T> | SuccessfulMatch<T>;


//
//   withState(state) {
//     return new Match(this.ok, state, this);
//   }
//
//   withValue(value) {
//     const rv = new Match(this.ok, this.state, this);
//     rv.value = value;
//     return rv;
//   }
//
//   toError(message) {
//     const rv = new Match(false, this.state, this);
//     rv.value = message;
//     rv.generated = false;
//     return rv;
//   }
//
//   changeGeneratedMessage(message) {
//     if (!this.generated) return this;
//     const rv = new Match(false, this.state, this);
//     rv.value = message;
//     return rv;
//   }
//
//   setCommit() {
//     const rv = new Match(this.ok, this.state, this);
//     rv.commit = true;
//     return rv;
//   }
