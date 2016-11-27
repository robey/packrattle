import { chain, repeat, RepeatOptions, seq } from "./combiners";
import { newParser, Parser } from "./parser";

/*
 * chain together a sequence of parsers. before each parser is checked, the
 * 'ignore' parser is optionally matched and thrown away. this is typicially
 * used for discarding whitespace in lexical parsing.
 */
export function seqIgnore<A, B>(ignore: Parser<A>, ...parsers: Parser<any>[]): Parser<any[]> {
  return seq(...parsers.map(p => chain(ignore.optional(), p, (a, b) => b)));
}

/*
 * like 'repeat', but each element may be optionally preceded by 'ignore',
 * which will be thrown away. this is usually used to remove leading
 * whitespace.
 */
export function repeatIgnore<A, B>(ignore: Parser<A>, p: Parser<B>, options: RepeatOptions = {}): Parser<B[]> {
  return repeat(chain(ignore.optional(), p, (a, b) => b), options);
}

/*
 * like 'repeat', but the repeated elements are separated by 'separator',
 * which is ignored.
 */
export function repeatSeparated<A, B>(separator: Parser<A>, p: Parser<B>, options: RepeatOptions = {}): Parser<B[]> {
  const min = options.min ? options.min - 1 : 0;
  const max = options.max ? options.max - 1 : Infinity;
  const p2 = chain(separator, p, (a, b) => b);
  return chain(p, repeat(p2, { min, max }), (a, b) => [ a ].concat(b));
}
