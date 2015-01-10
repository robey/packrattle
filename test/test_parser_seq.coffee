should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser.seq", ->
  it "can do a sequence", ->
    p = pr.string("abc").then(pr.string("123"))
    rv = pr.parse(p, "abc123")
    rv.state.pos().should.equal(6)
    rv.match.should.eql([ "abc", "123" ])
    rv = pr.parse(p, "abcd")
    rv.state.pos().should.equal(3)
    rv.message.should.match(/123/)
    rv = pr.parse(p, "123")
    rv.state.pos().should.equal(0)
    rv.message.should.match(/abc/)

  it "strings together a chained sequence", ->
    p = pr.seq(
      pr.string("abc"),
      pr.string("123").drop(),
      pr.string("xyz")
    )
    rv = pr.parse(p, "abc123xyz")
    rv.state.pos().should.equal(9)
    rv.match.should.eql([ "abc", "xyz" ])

  it "can lazily chain a sequence", ->
    hits = 0
    p = pr.seq(
      -> (hits += 1; pr.string("abc")),
      -> (hits += 1; pr.string("123").drop()),
      -> (hits += 1; pr.string("xyz"))
    )
    hits.should.equal(0)
    rv = pr.parse(p, "abc123xyz")
    hits.should.equal(3)
    rv.state.pos().should.equal(9)
    rv.match.should.eql([ "abc", "xyz" ])

  it "can sequence optional elements", ->
    p = [ "abc", pr.optional(/\d+/), "xyz" ]
    rv = pr.parse(p, "abcxyz")
    rv.state.pos().should.equal(6)
    rv.match.should.eql([ "abc", "", "xyz" ])
    rv = pr.parse(p, "abc99xyz")
    rv.state.pos().should.equal(8)
    rv.match[0].should.eql("abc")
    rv.match[1][0].should.eql("99")
    rv.match[2].should.eql("xyz")

  it "skips a dropped element at the end", ->
    p = [ "abc", pr.optional(/\d+/).drop(), pr.optional(/\w+/).drop() ]
    rv = pr.parse(p, "abcj")
    rv.state.pos().should.equal(4)
    rv.match.should.eql([ "abc" ])
    rv = pr.parse(p, "abc99")
    rv.state.pos().should.equal(5)
    rv.match.should.eql([ "abc" ])

  it "skips whitespace inside seqIgnore()", ->
    p = pr.seqIgnore(/\s+/, "abc", "xyz", "ghk")
    rv = pr.parse(p, "abcxyzghk")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "abc", "xyz", "ghk" ])
    rv = pr.parse(p, "   abc xyz\tghk")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "abc", "xyz", "ghk" ])

  it "skips whitespace lazily", ->
    hits = 0
    p = pr.seqIgnore(
      -> (hits += 1; /\s+/),
      -> (hits += 1; pr.string("abc")),
      -> (hits += 1; pr.string("xyz")),
      -> (hits += 1; pr.string("ghk"))
    )
    hits.should.equal(0)
    rv = pr.parse(p, "   abc xyz\tghk")
    hits.should.equal(4)
    rv.ok.should.equal(true)
    rv.match.should.eql([ "abc", "xyz", "ghk" ])

  it "handles regexen in a sequence", ->
    p = pr.seq(/\s*/, "if")
    rv = pr.parse p, "   if"
    rv.state.pos().should.equal(5)
    rv.match[0][0].should.eql("   ")
    rv.match[1].should.eql("if")
    rv = pr.parse p, "if"
    rv.state.pos().should.equal(2)
    rv.match[0][0].should.eql("")
    rv.match[1].should.eql("if")
    rv = pr.parse p, ";  if"
    rv.state.pos().should.equal(0)
    rv.message.should.match(/if/)

