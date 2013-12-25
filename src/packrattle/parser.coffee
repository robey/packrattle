util = require 'util'
combiners = require './combiners'
helpers = require './helpers'
parser_state = require './parser_state'

implicit = helpers.implicit
resolve = helpers.resolve

ParserState = parser_state.ParserState
Match = parser_state.Match
NoMatch = parser_state.NoMatch

pad = (n) -> [0...n].map((x) -> "  ").join("")

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

  toString: ->
    message = @message()
    if message[0] != '(' then message = "(#{message})"
    "Parser[#{@id}]#{message}"

  # helper for internal use: immediately fail.
  fail: (state, cont) ->
    cont(new NoMatch(state, "Expected " + @message()))

  # executes @matcher, passing the result (Match or NoMatch) to 'cont'.
  parse: (state, cont) ->
    state = state.deeper()
    if state.debugger?.graph?
      graph = state.debugger.graph
      if not graph.nodes? then graph.nodes = {}
      if not graph.edges? then graph.edges = []
      stateName = "#{@id}:#{state.pos}"
      graph.nodes[stateName] = { parser: @, state: state }
      if state.previousState?
        graph.edges.push(from: state.previousState, to: stateName)
      newCont = (rv) ->
        rv.state.previousState = stateName
        cont(rv)
    else
      newCont = cont

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
            state.debug =>
              pad(state.depth) + "<- (#{@id}): cache++ #{rv} / state=#{state}"
            entry.results.push rv
            for c in entry.continuations then c(rv)
    else
      state.debug =>
        pad(state.depth) + "<- (#{@id}): answer from cache #{util.inspect(entry.results)} / state=#{state}"
      entry.continuations.push newCont
      for r in entry.results then newCont(r)

  # ----- transformations and combinations:

  # transforms the error message of a parser
  onFail: (newMessage) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) ->
        if rv.ok or rv.abort then return cont(rv)
        state.debug => "rewriting error '#{rv.message}' to '#{newMessage}'"
        cont(new NoMatch(rv.state, newMessage, rv.abort))

  # transforms the result of a parser if it succeeds.
  onMatch: (f) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) ->
        if not rv.ok then return cont(rv)
        if typeof f == "function"
          try
            result = f(rv.match)
            if result instanceof Parser
              result.parse(rv.state, cont)
            else
              cont(new Match(rv.state, result, rv.commit, @_message))
          catch e
            state.debug => "onmatch threw exception: #{e.toString()}"
            cont(new NoMatch(rv.state, e.toString(), rv.commit))
        else
          cont(new Match(rv.state, f, rv.commit, @_message))

  # only succeed if f(match) returns true.
  matchIf: (f) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) =>
        if not rv.ok then return cont(rv)
        if not f(rv.match) then return cont(new NoMatch(state, "Expected " + @message(), rv.commit))
        cont(rv)

  describe: (message) ->
    @_message = message
    @
    
  # ----- convenience methods for accessing the combinators

  then: (p) -> combiners.chain @, p, (a, b) -> [ a, b ]

  or: (others...) -> combiners.alt(@, others...)

  optional: (defaultValue="") -> combiners.optional(@, defaultValue)

  check: -> combiners.check(@)

  commit: -> combiners.commit(@)

  not_: -> combiners.not_(@)

  drop: -> combiners.drop(@)

  repeat: (minCount, maxCount) -> combiners.repeat(@, minCount, maxCount)

  times: (count) -> combiners.repeat(@, count, count)


# matches the end of the string.
end = new Parser "end", (state, cont) ->
  if state.pos == state.end then cont(new Match(state, null, false, "end")) else @fail(state, cont)

# never matches anything.
reject = new Parser "failure", (state, cont) -> @fail(state, cont)

# always matches without consuming input and yields the given value.
succeed = (v) ->
  message = "succeed(#{v})"
  new Parser message, (state, cont) ->
    cont(new Match(state, v, false, message))

# matches a literal string.
string = (s) ->
  len = s.length
  message = "'#{s}'"
  new Parser message, (state, cont) ->
    candidate = state.text.slice(state.pos, state.pos + len)
    if candidate == s
      cont(new Match(state.advance(len), candidate, false, message))
    else
      @fail(state, cont)

# matches a regex
regex = (r) ->
  i = if r.ignoreCase then "i" else ""
  m = if r.multiline then "m" else ""
  source = if r.source[0] == "^" then r.source else ("^" + r.source)
  r2 = new RegExp(source, i + m)
  message = r.toString()
  new Parser message, (state, cont) ->
    m = r2.exec(state.text.slice(state.pos))
    if m? then cont(new Match(state.advance(m[0].length), m, false, message)) else @fail(state, cont)

# ----- top-level API:

# execute a parser over a string.
parse = (p, str, options = {}) ->
  state = if str instanceof ParserState then str else new ParserState(str)
  if options.debugger? then state.debugger = options.debugger
  p = resolve(p)
  successes = []
  failures = []
  state.addJob (=> "start: #{state}, #{p.toString()}"), ->
    p.parse state, (rv) ->
      if rv.ok
        state.debug -> "--- registering success: #{rv}"
        successes.push rv
      else
        state.debug -> "--- registering failure: #{rv}"
        failures.push rv
  while state.trampoline.ready() and successes.length == 0
    state.trampoline.next()
  # message with 'abort' set has highest priority. secondary sort by index.
  failures.sort (a, b) ->
    if a.abort != b.abort and false
      if b.abort then 1 else -1
    else
      b.state.depth - a.state.depth
  state.info -> [
    "--- final tally:"
    (for x in successes then "+++ #{x}")
    (for x in failures then "--- #{x}")
    "--- GOOD DAY SIR"
  ]
  if successes.length > 0
    successes[0]
  else
    failures[0]

# must match the entire string, to the end.
consume = (p, str, options) ->
  p = combiners.chain implicit(p), end, (a, b) -> a
  parse(p, str, options)


exports.Parser = Parser

exports.end = end
exports.reject = reject
exports.succeed = succeed
exports.string = string
exports.regex = regex

exports.parse = parse
exports.consume = consume
