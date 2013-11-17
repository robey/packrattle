should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser.repeat", ->
  it "0 or more", ->
    p = pr.repeat("hi")
    rv = pr.parse(p, "h")
    rv.state.pos.should.equal(0)
    rv.match.should.eql([])
    rv = pr.parse(p, "hi")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "hi" ])
    rv = pr.parse(p, "hiho")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "hi" ])
    rv = pr.parse(p, "hihihi")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "2 or 3", ->
    p = pr.repeat("hi", 2, 3)
    rv = pr.parse(p, "hi")
    rv.ok.should.equal(false)
    rv.state.pos.should.equal(0)
    rv.message.should.match(/\('hi'\)\{2, 3}/)
    rv = pr.parse(p, "hihi")
    rv.state.pos.should.equal(4)
    rv.match.should.eql([ "hi", "hi" ])
    rv = pr.parse(p, "hihihi")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "hi", "hi", "hi" ])
    rv = pr.parse(p, "hihihihi")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "nested", ->
    p = pr.repeat([ "hi", pr.repeat("!") ])
    rv = pr.parse(p, "hi!hi!!!hi?")
    rv.state.pos.should.equal(10)
    rv.match.should.eql([
      [ "hi", [ "!" ] ]
      [ "hi", [ "!", "!", "!" ] ]
      [ "hi", [] ]
    ])

  it "with whitespace ignoring", ->
    p = pr.repeatIgnore(/\s+/, "hi")
    rv = pr.parse(p, "hi  hihi ")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "and honors nested drops", ->
    p = pr.string("123").drop().repeat()
    rv = pr.parse(p, "123123")
    rv.ok.should.equal(true)
    rv.match.should.eql([])
    p = pr.string("123").drop().times(2)
    rv = pr.parse(p, "123123")
    rv.ok.should.equal(true)
    rv.match.should.eql([])

  it "but throws an error if there's no progress", ->
    p = pr.repeat(pr.string(""))
    (-> pr.parse(p, "?")).should.throw(/isn't making progress/)
