# Packrattle API

Packrattle's API consists of functions which make simple parsers (for example, to match a string) and combiners that let you attach parsers together (for example, one parser *or* another). All parsers are objects of type `Parser`, and have a set of useful methods for transforming and executing them.

- [Simple parsers](#simple-parsers)
- [Transforms](#transforms)
  - [Map and filter](#map-and-filter)
- [Combiners](#combiners)
  - [Convenience methods](#convenience-methods)
  - [Reduce](#reduce)
- methods on `Parser`
- [Debugging](#debugging)


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


## Transforms

Parser objects have a few methods on them that will allow you to transform the match results. This is how you turn the parser output into an AST, or cause the parser to evaluate expressions as it parses.

For example, this parser matches strings of digits and transforms them into a number:

```javascript
var number = pr.regex(/\d+/).map(x => parseInt(x, 10));
```

- `map(f)` or `onMatch(f)` - If the parser is successful, call 'f' on the match result, using the return value of 'f' as the new match result.

- `onFail(newMessage)` - Replace the error message for this parser when it fails to match.

- `filter(f)` or `matchIf(f)` - If the parser is successful, call 'f' on the match result and state: if it returns true, continue as normal, but if it returns false, fail to match.

 The type of 'f' is `(value, Span) => boolean`, where 'value' is the result of the parser, and `Span` is described below.


### Map and filter

Both `map` and `filter` (`onMatch` and `matchIf`) take a function 'f' and call it with two parameters: `f(value, span)`.

- `value`: The result of the previous parser. For simple parsers like `string` and `regex`, this will be the string literal or regex match object, respectively. For nested parsers with their own `onMatch` transforms, the parameter will be the object the nested parsers returned. For example, the `seq` combinator (below) returns an array of the sequence of matches. An expression parser might build up a tree of expression nodes.

- `span`: An object representing the span of text matched by this parser.

Span objects have several fields for identifying the location of the beginning and end of the span. Offsets are always in slice format, so the starting offset always points to the first character of the span, while the ending offset always points to the position right after the last character of the span. To put it another way, `text.slice(start, end)` provides the matching text exactly.

- `text` - the original text
- `start` - starting offset within the text
- `end` - ending offset within the text (plus one)
- `startLine`: Line object for the line around `start`
- `endLine`: Line object for the line around `end`

Line objects have several fields:

- `lineNumber` - counting from zero
- `startOfLine` - text offset of the first character in this line
- `endOfLine` - text offset of the first character after the line (usually the linefeed)
- `xpos` - position within this line (counting from zero)

As with spans, `startOfLine` is inclusive while `endOfLine` is exclusive, so `text.slice(startOfLine, endOfLine)` is the content of the line, not including a trailing linefeed.

There are also a few helper functions on Span:

- `toSquiggles()` - Returns an array of two strings: the first line of the span, and a string of spaces and squiggles (`~`) where the squiggles align with the span coverage.
- `around(width)` - Returns a segment of the line containing `start`, with up to `width` characters to the left and right.

For example, if the original text was "cats and dogs", and the span covers (start = 5, end = 8), then `toSquiggles()` returns:

```javascript
[
  "cats and dogs",
  "     ~~~"
]
```


## Combiners

The real power is in combining the parsers. These are all global functions in the packrattle module.

- `seq(p1, p2, ...)` - Match all of the parsers in sequence. The match result will be an array of all of the non-null match results.

- `alt(p1, p2, ...)` - If 'p1' matches, return that as the result; otherwise, try 'p2', and so on, until finding a match. If none of the parsers match, fail. This is the "or" operation.

- `optional(p, defaultValue = "")` - Match 'p' or return the default value (usually the empty string), succeeding either way.

- `repeat(p, options = { min: 0, max: Infinity })` - Match 'p' multiple times (often written as "`p*`"), at least `min` times but no more than `max` times. The match result will be an array of all the non-null 'p' results. (Note that it's trivial to match zero times, so often you want to set `min` to at least 1.)

- `check(p)` - Verify that 'p' matches, but don't advance the parser's position. Perl calls this a "zero-width lookahead".

- `commit(p)` - If 'p' matches, packrattle will no longer backtrack through the previous 'alt' alternative: parsing is "committed" to this branch. (This can be used with 'onFail' to give less ambiguous error messages, but is only provided as an optimization.)

- `not(p)` - Turn a successful match of 'p' into a failure, or a failure into a success (with an empty string as the match result).

- `drop(p)` - If 'p' matches, return null as the match result, which will cause it to be omitted from the result of any sequence.

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

All of the combiners are also defined as methods on the parsers, so you can chain them with method calls. The method versions all take one fewer argument, because the first 'p' is implied.

For example, these two lines are equivalent:

```javascript
var comment = pr.seq(pr.commit(pr.string("#")), pr.regex(/[^\n]+\n/));
var comment = pr.seq(pr.string("#").commit(), pr.regex(/[^\n]+\n/));
```


### Convenience methods

These are trivially implemented using the transforms and combiners above, but are commonly used, so they just come with the library, as global functions.

- `seqIgnore(ignore, p1, p2, ...)` - Like `seq`, but make an attempt to match 'ignore' before each parser, throwing away the result if it matches and ignoring if it doesn't. This is typically used to discard whitespace between parsers in a sequence.

- `repeatIgnore(ignore, p, options = { min: 0, max: Infinity })` - Similar to 'seqIgnore', attempts to match 'ignore' before each iteration of 'p', throwing away the result.

- `repeatSeparated(p, separator = "", options = { min: 1, max: Infinity })` - Like 'repeatIgnore', but there must be at least one match of 'p', the separator is not optional, and the separator is only matched (and discarded) between items.

- `chain(p1, p2, combiner)` - Match p1 followed by p2, just like 'seq'. The values of p1 and p2 are passed to combiner as `combiner(value1, value2)` and the return value is the value of the chain. This is useful if you want a 'seq' but want to do something with the intermediate values other than put them into an array.


### Reduce

The reduce method is borrowed from scala's parser-combinator library, and is particularly useful for parsing expression trees.

- `reduce(p, separator = "", options)`

Options are:
- `min` - minimum number of matches of 'p' allowed (default: 1)
- `max` - maximun number of matches of 'p' allowed (default: Infinity)
- `first` - one-argument function to transform the initial match value (default: `x => [ x ]`)
- `next` - three-argument function to combine successive matches (default: `(sum, sep, x) => sum.push(x)`)

Like 'repeatSeparated', it attempts to match at least one 'p', separated by 'separator'. In standard grammar, it matches:

    p (separator p)*

with an optional limit on the minimum or maximum number of 'p' there can be. Two functions are called to transform the match results:

- `first(value)` is called with the first result of 'p' and can be used to transform the result, just like 'onMatch'. The default accumulator creates a new array with the match result as its only element.

- `next(total, separator, value)` is called for each subsequent match of a separator and 'p'. The first parameter is the total result so far (or the result of the 'first' function). The second is the result of the separator, and the last is the result of the current 'p'. This function should return the new 'total' that will be passed in on future matches.

For example, here is a parser that identifies strings like "3+50+2" and returns the match result 55:

```javascript
// match a sequence of digits and parse them as an int.
const number = packrattle.regex(/\d+/).onMatch(m => parseInt(m[0], 10));

// match numbers separated by "+", and add the numbers as we go.
const expr = packrattle.reduce(number, "+", {
  first: n => n,
  next: (total, separator, n) => total + n
};

expr.run("3+50+2");
// 55
```









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

<img src="./abc1.png">

The second method is to pass `dotfile` as an option to the `execute` or `run` methods. This tells packrattle to trace its progress as it goes, and build a dot graph of the path it took. The `dotfile` option should be a filename to write the dot data into.

```javascript
var packrattle = require("./lib/packrattle");

var abc = pr.alt(/[aA]/, /[bB]/, /[cC]/);
var match = abc.run("b", { dotfile: "abc2.dot" });
```

This (trivial) trace shows the failed match of "a" before succeeding at "b". Note that it planned to try "c" next, but didn't bother once there was a successful match.

<img src="./abc2.png">
