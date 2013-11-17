should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser", ->
  it "reject", ->
    p = pr.reject
    rv = pr.parse p, ""
    rv.state.pos.should.equal(0)
    rv.message.should.match(/failure/)

  it "succeed", ->
    p = pr.succeed("foo")
    rv = pr.parse p, ""
    rv.state.pos.should.equal(0)
    rv.ok.should.equal(true)
    rv.match.should.equal("foo")

  it "literal string", ->
    p = pr.string("hello")
    rv = pr.parse p, "cat"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)
    rv = pr.parse p, "hellon"
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  it "consumes the whole string", ->
    p = pr.string("hello")
    rv = pr.consume p, "hello"
    rv.ok.should.equal(true)
    rv.match.should.eql("hello")
    rv.state.pos.should.equal(5)
    rv = pr.consume p, "hello!"
    rv.ok.should.equal(false)
    rv.state.pos.should.equal(5)
    rv.message.should.match(/end/)

  it "checks without consuming", ->
    p = pr.check(pr.string("hello"))
    rv = pr.parse p, "hello"
    rv.ok.should.equal(true)
    rv.match.should.eql("hello")
    rv.state.pos.should.equal(0)

  it "can perform a non-advancing check", ->
    p = pr.seq("hello", pr.check("there"), "th")
    rv = pr.parse(p, "hellothere")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "hello", "there", "th" ])
    rv = pr.parse(p, "helloth")
    rv.ok.should.equal(false)
    rv.message.should.match(/there/)

  it "regex", ->
    p = pr.regex(/h(i)?/)
    rv = pr.parse p, "no"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/h\(i\)\?/)
    rv = pr.parse p, "hit"
    rv.state.pos.should.equal(2)
    rv.match[0].should.eql("hi")
    rv.match[1].should.eql("i")

  it "onFail", ->
    p = pr.string("hello").onFail("Try a greeting.")
    rv = pr.parse p, "cat"
    rv.state.pos.should.equal(0)
    rv.message.should.eql("Try a greeting.")
    rv = pr.parse p, "hellon"
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  it "matches with a condition", ->
    p = pr.regex(/\d+/).matchIf((s) -> parseInt(s[0]) % 2 == 0).onFail("Expected an even number")
    rv = pr.parse p, "103"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/even number/)
    rv = pr.parse p, "104"
    rv.state.pos.should.equal(3)
    rv.match[0].should.eql("104")

  it "can negate", ->
    p = pr.string("hello").not_()
    rv = pr.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.match.should.eql("")
    rv = pr.parse(p, "hello")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)

  it "parses optionals", ->
    p = pr.optional(/\d+/, "?")
    rv = pr.parse(p, "34.")
    rv.state.pos.should.equal(2)
    rv.match[0].should.eql("34")
    rv = pr.parse(p, "no")
    rv.state.pos.should.equal(0)
    rv.match.should.eql("?")

  it "can perform an 'alt'", ->
    p = pr.alt("hello", "goodbye")
    rv = pr.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/'hello'/)
    rv = pr.parse(p, "hello")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")
    rv = pr.parse(p, "goodbye")
    rv.state.pos.should.equal(7)
    rv.match.should.equal("goodbye")

  it "can perform an 'or'", ->
    p = pr.string("hello").or(pr.string("goodbye"))
    rv = pr.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/'hello'/)
    rv = pr.parse(p, "hello")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")
    rv = pr.parse(p, "goodbye")
    rv.state.pos.should.equal(7)
    rv.match.should.equal("goodbye")

  describe "implicitly", ->
    it "turns strings into parsers", ->
      p = pr.seq("abc", "123").or("xyz")
      rv = pr.parse(p, "abc123")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "abc", "123" ])
      rv = pr.parse(p, "xyz")
      rv.state.pos.should.equal(3)
      rv.match.should.eql("xyz")

    it "strings together a chained sequence", ->
      p = [ "abc", pr.drop(/\d+/), "xyz" ]
      rv = pr.parse(p, "abc11xyz")
      rv.state.pos.should.equal(8)
      rv.match.should.eql([ "abc", "xyz" ])

  describe "lazily resolves", ->
    it "a nested parser", ->
      p = pr.seq ":", -> /\w+/
      rv = pr.parse(p, ":hello")
      rv.state.pos.should.equal(6)
      rv.match[0].should.eql(":")
      rv.match[1][0].should.eql("hello")

    it "only once", ->
      count = 0
      p = pr.seq ":", ->
        count++
        pr.regex(/\w+/).onMatch (m) -> m[0].toUpperCase()
      rv = pr.parse(p, ":hello")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ ":", "HELLO" ])
      count.should.equal(1)
      rv = pr.parse(p, ":goodbye")
      rv.state.pos.should.equal(8)
      rv.match.should.eql([ ":", "GOODBYE" ])
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

  describe "commit", ->
    it "can commit to an alternative", ->
      p = pr.seq(
        pr.string("!").commit()
        pr.regex(/\d+/).onFail("! must be a number")
      ).or([ "@", /\d+/ ]).onMatch (a) ->
        [ a[0], a[1][0] ]
      rv = $.parse(p, "!3")
      rv.ok.should.equal(true)
      rv.match.should.eql([ "!", "3" ])
      rv = $.parse(p, "@55")
      rv.ok.should.equal(true)
      rv.match.should.eql([ "@", "55" ])
      rv = $.parse(p, "!ok")
      rv.ok.should.equal(false)
      rv.message.should.eql("! must be a number")
      rv = $.parse(p, "@ok")
      rv.ok.should.equal(false)
      rv.message.should.not.eql("! must be a number")

    it "aborts nested alternatives", ->
      p = $.alt(
        [
          /\d+/,
          $.alt(
            [ $.string("!").commit(), "0" ],
            /[a-z]+/
          )
        ],
        [ "2", "!", /\d+/ ]
      )
      rv = $.parse(p, "2!9")
      rv.ok.should.equal(false)
      rv.message.should.match(/Expected '0'/)

    it "is remembered through a chain", ->
      p = $.alt(
        [ $.string("!").commit(), "x", "y", /\d+/ ],
        /.xyz/
      )
      rv = $.parse(p, "!xyz")
      rv.ok.should.equal(false)

    it "is remembered through an exception", ->
      p = $.alt(
        $.seq($.string("!").commit(), "x", "y").onMatch((m) -> throw new Error("Y!")),
        /.xyz/
      )
      rv = $.parse(p, "!xyz")
      rv.ok.should.equal(false)
