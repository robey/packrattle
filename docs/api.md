# Packrattle API

Packrattle's API consists of functions which make simple parsers (for example, to match a string) and combiners that let you attach parsers together (for example, one parser *or* another). All parsers are objects of type `Parser`, and have a set of useful methods described later.

- [Simple parsers](#simple-parsers)
- Combiners
- methods on `Parser`


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

The real power is in combining the parsers. These are all global functions in the packrattle module.

- `seq(p1, p2, ...)` - Match all of the parsers in sequence. The match result will be an array of all of the non-null match results.

- `alt(p1, p2, ...)` - If 'p1' matches, return that as the result; otherwise, try 'p2', and so on, until finding a match. If none of the parsers match, fail. This is the "or" operation.

- `optional(p, defaultValue = "")` - Match 'p' or return the default value (usually the empty string), succeeding either way.

- `repeat(p, options = { min: 0, max: Infinity })` - Match 'p' multiple times (often written as "`p*`"), at least `min` times but no more than `max` times. The match result will be an array of all the non-null 'p' results. (Note that it's trivial to match zero times, so often you want to set `min` to at least 1.)

- `check(p)` - Verify that 'p' matches, but don't advance the parser's position. Perl calls this a "zero-width lookahead".

- `commit(p)` - If 'p' matches, packrattle will no longer backtrack through the previous 'alt' alternative: parsing is "committed" to this branch. (This can be used with 'onFail' to give less ambiguous error messages, but is only provided as an optimization.)

- `not(p)` - Turn a successful match of 'p' into a failure, or a failure into a success (with an empty string as the match result).

- `drop(p)` - If 'p' matches, return null as the match result, which will cause it to be omitted from the result of any sequence.

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
const number = pr.regex(/\d+/).onMatch(m => parseInt(m[0], 10));

// match numbers separated by "+", and add the numbers as we go.
const expr = pr.reduce(number, "+", {
  first: n => n,
  next: (total, separator, n) => total + n
};

expr.run("3+50+2");
// 55
```
