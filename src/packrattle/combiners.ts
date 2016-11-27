import { FailedMatch, Match, SuccessfulMatch } from "./match";
import { newParser, Parser } from "./parser";
import { LazyParser } from "./resolve";
import { ParserState } from "./parser_state";

/*
 * chain together parsers p1 & p2 such that if p1 matches, p2 is executed on
 * the following state. if both match, `combiner` is called with the two
 * matched objects, to create a single match result.
 */
export function chain<R, T1, T2>(p1: Parser<T1>, p2: Parser<T2>, combiner: (r1: T1, r2: T2) => R): Parser<R> {
  return newParser<R>("chain", {
    cacheable: true,
    children: [ p1, p2 ],
    describe: list => `${list[0]} then ${list[1]}`
  }, (state, [ p1, p2 ]) => {
    state.schedule(p1, state.pos).then((match1: Match<T1>) => {
      if (match1 instanceof FailedMatch) {
        state.result.add(match1.forState(state));
      } else {
        match1.state.schedule(p2, match1.pos).then((match2: Match<T2>) => {
          if (match2 instanceof FailedMatch) {
            // no backtracking if the left match was commit()'d.
            state.result.add(match2.forState(state, match1.commit));
          } else {
            state.result.add(match1.merge(match2, state, combiner(match1.value, match2.value)));
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
export function seq(...parsers: LazyParser[]): Parser<any[]> {
  return newParser<any[]>("seq", {
    cacheable: true,
    children: parsers,
    describe: list => "[ " + list.join(", ") + " ]"
  }, (state, parsers) => {
    let commit = false;

    function next(i: number, pos: number, rv: any[] = []) {
      if (i >= parsers.length) {
        state.result.add(state.success(rv, pos - state.pos, commit));
        return;
      }
      const p = parsers[i];
      state.schedule(p, pos).then(match => {
        // no backtracking if we commit()'d in this chain.
        if (match instanceof FailedMatch) {
          state.result.add(match.forState(state, commit));
          return;
        }
        if (match.commit) commit = true;
        next(i + 1, match.pos, rv.concat([ match.value ]));
      });
    }

    next(0, state.pos);
  });
}

/*
 * try each of these parsers, in order (starting from the same position),
 * looking for the first match.
 */
export function alt(...parsers: LazyParser[]): Parser<any> {
  return newParser("alt", {
    cacheable: true,
    children: parsers,
    describe: list => list.join(" or ")
  }, (state, parsers) => {
    let aborting = false;
    let count = 0;
    const fails: FailedMatch<any>[] = [];
    parsers.forEach(p => {
      state.schedule(p, state.pos, () => !aborting).then(match => {
        if (match instanceof SuccessfulMatch) {
          state.result.add(match);
        } else {
          if (match.commit) {
            // skip other alternatives; dump error buffer.
            aborting = true;
            fails.splice(0, fails.length);
            state.result.add(match);
            return;
          }
          fails.push(match);
        }
        // save up all the fails. if *all* of the alternatives fail, summarize it.
        count++;
        if (count == parsers.length) {
          if (count == fails.length) {
            state.result.add(state.failure());
          } else {
            fails.forEach(f => state.result.add(f));
          }
        }
      });
    });
  });
}

/*
 * allow a parser to fail, and instead return undefined (js equivalent of
 * the Optional type).
 */
export function optional<T>(p: Parser<T>): Parser<T | undefined> {
  return newParser<T | undefined>("optional", {
    children: [ p ],
    cacheable: true
  }, (state, [ p ]) => {
    state.schedule(p, state.pos).then(match => {
      if (match instanceof SuccessfulMatch) state.result.add(match);
      // unless we committed to p, always try the non-p case too.
      if (!match.commit) state.result.add(state.success(undefined));
    });
  });
}

/*
 * allow a parser to fail, and instead return a default value (the empty string
 * if no other value is provided).
 */
export function optionalOr<T>(p: Parser<T>, defaultValue: T): Parser<T> {
  return newParser<T>("optionalOr", {
    children: [ p ],
    cacheable: (defaultValue == null || typeof defaultValue == "string" || typeof defaultValue == "number"),
    extraCacheKey: defaultValue == null ? "(null)" : ("str:" + defaultValue)
  }, (state, [ p ]) => {
    state.schedule(p, state.pos).then(match => {
      if (match instanceof SuccessfulMatch) state.result.add(match);
      // unless we committed to p, always try the non-p case too.
      if (!match.commit) state.result.add(state.success(defaultValue));
    });
  });
}

/*
 * check that this parser matches, but don't advance our position in the
 * string. (perl calls this a zero-width lookahead.)
 */
export function check<T>(p: Parser<T>): Parser<T> {
  return newParser<T>("check", { children: [ p ], cacheable: true }, (state, [ p ]) => {
    state.schedule(p, state.pos).then(match => {
      if (match instanceof FailedMatch) {
        state.result.add(match);
        return;
      }
      state.result.add(state.success(match.value, 0, match.commit));
    });
  });
}

/*
 * if this parser matches, "commit" to this path and refuse to backtrack to
 * previous alternatives.
 */
export function commit<T>(p: Parser<T>): Parser<T> {
  return newParser<T>("commit", { children: [ p ], cacheable: true }, (state, [ p ]) => {
    state.schedule(p, state.pos).then(match => {
      state.result.add(match instanceof SuccessfulMatch ? match.withCommit() : match);
    });
  });
}

/*
 * succeed (with an empty match) if the inner parser fails; otherwise fail.
 */
export function not<T>(p: Parser<T>): Parser<null> {
  return newParser<null>("not", { children: [ p ], cacheable: true }, (state, [ p ]) => {
    state.schedule(p, state.pos).then(match => {
      state.result.add(
        match instanceof SuccessfulMatch ?
          state.failure(undefined, match.commit) :
          state.success(null, 0, match.commit));
    });
  });
}

export interface RepeatOptions {
  min?: number;
  max?: number;
}

/*
 * from 'min' to 'max' (inclusive) repetitions of a parser, returned as an
 * array. 'max' may be omitted to mean infinity.
 */
export function repeat<T>(p: Parser<T>, options: RepeatOptions = {}): Parser<T[]> {
  const min = options.min || 0;
  const max = options.max || Infinity;

  return newParser<T[]>("repeat", {
    children: [ p ],
    describe: list => list.join() + (max == Infinity ? `{${min}+}` : `{${min}, ${max}}`)
  }, (state, [ p ]) => {
    // if 0 is ok, then instantly we have zero.
    if (min == 0) state.result.add(state.success([], 0));

    function next(match: Match<T>, list: T[] = [], count: number = 0) {
      if (match instanceof FailedMatch) {
        // if we were committed, don't backtrack.
        if (match.commit) {
          state.result.add(match.forState(state));
        } else if (count < min) {
          // intentionally use the "last good state" from our repeating parser.
          state.result.add(state.failure());
        }
        return;
      }

      count++;
      const newlist = list.concat([ match.value ]);
      if (count >= min) state.result.add(state.success(newlist, match.pos - state.pos, match.commit));
      if (count < max) {
        // if a parser matches nothing, we could go on forever...
        if (match.pos == match.startpos) {
          throw new Error(`Repeating parser isn't making progress at position ${match.pos}: ${p}`);
        }
        match.state.schedule(p, match.pos).then(m => next(m, newlist, count));
      }
    }

    state.schedule(p, state.pos).then(m => next(m));
  });
}

// /*
//  * convenience method for reducing the result of 'repeatSeparated', optionally
//  * keeping the separator results. if 'accumulator' exists, it will transform
//  * the initial result into an accumulator. if 'reducer' exists, it will be
//  * used to progressively attach separators and new results.
//  */
// export function reduce(p, separator = "", options = {}) {
//   const first = options.first || (x => [ x ]);
//   const next = options.next || ((sum, sep, x) => sum.push(x));
//   const min = options.min ? options.min - 1 : 0;
//   const max = options.max ? options.max - 1 : Infinity;
//
//   return seq(p, repeat(seq(separator, p), { min, max })).map(([ initial, remainder ]) => {
//     return [ first(initial) ].concat(remainder).reduce((sum, [ sep, item ]) => {
//       // 'sep' may have been dropped.
//       if (item === undefined) {
//         item = sep;
//         sep = null;
//       }
//       return next(sum, sep, item);
//     });
//   });
// }
