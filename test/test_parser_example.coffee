should = require 'should'
parser = require '../src/packrattle/parser'

describe "Parser example", ->
  $ = parser
  binary = (left, op, right) -> { op: op, left: left, right: right }
  ws = (p) -> $.dropPrefix(/\s*/, p)
  number = ws(/\d+/).onMatch (m) -> parseInt(m[0])
  parens = $.seq(ws($.drop("(")), (-> expr), ws($.drop(")")))
  atom = $.alt(number, parens.onMatch((e) -> e[0]))
  term = $.reduce(atom, ws($.alt("*", "/", "%")), ((x) -> x), binary)
  expr = $.reduce(term, ws($.alt("+", "-")), ((x) -> x), binary)

  it "recognizes a number", ->
    rv = $.parse(expr, "900")
    rv.ok.should.eql(true)
    rv.match.should.eql(900)

  it "recognizes addition", ->
    rv = $.parse(expr, "2 + 3")
    rv.ok.should.eql(true)
    rv.match.should.eql(op: "+", left: 2, right: 3)

  it "recognizes a complex expression", ->
    rv = $.parse(expr, "1 + 2 * 3 + 4 * (5 + 6)")
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

  it "can add with reduce", ->
    number = $.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = $.reduce(number, "+", ((n) -> n), ((sum, op, n) -> sum + n))
    rv = $.parse(expr, "2+3+4")
    rv.ok.should.eql(true)
    rv.state.pos.should.equal(5)
    rv.match.should.equal(9)

  it "csv", ->
    csv = $.repeatSeparated(
      $.regex(/([^,]*)/).onMatch (m) -> m[0]
      /,/
    )
    rv = $.parse(csv, "this,is,csv")
    rv.ok.should.eql(true)
    rv.match.should.eql([ "this", "is", "csv" ])

