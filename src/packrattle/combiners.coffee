util = require 'util'
helpers = require './helpers'
parser = require './parser'
parser_state = require './parser_state'

defer = helpers.defer
implicit = helpers.implicit
resolve = helpers.resolve

ParserState = parser_state.ParserState
Match = parser_state.Match
NoMatch = parser_state.NoMatch

#
# functions that transform or combine other Parsers.
#

# a parser that can fail to match, and returns a default response if not
# present (usually the empty string).
optional = (p, defaultValue="") ->
  p = implicit(p)
  parser.newParser "optional",
    nested: [ p ]
    describer: (ps) -> "optional(#{ps.join()})"
    matcher: (state, cont) ->
      p = resolve(p)
      p.parse state, (rv) ->
        if rv.ok or rv.abort then return cont(rv)
        cont(new Match(state, defaultValue, rv.commit))

# check that this parser matches, but don't advance the string. (perl calls
# this a zero-width lookahead.)
check = (p) ->
  p = implicit(p)
  parser.newParser "check",
    wrap: p
    matcher: (state, cont) ->
      p = resolve(p)
      p.parse state, (rv) ->
        if not rv.ok then return cont(rv)
        cont(new Match(state, rv.match, rv.commit))

# if the parser matches up to here, refuse to backtrack to previous
# alternatives.
commit = (p) ->
  p = implicit(p)
  parser.newParser "commit",
    wrap: p
    matcher: (state, cont) ->
      p = resolve(p)
      p.parse state, (rv) ->
        if not rv.ok then return cont(rv)
        rv.commit = true
        cont(rv)

# succeed (with an empty match) if the parser failed; otherwise fail.
not_ = (p) ->
  p = implicit(p)
  parser.newParser "not",
    nested: [ p ]
    describer: (ps) -> "not(#{ps.join()})"
    matcher: (state, cont) ->
      p = resolve(p)
      p.parse state, (rv) =>
        if rv.ok then @fail(state, cont) else cont(new Match(state, "", rv.commit))

# throw away the match.
drop = (p) -> implicit(p).onMatch (x) -> null

# chain together p1 & p2 such that if p1 matches, p2 is executed. if both
# match, 'combiner' is called with the two matched objects, to create a
# single match result.
chain = (p1, p2, combiner) ->
  parser.newParser "chain",
    nested: [ p1, p2 ]
    describer: (ps) -> "#{ps[0]} then #{ps[1]}"
    matcher: (state, cont) ->
      p1 = resolve(p1)
      p1.parse state, (rv1) ->
        if not rv1.ok then return cont(rv1)
        p2 = resolve(p2)
        p2.parse rv1.state, (rv2) ->
          if not rv2.ok
            # no backtracking if the left match was commit()'d.
            if rv1.commit then rv2.abort = true
            return cont(rv2)
          cont(new Match(rv2.state.backfill(rv1.state), combiner(rv1.match, rv2.match), rv2.commit or rv1.commit))

seq = (parsers...) ->
  parsers = (implicit(p) for p in parsers)
  p0 = parsers.shift()
  if parsers.length == 0 then return defer(p0).onMatch (m) -> [ m ]
  chain p0, seq(parsers...), (rv1, rv2) ->
    if rv1?
      rv = rv2[...]
      rv.unshift(rv1)
    else
      rv = rv2
    rv

# chain together a sequence of parsers. before each parser is checked, the
# 'ignore' parser is optionally matched and thrown away. this is typicially
# used for discarding whitespace in lexical parsing.
seqIgnore = (ignore, parsers...) ->
  parsers = (implicit(p) for p in parsers)
  newseq = []
  for p in parsers
    newseq.push optional(ignore).drop()
    newseq.push p
  seq(newseq...)

# try each of these parsers, in order (starting from the same position),
# looking for the first match.
alt = (parsers...) ->
  parsers = (implicit(p) for p in parsers)
  parser.newParser "alt",
    nested: parsers
    describer: (ps) -> "(" + ps.join(" or ") + ")"
    matcher: (state, cont) ->
      parsers = (resolve(p) for p in parsers)
      aborting = false
      for p in parsers then do (p) ->
        state.addJob (=> "alt: #{state}, #{p}"), ->
          if aborting then return
          p.parse state, (rv) ->
            if rv.abort then aborting = true
            return cont(rv)

# from 'min' to 'max' (inclusive) repetitions of a parser, returned as an
# array. 'max' may be omitted to mean infinity.
repeat = (p, minCount=0, maxCount=null) ->
  p = implicit(p)
  if maxCount?
    countMessage = "{#{minCount}, #{maxCount}}"
  else
    countMessage = "{#{minCount}+}"
    maxCount = Math.pow(2, 31)
  parser.newParser "repeat",
    nested: [ p ]
    describer: (ps) -> "(#{ps.join()})#{countMessage}"
    matcher: (state, cont) ->
      p = resolve(p)
      origState = state
      count = 0
      nextCont = (rv, list=[], lastState=origState) =>
        if not rv.ok
          if count >= minCount
            # intentionally use the "last good state" from our repeating parser.
            return cont(new Match(lastState, list, rv.commit))
          return @fail(origState, cont)
        count += 1
        if rv.match? then list.push rv.match
        if count < maxCount
          # if a parser matches nothing, we could go on forever...
          if rv.state.pos == origState.pos then throw new Error("Repeating parser isn't making progress: #{rv.state.pos}=#{origState.pos} #{p}")
          rv.state.addJob (=> "repeat: #{state}, #{p.description()}"), ->
            p.parse rv.state, (x) -> nextCont(x, list[...], rv.state)
        else
          cont(new Match(rv.state, list, rv.commit))
      p.parse origState, nextCont

# like 'repeat', but each element may be optionally preceded by 'ignore',
# which will be thrown away. this is usually used to remove leading
# whitespace.
repeatIgnore = (ignore, p, minCount=0, maxCount=null) ->
  p2 = seq(optional(ignore).drop(), p).onMatch (x) -> x[0]
  repeat(p2, minCount, maxCount)

# like 'repeat', but the repeated elements are separated by 'separator',
# which is ignored.
repeatSeparated = (p, separator="", minCount=1, maxCount=null) ->
  p2 = seq(drop(separator), p).onMatch (x) -> x[0]
  seq(p, repeat(p2, minCount - 1, if maxCount? then maxCount - 1 else maxCount)).onMatch (x) ->
    [ x[0] ].concat(x[1])

# convenience method for reducing the result of 'repeatSeparated', optionally
# keeping the separator results. if 'accumulator' exists, it will transform
# the initial result into an accumulator. if 'reducer' exists, it will be
# used to progressively attach separators and new results.
reduce = (p, separator="", accumulator=null, reducer=null, minCount=1, maxCount=null) ->
  if not accumulator? then accumulator = (x) -> [ x ]
  if not reducer? then reducer = (sum, sep, x) -> sum.push(x)
  seq(p, repeat(seq(separator, p), minCount - 1, if maxCount? then maxCount - 1 else maxCount)).onMatch (x) ->
    [ accumulator(x[0]) ].concat(x[1]).reduce (sum, item) -> reducer(sum, item[0], item[1])


exports.optional = optional
exports.check = check
exports.commit = commit
exports.not_ = not_
exports.drop = drop
exports.chain = chain
exports.seq = seq
exports.seqIgnore = seqIgnore
exports.alt = alt
exports.repeat = repeat
exports.repeatIgnore = repeatIgnore
exports.repeatSeparated = repeatSeparated
exports.reduce = reduce
