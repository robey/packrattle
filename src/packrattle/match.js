"use strict";

const util = require("util");

/*
 * created by ParserState on demand.
 */
class Match {
  constructor(ok, state, options = {}) {
    this.ok = ok;
    this.state = state;
    this.commit = options.commit;
    this.abort = options.abort;
    // either a boxed result or an error message:
    this.value = options.value;
  }

  equals(other) {
    return this.ok == other.ok && this.state.pos == other.state.pos && this.value == other.value;
  }

  toString() {
    const fields = [
      this.ok ? "yes" : "no",
      "state=" + this.state,
      "value=" + util.inspect(this.value)
    ];
    if (this.commit) fields.push("commit");
    if (this.abort) fields.push("abort");
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
    return rv;
  }

  setCommit() {
    const rv = new Match(this.ok, this.state, this);
    rv.commit = true;
    return rv;
  }

  setAbort() {
    const rv = new Match(this.ok, this.state, this);
    rv.abort = true;
    rv.commit = false;
    return rv;
  }
}


exports.Match = Match;
