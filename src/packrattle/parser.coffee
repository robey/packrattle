
newState = (text) -> new ParserState(text, 0, text.length, 0, 0)

# parser state
class ParserState
  constructor: (@text, @pos, @end, @lineno, @xpos) ->

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
    new ParserState(@text, pos, @end, lineno, xpos)

  # text of the current line around @pos
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
  constructor: (@state, @message) ->
    @ok = false

class Parser
  # (state) -> Match|NoMatch|exception
  constructor: (@message, @matcher) ->

  fail: (state) ->
    new NoMatch(state, "Expected " + @message)

  # transforms the error message of a parser
  onFail: (newMessage) ->
    new Parser newMessage, (state) =>
      rv = @matcher(state)
      if rv.match? then return rv
      new NoMatch(rv.state, newMessage)

  # transforms the result of a parser if it succeeds
  onMatch: (f) ->
    new Parser @message, (state) =>
      rv = @matcher(state)
      if not rv.ok then return rv
      new Match(rv.state, f(rv.match))

  or: (others...) ->
    parsers = (implicit(p) for p in [ @ ].concat(others))
    message = (m.message for m in parsers).join(" or ")
    new Parser message, (state) =>
      rv = @matcher(state)
      for p in parsers
        rv = p.matcher(state)
        if rv.ok then return rv
      new NoMatch(state, message)

  then: (p) -> seq(@, p)

  optional: -> optional(@)

  repeat: (atLeast = 1) -> repeat(@, atLeast)

  # throw away the match
  drop: ->
    @onMatch (m) -> null

  exec: (s) -> @matcher(newState(s))

# matches the end of the string
end = new Parser "end", (state) ->
  if state.pos == state.end
    new Match(state, null)
  else
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
  new Parser parsers[0].message, (state) ->
    results = []
    for p in parsers
      rv = p.matcher(state)
      if not rv.ok then return rv
      if rv.match? then results.push(rv.match)
      state = rv.state
    new Match(state, results)

# a parser that can fail to match, and just returns the empty string
optional = (p) ->
  p = implicit(p)
  new Parser p.message, (state) ->
    rv = p.matcher(state)
    if rv.ok then return rv
    new Match(state, "")

# one or more repetitions of a parser, returned as an array
repeat = (p, atLeast = 1) ->
  p = implicit(p)
  message = "at least #{atLeast} of #{p.message}"
  new Parser message, (state) ->
    count = 0
    results = []
    loop
      rv = p.matcher(state)
      if not rv.ok
        if count < atLeast then return @fail(state)
        return new Match(state, results)
      count++
      results.push(rv.match)
      state = rv.state

# turn strings & regexen into parsers implicitly
implicit = (p) ->
  # wow, javascript's type system completely falls apart here.
  if typeof p == "string" then return string(p)
  if p instanceof RegExp then return regex(p)
  if p instanceof Array then return seq(p...)
  p

# helper for drop
drop = (p) ->
  implicit(p).drop()

exec = (p, s) ->
  implicit(p).exec(s)

exports.newState = newState
exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
exports.Parser = Parser

exports.end = end
exports.string = string
exports.regex = regex
exports.seq = seq
exports.optional = optional
exports.repeat = repeat
exports.drop = drop
exports.exec = exec
