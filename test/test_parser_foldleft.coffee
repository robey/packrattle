should = require 'should'
parser = require '../src/packrattle/parser'

describe "Parser#foldLeft", ->
  it "matches one", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.parse("98")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "98" ])

  it "matches several", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.parse("98, 99 ,100")
    rv.state.pos.should.equal(11)
    rv.match.should.eql([ "98", "99", "100" ])

  it "can use a custom accumulator", ->
    p = parser.foldLeft(
      tail: parser.regex(/\d+/).onMatch((x) -> x[0])
      sep: /\s*,\s*/
      accumulator: (item) -> [ parseInt(item) ]
      fold: (sum, sep, item) -> sum.unshift(parseInt(item)); sum
    )
    rv = p.parse("98, 99 ,100")
    rv.state.pos.should.equal(11)
    rv.match.should.eql([ 100, 99, 98 ])

  it "ignores trailing separators", ->
    p = parser.foldLeft(tail: parser.regex(/\d+/).onMatch((x) -> x[0]), sep: /\s*,\s*/)
    rv = p.parse("98, wut")
    rv.state.pos.should.equal(2)
    rv.match.should.eql([ "98" ])

  it "can use a different first parser", ->
    p = parser.foldLeft(
      first: parser.regex(/[a-f\d]+/).onMatch((x) -> parseInt(x[0], 16))
      tail: parser.regex(/\d+/).onMatch((x) -> parseInt(x[0]))
      sep: /\s*,\s*/
    )
    rv = p.parse("10,11")
    rv.state.pos.should.equal(5)
    rv.match.should.eql([ 16, 11 ])
