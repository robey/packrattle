should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")

describe "Parser.commit", ->
  it "can commit to an alternative", ->
    p = pr([
      pr("!").commit()
      pr(/\d+/).onFail("! must be a number")
    ]).or([ "@", /\d+/ ]).onMatch (a) ->
      [ a[0], a[1][0] ]
    rv = pr.parse(p, "!3")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "!", "3" ])
    rv = pr.parse(p, "@55")
    rv.ok.should.equal(true)
    rv.match.should.eql([ "@", "55" ])
    rv = pr.parse(p, "!ok")
    rv.ok.should.equal(false)
    rv.message.should.eql("! must be a number")
    rv = pr.parse(p, "@ok")
    rv.ok.should.equal(false)
    rv.message.should.not.eql("! must be a number")

  it "aborts nested alternatives", ->
    p = pr.alt(
      [
        /\d+/,
        pr.alt(
          [ pr("!").commit(), "0" ],
          /[a-z]+/
        )
      ],
      [ "2", "!", /\d+/ ]
    )
    rv = pr.parse(p, "2!9")
    rv.ok.should.equal(false)
    rv.message.should.match(/Expected '0'/)

  it "is remembered through a chain", ->
    p = pr.alt(
      [ pr("!").commit(), "x", "y", /\d+/ ],
      /.xyz/
    )
    rv = pr.parse(p, "!xyz")
    rv.ok.should.equal(false)

  it "is remembered through an exception", ->
    p = pr.alt(
      pr([ pr("!").commit(), "x", "y" ]).onMatch((m) -> throw new Error("Y!")),
      /.xyz/
    )
    rv = pr.parse(p, "!xyz")
    rv.ok.should.equal(false)
