
packrattle
==========

this is a simple parser-combinator library for javascript/coffeescript.

an example, from the unit tests:

    parser = require("packrattle")

    binary = (left, op, right) -> { op: op, left: left, right: right }
    ws = /\s*/
    number = parser.regex(/\d+/).skip(ws).onMatch (m) -> parseInt(m[0])
    parens = parser.seq(
      parser.string("(").skip(ws).drop(),
      (-> expr),
      parser.string(")").skip(ws).drop()
    ).onMatch (e) -> e[0]
    atom = number.or(parens)
    term = atom.chain(parser.string("*").or("/").or("%").skip(ws), binary)
    expr = term.chain(parser.string("+").or("-").skip(ws), binary)

    expr.exec("1 + 2 * 3 + 4 * (5 + 6)")

there's a wiki page on parser-combinators here:
http://en.wikipedia.org/wiki/Parser_combinator

but the basic idea is that a "parser" is a function that takes a string and
position, processes some chunk of the string, and returns a new position,
along with the digested part of the string. in other words, a parser does:

    (position) -> (position, result)

on success, or

    (position) -> (position, error_message)

on failure.

you can start with a few basic parsers which match a string or regex, and
build more complex parsers out of functions that combine them: "a or b",
"a then b", "repeat(a)", and so on.

basic methods
-------------

a few basic parsers just process a chunk of text:

- `parser.string(...)` - match exactly this string, and return it

- `parser.regex(...)` - match this regex, and return the "match" object
  (which can be used to extract any groups)

- `parser.end` - matches only the end of the string

- `parser.reject` - always fails to match

combinators
-----------

the real power is in combining the parsers:

- `parser.seq(p1, p2, ...)` - match all of p1, p2, ... in sequence; the match
  result will be an array of all of the non-null match results of p1 and
  friends

- `parser.optional(p)` - match p or return the empty string, succeeding
  either way

- `parser.repeat(p, atLeast, sep)` - match p multiple times (often written
  as "`p*`"), optionally separated by `sep` (for example, a comma); the match
  result will be an array of all the non-null match results, not including
  the separators

- `parser.foldLeft(args)` - see below

each parser has methods on it, also, to allow for combining:

- `onFail(newMessage)` - replace the error message for this parser when it
  fails to match

- `onMatch(function)` - transform the result of this parser: the function
  takes the parser's match result and returns the new result

- `matchIf(function)` - if the parser matches, the function gets the parser's
  match result and returs true/false -- if false, the parser fails to match
  after all

- `not()` - if the parser matches, it fails; if it fails, it matches and
  returns the empty string

- `or(p)` - if the parser matches, it returns normally, but if it fails, p is
  tried instead

- `skip(p)` - check if p matches before trying this parser, and throw p's
  result away if it matches -- useful for skipping whitespace before a parser

- `then(p)` - if this parser matches, try matching p next (just like `seq`)

- `optional()` - make this parser optional, like `parser.optional`

- `repeat(atLeast, sep)` - just like `parser.repeat`

- `reduce(sep, function)` - a simpler variant of `foldLeft` (see below)

- `drop()` - if this parser matches, return null as the match result, which
  will cause it to be omitted from the result of `parser.seq`

foldLeft
--------

`foldLeft` is a slightly more complex/powerful combinator, which matches a
sequence of nested parsers with optional separators and combines them as they
are parsed. it takes a hash of key/value parameters:

- `first` - the parser to match the first occurance (defaults to `tail` if
  not supplied)
- `tail` - the parser to match all successive occurances
- `sep` - optional parser to match the things separating the items (comma,
  for example); if missing or null, no separators are parsed
- `accumulator` - a function to transform the first match result into a
  running accumulator of the parser (defaults to an array containing only
  the first match result)
- `fold` - a function to transform the current accumulator and the new item
  (and its separator) into a new accumulator: `fold(accumulator, sep, item)`
  (defaults to calling `accumulator.push(item)`)

for example, to match a sequence of numbers separated by "+" and add them:

    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = parser.foldLeft(
      tail: number
      sep: parser.string("+")
      accumulator: (n) -> n
      fold: (sum, op, n) -> sum + n
    )

this is aliased to "reduce" on Parser, with a simplified interface:

    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = parser.foldLeft(
      tail: number
      sep: parser.string("+")
      accumulator: (n) -> n
      fold: (sum, op, n) -> sum + n
    )

implicit conversion
-------------------

for many functions, an object that isn't a parser will be converted into a
parser at runtime, to simplify your code:

- a string will be converted to `parser.string(...)`

- a regex will be converted to `parser.regex(...)`

- an array will be converted to `parser.seq(...)`

- a function will be called, under the assumption that it returns a parser --
  but only when the parser is `exec`'d, allowing for lazy evaluation


