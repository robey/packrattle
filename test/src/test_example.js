"use strict";

const pr = require("../../lib");
const util = require("util");

require("should");
require("source-map-support").install();

describe("Parser example", () => {
  function binary(left, op, right) {
    return { op, left, right };
  }

  function ws(p) {
    return pr.seqIgnore(/\s+/, p).onMatch(x => x[0]);
  }

  const number = ws(/\d+/).onMatch(m => parseInt(m[0], 10));
  const parens = pr([ ws(pr("(").drop()), () => expr, ws(pr(")").drop()) ]);
  const atom = pr.alt(number, parens.onMatch(e => e[0]));
  const term = pr.reduce(atom, ws(pr.alt("*", "/", "%")), { first: x => x, next: binary });
  const expr = pr.reduce(term, ws(pr.alt("+", "-")), { first: x => x, next: binary });

  it("recognizes a number", () => {
    const rv = expr.execute("900");
    rv.ok.should.eql(true);
    rv.value.should.eql(900);
  });

  it("recognizes addition", () => {
    const rv = expr.consume().execute("2 + 3");
    rv.ok.should.eql(true);
    rv.value.should.eql({ op: "+", left: 2, right: 3 });
  });

  it("recognizes a complex expression", () => {
    const rv = expr.consume().execute("1 + 2 * 3 + 4 * (5 + 6)");
    rv.ok.should.eql(true);
    rv.value.should.eql({
      op: "+",
      left: {
        op: "+",
        left: 1,
        right: {
          op: "*",
          left: 2,
          right: 3
        }
      },
      right: {
        op: "*",
        left: 4,
        right: {
          op: "+",
          left: 5,
          right: 6
        }
      }
    });
  });

  it("can add with reduce", () => {
    const number = pr.regex(/\d+/).onMatch(m => parseInt(m[0], 10));
    const expr = pr.reduce(number, "+", { first: n => n, next: (sum, op, n) => sum + n });
    const rv = expr.consume().execute("2+3+4");
    rv.ok.should.eql(true);
    rv.state.pos.should.equal(5);
    rv.value.should.equal(9);
  });

  it("csv", () => {
    const csv = pr.repeatSeparated(
      pr(/([^,]*)/).onMatch(m => m[0]),
      /,/
    );
    const rv = csv.consume().execute("this,is,csv");
    rv.ok.should.eql(true);
    rv.value.should.eql([ "this", "is", "csv" ]);
  });

  it("parses alternatives in priority (left to right) order", () => {
    const abc = pr.string('abc');
    const wordOrSep = pr.alt(/\s+/, /\S+/).onMatch(m => ({ word: m[0] }));
    const line = pr.repeat(pr.alt(abc, wordOrSep));
    const rv = line.consume().execute('abcabc def');
    rv.ok.should.eql(true);
    rv.value.should.eql([ "abc", "abc", { word: " " }, { word: "def" } ]);
  });

  it("obeys leftmost/depth precedence in the face of ambiguity", () => {
    const expr = pr.repeat(
      pr.alt(
        pr.repeat(pr.alt('++', '--'), { min: 1 }),
        pr(/\S+/).onMatch(m => m[0]),
        pr(/\s+/).onMatch(() => null)
      )
    );
    let rv = expr.consume().execute('++--');
    rv.ok.should.eql(true);
    rv.value.should.eql([ [ "++", "--" ] ]);
    rv = expr.consume().execute('++y++ --++ ++');
    rv.ok.should.eql(true);
    rv.value.should.eql([ [ "++" ], "y++", [ "--", "++" ], [ "++" ] ]);
  });
});
