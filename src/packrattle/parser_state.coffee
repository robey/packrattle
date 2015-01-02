util = require 'util'
debug_graph = require("./debug_graph")
Trampoline = require("./trampoline").Trampoline

class Location
  constructor: (@pos, @xpos, @lineno) ->

  toString: ->
    "(pos=#{@pos}, xpos=#{@xpos}, lineno=#{@lineno})"

  # return a new Location with the position advanced 'n' places.
  # the new @lineno and @xpos are adjusted by watching for linefeeds.
  advance: (n, text) ->
    pos = @pos
    xpos = @xpos
    lineno = @lineno
    while pos < @pos + n
      if text[pos++] == '\n'
        lineno++
        xpos = 0
      else
        xpos++
    new Location(pos, xpos, lineno)

# parser state, used internally.
# - permanent text state: text, end
# - internal state: trampoline, debugger
# - text position: pos, xpos, lineno, oldpos, endpos, endxpos, endlineno
# - transient: depth, stateName, previousStateName
class ParserState
  constructor: (text, pos=0, end) ->
    if not end? then end = text.length
    @loc = new Location(pos, 0, 0)
    @depth = 0
    @stateName = null
    @internal =
      text: text
      end: end
      trampoline: new Trampoline(@)
      debugger: null

  clone: ->
    rv = Object.create(@.__proto__)
    rv.loc = @loc
    rv.oldloc = @oldloc
    rv.endloc = @endloc
    rv.depth = @depth
    rv.stateName = @stateName
    rv.internal = @internal
    rv

  toString: ->
    truncated = if @internal.text.length > 10 then "'#{@internal.text[...10]}...'" else "'#{@internal.text}'"
    extendedInfo = ""
    if @oldloc? then extendedInfo += ", oldloc=#{@oldloc}"
    if @endloc? then extendedInfo += ", endloc=#{@endloc}"
    "ParserState(text=#{truncated}, loc=#{@loc}, depth=#{@depth})#{extendedInfo}"

  startDebugGraph: ->
    @internal.debugger = { graph: new debug_graph.DebugGraph() }

  # return a new ParserState with the position advanced 'n' places.
  # the new @lineno and @xpos are adjusted by watching for linefeeds.
  # the previous position is saved as 'oldpos'
  advance: (n) ->
    rv = @clone()
    rv.oldloc = @loc
    rv.loc = @loc.advance(n, @internal.text)
    rv

  # turn (oldloc, loc) into (loc, endloc) to create a covering span for a successful match.
  flip: ->
    loc = if @oldloc? then @oldloc else @loc
    rv = @clone()
    rv.loc = loc
    rv.endloc = @loc
    rv

  # rewind oldpos to cover a previous state, too.
  backfill: (otherState) ->
    rv = @clone()
    if @endloc?
      # this state has already been flipped. rewind pos
      rv.loc = otherState.loc
    else
      rv.oldloc = if otherState.oldloc? then otherState.oldloc else otherState.loc
    rv

  pos: -> @loc.pos
  xpos: -> @loc.xpos
  endpos: -> (@endloc or @loc).pos
  lineno: -> @loc.lineno

  # return the text of the current line around 'pos'.
  line: (pos = @loc.pos) ->
    text = @internal.text
    end = @internal.end
    lstart = pos
    lend = pos
    if lstart > 0 and text[lstart] == '\n' then lstart--
    while lstart > 0 and text[lstart] != '\n' then lstart--
    if text[lstart] == '\n' then lstart++
    while lend < end and text[lend] != '\n' then lend++
    text.slice(lstart, lend)

  # silly indicator (for ascii terminals) of where we are
  around: (width) ->
    line = @line()
    xpos = @xpos()
    left = xpos - width
    right = xpos + width
    if left < 0 then left = 0
    if right >= line.length then right = line.length - 1
    line[left ... xpos] + "[" + (line[xpos] or "") + "]" + line[xpos + 1 ... right + 1]

  getCache: (parser) -> @internal.trampoline.getCache(parser, @)

  addJob: (description, job) -> @internal.trampoline.push @depth, description, job

  deeper: (parser) ->
    rv = @clone()
    rv.depth = @depth + 1
    if not @internal.debugger?.graph? then return rv
    newStateName = "#{parser.id}:#{@loc.pos}"
    rv.stateName = newStateName
    @internal.debugger.graph.addNode(newStateName, parser, rv)
    if @stateName? then @internal.debugger.graph.addEdge(@stateName, newStateName)
    rv

  logSuccess: ->
    if @internal.debugger?.graph?
      @internal.debugger.graph.addEdge(@stateName, "success")

  logFailure: ->
    if @internal.debugger?.graph?
      @internal.debugger.graph.addEdge(@stateName, "failure")
    # don't do anything for now.

  debugGraphToDot: ->
    return unless @internal.debugger?.graph?
    @internal.debugger.graph.toDot()

  toSquiggles: ->
    line = @line()
    endloc = @endloc or @loc
    endxpos = endloc.xpos
    if endloc.lineno != @loc.lineno
      # multi-line: just show the first line.
      endxpos = line.length
    if endxpos == @loc.xpos then endxpos += 1
    [ line, [0 ... @loc.xpos].map(-> " ").join("") + [@loc.xpos ... endxpos].map(-> "~").join("") ]


class Match
  constructor: (@state, @match, @commit=false) ->
    @ok = true

  toString: -> "Match(state=#{@state}, match=#{util.inspect(@match)}, commit=#{@commit})"

  equals: (other) -> other.ok and @match == other.match and @state.pos() == other.state.pos()


class NoMatch
  constructor: (@state, @message, @abort=false) ->
    @ok = false

  toString: -> "NoMatch(state=#{@state}, message='#{@message}', abort=#{@abort})"

  equals: (other) -> (not other.ok) and @state.pos() == other.state.pos() and @message == other.message


exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
