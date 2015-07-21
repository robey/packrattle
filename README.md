![packrattle](docs/packrattle-small.png)

[![Build Status](https://travis-ci.org/robey/packrattle.png?branch=master)](https://travis-ci.org/robey/packrattle)

This is a simple GLL-based parser-combinator library for javascript. It lets you write parsing code without the use of an external tool like lex or antlr: the parser is written in javascript just like the rest of your code!

An example, from the unit tests:

```javascript
var packrattle = require("packrattle");

var csv = packrattle.repeatSeparated(
  pr(/([^,]*)/).onMatch(m => m[0]),
  /,/
);

csv.run("this,is,csv");
=> [ "this", "is", "csv" ]
```

Parser-combinators start from a simple idea: A "parser" is a function that takes a string and a position within that string, and either fails to match, or succeeds, returning the matched value and moving the position forward. In other words, a parser does:

    position => { newPosition, value }

on success, or

    position => error

on failure.

You can start with a few basic parsers which match a string or regular expression, and build more complex parsers out of functions that combine them: "a or b", "a then b", "repeat(a)", and so on.

Being "GLL-based" means that a work queue is used to avoid recursion and to memoize (cache) intermediate results. This lets you parse almost any grammar, even if it's left recursive or ambiguous. For example, the grammar

    expr ::= (expr "+" expr) | /\d+/

would need to be refactored a lot to work in most parser libraries. It can be expressed in packrattle as

```javascript
var expr = packrattle.alt(
  packrattle.seq(() => expr, "+", () => expr),
  packrattle.regex(/\d+/).onMatch(m => m[0])
);
```

and it actually matches strings:

```javascript
expr.run("3+10+200");
// [ [ '3', '+', '10' ], '+', '200' ]
```

The nested functions (`() => expr`) on line 2 allow javascript to handle recursive definitions by delaying evaluation. The functions will only be called once (when first invoked) and then cached.


Further reading
---------------

- There's a wiki page on parser-combinators here: http://en.wikipedia.org/wiki/Parser_combinator

- Vegard Øye has an excellent (highly-recommended) tutorial on how GLL parsers work, with an implementation in a lisp-like language: https://github.com/epsil/gll

- Daniel Spiewak wrote a paper on GLL and his work upgrading scala's parser-combinator library to use it: http://www.cs.uwm.edu/~dspiewak/papers/generalized-parser-combinators.pdf
















Implicit conversion
-------------------

Any function that takes a parser will also implicitly convert non-parser objects into parsers, to simplify your code:

- A string will be converted to `string(...)`.

- A regex will be converted to `regex(...)`.

- An array will be converted to `seq(...)`.

- A function will be called (with no arguments), under the assumption that it returns a parser. each function is called exactly once, and the result is cached. this can be used to make forward references, if your parser is recursive.

The packrattle module object can be used as a function for converting objects into parsers, so:

```javascript
pr.seq(pr.regex(/\d+/), pr.string("!").drop())
```

can also be expressed as:

```javascript
pr([ /\d+/, pr("!").drop() ])
```


Executing
---------

The simplest way to execute a parser is to call the `run` method on it, with a string to parse:

```javascript
expr.run("3+20*5")
```

This attempts to match the entire string by calling `consume` (see below). If it succeeds, the 'match' object is returned. If it fails, an Error is thrown with a `state` field containing the parser state of the error, described below.

There are also two manual ways to execute a parser:

- `pr.parse(parser, string, options = {})` - matches as much of the string as it can
- `pr.consume(parser, string, options = {})` - matches the entire string, or fails

Because packrattle will stop once it succeeds in matching, you usually want 'consume'. In some ambiguous parsers, 'parse' may seem to stop before consuming much of the string, because it operates "lazily" instead of "greedily".

(`consume(p, s)` is just an alias for `parse(seq(p, end), s)`.)

Both 'parse' and 'consume' return a match object with these fields:

- `ok` - true if the parser succeeded, false if not
- `state` - a `ParserState` object with the current position (see below)
- `match` - the match result (if `ok` is true)
- `message` - a string error message (if `ok` is false)

The `ParserState` object contains a few helper methods:

- `pos()` - the index within the string of the successful match or last error
- `endpos()` - the index within the string of the successful match (for errors, same as `pos()`)
- `lineno()` - the current line number of `pos()`, assuming `\n` divides lines, counting from 0
- `line()` - the text of the line around `pos()`, assuming `\n` divides lines
- `toSquiggles()` - an array containing `line()` and a a string with little squiggle characters highlighting the span of `pos()` to `endpos()`




Author
------

Credit and blame: Robey Pointer <robeypointer@gmail.com>

Special thanks to Daniel Spiewak, Brian McKenna, and Vegard Øye for sharing info about GLL.
