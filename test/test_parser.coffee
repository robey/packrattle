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


describe "Parser", ->
  it "reject", ->
    (-> pr.reject.run("")).should.throw /failure/

  it "succeed", ->
    parse(pr.succeed("foo"), "").should.eql [ "foo", 0 ]

  it "literal string", ->
    p = pr.string("hello")
    (-> p.run("cat")).should.throw /hello/
    parse(p, "hellon").should.eql [ "hello", 5 ]

  it "consumes the whole string", ->
    p = pr.string("hello")
    consume(p, "hello").should.eql [ "hello", 5 ]
    (-> p.run("hello!")).should.throw /end/

  it "checks without consuming", ->
    p = pr.check(pr.string("hello"))
    parse(p, "hello").should.eql [ "hello", 0 ]

  it "can perform a non-advancing check", ->
    p = pr.seq("hello", pr.check("there"), "th")
    parse(p, "hellothere").should.eql [ [ "hello", "there", "th" ], 7 ]
    (-> p.run("helloth")).should.throw /there/

  it "regex", ->
    p = pr.regex(/h(i)?/)
    (-> p.run("no")).should.throw /h\(i\)\?/
    [ m, pos ] = parse(p, "hit")
    pos.should.equal(2)
    m[0].should.eql("hi")
    m[1].should.eql("i")

  it "onFail", ->
    p = pr.string("hello").onFail("Try a greeting.")
    (-> p.run("cat")).should.throw "Try a greeting."
    parse(p, "hellon").should.eql [ "hello", 5 ]

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

  it "can perform an 'alt'", ->
    p = pr.alt("hello", "goodbye")
    (-> p.run("cat")).should.throw /'hello'/
    parse(p, "hello").should.eql [ "hello", 5 ]
    parse(p, "goodbye").should.eql [ "goodbye", 7 ]

  it "can perform an 'or'", ->
    p = pr.string("hello").or(pr.string("goodbye"))
    (-> p.run("cat")).should.throw /'hello'/
    parse(p, "hello").should.eql [ "hello", 5 ]
    parse(p, "goodbye").should.eql [ "goodbye", 7 ]

  describe "implicitly", ->
    it "turns strings into parsers", ->
      p = pr.seq("abc", "123").or("xyz")
      parse(p, "abc123").should.eql [ [ "abc", "123" ], 6 ]
      parse(p, "xyz").should.eql [ "xyz", 3 ]

    it "strings together a chained sequence", ->
      p = [ "abc", pr.drop(/\d+/), "xyz" ]
      parse(p, "abc11xyz").should.eql [ [ "abc", "xyz" ], 8 ]

  describe "lazily resolves", ->
    it "a nested parser", ->
      p = pr.seq ":", -> /\w+/
      [ m, pos ] = parse(p, ":hello")
      pos.should.equal(6)
      m[0].should.eql(":")
      m[1][0].should.eql("hello")

    it "only once", ->
      count = 0
      p = pr.seq ":", ->
        count++
        pr.regex(/\w+/).onMatch (m) -> m[0].toUpperCase()
      parse(p, ":hello").should.eql [ [ ":", "HELLO" ], 6 ]
      count.should.equal(1)
      parse(p, ":goodbye").should.eql [ [ ":", "GOODBYE" ], 8 ]
      count.should.equal(1)

  it "only executes a parser once per string/position", ->
    count = 0
    p = pr.seq "hello", /\s*/, pr.string("there").onMatch (x) ->
      count++
      x
    s = new pr.ParserState("hello  there!")
    count.should.equal(0)
    rv = pr.parse(p, s)
    rv.ok.should.equal(true)
    rv.match[2].should.eql("there")
    count.should.equal(1)
    rv = pr.parse(p, s)
    rv.ok.should.equal(true)
    rv.match[2].should.eql("there")
    count.should.equal(1)

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

