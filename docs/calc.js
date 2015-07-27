#!/usr/bin/env node --harmony --harmony_arrow_functions

var packrattle = require("../lib");

var number = packrattle.regex(/\d+/).map(match => parseInt(match[0], 10));
var whitespace = packrattle(/[ \t]+/).optional().drop();

var grouped = packrattle([
  packrattle.drop("("),
  whitespace,
  () => add,
  whitespace,
  packrattle.drop(")")
]).map(match => match[0]);

var multiplyOrDivide = packrattle([ whitespace, packrattle.alt("*", "/"), whitespace ]).map(match => match[0]);
var multiply = packrattle.reduce(number.or(grouped), multiplyOrDivide, {
  first: n => n,
  next: (total, operator, n) => {
    switch (operator) {
      case "*": return total * n;
      case "/": return total / n;
    }
  }
});

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

add.writeDotFile("calc.dot");

var expr = process.argv[process.argv.length - 1];
try {
  console.log(add.run(expr, { dotfile: "calc-expr.dot" }));
} catch (error) {
  console.log(error.message);
  error.span.toSquiggles().forEach(line => console.log(line));
}
