# Quick tutorial

Let's build a parser that can model a basic 1970s pocket calculator. It should take an expression like

    3 * 10 + 7 * 11

parse it, and evaluate it, getting the answer:

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

Luckily, this is just the beginning! We don't really want the match object from the regex. We want it to be parsed into a number, and we can get that by adding a transform to the parser.

```javascript
> var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
> number.run("34")
34
```

Okay, that's a little bit cooler. `map` will call a function on a successful match, letting us change the result. In this case, we take the matched string and parse it immediately into an int. Now `number` is sort of a glorified wrapper for `parseInt` that rejects anything but positive integers.

Let's go deeper.


## Multiplication

The precedence rules of algebra say that multiplication takes priority over addition, so let's handle that case next. We want to string together a few small parsers in a sequence, like this:

```
multiply ::= number "*" number
```

which is BNF syntax for saying that a multiply operation is a number followed by a star, followed by another number. In packrattle, this is a "sequence" or `seq`.

```javascript
> var multiply = packrattle.seq(number, packrattle.string("*"), number);
> multiply.run("3*4")
[ 3, '*', 4 ]
```

As you can see, `seq` takes a list of parsers and joins them together. We didn't have to explain how to parse numbers again, either; we can just use the parser we stored in `number`. Being able to combine the parsers by name this way will help a lot as the parsers and combinations get more complex.

This new "sequenced" parser returns an array of the match results, in order. But it only succeeds if each of the inner parsers succeeds.

```javascript
> multiply.run("3@4")
Error: Expected '*'
```

That error message is correct, but unhelpful. There's more information in the `Error` object if you dig in.

```javascript
> try { multiply.run("3@4") } catch (error) { console.log(util.inspect(error)) }
{ [Error: Expected '*']
  span: { text: '3@4', start: 1, end: 2, ... } }
```

The start position (1) tells us that the error occurred at offset 1 in the string: the "@". In fact, if you're wearing fancy pants today, you can ask packrattle to show you where the parser hurt you:

```javascript
> try {
...   multiply.run("3@4")
... } catch (error) {
...   console.log(error.message);
...   error.span.toSquiggles().forEach(line => console.log(line));
... }
Expected '*'
3@4
 ~
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
> var multiply = packrattle([ number, "*", number ]);
```


## Whitespace

It would be nice if we could add whitespace around the terms.

```javascript
> multiply.run("3 * 4")
Error: Expected '*'
```

A good regex for whitespace might be `/[ \t]+/`, or "one or more space or tab characters". But we don't care if the whitespace is there or not -- it's optional. There's a parser for that.

```javascript
> var whitespace = packrattle(/[ \t]+/).optional();
> var multiply = packrattle([ number, whitespace, "*", whitespace, number ]);
> multiply.run("3 * 4")
[ 3,
  [ ' ', index: 0, input: ' * 4' ],
  '*',
  [ ' ', index: 0, input: ' 4' ],
  4 ]
```  

Hey, pretty good! But also, we don't care about the results of the whitespace. If it's there, we just want to ignore it. So let's `drop` it.

```javascript
> var whitespace = packrattle(/[ \t]+/).optional().drop();
> var multiply = packrattle([ number, whitespace, "*", whitespace, number ]);
> multiply.run("3 * 4")
[ 3, '*', 4 ]
```

Nice! Good job, everyone!

In fact, we don't even need the `*` either. We just care about the numbers.

```javascript
> var multiply = packrattle([ number, whitespace, packrattle("*").drop(), whitespace, number ]);
> multiply.run("3 * 4")
[ 3, 4 ]
```
