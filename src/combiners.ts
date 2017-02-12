import { mapMatch, Match, MatchFailure, MatchResult, MatchSuccess, mergeSpan, schedule } from "./matcher";
import { Parser } from "./parser";

/*
 * chain together parsers p1 & p2 such that if p1 matches, p2 is executed on
 * the following state. if both match, `combiner` is called with the two
 * matched objects, to create a single match result.
 */
export function chain<A, T1, T2, R>(
  p1: Parser<A, T1>,
  p2: Parser<A, T2>,
  combiner: (r1: T1, r2: T2) => R
): Parser<A, R> {
  return new Parser<A, R>("chain", {
    cacheable: true,
    children: [ p1, p2 ],
    describe: list => `${list[0]} then ${list[1]}`
  }, children => {
    return (stream, index) => {
      return schedule<A, T1, R>(children[0], index, (match1: Match<T1>) => {
        return mapMatch<A, T1, R>(match1, (span1, value1) => {
          return schedule<A, T2, R>(children[1], span1.end, (match2: Match<T2>) => {
            return mapMatch<A, T2, R>(match2, (span2, value2) => {
              return new MatchSuccess<R>(mergeSpan(span1, span2), combiner(value1, value2));
            });
          });
        });
      });
    };
  });
}
