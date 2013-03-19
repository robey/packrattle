
# str -> entry
# entry = { continuations[], results[] }


inspect = require("util").inspect

# parser state, used internally.
class ParserState
  constructor: (@text, @pos=0, @end, @lineno=0, @xpos=0) ->
    if not @end? then @end = @text.length
    @trampoline = []

  toString: ->
    truncated = if @text.length > 10 then "'#{@text[...10]}...'" else "'#{@text}'"
    "ParserState(text=#{truncated}, pos=#{@pos}, end=#{@end}, lineno=#{@lineno}, xpos=#{@xpos})"

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

  # helper for internal use: immediately fail.
  fail: (cont, message) ->
    cont(new NoMatch(@, "Expected " + message))

  # execute the next branch of parsing on the trampoline.
  next: ->
    f = @trampoline.shift()
    if f? then f()

  run: ->
    while @trampoline.length > 0 then @next()


class Match
  constructor: (@state, @match, @commit=false) ->
    @ok = true

  toString: -> "Match(state=#{@state}, match=#{@match}, commit=#{@commit})"


class NoMatch
  constructor: (@state, @message, @abort=false) ->
    @ok = false

  toString: -> "NoMatch(state=#{@state}, message='#{@message}', abort=#{@abort})"


_parser_id = 0
class Parser
  constructor: (@_message, @matcher) ->
    @id = _parser_id++

  message: ->
    if (typeof @_message == "function") then @_message() else @_message

  toString: -> "Parser(#{@message()})"

  # helper for internal use: immediately fail.
  fail: (state, cont) ->
    cont(new NoMatch(state, "Expected " + @message()))

  # executes @matcher, passing the result (Match or NoMatch) to 'cont'.
  parse: (state, cont) ->
    @matcher(state, cont)

  # ----- transformations and combinations:

  # transforms the error message of a parser
  onFail: (newMessage) ->
    new Parser newMessage, (state, cont) =>
      @parse state, (rv) ->
        if rv.ok then return cont(rv)
        cont(new NoMatch(rv.state, newMessage, rv.abort))

  # transforms the result of a parser if it succeeds.
  onMatch: (f) ->
    new Parser @_message, (state, cont) =>
      @parse state, (rv) ->
        if not rv.ok then return cont(rv)
        rv = if f instanceof Function
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




  repeat: (sep = null) -> repeat(@, sep)

  times: (count) -> times(count, @)

  reduce: (sep, f) -> foldLeft(tail: @, accumulator: ((x) -> x), fold: f, sep: sep)

  # throw away the match
  drop: -> @onMatch (m) -> null


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
      @fail(state, cont)

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
      cont(rv)

# succeed (with an empty match) if the parser failed; otherwise fail.
not_ = (p) ->
  p = implicit(p)
  message = -> "not" + resolve(p).message()
  new Parser message, (state, cont) ->
    p = resolve(p)
    p.parse state, (rv) ->
      if rv.ok then state.fail(cont, message()) else cont(new Match(state, ""))

# chain together p1 & p2 such that if p1 matches, p2 is executed. if both
# match, 'combiner' is called with the two matched objects, to create a
# single match result.
chain = (p1, p2, combiner) ->
  new Parser (-> "#{resolve(p1).message()} then #{resolve(p2).message()}"), (state, cont) ->
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
  message = -> (resolve(p).message() for p in parsers).join(" then ")
  combiner = (sum, x) ->
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
  message = -> (resolve(p).message() for p in parsers).join(" then ")
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
  message = -> (resolve(p).message() for p in parsers).join(" or ")
  new Parser message, (state, cont) ->
    parsers = (resolve(p) for p in parsers)
    count = 0
    finished = false
    for p in parsers then do (p) ->
      state.trampoline.push ->
        p.parse state, (rv) ->
          count += 1
          if (rv.ok or rv.abort) and not finished
            finished = true
            return cont(rv)
          if not finished and count == parsers.length
            cont(new NoMatch(state, "Expected " + message()))










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
  if not (p instanceof Function) then return implicit(p)
  implicit(p())

# helper for drop
drop = (p) -> implicit(p).drop()

# execute a parser over a string.
parse = (p, str) ->
  state = new ParserState(str)
  p = resolve(p)
  rv = null
  state.trampoline.push ->
    p.parse state, (_rv) -> rv = _rv
  state.run()
  rv

# must match the entire string, to the end.
consume = (p, str) ->
  p = chain implicit(p), end, (a, b) -> a
  parse(p, str)


exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
exports.Parser = Parser

exports.end = end
exports.reject = reject
exports.string = string
exports.regex = regex
exports.optional = optional
exports.check = check
exports.commit = commit
exports.not_ = not_
exports.seq = seq
exports.seqIgnore = seqIgnore
exports.alt = alt

exports.repeat = repeat
exports.times = times
exports.foldLeft = foldLeft

exports.implicit = implicit
exports.drop = drop
exports.parse = parse
exports.consume = consume
