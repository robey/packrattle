
newState = (text) -> new ParserState(text, 0, text.length)

# if parsers should ignore whitespace between items (in seq() or then()),
# set this to the whitespace parser:
whitespace = null
setWhitespace = (ws) -> whitespace = ws

# parser state
class ParserState
  constructor: (@text, @pos, @end, @lineno=0, @xpos=0) ->
    @cache = {}

  # return a new ParserState with the position advanced 'n' places.
  # the new @lineno and @xpos are adjusted by watching for linefeeds.
  advance: (n) ->
    pos = @pos
    lineno = @lineno
    xpos = @xpos
    while pos < @pos + n
      if @text[pos++] == '\n'
        lineno++
        xpos = 0
      else
        xpos++
    state = new ParserState(@text, pos, @end, lineno, xpos)
    state.cache = @cache
    state

  # return the text of the current line around @pos.
  line: ->
    text = @text
    end = @end
    lstart = @pos
    lend = @pos
    if lstart > 0 and text[lstart] == '\n' then lstart--
    while lstart > 0 and text[lstart] != '\n' then lstart--
    if text[lstart] == '\n' then lstart++
    while lend < end and text[lend] != '\n' then lend++
    text.slice(lstart, lend)

class Match
  constructor: (@state, @match) ->
    @ok = true

class NoMatch
  constructor: (@state, @message, @abort = false) ->
    @ok = false

_parser_id = 0
class Parser
  constructor: (@message, @matcher) ->
    @id = _parser_id++

  # returns Match or NoMatch, or throws an exception.
  parse: (state) ->
    if typeof state == "string" then state = newState(state)
    cache = state.cache[@id]
    if not cache? then cache = state.cache[@id] = {}
    rv = cache[state.pos]
    if rv? then return rv
    rv = @matcher(state)
    cache[state.pos] = rv
    rv

  # must match the entire string, to the end
  consume: (state) ->
    rv = @parse(state)
    if not rv.ok then return rv
    rv2 = end.parse(rv.state)
    if not rv2.ok then return rv2
    rv

  fail: (state) ->
    new NoMatch(state, "Expected " + @message)

  # transforms the error message of a parser
  onFail: (newMessage) ->
    new Parser newMessage, (state) =>
      rv = @parse(state)
      if rv.match? then return rv
      new NoMatch(rv.state, newMessage, rv.abort)

  # transforms the result of a parser if it succeeds
  onMatch: (f) ->
    new Parser @message, (state) =>
      rv = @parse(state)
      if not rv.ok then return rv
      if f instanceof Function
        try
          new Match(rv.state, f(rv.match))
        catch e
          new NoMatch(state, e.toString())
      else
        new Match(rv.state, f)

  # only succeed if f(match) returns true.
  matchIf: (f) ->
    new Parser @message, (state) =>
      rv = @parse(state)
      if not rv.ok then return rv
      if not f(rv.match) then return @fail(state)
      rv

  # succeed (with an empty match) if the parser failed; otherwise fail.
  not: ->
    new Parser "not " + @message, (state) =>
      rv = @parse(state)
      if rv.ok then return @fail(state)
      new Match(state, "")

  or: (others...) ->
    parsers = (implicit(p) for p in [ @ ].concat(others))
    message = (m.message for m in parsers).join(" or ")
    outer = @
    new Parser message, (state) ->
      parsers = (resolve(p) for p in parsers)
      rv = outer.parse(state)
      for p in parsers
        rv = p.parse(state)
        if rv.ok or rv.abort then return rv
      @fail(state)

  # if this parser is prefixed by p, parse it and drop it first
  # (for example, whitespace: `p.skip(/\s+/)`)
  skip: (p) ->
    p = implicit(p)
    new Parser @message, (state) =>
      p = resolve(p)
      rv = p.parse(state)
      if rv.ok then state = rv.state
      @parse(state)

  then: (p) -> seq(@, p)

  optional: (defaultValue="") -> optional(@, defaultValue)

  repeat: (sep = null) -> repeat(@, sep)

  times: (count) -> times(count, @)

  reduce: (sep, f) -> foldLeft(tail: @, accumulator: ((x) -> x), fold: f, sep: sep)

  # throw away the match
  drop: -> @onMatch (m) -> null

  # verify that this parser matches, but don't advance the position
  check: ->
    new Parser @message, (state) =>
      rv = @parse(state)
      if not rv.ok then return rv
      new Match(state, rv.match)

  commit: ->
    new Parser @message, (state) =>
      rv = @parse(state)
      if not rv.ok then return rv
      rv.commit = true
      rv


# matches the end of the string
end = new Parser "end", (state) ->
  if state.pos == state.end
    new Match(state, null)
  else
    @fail(state)

# never matches anything
reject = new Parser "failure", (state) ->
  @fail(state)

# matches a literal string
string = (s) ->
  len = s.length
  new Parser "'#{s}'", (state) ->
    candidate = state.text.slice(state.pos, state.pos + len)
    if candidate == s
      new Match(state.advance(len), candidate)
    else
      @fail(state)

# matches a regex
regex = (r) ->
  i = if r.ignoreCase then "i" else ""
  m = if r.multiline then "m" else ""
  source = if r.source[0] == "^" then r.source else ("^" + r.source)
  r2 = new RegExp(source, i + m)
  new Parser r.toString(), (state) ->
    m = r2.exec(state.text.slice(state.pos))
    if m?
      new Match(state.advance(m[0].length), m)
    else
      @fail(state)

# chain together a sequence of parsers
seq = (parsers...) ->
  parsers = (implicit(p) for p in parsers)
  ws = whitespace
  new Parser parsers[0].message, (state) ->
    parsers = (resolve(p) for p in parsers)
    if ws?
      parsers = (p.skip(ws) for p in parsers)
      ws = null
    results = []
    commit = false
    for p in parsers
      rv = p.parse(state)
      if not rv.ok
        if commit then rv.abort = true
        return rv
      if rv.match? then results.push(rv.match)
      commit = rv.commit
      state = rv.state
    new Match(state, results)

# a parser that can fail to match, and just returns the empty string
optional = (p, defaultValue="") ->
  p = implicit(p)
  new Parser p.message, (state) ->
    p = resolve(p)
    rv = p.parse(state)
    if rv.ok then return rv
    new Match(state, defaultValue)

# one or more repetitions of a parser, returned as an array
# optionally separated by a separation parser
repeat = (p, sep = null) -> foldLeft(tail: p, sep: sep)

# exactly N repetitions of a parser
times = (count, p) ->
  p = implicit(p)
  ws = whitespace
  new Parser "#{count} of (#{p.message})", (state) ->
    p = resolve(p)
    if ws?
      p = p.skip(ws)
      ws = null
    results = []
    for i in [0...count]
      rv = p.parse(state)
      if not rv.ok then return @fail(rv.state)
      if rv.match? then results.push(rv.match)
      state = rv.state
    new Match(state, results)

# match against the 'first' parser, then any number of occurances of 'sep'
# followed by 'tail', as in: `first (sep tail)*`.
#
# for each match on 'tail', the function 'fold' will be called with
# `fold(accumulator_value, sep_match, tail_match)` and the return value will
# be the new accumulator value. the initial accumulator value is calculated
# on each parse by calling `accumulator(first_match)`.
#
# if a 'sep' is not followed by a 'tail', the 'sep' is not consumed, but the
# parser will match up to that point.
foldLeft = (args) ->
  tail = implicit(if args.tail? then args.tail else reject)
  first = implicit(if args.first? then args.first else args.tail)
  fold = if args.fold?
    args.fold
  else
    (acc, s, item) ->
      if item? then acc.push(item)
      acc
  accumulator = if args.accumulator?
    args.accumulator
  else
    (x) -> if x? then [ x ] else []
  sep = args.sep
  message = if args.first?
    "(#{first.message}) followed by (#{tail.message})*"
  else
    "(#{tail.message})*"
  if sep?
    sep = implicit(sep)
    message += " separated by (#{sep.message})"
  ws = whitespace
  new Parser message, (state) ->
    first = resolve(first)
    if ws? then first = first.skip(ws)
    if sep?
      sep = resolve(sep)
      if ws? then sep = sep.skip(ws)
    tail = resolve(tail)
    if ws? then tail = tail.skip(ws)
    ws = null
    rv = first.parse(state)
    if not rv.ok then return @fail(state)
    results = accumulator(rv.match)
    state = rv.state
    loop
      initial_state = state
      sep_match = ""
      if sep?
        rv = sep.parse(state)
        if not rv.ok then return new Match(state, results)
        sep_match = rv.match
        state = rv.state
      rv = tail.parse(state)
      if not rv.ok then return new Match(initial_state, results)
      results = fold(results, sep_match, rv.match)
      state = rv.state

# turn strings, regexen, and arrays into parsers implicitly.
implicit = (p) ->
  # wow, javascript's type system completely falls apart here.
  if typeof p == "string" then return string(p)
  if p instanceof RegExp then return regex(p)
  if p instanceof Array then return seq(p...)
  p

# allow functions to be passed in, and resolved only at parse-time.
resolve = (p) ->
  if not (p instanceof Function) then return p
  implicit(p())

# helper for drop
drop = (p) -> implicit(p).drop()

parse = (p, s) -> implicit(p).parse(s)

check = (p) -> implicit(p).check()

exports.newState = newState
exports.setWhitespace = setWhitespace

exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
exports.Parser = Parser

exports.end = end
exports.reject = reject
exports.string = string
exports.regex = regex
exports.seq = seq
exports.optional = optional
exports.repeat = repeat
exports.times = times
exports.foldLeft = foldLeft
exports.implicit = implicit
exports.drop = drop
exports.parse = parse
exports.check = check
