should = require 'should'
util = require 'util'

pr = require("../lib/packrattle")




  it "can negate", ->
    p = pr.string("hello").not_()
    parse(p, "cat").should.eql [ "", 0 ]
    (-> p.run("hello")).should.throw /hello/
