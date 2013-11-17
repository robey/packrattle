should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser.repeatSeparated", ->
  it "works", ->
    p = pr.repeatSeparated("hi", ",")
    rv = pr.parse(p, "hi,hi,hi")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  describe "comma-separated numbers", ->
    p = pr.repeatSeparated(pr.regex(/\d+/).onMatch((x) -> x[0]), /\s*,\s*/)

    it "matches one", ->
      rv = pr.parse(p, "98")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "98" ])

    it "matches several", ->
      rv = pr.parse(p, "98, 99 ,100")
      rv.state.pos.should.equal(11)
      rv.match.should.eql([ "98", "99", "100" ])

    it "map", ->
      rv = pr.parse(p.onMatch((x) -> x.map((n) -> parseInt(n))), "98, 99 ,100")
      rv.state.pos.should.equal(11)
      rv.match.should.eql([ 98, 99, 100 ])

    it "ignores trailing separators", ->
      rv = pr.parse(p, "98, wut")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "98" ])
