packrattle
==========

[![Build Status](https://travis-ci.org/robey/packrattle.png?branch=master)](https://travis-ci.org/robey/packrattle)

this is a simple GLL-based parser-combinator library for coffeescript / javascript. it lets you write parsing code without the use of an external tool like lex or antlr: the parser is in js/cs with the rest of your code!

an example, from the unit tests:

```coffeescript
pr = require("packrattle")

csv = pr.repeatSeparated(
  pr.regex(/([^,]*)/).onMatch (m) -> m[0]
  /,/
)

pr.consume(csv, "this,is,csv")
=> { ok: true, match: [ "this", "is", "csv" ] }
```

or, in javascript:
```javascript
var pr = require("packrattle");

var csv = pr.repeatSeparated(
  pr.regex(/([^,]*)/).onMatch(function (m) { return m[0]; }),
  /,/
);

pr.consume(csv, "this,is,csv");
=> { ok: true, match: [ "this", "is", "csv" ] }
```

parser-combinators start from a simple idea: a "parser" is a function that takes a string and position, processes some chunk of the string, and returns a new position, along with the digested part of the string. in other words, a parser does:

    (position) -> (new position, result)

on success, or

    (position) -> (position, error_message)

on failure.

you can start with a few basic parsers which match a string or regex, and build more complex parsers out of functions that combine them: "a or b", "a then b", "repeat(a)", and so on.

being "GLL-based" means that a trampoline is used to avoid recursion and to memoize (cache) intermediate results. this lets you parse almost any grammar, even if it's left recursive or ambiguous. for example, the grammar

    expr ::= (expr "+" expr) | /\d+/

would need to be refactored a lot to work in most parser libraries. it can be expressed in packrattle as

```coffeescript
expr = pr.alt(
  pr.seq((-> expr), "+", (-> expr)),
  pr.regex(/\d+/).onMatch((m) -> m[0])
)
```

or in javascript as

```javascript
var expr = pr.alt(
  pr.seq(function() { return expr; }, "+", function() { return expr; }),
  pr.regex(/\d+/).onMatch(function (m) { return m[0]; })
);
```

and it actually matches strings:

```coffeescript
pr.consume(expr, "3+10+200")
=> { ok: true, match: [ [ '3', '+', '10' ], '+', '200' ] }
```

the nested anonymous functions on line 2 allow js/cs to handle recursive definitions by delaying evaluation. the functions will only be called once (when first invoked) and then cached.


further reading
---------------

- there's a wiki page on parser-combinators here: http://en.wikipedia.org/wiki/Parser_combinator

- vegard øye has an excellent (highly-recommended) tutorial on how GLL parsers work, with an implementation in a lisp-like language: https://github.com/epsil/gll

- daniel spiewak wrote a paper on GLL and his work upgrading scala's parser-combinator library to use it: http://www.cs.uwm.edu/~dspiewak/papers/generalized-parser-combinators.pdf


basic parsers
-------------

the basic parsers attempt to match a chunk of text:

- `string("...")` - match exactly this string, and return it

- `regex(/.../)` - match this regex, and return the regex "match" object (which can be used to extract any groups)

- `end` - matches only the end of the string

- `reject` - always fails to match


transforms
----------

parsers have a few methods on them that will allow you to transform the match results. this is how you turn the parser output into an AST, or cause the parser to evaluate expressions as it parses.

for example, this parser matches strings of digits and transforms them into a number:

```javascript
var number = $.regex(/\d+/).onMatch(function (x) { return parseInt(x); });
```

- `onMatch(f)` - if the parser is successful, call 'f' on the match result, using the return value of 'f' as the new match result

- `onFail(newMessage)` - replace the error message for this parser when it fails to match

- `matchIf(f)` - if the parser is successful, call 'f' on the match result: if it returns true, continue as normal, but if it returns false, return a failure to match


combinators
-----------

the real power is in combining the parsers:

- `seq(p1, p2, ...)` - match all of the parsers in sequence; the match result will be an array of all of the non-null match results

- `alt(p1, p2, ...)` - if 'p1' matches, return that as the result; otherwise, try 'p2', and so on until finding a match, or failing if none of the parsers match

- `optional(p, defaultValue)` - match 'p' or return the default value (usually the empty string), succeeding either way

- `repeat(p, minCount=0, maxCount=infinity)` - match 'p' multiple times (often written as "`p*`"); the match result will be an array of all the non-null 'p' results (note that it's trivial to match zero times, so often you want to set 'minCount' to 1)

- `check(p)` - verify that 'p' matches, but don't advance the parser's position; perl calls this a "zero-width lookahead"

- `commit(p)` - if 'p' matches, packrattle will no longer backtrack through previous 'alt' alternatives: the parsing is "committed" to this branch (can be used with 'onFail' to give less ambiguous error messages)

- `not_(p)` - turn a successful match of 'p' into a failure, or a failure into a success (with an empty string as the match result)

- `drop(p)` - if 'p' matches, return null as the match result, which will cause it to be omitted from the result of any sequence

all of the combinators are also defined as methods on the parsers, so you can chain them with method calls. the method versions all take one fewer argument, because the first 'p' is implied.


convenience methods
-------------------

these are trivially implemented using the transforms and combinators above, but are commonly used, so they just come with the library.

- `seqIgnore(ignore, p1, p2, ...)` - like seq, but make an attempt to match 'ignore' before each parser, throwing away the result if it matches and ignoring if it doesn't; typically used to discard whitespace

- `repeatIgnore(ignore, p, minCount=0, maxCount=infinity)` - similar to 'seqIgnore', attempts to match 'ignore' before each iteration of 'p', throwing away the result

- `repeatSeparated(p, separator="", minCount=1, maxCount=infinity)` - like 'repeatIgnore', but there must be at least one match of 'p', the separator is not optional, and the separator is only matched (and discarded) between items


reduce
------

the reduce method is borrowed from scala's parser-combinator library, and is particularly useful for parsing expression trees.

- `reduce(p, separator="", accumulator=null, reducer=null, minCount=1, maxCount=infinity)`

like 'repeatSeparated', it attempts to match at least one 'p', separated by 'separator'. in standard syntax, it matches:

    p (separator p)*

with an optional limit on the minimum or maximum number of 'p' there can be. two functions are called to transform the match results:

- `accumulator(first)` is called with the first result of 'p' and can be used to transform the result, just like 'onMatch'. the default accumulator creates a new array with the match result as its only element.

- `reducer(total, sep, next)` is called for each subsequent match of 'p' and a separator. the first parameter is the total result so far (or the result of the accumulator function). the second is the result of the separator, and the last is the result of the current 'p'. this function should return the new 'total' that will be passed in on future matches.

for example, here is a parser that identifies strings like "3+50+2" and returns the match result 55:

```javascript
var number = pr.regex(/\d+/).onMatch(function (m) { return parseInt(m[0]); });
var expr = pr.reduce(
  number,
  "+",
  function (n) { return n; },
  function (total, sep, n) { return total + n; }
);
```


implicit conversion
-------------------

any function that takes a parser will also implicitly convert non-parser objects into parsers, to simplify your code:

- a string will be converted to `string(...)`.

- a regex will be converted to `regex(...)`.

- an array will be converted to `seq(...)`.

- a function will be called (with no arguments), under the assumption that it returns a parser. each function is called exactly once, and the result is cached. this can be used to make forward references, if your parser is recursive.

the packrattle module object can be used as a function for converting objects into parsers, so:

```javascript
pr.seq(pr.regex(/\d+/), pr.string("!").drop())
```

can also be expressed as:

```javascript
pr([ /\d+/, pr("!").drop() ])
```


executing
---------

to execute a parser, call either:

- `parse(string)` - matches as much of the string as it can
- `consume(string)` - matches the entire string, or fails

because packrattle will stop once it succeeds in matching, you usually want 'consume'. in some ambiguous parsers, 'parse' may seem to stop before consuming much of the string, because it operates "lazily" instead of "greedily".

('consume' is just an alias for `parse(seq(p, end))`.)

both 'parse' and 'consume' return a match object with these fields:

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


author
------

credit and blame: Robey Pointer <robeypointer@gmail.com>

special thanks to daniel spiewak, brian mckenna, and vegard øye for sharing info about GLL.
