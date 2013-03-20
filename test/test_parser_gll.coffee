should = require 'should'
parser = require '../src/packrattle/parser'
inspect = require("util").inspect

describe "Parser GLL flow", ->
  $ = parser

  it "balances parens", ->
    p = $.alt($.seq("(", (-> p), ")").onMatch((x) -> ":" + x[1]), "x", "")
    $.consume(p, "(x)").match.should.eql(":x")
    $.consume(p, "((x))").match.should.eql("::x")
    $.consume(p, "((x)").ok.should.eql(false)
    $.consume(p, "(x))").ok.should.eql(false)

  it "accepts doubles", ->
    p = $.alt($.seq((-> p), (-> p)), "qx")
    $.consume(p, "qx").match.should.eql("qx")
    $.consume(p, "qxqx").match.should.eql([ "qx", "qx" ])
    $.consume(p, "qxqxqx").match.should.eql([ [ "qx", "qx" ], "qx" ])

  it "tracks a bunch of leading zeros", ->
    # 0 p | \d
    p = $.alt([ "0", (-> p) ], $.regex(/\d/).onMatch((n) -> n[0]))
    $.consume(p, "9").match.should.eql("9")
    $.consume(p, "09").match.should.eql([ "0", "9" ])
    $.consume(p, "009").match.should.eql([ "0", [ "0", "9" ] ])
    $.consume(p, "0009").match.should.eql([ "0", [ "0", ["0", "9" ] ] ])

  it "left-recurses", ->
    # p p $ | x
    p = $.alt([ (-> p), (-> p), "$" ], "x")
    $.consume(p, "x").match.should.eql("x")
    $.consume(p, "xx$").match.should.eql([ "x", "x", "$" ])
    $.consume(p, "xx$xx$$").match.should.eql([ [ "x", "x", "$" ], [ "x", "x", "$" ], "$" ])
    $.consume(p, "xx$xx$").ok.should.eql(false)
