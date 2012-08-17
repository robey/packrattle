packrattle
==========

this is a simple packrat parser-combinator library for coffeescript /
javascript.

an example, from the unit tests:

    parser = require("packrattle")

    csv = parser.repeat(
      parser.regex(/([^,]*)/).onMatch (m) -> m[0]
      /,/
    )

    csv.parse("this,is,csv")
    => { ok: true, match: [ "this", "is", "csv" ] }

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

a "packrat" parser just keeps a cache (for the duration of parsing a single
string) of the results for each parser at each position, so that if there's a
lot of backtracking, it doesn't do the same work over and over again.

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

- `parser.optional(p, defaultValue)` - match p or return the default value
  (usually the empty string), succeeding either way

- `parser.check(p)` - verify that p matches, but don't advance the parser's
  position

- `parser.repeat(p, sep)` - match p multiple times (often written as "`p*`"),
  optionally separated by `sep` (for example, a comma); the match result will
  be an array of all the non-null match results, not including the separators

- `parser.times(count, p)` - match p exactly count times; the match result
  will be an array of all the non-null match results

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

- `repeat(sep)` - just like `parser.repeat`

- `times(count)` - just like `parser.times`

- `reduce(sep, function)` - a simpler variant of `foldLeft` (see below)

- `drop()` - if this parser matches, return null as the match result, which
  will cause it to be omitted from the result of `parser.seq`

- `commit()` - if this parser is part of a sequence, and it matches, then
  backtracking will stop here (no "or" clauses higher up in the parse tree
  will take effect) -- this can be used to give more meaningful error
  messages, since the error message text will not backtrack either

foldLeft
--------

`foldLeft` is a slightly more complex/powerful combinator, which matches a
sequence of nested parsers with optional separators and combines them as they
are parsed. it takes a hash of key/value parameters:

- `first` - the parser to match the first occurance (defaults to `tail` if
  not supplied)
- `tail` - the parser to match all successive occurances
- `sep` - optional parser to match the things separating the items (comma,
  for example); if missing or null, items don't have separators
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
    expr = number.reduce parser.string("+"), (sum, op, n) -> sum + n

implicit conversion
-------------------

for many functions, an object that isn't a parser will be converted into a
parser at runtime, to simplify your code:

- a string will be converted to `parser.string(...)`

- a regex will be converted to `parser.regex(...)`

- an array will be converted to `parser.seq(...)`

- a function will be called, under the assumption that it returns a parser --
  but only when the parser is `parse`d, allowing for lazy evaluation

executing
---------

to execute a parser, call either:

- `parse(string)` - matches as much of the string as it can
- `consume(string)` - matches the entire string, or fails

each function returns an object with state:

- `ok` - true if the parser succeeded, false if not
- `state` - a `ParserState` object with the current position (see below)
- `match` - the match result (if `ok` is true)
- `message` - a string error message (if `ok` is false)

the `ParserState` object contains:

- `text` - the original string
- `pos` - the index within the string that the parser stopped
- `lineno` - the current line number of `pos`, assuming `\n` divides lines,
  counting from 0
- `xpos` - the position of `pos` within the current line, counting from 0
- `line()` - returns the content of the line around `pos` (the `lineno` line)

automatic whitespace skipping
-----------------------------

if a global whitespace parser is set:

    parser.setWhitespace /\s+/

then text matching that parser will be automatically skipped between items in
a `seq`, `times`, or `foldLeft`. it has the same effect as calling `skip` on
each of the tiems.

this global setting is used at the time the parser is constructed, not when
it's used, so you can change its value before and after constructing parsers,
if they have varying whitespace requirements.
