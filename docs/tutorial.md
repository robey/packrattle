# Let's build a calculator

Let's build a parser that can model a basic 1970s pocket calculator. It should take an expression like

    3 * 10 + 7 * 11

parse it, and evaluate it, getting the answer:

    107

We'll start from the bottom up, building simple parsers and then combining them, and in the process, get a whirlwind tour of packrattle.

1. [Parsing a number](#parsing-a-number) - regex, run
2. [Into a number](#into-a-number) - map
3. [Multiplication](#multiplication) - seq, Error, span
4. [Shortcuts](#shortcuts) - string, implicit conversions
5. [Whitespace](#whitespace) - optional, drop
6. [More than two numbers](#more-than-two-numbers) - or, alt, deferred resolution
7. [Reduction](#reduction) - reduce
8. [Division and Addition](#division-and-addition)
9. [Bonus points: grouping](#bonus-points-grouping)
10. [calc.js](#calcjs)
11. [Debugging](#debugging) - writeDotFile


## Parsing a number

The first thing to do is recognize and match numbers. If you're good at regular expressions, it's a breeze.

```javascript
#!/usr/bin/env node --harmony --harmony_arrow_functions

var packrattle = require("packrattle");
var number = packrattle.regex(/\d+/);
number.run("34");
// [ '34', index: 0, input: '34' ]
```

If you don't know regular expressions, `\d+` means "one or more digits". That's sufficient to match an int, which is all we need for this example. You could get fancier if you want to match against floats (the javascript `Number` type).

`regex` is the packrattle function for creating a parser based on a regular expression (or "regex"). `number`, then, is a `Parser`, and to make a Parser tackle a string, you call `run`. `run` will either return a successful match, or throw an exception.

```javascript
number.run("a");
// Error: Expected /\d+/
```

Hm. So packrattle can hold a regular expression and then execute it against a string. But you can do that easily already.

```javascript
var number = /\d+/;
number.exec("34");
// [ '34', index: 0, input: '34' ]
```

So if that was all it could do, we might as well pack up and go home. This vacation is over.


## Into a number

Luckily, this is just the beginning! Parser objects have a few methods that allow us to transform the results. This is how a compiler can turn parser output into an AST, and how we can evaluate expressions as the parser works. For this parser, we want to turn the match object from the regex into a javascript `Number`, and we can get that by adding a transform with `map`.

```javascript
var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
number.run("34");
// 34
```

`map` is probably the most important tool in packrattle. It lets you change the return value of a parser. In this case, we're converting the regex match object into a plain number. When used with combiners (below), it lets us build up data structures like a syntax tree, or in our case, calculate an expression as we go.

The transform function is given two parameters:
- `match` - the current value
- `span` - an immutable object representing the part of the string that matched

We don't care much about the span here, but if we were building a compiler, we'd want to keep track of the span of successful matches so we can highlight the locations of errors later. For our `number` example, the span will necessarily cover the entire string:

```javascript
var number = packrattle.regex(/\d+/).map((match, span) => span);
number.run("34").toString()
// 'Span(0 -> 2)'
```

Okay, so that's cool. We can parse a number, turn it into a number, and track where it came from. But that isn't much of a calculator.

We need to go deeper.


## Multiplication

The precedence rules of algebra say that multiplication takes priority over addition, so let's handle that case next. We want to string together a few small parsers in a sequence, like this:

```
multiply ::= number "*" number
```

which is BNF syntax for saying that a multiply operation is a number followed by a star, followed by another number. In packrattle, this is a "sequence" or `seq`.

```javascript
var multiply = packrattle.seq(number, packrattle.string("*"), number);
multiply.run("3*4");
// [ 3, '*', 4 ]
```

As you can see, `seq` takes a list of parsers and joins them together. We didn't have to explain how to parse numbers again, either; we can use the parser we stored in `number`. Being able to combine the parsers by name this way will help a lot as the parsers and combinations get more complex.

This new "sequenced" parser returns an array of the match results, in order. But it only succeeds if each of the inner parsers succeeds.

```javascript
multiply.run("3@4");
// Error: Expected '*'
```

That error message is correct, but unhelpful. There's more information in the `Error` object if you dig in.

```javascript
try { multiply.run("3@4") } catch (error) { console.log(util.inspect(error)) }
// { [Error: Expected '*']
//   span: { text: '3@4', start: 1, end: 2, ... } }
```

The start position (1) tells us that the error occurred at offset 1 in the string: the "@". In fact, if you're wearing fancy pants today, you can ask packrattle to show you where the parser hurt you:

```javascript
try {
  multiply.run("3@4")
} catch (error) {
  console.log(error.message);
  error.span.toSquiggles().forEach(line => console.log(line));
}
// Expected '*'
// 3@4
//  ~
```


## Shortcuts

You may have noticed that the "\*" parser used a new building block.

```javascript
packrattle.string("*")
```

The `string` parser is even simpler than `regex`: it matches only the exact string requested.

Because strings, regular expressions, and sequences are used all the time, shortcuts are begrudgingly allowed. Any time packrattle expects a nested parser, it will accept a string, RegExp object, or array, and implicitly convert them. (An array becomes a sequence.) So we could have defined `multiply` as:

```javascript
> var multiply = packrattle.seq(number, "*", number);
```

The packrattle module is also a function that will do these implicit conversions for you, so we could also write it like this:

```javascript
var multiply = packrattle([ number, "*", number ]);
```


## Whitespace

It would be nice if we could add whitespace around the terms.

```javascript
multiply.run("3 * 4");
// Error: Expected '*'
```

A good regex for whitespace might be `/[ \t]+/`, or "one or more space or tab characters". But we don't care if the whitespace is there or not -- it's optional. There's a parser for that.

```javascript
var whitespace = packrattle(/[ \t]+/).optional();
var multiply = packrattle([ number, whitespace, "*", whitespace, number ]);
multiply.run("3 * 4");
// [ 3,
//   [ ' ', index: 0, input: ' * 4' ],
//   '*',
//   [ ' ', index: 0, input: ' 4' ],
//   4 ]
```  

Hey, pretty good! But also, we don't care about the results of the whitespace. If it's there, we want to ignore it. So let's `drop` it.

```javascript
var whitespace = packrattle(/[ \t]+/).optional().drop();
var multiply = packrattle([ number, whitespace, "*", whitespace, number ]);
multiply.run("3 * 4");
// [ 3, '*', 4 ]
```

Nice! Good job, everyone!

In fact, we don't even need the `*` either. We only care about the numbers. Let's pull it out into its own parser, to make it easier to read, and make `multiply` actually do the math.

```javascript
var star = packrattle([ whitespace, "*", whitespace ]).drop();
var multiply = packrattle([ number, star, number ]).map(match => match[0] * match[1]);
multiply.run("3 * 4");
// 12
```


## More than two numbers

We're at a crossroads now. What if we want to compute _three_ numbers multiplied?

    4 * 5 * 7

One way to handle this is through recursion. Each side of a multiplication could itself be another multiplication. We'll call that a "factor".

```javascript
var factor = number.or(multiply);
```

The `or` method makes a branch: `factor` will match either `number` or `multiply`, and return the value of whichever one matched. Another way of writing that is to use `alt` with a list of alternatives.

```javascript
var factor = packrattle.alt(number, multiply);
```

But, uh... `factor` refers to `multiply`, and our new definition of `multiply` is going to need to refer to `factor`. How can that work? It's a loop!

Packrattle will let us pass in a function wherever a parser is expected, to let us "defer" resolving the parsers until they're all defined. The first time we execute a parser, it walks the tree, looking for functions and calling them, to build up the real tree, which may contain loops. So we can use functions to create this loop: `factor` will be either a number or a (deferred reference to) `multiply`.

```javascript
var factor = number.or(() => multiply);
var star = packrattle([ whitespace, "*", whitespace ]).drop();
var multiply = packrattle([ factor, star, factor ]).map(match => match[0] * match[1]);
multiply.run("3 * 4");
// 12
multiply.run("4 * 5 * 7");
// 140
```

If you're familiar with parsers, your head may have just spun around. The parser we built is "left-recursive", meaning that the left side of the expression for `multiply` is `factor`, but one option for `factor` is `multiply`, so most parser engines will go navel-gazing immediately and never return.

```
multiply ::= factor star factor
factor ::= number | multiply

...therefore...

multiply ::= (number | multiply) star (number | multiply)
multiply ::= (number | (number | multiply) star (number | multiply)) ...
multiply ::= (number | (number | (number | multiply) star (number | multiply)) ...
```

Help! In these engines, you need to carefully arrange the parsers so that they can only recurse on the right side, like this:

```javascript
var multiply = packrattle([ number, star, factor ]).map(match => match[0] * match[1]);
multiply.run("4 * 5 * 7");
// 140
```

You don't need to do this in a GLL-based engine because it effectively walks branches in parallel, memoizing loops. If this interests you, there are some papers listed at the end of packrattle's README.


## Reduction

Another way to tackle the three-numbers problem is to treat it explicitly as a tree, using left association like a real math person would do when they're wearing their math hat. Left association means the first two numbers are multiplied, then the next one, and so on.

```
4 * 5 * 7 * 2              *
                          / \
((4 * 5) * 7) * 2        *   2
                        / \
                       *   7
                      / \
                     4   5
```

This is also what you'd do if you were building up an abstract syntax tree (AST) for a programming language.

We can model this with left-recursion like we were doing above, but there's also a helper function for this case, called "reduce". It takes a node parser (`number` for us) and a separator parser (`star`), and matches as many interleaving sets as it can. (You can specify a minimum and maximum number of matches, but we're okay with as many as someone can type.)

Here it is all together:

```javascript
var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
var whitespace = packrattle(/[ \t]+/).optional().drop();
var star = packrattle([ whitespace, "*", whitespace ]).drop();
var multiply = packrattle.reduce(number, star, {
  first: n => n,
  next: (total, operator, n) => total * n
});

multiply.run("4 * 5 * 7");
// 140
```

It works similarly to `reduce` in functional programming. The first `number` is passed to `first` to allow us to wrap it if we want to. Then each following `star` and `number` are passed to `next` so we can roll them up. We called `drop()` on `star`, so it's `null` here, but if we didn't, it would be the result of the `"*"` parser.

One nice thing reduction has over the previous method is that it's valid to have no multiplications at all, just a number, because we left `min` set to 1. If there's no `*`, the expression matches exactly once, calls `first`, and uses that as the return value.

```javascript
multiply.run("42");
// 42
```

If we were building a parse tree for a compiler, we might do something like this, to build a nice tree:

```javascript
var multiply = packrattle.reduce(number, star, {
  first: n => ({ number: n }),
  next: (total, operator, n) => ({ multiply: [ total, { number: n } ] })
});

multiply.run("4 * 5 * 7");
// { multiply:
//    [ { multiply: [ { number: 4 }, { number: 5 } ] },
//      { number: 7 } ] }
```


## Division and addition

Division has the same precedence as multiplication, so we should probably handle them at the same time. No problem. Our "star" parser should change to allow either `*` or `/` (and not drop it!), and inside `reduce`, we can switch on the operator to decide which operation to do.

```javascript
var multiplyOrDivide = packrattle([ whitespace, packrattle.alt("*", "/"), whitespace ]).map(match => match[0]);
var multiply = packrattle.reduce(number, multiplyOrDivide, {
  first: n => n,
  next: (total, operator, n) => {
    switch (operator) {
      case "*": return total * n;
      case "/": return total / n;
    }
  }
});

multiply.run("4 * 5 / 2");
// 10
```

The last piece of our nostalgic calculator is addition (and subtraction). Addition has lower precedence than multiplication, so either side of an addition may be a multiplication, but not vice versa. In other words, a multiply operates on numbers, but an addition operates on multiplies.

```javascript
var addOrSubtract = packrattle([ whitespace, packrattle.alt("+", "-"), whitespace ]).map(match => match[0]);
var add = packrattle.reduce(multiply, addOrSubtract, {
  first: n => n,
  next: (total, operator, n) => {
    switch (operator) {
      case "+": return total + n;
      case "-": return total - n;
    }
  }
});

add.run("3 * 4 + 2");
// 14
add.run("3 + 4 * 2");
// 11
```

Hey, nice! This is starting to look easy!


## Bonus points: grouping

You know, that's a real fine calculator we've built here, but looking at that last expression, I can't help thinking that it would be really nice if we could ask it to add 3 and 4 _first_, and then multiply by 2. Normally we'd do that by grouping with parentheses, but I guess that's too hard...

Nonsense!

We're allowed to loop parsers back on each other -- we did that in our first attempt to multiply three numbers. So we should be allowed to change the element of a multiply from `number` to either a number or a grouped expression.

```javascript
var grouped = packrattle([
  packrattle.drop("("),
  whitespace,
  () => add,
  whitespace,
  packrattle.drop(")")
]).map(match => match[0]);

var multiply = packrattle.reduce(number.or(grouped), multiplyOrDivide, {
  first: n => n,
  next: (total, operator, n) => {
    switch (operator) {
      case "*": return total * n;
      case "/": return total / n;
    }
  }
});

// define "add" as before...

add.run("3 + 4 * 2");
// 11
add.run("(3 + 4) * 2");
// 14
```

Presto! Multiply now takes a number or a grouped expression, which is an add (deferred) surrounded by parentheses.


## calc.js

The complete parser we built is included in the short file <a href="./calc.js">calc.js</a> in the `docs/` folder, along with some extra code to take the expression passed on the command line, and print out either the result of the calculation, or an error message.

```
❯ ./docs/calc.js "(34 + 4) / 2"
19
❯ ./docs/calc.js "(34+4"
Expected ')'
(34+4
     ~
```

Pat yourself on the back and grab a beverage of your choice: We did it! Numbers can be added and subtracted, multiplied and divided! It's a great time to be alive.


## Debugging

Ocassionally, the first draft of a parser may not work exactly the way you want it to. To help you debug, packrattle provides two methods for generating ['dot' graph data](https://en.wikipedia.org/wiki/DOT_(graph_description_language)).

The first is `toDot()`, which will generate a directed graph of the nesting of parsers. This is useful if you want to see how the sausage is made inside packrattle, as it assembles your parser objects into smaller bits.

- `toDot() => string` - returns "dot" data for this parser tree
- `writeDotFile(filename)` - calls `toDot()` and writes the data into a file for you (in node.js)

For example:

```javascript
var abc = packrattle.alt(/[aA]/, /[bB]/, /[cC]/);
abc.writeDotFile("abc1.dot");
```

This will write a graph file named "abc1.dot". Dot utilities will be able to generate an image like the one below.

```sh
$ dot -Tpng -o abc1.png ./abc1.dot
```

<img src="./abc1.png" width="40%">

The second method is to pass `dotfile` as an option to the `execute` or `run` methods. This tells packrattle to trace its progress as it goes, and build a dot graph of the path it took. The `dotfile` option should be a filename to write the dot data into.

```javascript
var abc = packrattle.alt(/[aA]/, /[bB]/, /[cC]/);
var match = abc.run("b", { dotfile: "abc2.dot" });
```

This (simple) trace shows the failed match of "a" before succeeding at "b". Note that it planned to try "c" next, but didn't bother once there was a successful match.

<img src="./abc2.png" width="40%">

Wanna see the dot graphs of the parser we built for the calculator? Of course you do.

- [graph of the `add` parser](./calc.png)
- [graph of an execution of `2 * 9`](./calc-expr.png)

The first one looks a little intimidating at first, but we can recognize landmarks once we get over our initial shock. The number in brackets in each box is the "identifier" of the parser -- each one gets a unique number. Underneath is a text description, or as much as will reasonably fit.

At the bottom, we can see that 5, 6, and 7 are our whitespace parser, which several other parsers refer to. And in the lower right, 10 is our grouping parser, with a reference back up to `add` at the top (26). Each reduction is built out of a `seq` and `repeat`, so you can see `multiply` at 17 and 18, and `add` at 24 and 25.

The second graph shows the path the parser engine took through our parser graph as it ran. The important thing to notice is that it made very few false starts as it went. Whenever it made a wrong choice, it failed pretty quickly, so our parser is reasonably well structured. That's worth another pat on the back.
