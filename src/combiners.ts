import {
  defer, mapMatch, Match, MatchFailure, MatchResult, MatchSuccess, mergeSpan, schedule, success
} from "./matcher";
import { LazyParser, Parser } from "./parser";
import { quote } from "./strings";

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
              return [ new MatchSuccess<R>(mergeSpan(span1, span2), combiner(value1, value2)) ];
            });
          });
        });
      });
    };
  });
}

/*
 * chain together a series of parsers as in 'chain'. the match value is an
 * array of non-null match values from the inner parsers.
 */
export function seq<A>(...parsers: LazyParser<A>[]): Parser<A, any[]> {
  return new Parser<A, any[]>("seq", {
    cacheable: true,
    children: parsers,
    describe: list => "[ " + list.join(", ") + " ]"
  }, children => {
    function next(i: number, start: number, index: number, rv: any[] = []): MatchResult<A, any[]> {
      if (i >= parsers.length) return success(start, index, rv);
      return schedule<A, any, any[]>(children[i], index, (match: Match<any>) => {
        return mapMatch<A, any, any[]>(match, (span, value) => next(i + 1, start, span.end, rv.concat([ value ])));
      });
    }

    return (stream, index) => next(0, index, index);
  });
}

// alt

/*
 * allow a parser to fail, and instead return undefined (js equivalent of
 * the Optional type).
 */
export function optional<A, Out>(p: Parser<A, Out>): Parser<A, Out | undefined> {
  return optionalOr<A, Out | undefined>(p, undefined);
}

/*
 * allow a parser to fail, and instead return a default value (the empty string
 * if no other value is provided).
 */
export function optionalOr<A, Out>(p: Parser<A, Out>, defaultValue: Out): Parser<A, Out> {
  return new Parser<A, Out>("optionalOr", {
    children: [ p ],
    cacheable: (defaultValue == null || typeof defaultValue == "string" || typeof defaultValue == "number"),
    describe: children => `optionalOr(${children[0]}, ${quote(defaultValue ? defaultValue.toString() : defaultValue)})`
  }, children => {
    return (stream, index) => {
      // always succeed, but also try the optional parser.
      return defer<A, Out>(children[0], index).concat(success(index, index, defaultValue) as MatchResult<A, Out>);
    };
  });
}
