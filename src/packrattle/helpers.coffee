WeakMap = require 'weakmap'
parser = require './parser'

#
# helper functions used by the parsers & combiners -- not exported.
#

lazyCache = new WeakMap()
fromLazyCache = (p) ->
  memo = lazyCache.get(p)
  if not memo?
    memo = p()
    lazyCache.set(p, memo)
  memo

# helper to defer an unresolved parser into one that can be combined
defer = (p) ->
  parser.newParser "defer",
    wrap: p,
    matcher: (state, cont) ->
      p = resolve(p)
      p.parse state, cont

# turn strings, regexen, and arrays into parsers implicitly.
implicit = (p) ->
  parser = require './parser'
  combiners = require './combiners'

  # wow, javascript's type system completely falls apart here.
  if typeof p == "string" then return parser.string(p)
  className = Object.prototype.toString.call(p)[1 ... -1].split(" ")[1]
  if className == "RegExp" then return parser.regex(p)
  if className == "Array" then return combiners.seq(p...)
  p

# allow functions to be passed in, and resolved only at parse-time.
resolve = (p) ->
  if not (typeof p == "function") then return implicit(p)
  p = fromLazyCache(p)
  p = implicit(p)
  if not p? then throw new Error("Can't resolve parser")
  p


exports.defer = defer
exports.implicit = implicit
exports.resolve = resolve
