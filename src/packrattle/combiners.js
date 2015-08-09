"use strict";

const parser = require("./parser");

/*
 * chain together parsers p1 & p2 such that if p1 matches, p2 is executed on
 * the following state. if both match, `combiner` is called with the two
 * matched objects, to create a single match result.
 */
function chain(p1, p2, combiner) {
  return parser.newParser("chain", {
    children: [ p1, p2 ],
    describe: (list) => `${list[0]} then ${list[1]}`,
  }, (state, results, p1, p2) => {
    state.schedule(p1).then(match1 => {
      if (!match1.ok) {
        results.add(match1);
      } else {
        match1.state.schedule(p2).then(match2 => {
          if (!match2.ok) {
            // no backtracking if the left match was commit()'d.
            results.add(match1.commit ? match2.setCommit() : match2);
          } else {
            const newState = match2.state.merge(match1.state);
            const value = combiner(match1.value, match2.value);
            results.add(newState.success(value, match1.commit || match2.commit));
          }
        });
      }
    });
  });
}

/*
 * chain together a series of parsers as in 'chain'. the match value is an
 * array of non-null match values from the inner parsers.
 */
function seq(...parsers) {
  return parser.newParser("seq", {
    cacheable: true,
    children: parsers,
    describe: list => "[ " + list.join(", ") + " ]"
  }, (state, results, ...parsers) => {
    let commit = false;

    function next(state, i, rv = []) {
      if (i >= parsers.length) return results.add(state.success(rv, commit));
      const p = parsers[i];
      state.schedule(p).then(match => {
        // no backtracking if we commit()'d in this chain.
        if (!match.ok) return results.add(commit ? match.setCommit() : match);
        if (match.commit) commit = true;
        next(state.merge(match.state), i + 1, match.value != null ? rv.concat([ match.value ]) : rv);
      });
    }

    next(state, 0);
  });
}

/*
 * chain together a sequence of parsers. before each parser is checked, the
 * 'ignore' parser is optionally matched and thrown away. this is typicially
 * used for discarding whitespace in lexical parsing.
 */
function seqIgnore(ignore, ...parsers) {
  const newseq = [];
  parsers.forEach(p => {
    newseq.push(drop(optional(ignore)));
    newseq.push(p);
  });
  return seq(...newseq);
}

/*
 * try each of these parsers, in order (starting from the same position),
 * looking for the first match.
 */
function alt(...parsers) {
  return parser.newParser("alt", {
    cacheable: true,
    children: parsers,
    describe: list => list.join(" or ")
  }, (state, results, ...parsers) => {
    let aborting = false;
    let count = 0;
    const fails = [];
    parsers.forEach(p => {
      state.schedule(p, () => !aborting).then(match => {
        if (match.ok) {
          results.add(match);
        } else {
          if (match.commit) {
            // skip other alternatives; dump error buffer.
            aborting = true;
            fails.splice(0, fails.length);
            return results.add(match);
          }
          fails.push(match);
        }
        // save up all the fails. if *all* of the alternatives fail, summarize it.
        count++;
        if (count == parsers.length) {
          if (count == fails.length) {
            results.add(state.failure());
          } else {
            fails.forEach(f => results.add(f));
          }
        }
      });
    });
  });
}

/*
 * throw away the match value, equivalent to `map(null)`.
 */
function drop(p) {
  return parser.newParser("drop", { wrap: p, cacheable: true }, (state, results, p) => {
    state.schedule(p).then(match => {
      results.add(match.ok ? match.withValue(null) : match);
    });
  });
}

/*
 * allow a parser to fail, and instead return a default value (the empty string
 * if no other value is provided).
 */
function optional(p, defaultValue) {
  return parser.newParser("optional", {
    wrap: p,
    cacheable: (typeof defaultValue == "string"),
    extraCacheKey: defaultValue
  }, (state, results, p) => {
    state.schedule(p).then(match => {
      results.add(match);
      // unless we committed to p, always try the non-p case too.
      if (!match.commit) results.add(state.success(defaultValue));
    });
  });
}

/*
 * check that this parser matches, but don't advance our position in the
 * string. (perl calls this a zero-width lookahead.)
 */
function check(p) {
  return parser.newParser("check", { wrap: p, cacheable: true }, (state, results, p) => {
    state.schedule(p).then(match => {
      results.add(match.ok ? match.withState(state) : match);
    });
  });
}

/*
 * if this parser matches, "commit" to this path and refuse to backtrack to
 * previous alternatives.
 */
function commit(p) {
  return parser.newParser("commit", { wrap: p, cacheable: true }, (state, results, p) => {
    state.schedule(p).then(match => {
      results.add(match.ok ? match.setCommit() : match);
    });
  });
}

/*
 * succeed (with an empty match) if the inner parser fails; otherwise fail.
 */
function not(p) {
  return parser.newParser("not", { wrap: p, cacheable: true }, (state, results, p) => {
    state.schedule(p).then(match => {
      results.add(
        match.ok ?
        state.failure(null, match.commit) :
        state.success("", match.commit));
    });
  });
}

/*
 * from 'min' to 'max' (inclusive) repetitions of a parser, returned as an
 * array. 'max' may be omitted to mean infinity.
 */
function repeat(p, options = {}) {
  const min = options.min || 0;
  const max = options.max || Infinity;
  return parser.newParser("repeat", {
     children: [ p ],
     describe: (list) => list.join() + (max == Infinity ? `{${min}+}` : `{${min}, ${max}}`)
  }, (state, results, p) => {
    let count = 0;
    let list = [];

    function next(match, startingState, list = [], count = 0) {
      if (!match.ok) {
        // if we were committed, don't backtrack.
        if (match.commit) return results.add(match);
        // intentionally use the "last good state" from our repeating parser.
        return results.add(count >= min ?
          state.merge(startingState).success(list, match.commit) :
          state.failure());
      }
      count++;
      const newlist = match.value != null ? list.concat([ match.value ]) : list;
      if (count >= min) results.add(state.merge(match.state).success(newlist, match.commit));
      if (count < max) {
        // if a parser matches nothing, we could go on forever...
        if (match.state.pos == state.pos) {
          throw new Error(`Repeating parser isn't making progress at position ${state.pos}: ${p}`);
        }
        match.state.schedule(p).then(m => next(m, match.state, newlist, count));
      }
    }

    state.schedule(p).then(m => next(m, state));
  });
}

/*
 * like 'repeat', but each element may be optionally preceded by 'ignore',
 * which will be thrown away. this is usually used to remove leading
 * whitespace.
 */
function repeatIgnore(p, ignore, options) {
  return repeat(seq(optional(ignore).drop(), p).onMatch(x => x[0]), options);
}

/*
 * like 'repeat', but the repeated elements are separated by 'separator',
 * which is ignored.
 */
function repeatSeparated(p, separator = "", options = {}) {
  const min = options.min ? options.min - 1 : 0;
  const max = options.max ? options.max - 1 : Infinity;
  const p2 = seq(drop(separator), p).onMatch(x => x[0]);
  return seq(p, repeat(p2, { min, max })).onMatch(x => {
    return [ x[0] ].concat(x[1]);
  });
}

/*
 * convenience method for reducing the result of 'repeatSeparated', optionally
 * keeping the separator results. if 'accumulator' exists, it will transform
 * the initial result into an accumulator. if 'reducer' exists, it will be
 * used to progressively attach separators and new results.
 */
function reduce(p, separator = "", options = {}) {
  const first = options.first || (x => [ x ]);
  const next = options.next || ((sum, sep, x) => sum.push(x));
  const min = options.min ? options.min - 1 : 0;
  const max = options.max ? options.max - 1 : Infinity;

  return seq(p, repeat(seq(separator, p), { min, max })).map(([ initial, remainder ]) => {
    return [ first(initial) ].concat(remainder).reduce((sum, [ sep, item ]) => {
      // 'sep' may have been dropped.
      if (item === undefined) {
        item = sep;
        sep = null;
      }
      return next(sum, sep, item);
    });
  });
}


exports.alt = alt;
exports.chain = chain;
exports.check = check;
exports.commit = commit;
exports.drop = drop;
exports.not = not;
exports.optional = optional;
exports.reduce = reduce;
exports.repeat = repeat;
exports.repeatIgnore = repeatIgnore;
exports.repeatSeparated = repeatSeparated;
exports.seq = seq;
exports.seqIgnore = seqIgnore;
