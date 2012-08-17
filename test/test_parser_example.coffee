should = require 'should'
parser = require '../src/packrattle/parser'

describe "Parser example", ->
  $ = parser.implicit
  binary = (left, op, right) -> { op: op, left: left, right: right }
  ws = /\s*/
  number = $(/\d+/).skip(ws).onMatch (m) -> parseInt(m[0])
  parens = [ $("(").skip(ws).drop(), (-> expr), $(")").skip(ws).drop() ]
  atom = number.or($(parens).onMatch((e) -> e[0]))
  term = atom.reduce($("*").or("/").or("%").skip(ws), binary)
  expr = term.reduce($("+").or("-").skip(ws), binary)

  it "recognizes a number", ->
    rv = expr.parse("900")
    rv.ok.should.eql(true)
    rv.match.should.eql(900)

  it "recognizes addition", ->
    rv = expr.parse("2 + 3")
    rv.ok.should.eql(true)
    rv.match.should.eql(op: "+", left: 2, right: 3)

  it "recognizes a complex expression", ->
    rv = expr.parse("1 + 2 * 3 + 4 * (5 + 6)")
    rv.ok.should.eql(true)
    rv.match.should.eql(
      op: "+"
      left: {
        op: "+"
        left: 1
        right: {
          op: "*"
          left: 2
          right: 3
        }
      }
      right: {
        op: "*"
        left: 4
        right: {
          op: "+"
          left: 5
          right: 6
        }
      }
    )

  it "can add with foldLeft", ->
    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = parser.foldLeft(
      tail: number
      sep: parser.string("+")
      accumulator: (n) -> n
      fold: (sum, op, n) -> sum + n
    )
    rv = expr.parse("2+3+4")
    rv.ok.should.eql(true)
    rv.state.pos.should.equal(5)
    rv.match.should.equal(9)

  it "can add with reduce", ->
    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = number.reduce "+", (sum, op, n) -> sum + n
    rv = expr.parse("2+3+4")
    rv.ok.should.eql(true)
    rv.state.pos.should.equal(5)
    rv.match.should.equal(9)

  it "csv", ->
    csv = parser.repeat(
      parser.regex(/([^,]*)/).onMatch (m) -> m[0]
      /,/
    )
    rv = csv.parse("this,is,csv")
    rv.ok.should.eql(true)
    rv.match.should.eql([ "this", "is", "csv" ])
