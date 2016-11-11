"use strict";

import { quote } from "./strings";

/*
 * created by ParserState on demand.
 */
export default class Match {
  constructor(ok, state, options = {}) {
    this.ok = ok;
    this.state = state;
    this.commit = options.commit;
    // either a boxed result or an error message:
    this.value = options.value;
    // is this an auto-generated error message?
    this.generated = options.generated;
  }

  equals(other) {
    return this.ok == other.ok && this.state.pos == other.state.pos && this.value == other.value;
  }

  inspect() {
    const fields = [
      this.ok ? "yes" : "no",
      "state=" + this.state.inspect(),
      "value='" + quote(this.value && this.value.inspect ? this.value.inspect() : this.value) + "'"
    ];
    if (this.commit) fields.push("commit");
    fields.push(`priority=0x${this.priority.toString(16)}`);
    return "Match(" + fields.join(", ") + ")";
  }

  withState(state) {
    return new Match(this.ok, state, this);
  }

  withValue(value) {
    const rv = new Match(this.ok, this.state, this);
    rv.value = value;
    return rv;
  }

  toError(message) {
    const rv = new Match(false, this.state, this);
    rv.value = message;
    rv.generated = false;
    return rv;
  }

  changeGeneratedMessage(message) {
    if (!this.generated) return this;
    const rv = new Match(false, this.state, this);
    rv.value = message;
    return rv;
  }

  setCommit() {
    const rv = new Match(this.ok, this.state, this);
    rv.commit = true;
    return rv;
  }

  // determine how "important" this match is (larger number: higher priority).
  get priority() {
    // higher startpos is better.
    let rv = this.state.startpos;
    // commit is even better.
    if (this.commit) rv += Math.pow(2, 40);
    return rv;
  }
}
