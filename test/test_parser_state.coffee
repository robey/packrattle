should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "ParserState", ->
  text = "line one\nline two\nline 3\n\nline 4"

  verify = (state, lineno, xpos) ->
    lines = text.split("\n")
    state.line().should.eql(lines[lineno])
    state.lineno.should.eql(lineno)
    state.xpos.should.eql(xpos)

  it "finds the current line", ->
    state = new pr.ParserState(text).advance(0)
    verify(state, 0, 0)
    state = new pr.ParserState(text).advance(5)
    verify(state, 0, 5)
    state = new pr.ParserState(text).advance(7)
    verify(state, 0, 7)
    state = new pr.ParserState(text).advance(8)
    verify(state, 0, 8)
    state = new pr.ParserState(text).advance(9)
    verify(state, 1, 0)
    state = new pr.ParserState(text).advance(20)
    verify(state, 2, 2)
    state = new pr.ParserState(text).advance(25)
    verify(state, 3, 0)
    state = new pr.ParserState(text).advance(26)
    verify(state, 4, 0)
    state = new pr.ParserState(text).advance(31)
    verify(state, 4, 5)
    