# Quick tutorial

Let's build a parser that can model a basic 1970s pocket calculator. It should take an expression like

    3 * 10 + 7 * 11

and evaluate it as it parses it, into the answer:

    107

We'll start from the bottom up, building simple parsers and then combining them. The first thing to do is recognize and match numbers. If you're good at regular expressions, it's a breeze.

```javascript
$ node --harmony --harmony_arrow_functions

> var packrattle = require("packrattle");
> var number = packrattle.regex(/\d+/);
> number.run("34");
[ '34', index: 0, input: '34' ]
```

If you don't know regular expressions, `\d+` means "one or more digits". That's sufficient to match an int, which is all we need for this example. You could get fancier if you want to match against floats (javascript `Number`s).

Hm. So packrattle can hold a regular expression (regex) and then execute it against a string. But you can do that easily already.

```javascript
> var number = /\d+/;
> number.exec("34")
[ '34', index: 0, input: '34' ]
```

So if that was all it could do, we might as well pack up and go home. This vacation is over.

Luckily this is just a building block. We don't really want the match object from the regex. We want it to be parsed into a number.

```
> var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
> number.run("34")
34
```

Okay, that's a little bit cooler. `map` will take a successful match and transform it. In this case, we take the matched string and parse it immediately into an int.




- match numbers
- map -> number
- whitespace
- drop
- optional
