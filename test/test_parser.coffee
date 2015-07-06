should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

parse = (p, line) ->
  rv = pr.parse p, line
  rv.ok.should.equal true
  [ rv.match, rv.state.loc.pos ]

consume = (p, line) ->
  rv = pr.consume p, line
  rv.ok.should.equal true
  [ rv.match, rv.state.loc.pos ]





  it "checks without consuming", ->
    p = pr.check(pr.string("hello"))
    parse(p, "hello").should.eql [ "hello", 0 ]

  it "can perform a non-advancing check", ->
    p = pr.seq("hello", pr.check("there"), "th")
    parse(p, "hellothere").should.eql [ [ "hello", "there", "th" ], 7 ]
    (-> p.run("helloth")).should.throw /there/

  it "matches with a condition", ->
    p = pr.regex(/\d+/).matchIf((s) -> parseInt(s[0]) % 2 == 0).onFail("Expected an even number")
    (-> p.run("103")).should.throw /even number/
    [ m, pos ] = parse(p, "104")
    pos.should.equal(3)
    m[0].should.eql("104")

  it "can negate", ->
    p = pr.string("hello").not_()
    parse(p, "cat").should.eql [ "", 0 ]
    (-> p.run("hello")).should.throw /hello/

  it "parses optionals", ->
    p = pr.optional(/\d+/, "?")
    [ m, pos ] = parse(p, "34.")
    [ m[0], pos ].should.eql [ "34", 2 ]
    parse(p, "no").should.eql [ "?", 0 ]





  it "advances position correctly past an optional", ->
    p = pr([
      /[b]+/
      pr(/c/).optional().onMatch (m, state) -> { start: state.loc.pos, end: state.endloc.pos }
      pr(/[d]+/)
    ])
    rv = pr.parse(p, "bbbd")
    rv.ok.should.eql(true)
    rv.match[1].should.eql { start: 3, end: 3 }
    rv.match[2][0].should.eql "d"
