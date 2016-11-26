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
        state.result.add(state.success(rv, pos, commit));
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

// /*
//  * chain together a sequence of parsers. before each parser is checked, the
//  * 'ignore' parser is optionally matched and thrown away. this is typicially
//  * used for discarding whitespace in lexical parsing.
//  */
// export function seqIgnore(ignore, ...parsers) {
//   const newseq = [];
//   parsers.forEach(p => {
//     newseq.push(drop(optional(ignore)));
//     newseq.push(p);
//   });
//   return seq(...newseq);
// }

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
        if (match.match) {
          state.result.add(match);
        } else {
          if (match instanceof SuccessfulMatch) {
            // skip other alternatives; dump error buffer.
            aborting = true;
            fails.splice(0, fails.length);
            state.result.add(match);
            return;
          } else {
            fails.push(match);
          }
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

// /*
//  * throw away the match value, equivalent to `map(null)`.
//  */
// export function drop(p) {
//   return newParser("drop", { wrap: p, cacheable: true }, (state, results, p) => {
//     state.schedule(p).then(match => {
//       results.add(match.ok ? match.withValue(null) : match);
//     });
//   });
// }

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

// /*
//  * check that this parser matches, but don't advance our position in the
//  * string. (perl calls this a zero-width lookahead.)
//  */
// export function check(p) {
//   return newParser("check", { wrap: p, cacheable: true }, (state, results, p) => {
//     state.schedule(p).then(match => {
//       results.add(match.ok ? match.withState(state) : match);
//     });
//   });
// }
//
// /*
//  * if this parser matches, "commit" to this path and refuse to backtrack to
//  * previous alternatives.
//  */
// export function commit(p) {
//   return newParser("commit", { wrap: p, cacheable: true }, (state, results, p) => {
//     state.schedule(p).then(match => {
//       results.add(match.ok ? match.setCommit() : match);
//     });
//   });
// }
//
// /*
//  * succeed (with an empty match) if the inner parser fails; otherwise fail.
//  */
// export function not(p) {
//   return newParser("not", { wrap: p, cacheable: true }, (state, results, p) => {
//     state.schedule(p).then(match => {
//       results.add(
//         match.ok ?
//         state.failure(null, match.commit) :
//         state.success("", match.commit));
//     });
//   });
// }
//
// /*
//  * from 'min' to 'max' (inclusive) repetitions of a parser, returned as an
//  * array. 'max' may be omitted to mean infinity.
//  */
// export function repeat(p, options = {}) {
//   const min = options.min || 0;
//   const max = options.max || Infinity;
//   return newParser("repeat", {
//     children: [ p ],
//     describe: list => list.join() + (max == Infinity ? `{${min}+}` : `{${min}, ${max}}`)
//   }, (state, results, p) => {
//     function next(match, startingState, list = [], count = 0) {
//       if (!match.ok) {
//         // if we were committed, don't backtrack.
//         if (match.commit) return results.add(match);
//         // intentionally use the "last good state" from our repeating parser.
//         return results.add(count >= min ?
//           state.merge(startingState).success(list, match.commit) :
//           state.failure());
//       }
//       count++;
//       const newlist = match.value != null ? list.concat([ match.value ]) : list;
//       if (count >= min) results.add(state.merge(match.state).success(newlist, match.commit));
//       if (count < max) {
//         // if a parser matches nothing, we could go on forever...
//         if (match.state.pos == state.pos) {
//           throw new Error(`Repeating parser isn't making progress at position ${state.pos}: ${p}`);
//         }
//         match.state.schedule(p).then(m => next(m, match.state, newlist, count));
//       }
//     }
//
//     state.schedule(p).then(m => next(m, state));
//   });
// }
//
// /*
//  * like 'repeat', but each element may be optionally preceded by 'ignore',
//  * which will be thrown away. this is usually used to remove leading
//  * whitespace.
//  */
// export function repeatIgnore(p, ignore, options) {
//   return repeat(seq(optional(ignore).drop(), p).map(x => x[0]), options);
// }
//
// /*
//  * like 'repeat', but the repeated elements are separated by 'separator',
//  * which is ignored.
//  */
// export function repeatSeparated(p, separator = "", options = {}) {
//   const min = options.min ? options.min - 1 : 0;
//   const max = options.max ? options.max - 1 : Infinity;
//   const p2 = seq(drop(separator), p).map(x => x[0]);
//   return seq(p, repeat(p2, { min, max })).map(x => {
//     return [ x[0] ].concat(x[1]);
//   });
// }
//
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
