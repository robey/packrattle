util = require 'util'
Trampoline = require("./trampoline").Trampoline

# parser state, used internally.
class ParserState
  constructor: (@text, @pos=0, @end, @lineno=0, @xpos=0, @trampoline=null, @depth=0, @debugger=null, @stateName=null, @previousStateName=null) ->
    if not @end? then @end = @text.length
    if not @trampoline? then @trampoline = new Trampoline(@)

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
    state = new ParserState(@text, pos, @end, lineno, xpos, @trampoline, @depth, @debugger, @stateName, @previousStateName)
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

  # silly indicator (for ascii terminals) of where we are
  around: (width) ->
    line = @line()
    left = @xpos - width
    right = @xpos + width
    if left < 0 then left = 0
    if right >= line.length then right = line.length - 1
    line[left ... @xpos] + "[" + (line[@xpos] or "") + "]" + line[@xpos + 1 ... right + 1]

  getCache: (parser) -> @trampoline.getCache(parser, @)

  addJob: (description, job) -> @trampoline.push @depth, description, job

  deeper: (parser) ->
    newStateName = "#{parser.id}:#{@pos}"
    state = new ParserState(@text, @pos, @end, @lineno, @xpos, @trampoline, @depth + 1, @debugger, newStateName, @stateName)
    if @debugger?.graph?
      @debugger.graph.addNode(newStateName, parser, state)
      if @stateName? then @debugger.graph.addEdge(@stateName, newStateName)
    state

  logSuccess: ->
    if @debugger?.graph?
      @debugger.graph.addEdge(@stateName, "success")

  debugAtLevel: (name, f) ->
    return unless @debugger
    # "debugger" is a reserved word in coffeescript (sometimes) (?!)
    debuggr = if typeof @debugger == "object" then @debugger[name] else @debugger
    return unless debuggr
    lines = if typeof f == "function" then f() else f
    unless Array.isArray(lines) then lines = lines.split("\n")
    @debugLines(debuggr, lines)

  info: (f) -> @debugAtLevel("info", f)
  debug: (f) -> @debugAtLevel("debug", f)

  debugLines: (debuggr, lines) ->
    for line in lines
      if Array.isArray(line) then @debugLines(debuggr, line) else debuggr(line)

  debugGraphToDot: ->
    return unless @debugger?.graph?
    @debugger.graph.toDot()

class Match
  constructor: (@state, @match, @commit=false, @message) ->
    @ok = true
    @state.info =>
      pad = (n, s) -> if s.toString().length < n then pad(n, " " + s) else s
      message = if @message?
        if typeof @message == "function" then @message() else @message
      else
        "*"
      [
        "MATCH: #{message}: #{util.inspect(@match)}"
        "  [#{pad(4, @state.lineno + 1)}] #{@state.line()}"
        pad(9 + @state.xpos, "") + "^"
      ]

  toString: -> "Match(state=#{@state}, match=#{util.inspect(@match)}, commit=#{@commit})"

  equals: (other) -> other.ok and @match == other.match and @state.pos == other.state.pos


class NoMatch
  constructor: (@state, @message, @abort=false) ->
    @ok = false

  toString: -> "NoMatch(state=#{@state}, message='#{@message}', abort=#{@abort})"

  equals: (other) -> (not other.ok) and @state.pos == other.state.pos and @message == other.message


exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
