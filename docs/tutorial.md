# Quick tutorial

Let's build a parser that can model a basic 1970s pocket calculator. It should take an expression like

    3 * 10 + 7 * 11

and evaluate it as it parses it, into the answer:

    107

We'll start from the bottom up, building simple parsers and then combining them, and in the process, get a whirlwind tour of packrattle.


## Parsing a number

The first thing to do is recognize and match numbers. If you're good at regular expressions, it's a breeze.

```javascript
$ node --harmony --harmony_arrow_functions

> var packrattle = require("packrattle");
> var number = packrattle.regex(/\d+/);
> number.run("34");
[ '34', index: 0, input: '34' ]
```

If you don't know regular expressions, `\d+` means "one or more digits". That's sufficient to match an int, which is all we need for this example. You could get fancier if you want to match against floats (the javascript `Number` type).

`regex` is the packrattle function for creating a parser based on a regular expression (or "regex"). `number`, then, is a `Parser`, and to make a Parser tackle a string, you call `run`. `run` will either return a successful match, or throw an exception.

```javascript
> number.run("a")
Error: Expected /\d+/
```

Hm. So packrattle can hold a regular expression and then execute it against a string. But you can do that easily already.

```javascript
> var number = /\d+/;
> number.exec("34")
[ '34', index: 0, input: '34' ]
```

So if that was all it could do, we might as well pack up and go home. This vacation is over.

Luckily this is just the beginning. We don't really want the match object from the regex. We want it to be parsed into a number, and we can get that by adding a transform to the parser.

```
> var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
> number.run("34")
34
```

Okay, that's a little bit cooler. `map` will call a function on a successful match, letting us change the result. In this case, we take the matched string and parse it immediately into an int.


## Multiplication

The precedence rules of algebra say that multiplication takes priority over addition, so let's handle that case next. We want to string together a few small parsers in a sequence, like this:

```
multiply ::= number "*" number
```

which is BNF syntax for saying that a multiply operation is a number followed by a star, followed by another number. In packrattle, this is a "sequence" or `seq`.



- match numbers
- map -> number
- whitespace
- drop
- optional
