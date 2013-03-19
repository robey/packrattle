should = require 'should'
parser = require '../src/packrattle/parser'

describe "Parser#repeatSeparated", ->
  $ = parser

  it "works", ->
    p = $.repeatSeparated("hi", ",")
    rv = $.parse(p, "hi,hi,hi")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  describe "comma-separated numbers", ->
    p = $.repeatSeparated($.regex(/\d+/).onMatch((x) -> x[0]), /\s*,\s*/)

    it "matches one", ->
      rv = $.parse(p, "98")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "98" ])

    it "matches several", ->
      rv = $.parse(p, "98, 99 ,100")
      rv.state.pos.should.equal(11)
      rv.match.should.eql([ "98", "99", "100" ])

    it "map", ->
      rv = $.parse(p.onMatch((x) -> x.map((n) -> parseInt(n))), "98, 99 ,100")
      rv.state.pos.should.equal(11)
      rv.match.should.eql([ 98, 99, 100 ])

    it "ignores trailing separators", ->
      rv = $.parse(p, "98, wut")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "98" ])
