should = require 'should'
parser = require '../src/packrattle/parser'
inspect = require("util").inspect

describe "Parser", ->
  $ = parser

  it "intentionally fails", ->
    p = $.reject
    rv = $.parse p, ""
    rv.state.pos.should.equal(0)
    rv.message.should.match(/failure/)

  it "matches a literal", ->
    p = $.string("hello")
    rv = $.parse p, "cat"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)
    rv = $.parse p, "hellon"
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  it "consumes the whole string", ->
    p = $.string("hello")
    rv = $.consume p, "hello"
    rv.ok.should.equal(true)
    rv.match.should.eql("hello")
    rv.state.pos.should.equal(5)
    rv = $.consume p, "hello!"
    rv.ok.should.equal(false)
    rv.state.pos.should.equal(5)
    rv.message.should.match(/end/)

  it "checks without consuming", ->
    p = $.check($.string("hello"))
    rv = $.parse p, "hello"
    rv.ok.should.equal(true)
    rv.match.should.eql("hello")
    rv.state.pos.should.equal(0)

  it "can perform a non-advancing check", ->
    p = $.seq("hello", $.check("there"), "th")
    rv = $.parse(p, "hellothere")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "hello", "there", "th" ])
    rv = $.parse(p, "helloth")
    rv.ok.should.equal(false)
    rv.message.should.match(/there/)

  it "handles regexen", ->
    p = $.regex(/h(i)?/)
    rv = $.parse p, "no"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/h\(i\)\?/)
    rv = $.parse p, "hit"
    rv.state.pos.should.equal(2)
    rv.match[0].should.eql("hi")
    rv.match[1].should.eql("i")

  it "transforms the error message", ->
    p = $.string("hello").onFail("Try a greeting.")
    rv = $.parse p, "cat"
    rv.state.pos.should.equal(0)
    rv.message.should.eql("Try a greeting.")
    rv = $.parse p, "hellon"
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  describe "onMatch", ->
    it "transforms a match", ->
      p = parser.string("hello").onMatch((s) -> s.toUpperCase())
      rv = $.parse p, "cat"
      rv.state.pos.should.equal(0)
      rv.message.should.match(/hello/)
      rv = $.parse p, "hellon"
      rv.state.pos.should.equal(5)
      rv.match.should.equal("HELLO")

    it "transforms a match into a constant", ->
      p = parser.string("hello").onMatch("yes")
      rv = $.parse p, "hello"
      rv.state.pos.should.equal(5)
      rv.match.should.eql("yes")

    it "transforms a match into a failure on exception", ->
      p = parser.string("hello").onMatch((s) -> throw "utter failure")
      rv = $.parse p, "hello"
      rv.ok.should.equal(false)
      rv.message.should.match(/utter failure/)

  it "matches with a condition", ->
    p = $.regex(/\d+/).matchIf((s) -> parseInt(s[0]) % 2 == 0).onFail("Expected an even number")
    rv = $.parse p, "103"
    rv.state.pos.should.equal(0)
    rv.message.should.match(/even number/)
    rv = $.parse p, "104"
    rv.state.pos.should.equal(3)
    rv.match[0].should.eql("104")

  it "can negate", ->
    p = $.string("hello").not_()
    rv = $.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.match.should.eql("")
    rv = $.parse(p, "hello")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)

  it "parses optionals", ->
    p = $.optional(/\d+/, "?")
    rv = $.parse(p, "34.")
    rv.state.pos.should.equal(2)
    rv.match[0].should.eql("34")
    rv = $.parse(p, "no")
    rv.state.pos.should.equal(0)
    rv.match.should.eql("?")

  describe "then/seq", ->
    it "can do a sequence", ->
      p = $.string("abc").then(parser.string("123"))
      rv = $.parse(p, "abc123")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "abc", "123" ])
      rv = $.parse(p, "abcd")
      rv.state.pos.should.equal(3)
      rv.message.should.match(/123/)
      rv = $.parse(p, "123")
      rv.state.pos.should.equal(0)
      rv.message.should.match(/abc/)

    it "strings together a chained sequence", ->
      p = $.seq(
        $.string("abc"),
        $.string("123").drop(),
        $.string("xyz")
      )
      rv = $.parse(p, "abc123xyz")
      rv.state.pos.should.equal(9)
      rv.match.should.eql([ "abc", "xyz" ])

    it "can lazily chain a sequence", ->
      hits = 0
      p = $.seq(
        -> (hits += 1; $.string("abc")),
        -> (hits += 1; $.string("123").drop()),
        -> (hits += 1; $.string("xyz"))
      )
      hits.should.equal(0)
      rv = $.parse(p, "abc123xyz")
      hits.should.equal(3)
      rv.state.pos.should.equal(9)
      rv.match.should.eql([ "abc", "xyz" ])

    it "can sequence optional elements", ->
      p = [ "abc", $.optional(/\d+/), "xyz" ]
      rv = $.parse(p, "abcxyz")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "abc", "", "xyz" ])
      rv = $.parse(p, "abc99xyz")
      rv.state.pos.should.equal(8)
      rv.match[0].should.eql("abc")
      rv.match[1][0].should.eql("99")
      rv.match[2].should.eql("xyz")

    it "skips whitespace inside seqIgnore()", ->
      p = $.seqIgnore(/\s+/, "abc", "xyz", "ghk")
      rv = $.parse(p, "abcxyzghk")
      rv.ok.should.equal(true)
      rv.match.should.eql([ "abc", "xyz", "ghk" ])
      rv = $.parse(p, "   abc xyz\tghk")
      rv.ok.should.equal(true)
      rv.match.should.eql([ "abc", "xyz", "ghk" ])

    it "skips whitespace lazily", ->
      hits = 0
      p = $.seqIgnore(
        -> (hits += 1; /\s+/),
        -> (hits += 1; $.string("abc")),
        -> (hits += 1; $.string("xyz")),
        -> (hits += 1; $.string("ghk"))
      )
      hits.should.equal(0)
      rv = $.parse(p, "   abc xyz\tghk")
      hits.should.equal(6)
      rv.ok.should.equal(true)
      rv.match.should.eql([ "abc", "xyz", "ghk" ])

    it "handles regexen in a sequence", ->
      p = $.seq(/\s*/, "if")
      rv = $.parse p, "   if"
      rv.state.pos.should.equal(5)
      rv.match[0][0].should.eql("   ")
      rv.match[1].should.eql("if")
      rv = $.parse p, "if"
      rv.state.pos.should.equal(2)
      rv.match[0][0].should.eql("")
      rv.match[1].should.eql("if")
      rv = $.parse p, ";  if"
      rv.state.pos.should.equal(0)
      rv.message.should.match(/if/)

  it "can perform an 'alt'", ->
    p = $.alt("hello", "goodbye")
    rv = $.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/\('hello'\) or \('goodbye'\)/)
    rv = $.parse(p, "hello")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")
    rv = $.parse(p, "goodbye")
    rv.state.pos.should.equal(7)
    rv.match.should.equal("goodbye")

  it "can perform an 'or'", ->
    p = $.string("hello").or($.string("goodbye"))
    rv = $.parse(p, "cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/\('hello'\) or \('goodbye'\)/)
    rv = $.parse(p, "hello")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")
    rv = $.parse(p, "goodbye")
    rv.state.pos.should.equal(7)
    rv.match.should.equal("goodbye")

  describe "repeats", ->
    it "0 or more", ->
      p = $.repeat("hi")
      rv = $.parse(p, "h")
      rv.state.pos.should.equal(0)
      rv.match.should.eql([])
      rv = $.parse(p, "hi")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "hi" ])
      rv = $.parse(p, "hiho")
      rv.state.pos.should.equal(2)
      rv.match.should.eql([ "hi" ])
      rv = $.parse(p, "hihihi")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "hi", "hi", "hi" ])

    it "2 or 3", ->
      p = $.repeat("hi", 2, 3)
      rv = $.parse(p, "hi")
      rv.ok.should.equal(false)
      rv.state.pos.should.equal(0)
      rv.message.should.match(/\('hi'\)\{2, 3}/)
      rv = $.parse(p, "hihi")
      rv.state.pos.should.equal(4)
      rv.match.should.eql([ "hi", "hi" ])
      rv = $.parse(p, "hihihi")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "hi", "hi", "hi" ])
      rv = $.parse(p, "hihihihi")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "hi", "hi", "hi" ])

    it "nested", ->
      p = $.repeat([ "hi", $.repeat("!") ])
      rv = $.parse(p, "hi!hi!!!hi?")
      rv.state.pos.should.equal(10)
      rv.match.should.eql([
        [ "hi", [ "!" ] ]
        [ "hi", [ "!", "!", "!" ] ]
        [ "hi", [] ]
      ])

    it "with whitespace ignoring", ->
      p = $.repeatIgnore(/\s+/, "hi")
      rv = $.parse(p, "hi  hihi ")
      rv.state.pos.should.equal(8)
      rv.match.should.eql([ "hi", "hi", "hi" ])

    it "and honors nested drops", ->
      p = $.string("123").drop().repeat()
      rv = $.parse(p, "123123")
      rv.ok.should.equal(true)
      rv.match.should.eql([])
      p = $.string("123").drop().times(2)
      rv = $.parse(p, "123123")
      rv.ok.should.equal(true)
      rv.match.should.eql([])

    it "but throws an error if there's no progress", ->
      p = $.repeat($.string(""))
      rv = $.parse(p, "?")
      
  describe "implicitly", ->
    it "turns strings into parsers", ->
      p = $.seq("abc", "123").or("xyz")
      rv = $.parse(p, "abc123")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ "abc", "123" ])
      rv = $.parse(p, "xyz")
      rv.state.pos.should.equal(3)
      rv.match.should.eql("xyz")

    it "strings together a chained sequence", ->
      p = [ "abc", parser.drop(/\d+/), "xyz" ]
      rv = $.parse(p, "abc11xyz")
      rv.state.pos.should.equal(8)
      rv.match.should.eql([ "abc", "xyz" ])

  describe "lazily resolves", ->
    it "a nested parser", ->
      p = $.seq ":", -> /\w+/
      rv = $.parse(p, ":hello")
      rv.state.pos.should.equal(6)
      rv.match[0].should.eql(":")
      rv.match[1][0].should.eql("hello")

    it "only once", ->
      count = 0
      p = $.seq ":", ->
        count++
        $.regex(/\w+/).onMatch (m) -> m[0].toUpperCase()
      rv = $.parse(p, ":hello")
      rv.state.pos.should.equal(6)
      rv.match.should.eql([ ":", "HELLO" ])
      count.should.equal(1)
      rv = $.parse(p, ":goodbye")
      rv.state.pos.should.equal(8)
      rv.match.should.eql([ ":", "GOODBYE" ])
      count.should.equal(1)

  it "only executes a parser once per string/position", ->
    count = 0
    p = $.seq "hello", /\s*/, $.string("there").onMatch (x) ->
      count++
      x
    s = new parser.ParserState("hello  there!")
    count.should.equal(0)
    rv = $.parse(p, s)
    rv.ok.should.equal(true)
    rv.match[2].should.eql("there")
    count.should.equal(1)
    rv = $.parse(p, s)
    rv.ok.should.equal(true)
    rv.match[2].should.eql("there")
    count.should.equal(1)

  it "can commit to an alternative", ->
    p = $.seq($.string("!").commit(), /\d+/).onFail("! must be a number").or([ "@", /\d+/ ]).onMatch (a) ->
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
