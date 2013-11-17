should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser.onMatch", ->
  it "transforms a match", ->
    p = pr("hello").onMatch((s) -> s.toUpperCase())
    rv = pr.parse p, "cat"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)
    rv = pr.parse p, "hellon"
    rv.state.pos.should.equal(5)
    rv.match.should.equal("HELLO")

  it "transforms a match into a constant", ->
    p = pr("hello").onMatch("yes")
    rv = pr.parse p, "hello"
    rv.state.pos.should.equal(5)
    rv.match.should.eql("yes")

  it "transforms a match into a failure on exception", ->
    p = pr("hello").onMatch((s) -> throw "utter failure")
    rv = pr.parse p, "hello"
    rv.ok.should.equal(false)
    rv.message.should.match(/utter failure/)
    rv.state.pos.should.eql(5)

  a = "foo"
  m = pr("foo")
  f = (s) -> pr(s + "bar")
  g = (s) -> pr(s + "baz")

  shouldBeIdentical = (p1, p2, input) ->
    rv1 = pr.parse(p1, input)
    rv2 = pr.parse(p2, input)
    rv1.ok.should.equal(true)
    rv2.ok.should.equal(true)
    rv1.match.should.equal(rv2.match)

  it "satisfies monad left identity", ->
    p1 = pr.succeed(a).onMatch(f)
    p2 = f(a)
    shouldBeIdentical(p1, p2, "foobar")

  it "satisfies monad right identity", ->
    p1 = m.onMatch(pr.succeed)
    p2 = m
    shouldBeIdentical(p1, p2, "foo")

  it "satisfies monad associativity", ->
    p1 = m.onMatch(f).onMatch(g)
    p2 = m.onMatch((s) -> f(s).onMatch(g))
    shouldBeIdentical(p1, p2, "foofoobarfoobarbaz")

  it "fails if a nested parser fails", ->
    p = m.onMatch(-> pr.reject.onFail("no foo"))
    rv = pr.parse p, "foo"
    rv.ok.should.equal(false)
    rv.message.should.equal("no foo")
