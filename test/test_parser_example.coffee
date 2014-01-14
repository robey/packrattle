should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser example", ->
  binary = (left, op, right) -> { op: op, left: left, right: right }
  ws = (p) -> pr.seqIgnore(/\s+/, p).onMatch (x) -> x[0]
  number = ws(/\d+/).onMatch (m) -> parseInt(m[0])
  parens = pr([ ws(pr("(").drop()), (-> expr), ws(pr(")").drop()) ])
  atom = pr.alt(number, parens.onMatch((e) -> e[0]))
  term = pr.reduce(atom, ws(pr.alt("*", "/", "%")), ((x) -> x), binary)
  expr = pr.reduce(term, ws(pr.alt("+", "-")), ((x) -> x), binary)

  it "recognizes a number", ->
    rv = pr.parse(expr, "900")
    rv.ok.should.eql(true)
    rv.match.should.eql(900)

  it "recognizes addition", ->
    rv = pr.consume(expr, "2 + 3")
    rv.ok.should.eql(true)
    rv.match.should.eql(op: "+", left: 2, right: 3)

  it "recognizes a complex expression", ->
    rv = pr.consume(expr, "1 + 2 * 3 + 4 * (5 + 6)")
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
    number = pr.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = pr.reduce(number, "+", ((n) -> n), ((sum, op, n) -> sum + n))
    rv = pr.parse(expr, "2+3+4")
    rv.ok.should.eql(true)
    rv.state.loc.pos.should.equal(5)
    rv.match.should.equal(9)

  it "csv", ->
    csv = pr.repeatSeparated(
      pr(/([^,]*)/).onMatch (m) -> m[0]
      /,/
    )
    rv = pr.parse(csv, "this,is,csv")
    rv.ok.should.eql(true)
    rv.match.should.eql([ "this", "is", "csv" ])

  it "parses alternatives in priority (left to right) order", ->
    abc = pr.string('abc')
    wordOrSep = pr.alt(/\s+/, /\S+/).onMatch((m) -> { word: m[0] })
    line = pr.repeat(pr.alt(abc, wordOrSep))
    rv = pr.consume(line, 'abcabc def')
    rv.ok.should.eql(true)
    rv.match.should.eql [ "abc", "abc", { word: " " }, { word: "def" } ]

  it "exhausts leftmost alternatives before trying others", ->
    expr = pr.alt(
      pr([ (-> expr), "+", (-> expr) ]).onMatch((x) -> x[0] + x[2]),
      pr(/\d+/).onMatch((m) -> parseInt(m[0])),
      pr(/.+/).onMatch((m) -> "BAD")
    )
    expr.run("4+80+3+200+12").should.eql 299

  it "obeys leftmost/depth precedence in the face of ambiguity", ->
    expr = pr.repeat(
      pr.alt(
        pr.repeat(pr.alt('++', '--'), 1),
        pr(/\S+/).onMatch((m) -> m[0]),
        pr(/\s+/).onMatch(-> null)
      )
    )
    rv = pr.consume(expr, '++--')
    rv.ok.should.eql(true)
    rv.match.should.eql([ [ "++", "--" ] ])
    rv = pr.consume(expr, '++y++ --++ ++')
    rv.ok.should.eql(true)
    rv.match.should.eql([ [ "++" ], "y++", [ "--", "++" ], [ "++" ] ])
