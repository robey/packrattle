should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser onMatch spans", ->
  it "cover a string", ->
    p = pr("abc").onMatch (m, state) -> state
    rv = pr.parse p, "abc"
    rv.ok.should.eql(true)
    rv.match.pos().should.eql 0
    rv.match.endpos().should.eql 3

  it "cover a regex", ->
    p = pr(/ab+c/).onMatch (m, state) -> state
    rv = pr.parse p, "abc"
    rv.ok.should.eql(true)
    rv.match.pos().should.eql 0
    rv.match.endpos().should.eql 3

  it "survive an alt", ->
    p = pr.alt("xyz", pr("abc").onMatch (m, state) -> state)
    rv = pr.parse p, "abc"
    rv.ok.should.eql(true)
    rv.match.pos().should.eql 0
    rv.match.endpos().should.eql 3

  it "cover an alt", ->
    p = pr.alt("xyz", "abc").onMatch (m, state) -> state
    rv = pr.parse p, "abc"
    rv.ok.should.eql(true)
    rv.match.pos().should.eql 0
    rv.match.endpos().should.eql 3

  it "cover a sequence", ->
    p = pr.seq("xyz", "abc").onMatch (m, state) -> state
    rv = pr.parse p, "xyzabc"
    rv.ok.should.eql(true)
    rv.match.pos().should.eql 0
    rv.match.endpos().should.eql 6

  it "cover a combination", ->
    p = pr.seq("abc", pr.optional(/\s+/), pr.alt(
      /\d+/,
      pr.seq("x", /\d+/, "x").onMatch (m, state) -> state
    ), pr.optional("?")).onMatch (m, state) -> [ m, state ]
    rv = pr.parse p, "abc x99x?"
    rv.ok.should.eql(true)
    [ m, state ] = rv.match
    state.pos().should.eql 0
    state.endpos().should.eql 9
    m[2].pos().should.eql 4
    m[2].endpos().should.eql 8

  it "crosses line boundaries", ->
    p = pr.seq(
      /\w+/,
      /\s+/,
      pr("line\nbreak").onMatch((m, state) -> state),
      /\s+/,
      /\w+/
    )
    rv = pr.parse p, "hello line\nbreak ok"
    rv.ok.should.eql(true)
    state = rv.match[2]
    state.loc.pos.should.eql 6
    state.loc.lineno.should.eql 0
    state.loc.xpos.should.eql 6
    state.endloc.pos.should.eql 16
    state.endloc.lineno.should.eql 1
    state.endloc.xpos.should.eql 5
    state.toSquiggles().should.eql [
      "hello line"
      "      ~~~~"
    ]
