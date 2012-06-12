should = require 'should'
parser = require '../src/packrattle/parser'

describe "ParserState", ->
  it "finds the current line", ->
    text = "line one\nline two\nline 3\n\nline 4"
    state = parser.newState(text).advance(0)
    state.line().should.eql("line one")
    state.lineno.should.equal(0)
    state.xpos.should.equal(0)
    state = parser.newState(text).advance(5)
    state.line().should.eql("line one")
    state.lineno.should.equal(0)
    state.xpos.should.equal(5)
    state = parser.newState(text).advance(7)
    state.line().should.eql("line one")
    state.lineno.should.equal(0)
    state.xpos.should.equal(7)
    state = parser.newState(text).advance(8)
    state.line().should.eql("line one")
    state.lineno.should.equal(0)
    state.xpos.should.equal(8)
    state = parser.newState(text).advance(9)
    state.line().should.eql("line two")
    state.lineno.should.equal(1)
    state.xpos.should.equal(0)
    state = parser.newState(text).advance(20)
    state.line().should.eql("line 3")
    state.lineno.should.equal(2)
    state.xpos.should.equal(2)
    state = parser.newState(text).advance(25)
    state.line().should.eql("")
    state.lineno.should.equal(3)
    state.xpos.should.equal(0)
    state = parser.newState(text).advance(26)
    state.line().should.eql("line 4")
    state.lineno.should.equal(4)
    state.xpos.should.equal(0)
    state = parser.newState(text).advance(31)
    state.line().should.eql("line 4")
    state.lineno.should.equal(4)
    state.xpos.should.equal(5)

describe "Parser", ->
  it "intentionally fails", ->
    p = parser.reject
    rv = p.exec("")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/failure/)

  it "matches a literal", ->
    p = parser.string("hello")
    rv = p.exec("cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)
    rv = p.exec("hellon")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  it "skips whitespace", ->
    p = parser.string("hello").skip(/\s+/)
    rv = p.exec("    hello")
    rv.state.pos.should.equal(9)
    rv.match.should.eql("hello")

  it "transforms a match", ->
    p = parser.string("hello").onMatch((s) -> s.toUpperCase())
    rv = p.exec("cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)
    rv = p.exec("hellon")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("HELLO")

  it "transforms a match into a constant", ->
    p = parser.string("hello").onMatch("yes")
    rv = p.exec("hello")
    rv.state.pos.should.equal(5)
    rv.match.should.eql("yes")

  it "transforms the error message", ->
    p = parser.string("hello").onFail("Try a greeting.")
    rv = p.exec("cat")
    rv.state.pos.should.equal(0)
    rv.message.should.eql("Try a greeting.")
    rv = p.exec("hellon")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")

  it "matches with a condition", ->
    p = parser.regex(/\d+/).matchIf((s) -> parseInt(s[0]) % 2 == 0).onFail("Expected an even number")
    rv = p.exec("103")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/even number/)
    rv = p.exec("104")
    rv.state.pos.should.equal(3)
    rv.match[0].should.eql("104")

  it "can negate", ->
    p = parser.string("hello").not()
    rv = p.exec("cat")
    rv.state.pos.should.equal(0)
    rv.match.should.eql("")
    rv = p.exec("hello")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/hello/)

  it "can perform an 'or'", ->
    p = parser.string("hello").or(parser.string("goodbye"))
    rv = p.exec("cat")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/'hello' or 'goodbye'/)
    rv = p.exec("hello")
    rv.state.pos.should.equal(5)
    rv.match.should.equal("hello")
    rv = p.exec("goodbye")
    rv.state.pos.should.equal(7)
    rv.match.should.equal("goodbye")

  it "can do a sequence", ->
    p = parser.string("abc").then(parser.string("123"))
    rv = p.exec("abc123")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "abc", "123" ])
    rv = p.exec("abcd")
    rv.state.pos.should.equal(3)
    rv.message.should.match(/123/)
    rv = p.exec("123")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/abc/)

  it "strings together a chained sequence", ->
    p = parser.seq(
      parser.string("abc"),
      parser.string("123").drop(),
      parser.string("xyz")
    )
    rv = p.exec("abc123xyz")
    rv.state.pos.should.equal(9)
    rv.match.should.eql([ "abc", "xyz" ])

  it "implicitly turns strings into parsers", ->
    p = parser.seq("abc", "123").or("xyz")
    rv = p.exec("abc123")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "abc", "123" ])
    rv = p.exec("xyz")
    rv.state.pos.should.equal(3)
    rv.match.should.eql("xyz")

  it "strings together a chained sequence implicitly", ->
    p = [ "abc", parser.drop(/\d+/), "xyz" ]
    rv = parser.exec(p, "abc11xyz")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ "abc", "xyz" ])

  it "handles regexen", ->
    p = parser.seq(/\s*/, "if")
    rv = p.exec("   if")
    rv.state.pos.should.equal(5)
    rv.match[0][0].should.eql("   ")
    rv.match[1].should.eql("if")
    rv = p.exec("if")
    rv.state.pos.should.equal(2)
    rv.match[0][0].should.eql("")
    rv.match[1].should.eql("if")
    rv = p.exec(";  if")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/if/)
    # try some basic cases too.
    p = parser.regex(/h(i)?/)
    rv = p.exec("no")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/h\(i\)\?/)
    rv = p.exec("hit")
    rv.state.pos.should.equal(2)
    rv.match[0].should.eql("hi")
    rv.match[1].should.eql("i")

  it "parses optionals", ->
    p = [ "abc", parser.optional(/\d+/), "xyz" ]
    rv = parser.exec(p, "abcxyz")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "abc", "", "xyz" ])
    rv = parser.exec(p, "abc99xyz")
    rv.state.pos.should.equal(8)
    rv.match[0].should.eql("abc")
    rv.match[1][0].should.eql("99")
    rv.match[2].should.eql("xyz")

  it "repeats", ->
    p = parser.repeat("hi")
    rv = p.exec("h")
    rv.state.pos.should.equal(0)
    rv.message.should.match(/at least 1 of 'hi'/)
    rv = p.exec("hi")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "hi" ])
    rv = p.exec("hiho")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "hi" ])
    rv = p.exec("hihihi!")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "repeats with minimum count", ->
    p = parser.string("hi").repeat(3)
    rv = p.exec("hihi!")
    rv.state.pos.should.equal(4)
    rv.message.should.match(/at least 3 of 'hi'/)
    rv = p.exec("hihihi!")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "repeats with separators", ->
    p = parser.repeat("hi", 2, ",")
    rv = p.exec("hi,hi,hi")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ "hi", "hi", "hi" ])

  it "resolves a lazy parser", ->
    p = parser.seq ":", -> /\w+/
    rv = p.exec(":hello")
    rv.state.pos.should.equal(6)
    rv.match[0].should.eql(":")
    rv.match[1][0].should.eql("hello")

  it "resolves a lazy parser only once", ->
    count = 0
    p = parser.seq ":", ->
      count++
      parser.regex(/\w+/).onMatch (m) -> m[0].toUpperCase()
    rv = p.exec(":hello")
    rv.state.pos.should.equal(6)
    rv.match.should.eql([ ":", "HELLO" ])
    count.should.equal(1)
    rv = p.exec(":goodbye")
    rv.state.pos.should.equal(8)
    rv.match.should.eql([ ":", "GOODBYE" ])
    count.should.equal(1)

describe "Parser#foldLeft", ->
  it "matches one", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.exec("98")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "98" ])

  it "matches several", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.exec("98, 99 ,100")
    rv.state.pos.should.equal(11)
    rv.match.should.eql([ "98", "99", "100" ])

  it "can use a custom accumulator", ->
    p = parser.foldLeft(
      tail: parser.regex(/\d+/).onMatch((x) -> x[0])
      sep: /\s*,\s*/
      accumulator: (item) -> [ parseInt(item) ]
      fold: (sum, sep, item) -> sum.unshift(parseInt(item)); sum
    )
    rv = p.exec("98, 99 ,100")
    rv.state.pos.should.equal(11)
    rv.match.should.eql([ 100, 99, 98 ])

  it "ignores trailing separators", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.exec("98, wut")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "98" ])

  it "can use a different first parser", ->
    p = parser.foldLeft(
      first: parser.regex(/[a-f\d]+/).onMatch((x) -> parseInt(x[0], 16))
      tail: parser.regex(/\d+/).onMatch((x) -> parseInt(x[0]))
      sep: /\s*,\s*/
    )
    rv = p.exec("10,11")
    rv.state.pos.should.equal(5)
    rv.match.should.eql([ 16, 11 ])

describe "Parser example", ->
  $ = parser.implicit
  binary = (left, op, right) -> { op: op, left: left, right: right }
  ws = /\s*/
  number = $(/\d+/).skip(ws).onMatch (m) -> parseInt(m[0])
  parens = [ $("(").skip(ws).drop(), (-> expr), $(")").skip(ws).drop() ]
  atom = number.or($(parens).onMatch((e) -> e[0]))
  term = atom.reduce($("*").or("/").or("%").skip(ws), binary)
  expr = term.reduce($("+").or("-").skip(ws), binary)

  it "recognizes a number", ->
    rv = expr.exec("900")
    rv.ok.should.eql(true)
    rv.match.should.eql(900)

  it "recognizes addition", ->
    rv = expr.exec("2 + 3")
    rv.ok.should.eql(true)
    rv.match.should.eql(op: "+", left: 2, right: 3)

  it "recognizes a complex expression", ->
    rv = expr.exec("1 + 2 * 3 + 4 * (5 + 6)")
    rv.ok.should.eql(true)
    rv.match.should.eql(
      op: "+"
      left: {
        op: "+"
        left: 1
        right: {
          op: "*"
          left: 2
          right: 3
        }
      }
      right: {
        op: "*"
        left: 4
        right: {
          op: "+"
          left: 5
          right: 6
        }
      }
    )

  it "can add with foldLeft", ->
    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = parser.foldLeft(
      tail: number
      sep: parser.string("+")
      accumulator: (n) -> n
      fold: (sum, op, n) -> sum + n
    )
    rv = expr.exec("2+3+4")
    rv.ok.should.eql(true)
    rv.state.pos.should.equal(5)
    rv.match.should.equal(9)

  it "can add with reduce", ->
    number = parser.regex(/\d+/).onMatch (m) -> parseInt(m[0])
    expr = number.reduce "+", (sum, op, n) -> sum + n
    rv = expr.exec("2+3+4")
    rv.ok.should.eql(true)
    rv.state.pos.should.equal(5)
    rv.match.should.equal(9)
