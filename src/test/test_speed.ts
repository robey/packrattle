import { alt, matchRegex, matchString, Parser, reduce, seq } from "..";

class Binary {
  constructor(public left: Node, public op: string, public right: Node) {
    // pass
  }
}
type Node = Binary | number;

const ws = matchRegex(/\s*/);
const number = matchRegex(/\d+/).map(m => parseInt(m[0], 10));
const parens: Parser<string, Node> = seq(matchString("("), ws, () => expr, ws, matchString(")")).map(m => m[2]);
const atom = alt(number, parens);

const multOp = alt(matchString("*"), matchString("/"), matchString("%"));
const term = reduce(seq(ws, multOp, ws).map(m => m[1]), atom, { first: x => x, next: binary });

const addOp = alt(matchString("+"), matchString("-"));
const expr: Parser<string, Node> = reduce(seq(ws, addOp, ws).map(m => m[1]), term, { first: x => x, next: binary });

function binary(left: Node, op: string, right: Node): Binary {
  return new Binary(left, op, right);
}

describe("speed", () => {
  it("profile", () => {
    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      expr.run("1 + 2 * 3 + 4 * (5 + 6)");
    }
    const endTime = Date.now();
    console.log("finished in " + (endTime - startTime) + "ms");
  });
});
