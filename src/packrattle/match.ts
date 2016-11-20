import { ParserState } from "./parser_state";
import { Span } from "./span";
import { quote } from "./strings";

/*
 * created by ParserState on demand.
 */
export class Match<T> {
  constructor(
    public readonly ok: boolean,
    public readonly startpos: number,
    public readonly pos: number,
    public readonly state: ParserState<T>,
    public readonly commit: boolean,
    public readonly generated: boolean,
    public readonly value: T | undefined,
    public readonly errorMessage: string | undefined
  ) {
    // pass.
  }

  inspect(): string {
    const fields = [
      this.ok ? "yes" : "no",
      "state=" + this.state.id,
      "span=" + this.span().inspect()
    ];
    if (this.value) fields.push("value='" + quote(this.value["inspect"] ? this.value["inspect"]() : this.value) + "'");
    if (this.errorMessage) fields.push(`error='${this.errorMessage}'`);
    if (this.commit) fields.push("commit");
    if (this.generated) fields.push("generated");
    // fields.push(`priority=0x${this.priority.toString(16)}`);
    return "Match(" + fields.join(", ") + ")";
  }

  /*
   * return a match with a span covering both this one and another.
   */
  merge(other: Match<any>): Match<T> {
    const startpos = Math.min(this.startpos, other.startpos);
    const pos = Math.max(this.pos, other.pos);
    const commit = this.commit || other.commit;
    const generated = this.generated || other.generated;
    return new Match<T>(this.ok, startpos, pos, this.state, commit, generated, this.value, this.errorMessage);
  }

  /*
   * return the covering span of the current match.
   */
  span(): Span {
    return new Span(this.state.text, this.startpos, this.pos);
  }


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

  // determine how "important" this match is (larger number: higher priority).
  get priority() {
    // higher startpos is better.
    let rv = this.startpos;
    // commit is even better.
    if (this.commit) rv += Math.pow(2, 40);
    return rv;
  }
}
