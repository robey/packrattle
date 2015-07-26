# Packrattle API

Packrattle's API consists of functions which make simple parsers (for example, to match a string) and combiners that let you attach parsers together (for example, one parser *or* another). All parsers are objects of type `Parser`, and have a set of useful methods for transforming and executing them.

- [Simple parsers](#simple-parsers)
- [Combiners](#combiners)
  - [Convenience combiners](#convenience-combiners)
- [Parser](#parser)
  - [Transforms](#transforms)
  - [Combiners](#combiners)
  - [Execution](#execution)
  - [Introspection](#introspection)
- [Span](#span)
- [Line](#line)
- [Match](#match)


## Simple parsers

The simple parsers attempt to match a chunk of text. These are all global functions in the packrattle module.

- `string("...")` - match exactly this string, and return it

- `regex(/.../)` - match this regex, and return the regex "match" object (which can be used to extract any groups)

- `end` - matches only the end of the string

- `reject` - always fails to match

- `succeed(value)` - always succeeds and returns a value

Example:

```javascript
var packrattle = require("packrattle");

var hello = packrattle.string("hello");
hello.run("hi");
// Error: Expected 'hello'
hello.run("hello");
// "hello"
```


## Combiners

The real power is in combining parsers together. These are all global functions in the packrattle module.

- `chain(p1, p2, combiner)` - Match 'p1', and if that succeeds, match 'p2' after it. If both succeed, call 'combiner' with the two match results, as `combiner(value1, value2)`, to get the new combined match result.

- `seq(...parsers)` - Match all of the parsers in sequence. The match result will be an array of all of the non-null match results. This is equivalent to a sequence of 'chain' calls that use 'combiner' to build up an array.

- `alt(...parsers)` - Try each of the parsers as a possible match at the current position. They are effectively tried in parallel. If none of the parsers match, fail. This is the "or" operation.

- `drop(p)` - If 'p' matches, return null as the match result, which will cause it to be omitted from the result of any sequence.

- `optional(p, defaultValue = "")` - Match 'p' or return the default value (usually the empty string), succeeding either way.

- `check(p)` - Verify that 'p' matches, but don't advance the parser's position. Perl calls this a "zero-width lookahead".

- `commit(p)` - If 'p' matches, packrattle will no longer backtrack through the previous 'alt' alternative: parsing is "committed" to this branch. (This can be used with 'onFail' to give less ambiguous error messages, but is only provided as an optimization.)

- `not(p)` - Turn a successful match of 'p' into a failure, or a failure into a success (with an empty string as the match result).

- `repeat(p, options = { min: 0, max: Infinity })` - Match 'p' multiple times (often written as "`p*`"), at least `min` times but no more than `max` times. The match result will be an array of all the non-null 'p' results. (Note that it's trivial to match zero times, so often you want to set `min` to at least 1.)

Example:

```javascript
var packrattle = require("packrattle");

// match either "true" _or_ "false".
var bools = packrattle.alt("true", "false");
bools.run("true");
// "true"
bools.run("false");
// "false"

// match as many "z" as possible.
var sleepy = packrattle.repeat("z", { min: 1 });
sleepy.run("zz");
// [ 'z', 'z' ]
sleepy.run("zzzzz");
// [ 'z', 'z', 'z', 'z', 'z' ]
```

### Convenience combiners

These are easily implemented using the transforms and combiners above, but are commonly used, so they just come with the library, as global functions.

- `seqIgnore(ignore, ...parsers)` - Match all of the parsers in sequence, like 'seq', but before each parser, match and discard an optional 'ignore'. This is handy for discarding whitespace between elements.

- `repeatIgnore(p, ignore, options)` - Match 'p' mulitple times, like 'repeat', but each 'p' may optionally be preceded by 'ignore', which will be dropped. This is handy for discarding whitespace between repeating elements.

- `repeatSeparated(p, separator = "", options = { min: 1, max: Infinity })` - Match 'p' multiple times, separated by 'separator', which is not optional but is dropped.

- `reduce(p, separator = "", options = { min: 1, max: Infinity, first: x => [ x ], next: (sum, sep, x) => sum.push(x) })` - Match 'p' multiple times, separated by a non-optional 'separator', like 'repeatSeparated'. For the first 'p', map the result through 'first' to create an accumulator. For subsequent 'p', call `next(sum, sep, x)` with the accumulator, the result of 'separator', and the result of 'p'. The result of 'next' will be the new accumulator. When the match is exhausted, the accumulator is returned.

For example, here is a parser that identifies strings like "3+50+2" and returns the match result 55:

```javascript
// match a sequence of digits and parse them as an int.
const number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));

// match numbers separated by "+", and add the numbers as we go.
const expr = packrattle.reduce(number, "+", {
  first: n => n,
  next: (total, separator, n) => total + n
};

expr.run("3+50+2");
// 55
```


## Parser

### Transforms

- `map(f)` (or `onMatch(f)`) - If the parser is successful, call `f(match, span)`, using the return value as the new match result. If 'f' isn't a function, it's used as the return value itself.

- `onFail(newMessage)` - Replace the error message for this parser when it fails to match.

- `filter(f, message = null)` (or `matchIf(f, message)`) - If the parser is successful, call `f(match, span)`. If 'f' returns true, continue as normal, but if it returns false, fail to match. `message` is optional, but if it's present and the match fails, it will be used as the failure description.

- `consume()` - Return a parser that will only succeed if it consumes the entire string. This is equivalent to `seq(this, end).map(match => match[0])` but is included here because it's used frequently.

For both `map` and `filter`, the function `f` is called with the current match result from the previous (nested) parser, and a [Span](#span) object (described below), representing the span of text covered by the match.

For example, this parser matches strings of digits and transforms them into a number:

```javascript
var number = pr.regex(/\d+/).map(x => parseInt(x, 10));
```

### Combiners

These are convenience methods for the global [combiners](#combiners).

- `then(...parsers)` -> `seq(this, ...parsers)`

- `or(...parsers)` -> `alt(this, ...parsers)`

- `drop()` -> `drop(this)`

- `optional(defaultValue = "")` -> `optional(this, defaultValue)`

- `check()` -> `check(this)`

- `commit()` -> `commit(this)`

- `not()` -> `not(this)`

- `repeat(options)` -> `repeat(this, options)`

- `times(count)` -> `repeat(this, { min: count, max: count })`

### Execution

Note that `execute` is "lazy" and may stop before the entire string is consumed. `run` is "greedy", so any success has consumed the entire string, and any failures have been converted to a thrown `Error`.

- `execute(text, options = {})` - Parse 'text' until a match is found or there are no more alternatives. Return a [Match](#match) object representing the first success, or (if there were no successes), the failure that made the most progress. Usually you want to call `run()` instead.

- `run(text, options = {})` - Treat the parser as if `consume()` was invoked, then parse 'text' until a match is found or there are no more alternatives. On success, return the parse result. On failure, throw an `Error` representing the failure that made the most progress. The error will have a [`span`](#span) attribute covering the failure.

Options:

- `debugger` - A function to call for debugging. The function should take a string (the line to log). `console.log` would work, for example.

- `dotfile` - A string representing a filename, or a function that takes a string. A "dot" graph will be generated of the parser's progress, and the final text content will be sent to this function. If it's a filename, the dot content will be written to a file with that name (in node only).

Example:

```javascript
expr.run("3+20*5");
// { add: { left: 3, right: { multiply: { left: 20, right: 5 } } } }
```

### Introspection

- `toString()` - Return a unique name like `Parser[35, seq]`.

- `inspect()` - Return a more descriptive name, following combiners as far as possible, like `/\d+/ or "Infinity"`.

- `toDot(maxLength = 40)` - Return a dot-format graph of the nested parsers, as described below in [Debugging](#debugging).
  - `maxLength` - Maximum length of any label in the graph. Longer labels will be truncated.

- `writeDotFile(filename, maxLength)` - In node.js, write `toDot()` into a file with the given name. (This method is just a convenience for the common case of wanting to quickly write out a dot file while debugging.)


## Span

A Span object represents a segment of the original text, with start and end offsets. Like `slice()`, the start offset is inclusive (points to the first character of the span), and the end offset is exclusive (points one position past the last character of the span).

Spans are immutable. You may store them in a data structure around during parsing, and after the parser is complete.

Attributes:

- `text` - the original text
- `start` - starting offset within the text
- `end` - ending offset within the text (plus one)
- `startLine`: [Line](#line) object for the line around `start`
- `endLine`: [Line](#line) object for the line around `end`

Methods:

- `toSquiggles()` - Return an array of two strings: the first line of the span, and a string of spaces and squiggles (`~`) where the squiggles align with the span coverage.
- `around(width)` - Return a segment of the line containing `start`, with up to `width` characters to the left and right. The segment will be surrounded with brackets (`[]`) and the surrounding characters will never cross a line boundary. (This method is intended as a debugging aid.)

For example, if the original text was "cats and dogs", and the span covers (start = 5, end = 8), then `toSquiggles()` returns:

```javascript
[
  "cats and dogs",
  "     ~~~"
]
```

and `around(2)` returns:

```javascript
"s [and] d"
```


## Line

As with [Span](#span), offsets within Line are inclusive at the start, and exclusive at the end, so `text.slice(startOfLine, endOfLine)` is the content of the line, not including a trailing linefeed.

Lines are immutable. You may store them in a data structure around during parsing, and after the parser is complete.

- `lineNumber` - counting from zero
- `startOfLine` - text offset of the first character in this line
- `endOfLine` - text offset of the first character after the line (usually the linefeed)
- `xpos` - position within this line (counting from zero)


## Match

A Match object represents a successful or failed match, and is returned by `[Parser](Parser).execute`. It's usually only interesting for creating new combiners.

- `ok` - true if the parse was successful; false if it failed
- `state` - the ParserState object used to get the span (`state.span()`)
- `commit` - true if the parser went through a `commit()`
- `value` - either the parser's result, or an error message (if `ok` is false)



















## Debugging

Ocassionally, the first draft of a parser may not work exactly the way you want it to. To help you debug, packrattle provides two methods for generating 'dot' graph data.

The first is `toDot()`, which will generate a directed graph of the nesting of parsers. This is useful if you want to see how the sausage is made inside packrattle, as it assembles your parser objects into smaller bits.

- `toDot() => string` - returns "dot" data for this parser tree
- `writeDotFile(filename)` - calls `toDot()` and writes the data into a file for you (in node.js)

For example:

```javascript
var packrattle = require("packrattle");

var abc = pr.alt(/[aA]/, /[bB]/, /[cC]/);
abc.writeDotFile("abc1.dot");
```

will write a graph file named "abc1.dot". Dot utilities will be able to generate an image like the one below.

```sh
$ dot -Tpng -oabc1.png ./abc1.dot
```

<img src="./abc1.png" width="40%">

The second method is to pass `dotfile` as an option to the `execute` or `run` methods. This tells packrattle to trace its progress as it goes, and build a dot graph of the path it took. The `dotfile` option should be a filename to write the dot data into.

```javascript
var packrattle = require("./lib/packrattle");

var abc = pr.alt(/[aA]/, /[bB]/, /[cC]/);
var match = abc.run("b", { dotfile: "abc2.dot" });
```

This (trivial) trace shows the failed match of "a" before succeeding at "b". Note that it planned to try "c" next, but didn't bother once there was a successful match.

<img src="./abc2.png" width="40%">
