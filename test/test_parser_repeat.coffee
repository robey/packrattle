should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

matchSpan = (rv) ->
  state = rv.state.flip()
  [ rv.match, state.loc.pos, state.endloc.pos ]

describe "Parser.repeat", ->
  it "0 or more", ->
    p = pr.repeat("hi")
    matchSpan(pr.parse(p, "h")).should.eql [ [], 0, 0 ]
    matchSpan(pr.parse(p, "hi")).should.eql [ [ "hi" ], 0, 2 ]
    matchSpan(pr.parse(p, "hiho")).should.eql [ [ "hi" ], 0, 2 ]
    matchSpan(pr.parse(p, "hihihi")).should.eql [ [ "hi", "hi", "hi" ], 0, 6 ]

  it "2 or 3", ->
    p = pr.repeat("hi", 2, 3)
    (-> p.run("hi")).should.throw /\('hi'\)\{2, 3}/
    matchSpan(pr.parse(p, "hihi")).should.eql [ [ "hi", "hi" ], 0, 4 ]
    matchSpan(pr.parse(p, "hihihi")).should.eql [ [ "hi", "hi", "hi" ], 0, 6 ]
    matchSpan(pr.parse(p, "hihihihi")).should.eql [ [ "hi", "hi", "hi" ], 0, 6 ]

  it "nested", ->
    p = pr.repeat([ "hi", pr.repeat("!") ])
    rv = pr.parse(p, "hi!hi!!!hi?")
    rv.state.loc.pos.should.equal(10)
    rv.match.should.eql([
      [ "hi", [ "!" ] ]
      [ "hi", [ "!", "!", "!" ] ]
      [ "hi", [] ]
    ])

  it "with whitespace ignoring", ->
    p = pr.repeatIgnore(/\s+/, "hi")
    matchSpan(pr.parse(p, "hi  hihi ")).should.eql [ [ "hi", "hi", "hi" ], 0, 8 ]

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

  it "aborts if a repeating phrase aborts", ->
    ws = pr(/\s*/).drop()
    algebra = pr.reduce(
      pr(/\d+/).onMatch((m) -> m[0]).onFail("Expected operand"),
      pr([ ws, pr.alt("+", "-"), ws ]).commit().onMatch((m) -> m[0]),
      ((x) -> x),
      ((left, op, right) -> { binary: op, left: left, right: right })
    )
    algebra.run("3 + 2").should.eql(binary: "+", left: "3", right: "2")
    try
      algebra.run("3 +")
      throw new Error("nope")
    catch e
      e.message.should.eql "Expected operand"
      e.state.loc.pos.should.eql 3
    try
      algebra.run("3 + 5 +")
      throw new Error("nope")
    catch e
      e.message.should.eql "Expected operand"
      e.state.loc.pos.should.eql 7
