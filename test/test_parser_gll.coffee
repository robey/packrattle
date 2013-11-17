should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser GLL flow", ->
  it "balances parens", ->
    p = pr.alt(pr([ "(", (-> p), ")" ]).onMatch((x) -> ":" + x[1]), "x", "")
    pr.consume(p, "(x)").match.should.eql(":x")
    pr.consume(p, "((x))").match.should.eql("::x")
    pr.consume(p, "((x)").ok.should.eql(false)
    pr.consume(p, "(x))").ok.should.eql(false)

  it "accepts doubles", ->
    p = pr.alt(pr([ (-> p), (-> p) ]), "qx")
    pr.consume(p, "qx").match.should.eql("qx")
    pr.consume(p, "qxqx").match.should.eql([ "qx", "qx" ])
    pr.consume(p, "qxqxqx").match.should.eql([ [ "qx", "qx" ], "qx" ])

  it "tracks a bunch of leading zeros", ->
    # 0 p | \d
    p = pr.alt([ "0", (-> p) ], pr(/\d/).onMatch((n) -> n[0]))
    pr.consume(p, "9").match.should.eql("9")
    pr.consume(p, "09").match.should.eql([ "0", "9" ])
    pr.consume(p, "009").match.should.eql([ "0", [ "0", "9" ] ])
    pr.consume(p, "0009").match.should.eql([ "0", [ "0", ["0", "9" ] ] ])

  it "left-recurses", ->
    # p p $ | x
    p = pr.alt([ (-> p), (-> p), "$" ], "x")
    pr.consume(p, "x").match.should.eql("x")
    pr.consume(p, "xx$").match.should.eql([ "x", "x", "$" ])
    pr.consume(p, "xx$xx$$").match.should.eql([ [ "x", "x", "$" ], [ "x", "x", "$" ], "$" ])
    pr.consume(p, "xx$xx$").ok.should.eql(false)

  it "adds numbers", ->
    # p + p | \d+
    p = pr.alt(
      pr([ (-> p), "+", (-> p) ]).onMatch((x) -> x[0] + x[2]),
      pr(/\d+/).onMatch((x) -> parseInt(x))
    )
    pr.consume(p, "23").match.should.eql(23)
    pr.consume(p, "2+3").match.should.eql(5)
    pr.consume(p, "23+100+9").match.should.eql(132)
