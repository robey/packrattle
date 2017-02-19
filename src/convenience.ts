// import { chainin, repeat, RepeatOptions, seq } from "./combiners";
import { chain, optional, repeat, RepeatOptions, seq } from "./combiners";
import { LazyParser, Parser } from "./parser";

/*
 * chain together a sequence of parsers. before each parser is checked, the
 * 'ignore' parser is optionally matched and thrown away. this is typicially
 * used for discarding whitespace in lexical parsing.
 */
export function seqIgnore<A>(ignore: LazyParser<A, any>, ...parsers: LazyParser<A, any>[]): Parser<A, any> {
  return seq(...parsers.map(p => chain(optional(ignore), p, (a, b) => b)));
}

/*
 * like 'repeat', but each element may be optionally preceded by 'ignore',
 * which will be thrown away. this is usually used to remove leading
 * whitespace.
 */
export function repeatIgnore<A, Out>(
  ignore: LazyParser<A, any>,
  p: LazyParser<A, Out>,
  options: RepeatOptions = {}
): Parser<A, Out[]> {
  return repeat(chain(optional(ignore), p, (a, b) => b), options);
}

/*
 * like 'repeat', but the repeated elements are separated by 'separator',
 * which is ignored.
 */
export function repeatSeparated<A, Sep, Out>(
  separator: LazyParser<A, Sep>,
  p: LazyParser<A, Out>,
  options: RepeatOptions = {}
): Parser<A, Out[]> {
  const min = options.min ? options.min - 1 : 0;
  const max = options.max ? options.max - 1 : Infinity;
  const p2 = chain(separator, p, (a, b) => b);
  return chain(p, repeat(p2, { min, max }), (a, b) => [ a ].concat(b));
}

export interface ReduceOptions<Item, Sep, Out> extends RepeatOptions {
  first: (value: Item) => Out;
  next: (sum: Out, sep: Sep, value: Item) => Out;
}

/*
 * convenience method for reducing the result of 'repeatSeparated', optionally
 * keeping the separator results. if 'accumulator' exists, it will transform
 * the initial result into an accumulator. if 'reducer' exists, it will be
 * used to progressively attach separators and new results.
 */
export function reduce<A, Item, Sep, Out>(
  separator: LazyParser<A, Sep>,
  p: LazyParser<A, Item>,
  options: ReduceOptions<Item, Sep, Out>
): Parser<A, Out> {
  const first = options.first;
  const next = options.next;
  const min = options.min ? options.min - 1 : 0;
  const max = options.max ? options.max - 1 : Infinity;

  return chain(
    p,
    repeat(chain(separator, p, (sep, item) => [ sep, item ] as [ Sep, Item ]), { min, max }),
    (initial, remainder) => {
      return remainder.reduce((sum, [ sep, value ]) => next(sum, sep, value), first(initial));
    }
  );
}
