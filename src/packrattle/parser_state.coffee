util = require 'util'
Trampoline = require("./trampoline").Trampoline

# parser state, used internally.
class ParserState
  constructor: (@text, @pos=0, @end, @lineno=0, @xpos=0, @trampoline=null, @depth=0, @debugger=null, @previousState=null) ->
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
    state = new ParserState(@text, pos, @end, lineno, xpos, @trampoline, @depth, @debugger, @previousState)
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

  getCache: (parser) -> @trampoline.getCache(parser, @)

  addJob: (description, job) -> @trampoline.push @depth, description, job

  deeper: -> new ParserState(@text, @pos, @end, @lineno, @xpos, @trampoline, @depth + 1, @debugger, @previousState)

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

  debugGraph: ->
    return unless @debugger?.graph?
    graph = @debugger.graph
    console.log "digraph packrattle {"
    for edge in graph.edges
      console.log "  \"#{edge.from}\" -> \"#{edge.to}\";"
    console.log ""
    for k, v of graph.nodes
      console.log "  \"#{k}\" [label=\"@#{v.state.pos}: #{v.parser.message()}\"];"
    console.log "}"

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
