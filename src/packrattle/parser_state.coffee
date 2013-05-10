Trampoline = require("./trampoline").Trampoline

# parser state, used internally.
class ParserState
  constructor: (@text, @pos=0, @end, @lineno=0, @xpos=0, @trampoline=null, @depth=0) ->
    if not @end? then @end = @text.length
    if not @trampoline? then @trampoline = new Trampoline()

  toString: ->
    truncated = if @text.length > 10 then "'#{@text[...10]}...'" else "'#{@text}'"
    "ParserState(text=#{truncated}, pos=#{@pos}, end=#{@end}, lineno=#{@lineno}, xpos=#{@xpos}, depth=#{@depth}, work=#{@trampoline.size()})"

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
    state = new ParserState(@text, pos, @end, lineno, xpos, @trampoline, @depth)
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

  getCache: (parser) -> @trampoline.getCache(parser, @)

  addJob: (description, job) -> @trampoline.push @depth, description, job

  deeper: -> new ParserState(@text, @pos, @end, @lineno, @xpos, @trampoline, @depth + 1)


class Match
  constructor: (@state, @match, @commit=false) ->
    @ok = true

  toString: -> "Match(state=#{@state}, match=#{util.inspect(@match)}, commit=#{@commit})"

  equals: (other) -> other.ok and @match == other.match and @state.pos == other.state.pos


class NoMatch
  constructor: (@state, @message, @abort=false) ->
    @ok = false

  toString: -> "NoMatch(state=#{@state}, message='#{@message}', abort=#{@abort})"

  equals: (other) -> (not other.ok) and @state.pos == other.state.pos


exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch

