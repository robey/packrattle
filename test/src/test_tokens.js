"use strict";

import packrattle from "../../lib";

import "should";
import "source-map-support/register";

// experiments for token parsing.

class Token {
  constructor(name, span, value) {
    this.name = name;
    this.span = span;
    this.value = value;
  }

  toString() {
    if (!this.value || this.value == this.name) return this.name.toUpperCase();
    return this.name.toUpperCase() + "(" + this.value + ")";
  }
}

function makeLexer1(f) {
  function token(name, matcher, f) {
    name = name.toUpperCase();
    if (!matcher) matcher = name;

    return packrattle(matcher).onMatch((m, span) => {
      const value = f ? f(m) : null;
      return new Token(name, span, value);
    });
  }

  function drop(matcher) {
    return packrattle(matcher).drop();
  }

  const parsers = f(token, drop).map(p => {
    if (typeof p == "string") return token(p);
    return p;
  });
  return packrattle.repeat(packrattle.alt(...parsers));
}

function makeLexer(rules) {
  const ignoreList = rules.ignore == null ? [] : (Array.isArray(rules.ignore) ? rules.ignore : [ rules.ignore ]);
  const stringsList = rules.strings == null ? [] : (Array.isArray(rules.strings) ? rules.strings : [ rules.strings ]);

  const ignore = ignoreList.map(regex => packrattle(regex).drop());
  const strings = stringsList.map(str => packrattle(str).onMatch((m, span) => new Token(str, span, str)));
  let matchers = Object.keys(rules.matchers || {}).map(key => {
    const matcher = rules.matchers[key];
    return packrattle(matcher.match).onMatch((m, span) => {
      const value = matcher.value ? (typeof matcher.value == "function" ? matcher.value(m) : matcher.value) : m;
      return new Token(key.toUpperCase(), span, value);
    });
  });

  return packrattle.repeat(packrattle.alt(...(ignore.concat(strings).concat(matchers))));
}

// -----

// const lexer = makeLexer((token, drop) => {
//   return [
//     drop(/\s+/),
//     token("number", /\d+/, m => parseInt(m[0], 10)),
//     "(",
//     ")",
//     "+",
//     "-",
//     "*",
//     "/",
//     "%"
//   ];
// });

const lexer = makeLexer({
  ignore: [ /\s+/ ],
  strings: [
    "(",
    ")",
    "+",
    "-",
    "*",
    "/",
    "%"
  ],
  matchers: {
    number: {
      match: /\d+/,
      value: m => parseInt(m[0], 10)
    }
  }
});


function token(name) {
  return packrattle.newParser(name, { cacheable: true }, (state, results) => {
    name = name.toUpperCase();
    if (state.pos >= state.text.length) return results.add(state.failure());
    const currentToken = state.text[state.pos];
    console.log("check:", currentToken);
    results.add(currentToken.name == name ? state.advance(1).success(currentToken) : state.failure());
  });
}


/*
 * create a new Parser object:
 *   - name: type of parser, in one word ("alt", "optional", ...)
 *   - options:
 *       - children: list of nested parsers, if this is a combiner
 *       - describe: `(children: Array(String)) => String`: returns a
 *         description of the parser for debugging, including children, like
 *         "x or y or z"
 *   - matcher: `(state, results, ...children) => void`
 *       - state: `ParserState`: current text and position
 *       - results: `ResultSet`: container for eventual result (success or
 *         failure)
 *       - children: same as `options.children`, but with implicits resolved
 */

describe("token parser", () => {
  const parens = packrattle([ token("(").drop(), () => expr, token(")").drop() ]);
  const atom = packrattle.alt(token("number"), parens);
  const term = packrattle.reduce(atom, packrattle.alt(token("*"), token("/"), token("%")), {
    first: x => x,
    next: (left, op, right) => ({ op, left, right })
  });
  const expr = packrattle.reduce(term, packrattle.alt(token("+"), token("-")), {
    first: x => x,
    next: (left, op ,right) => ({ op, left, right })
  });


  it("lexes", () => {
    const tokenstream = lexer.run("1 + (2 + 3) * 4");
    tokenstream.join(" ").should.eql("NUMBER(1) + ( NUMBER(2) + NUMBER(3) ) * NUMBER(4)");
  });

  it("parses", () => {
    const tokenstream = lexer.run("1 + 2");
    tokenstream.join(" ").should.eql("NUMBER(1) + NUMBER(2)");
    console.log(expr.run(tokenstream, { debugger: console.log }));
    try {
      expr.run(lexer.run("1 + "), { debugger: console.log });
    } catch (error) {
      console.log(error);
      console.log(error.span.toSquiggles().join("\n"));
    }
  });
});
