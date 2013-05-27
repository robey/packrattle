util = require 'util'
WeakMap = require 'weakmap'
debug = require("./debugging").debug
parser_state = require("./parser_state")

ParserState = parser_state.ParserState
Match = parser_state.Match
NoMatch = parser_state.NoMatch


_parser_id = 0
class Parser
  constructor: (@_message, @matcher) ->
    @id = _parser_id++

  message: ->
    if @recursing then return "..."
    @recursing = true
    rv = if (typeof @_message == "function") then @_message() else @_message
    @recursing = false
    rv

  toString: -> "Parser(#{@message()})"

  # helper for internal use: immediately fail.
  fail: (state, cont) ->
    cont(new NoMatch(state, "Expected " + @message()))

  # executes @matcher, passing the result (Match or NoMatch) to 'cont'.
  parse: (state, cont) ->
    state = state.deeper()
    debug =>
      "-> state=#{state}\n" +
      "   parse (#{@id}): #{@}"
    newCont = (rv) ->
      debug -> "<- #{rv}"
      cont(rv)

    entry = state.getCache(@)
    if entry.continuations.length == 0
      # first to try it!
      entry.continuations.push newCont
      state.addJob (=> "parse: #{state}, #{@toString()}"), =>
        @matcher state, (rv) =>
          # push our (new?) result
          found = false
          for r in entry.results
            if r.equals(rv) then found = true
          if not found
            debug =>
              "<- coming back from #{@}\n" +
                "   cache++ (#{@id},#{state.pos}) = #{rv}"
            entry.results.push rv
            for c in entry.continuations then c(rv)
    else
      debug => "<- answer from cache (#{@id},#{state.pos}): #{util.inspect(entry.results)}"
      entry.continuations.push newCont
      for r in entry.results then newCont(r)

  # ----- transformations and combinations:

  # transforms the error message of a parser
  onFail: (newMessage) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) ->
        if rv.ok then return cont(rv)
        cont(new NoMatch(rv.state, newMessage, rv.abort))

  # transforms the result of a parser if it succeeds.
  onMatch: (f) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) ->
        if not rv.ok then return cont(rv)
        rv = if typeof f == "function"
          try
            new Match(rv.state, f(rv.match), rv.commit)
          catch e
            new NoMatch(state, e.toString())
        else
          new Match(rv.state, f, rv.commit)
        cont(rv)
  
  # only succeed if f(match) returns true.
  matchIf: (f) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) =>
        if not rv.ok then return cont(rv)
        if not f(rv.match) then return @fail(state, cont)
        cont(rv)

  # ----- convenience methods for accessing the combinators

  then: (p) -> chain @, p, (a, b) -> [ a, b ]

  or: (others...) -> alt(@, others...)

  optional: (defaultValue="") -> optional(@, defaultValue)

  check: -> check(@)

  commit: -> commit(@)

  not_: -> not_(@)

  drop: -> drop(@)

  repeat: (minCount, maxCount) -> repeat(@, minCount, maxCount)

  times: (count) -> repeat(@, count, count)


# matches the end of the string.
end = new Parser "end", (state, cont) ->
  if state.pos == state.end then cont(new Match(state, null)) else @fail(state, cont)

# never matches anything.
reject = new Parser "failure", (state, cont) -> @fail(state, cont)

# matches a literal string.
string = (s) ->
  len = s.length
  new Parser "'#{s}'", (state, cont) ->
    candidate = state.text.slice(state.pos, state.pos + len)
    if candidate == s
      cont(new Match(state.advance(len), candidate))
    else
      state.fail(cont, @message())

# matches a regex
regex = (r) ->
  i = if r.ignoreCase then "i" else ""
  m = if r.multiline then "m" else ""
  source = if r.source[0] == "^" then r.source else ("^" + r.source)
  r2 = new RegExp(source, i + m)
  new Parser r.toString(), (state, cont) ->
    m = r2.exec(state.text.slice(state.pos))
    if m? then cont(new Match(state.advance(m[0].length), m)) else @fail(state, cont)

# ----- combinators:

# a parser that can fail to match, and returns a default response if not
# present (usually the empty string).
optional = (p, defaultValue="") ->
  p = implicit(p)
  new Parser (-> "optional #{resolve(p).message()}"), (state, cont) ->
    p = resolve(p)
    p.parse state, (rv) ->
      if rv.ok then return cont(rv)
      cont(new Match(state, defaultValue))

# check that this parser matches, but don't advance the string. (perl calls
# this a zero-width lookahead.)
check = (p) ->
  p = implicit(p)
  new Parser (-> resolve(p).message()), (state, cont) ->
    p = resolve(p)
    p.parse state, (rv) ->
      if not rv.ok then return cont(rv)
      cont(new Match(state, rv.match, rv.commit))      

# if the parser matches up to here, refuse to backtrack to previous
# alternatives.
commit = (p) ->
  p = implicit(p)
  new Parser (-> resolve(p).message()), (state, cont) ->
    p = resolve(p)
    p.parse state, (rv) ->
      if not rv.ok then return cont(rv)
      rv.commit = true
      debug -> "commit!"
      cont(rv)

# succeed (with an empty match) if the parser failed; otherwise fail.
not_ = (p) ->
  p = implicit(p)
  message = -> "not " + resolve(p).message()
  new Parser message, (state, cont) ->
    p = resolve(p)
    p.parse state, (rv) ->
      if rv.ok then state.fail(cont, message()) else cont(new Match(state, ""))

# throw away the match.
drop = (p) -> implicit(p).onMatch (x) -> null

# chain together p1 & p2 such that if p1 matches, p2 is executed. if both
# match, 'combiner' is called with the two matched objects, to create a
# single match result.
chain = (p1, p2, combiner) ->
  new Parser (-> "(#{resolve(p1).message()}) chain (#{resolve(p2).message()})"), (state, cont) ->
    p1 = resolve(p1)
    p1.parse state, (rv1) ->
      if not rv1.ok then return cont(rv1)
      p2 = resolve(p2)
      p2.parse rv1.state, (rv2) ->
        if not rv2.ok
          # no backtracking if the left match was commit()'d.
          if rv1.commit then rv2.abort = true
          return cont(rv2)
        cont(new Match(rv2.state, combiner(rv1.match, rv2.match), rv2.commit))

# chain together a sequence of parsers. if they all match, the match result
# will contain an array of all the results that weren't null.
seq = (parsers...) ->
  parsers = (implicit(p) for p in parsers)
  message = -> ("(" + resolve(p).message() + ")" for p in parsers).join(" then ")
  combiner = (sum, x) ->
    sum = sum[...]
    if x? then sum.push x
    sum
  rv = new Parser "''", (state, cont) -> cont(new Match(state, []))
  for p in parsers then rv = chain(rv, p, combiner)
  new Parser message, (state, cont) ->
    rv.parse state, cont

# chain together a sequence of parsers. before each parser is checked, the
# 'ignore' parser is optionally matched and thrown away. this is typicially
# used for discarding whitespace in lexical parsing.
seqIgnore = (ignore, parsers...) ->
  parsers = (implicit(p) for p in parsers)
  message = -> ("(" + resolve(p).message() + ")" for p in parsers).join(" then ")
  newseq = []
  for p in parsers
    newseq.push optional(ignore).drop()
    newseq.push p
  rv = seq(newseq...)
  new Parser message, (state, cont) ->
    rv.parse state, cont

# try each of these parsers, in order (starting from the same position),
# looking for the first match.
alt = (parsers...) ->
  parsers = (implicit(p) for p in parsers)
  message = -> ("(" + resolve(p).message() + ")" for p in parsers).join(" or ")
  new Parser message, (state, cont) ->
    parsers = (resolve(p) for p in parsers)
    debug ->
      "<alt> start: #{state}\n" +
        (for p in parsers then "<alt> -- #{p}\n") +
        "<alt> --."
    aborting = false
    for p in parsers[...] then do (p) ->
      state.addJob (=> "alt: #{state}, #{p.message()}"), ->
        debug -> "<alt> next try: #{p} at #{state}"
        if aborting
          debug -> "<alt> -- er, n/m, aborting"
          return
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
  message = -> "(" + resolve(p).message() + ")#{countMessage}"
  new Parser message, (state, cont) ->
    p = resolve(p)
    origState = state
    count = 0
    nextCont = (rv, list=[], lastState=origState) ->
      if not rv.ok
        if count >= minCount
          # intentionally use the "last good state" from our repeating parser.
          return cont(new Match(lastState, list, rv.commit))
        return origState.fail(cont, message())
      count += 1
      if rv.match? then list.push rv.match
      if count < maxCount
        # if a parser matches nothing, we could go on forever...
        if rv.state.pos == origState.pos then throw new Error("Repeating parser isn't making progress: #{rv.state.pos}=#{origState.pos} #{p}")
        rv.state.addJob (=> "repeat: #{state}, #{message()}"), ->
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

# turn strings, regexen, and arrays into parsers implicitly.
implicit = (p) ->
  # wow, javascript's type system completely falls apart here.
  if typeof p == "string" then return string(p)
  className = p.constructor.toString().split(" ")[1]
  if className == "RegExp()" then return regex(p)
  if className == "Array()" then return seq(p...)
  p

# allow functions to be passed in, and resolved only at parse-time.
resolve = (p) ->
  if not (typeof p == "function") then return implicit(p)
  p = fromLazyCache(p)
  p = implicit(p)
  if not p? then throw new Error("Can't resolve parser")
  p

lazyCache = new WeakMap
fromLazyCache = (p) ->
  memo = lazyCache.get(p)
  if !memo
    memo = p()
    lazyCache.set(p, memo)
  memo

# execute a parser over a string.
parse = (p, str) ->
  state = if str instanceof ParserState then str else new ParserState(str)
  p = resolve(p)
  successes = []
  failures = []
  state.addJob (=> "start: #{state}, #{p.toString()}"), ->
    p.parse state, (rv) ->
      if rv.ok
        debug -> "--- registering success: #{rv}"
        successes.push rv
      else
        debug -> "--- registering failure: #{rv}"
        failures.push rv
  while state.trampoline.ready() and successes.length == 0
    state.trampoline.next()
  debug ->
    "--- final tally:\n" +
      (for x in successes then "+++ #{x}\n") +
      (for x in failures then "--- #{x}\n") +
      "--- GOOD DAY SIR"
  if successes.length > 0
    successes[0]
  else
    failures[0]

# must match the entire string, to the end.
consume = (p, str) ->
  p = chain implicit(p), end, (a, b) -> a
  parse(p, str)


exports.Parser = Parser

exports.end = end
exports.reject = reject
exports.string = string
exports.regex = regex
exports.optional = optional
exports.check = check
exports.commit = commit
exports.not_ = not_
exports.drop = drop
exports.seq = seq
exports.seqIgnore = seqIgnore
exports.alt = alt
exports.repeat = repeat
exports.repeatIgnore = repeatIgnore
exports.repeatSeparated = repeatSeparated
exports.reduce = reduce

exports.implicit = implicit
exports.parse = parse
exports.consume = consume
