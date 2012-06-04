
newState = (text) -> new ParserState(text, 0, text.length, 0, 0)

# parser state
class ParserState
  constructor: (@text, @pos, @end, @lineno, @xpos) ->

  advance: (n) ->
    pos = @pos
    lineno = @lineno
    xpos = @xpos
    while pos < n
      if @text[pos++] == '\n'
        lineno++
        xpos = 0
      else
        xpos++
    new ParserState(@text, pos, @end, lineno, xpos)

class Match
  constructor: (@state, @match) ->

class NoMatch
  constructor: (@state, @message) ->
    @lineno = @state.lineno
    @xpos = @state.xpos

  line: ->
    text = @state.text
    end = @state.end
    lstart = @state.pos
    lend = @state.pos
    if lstart > 0 and text[lstart] == '\n' then lstart--
    while lstart > 0 and text[lstart] != '\n' then lstart--
    if text[lstart] == '\n' then lstart++
    while lend < end and text[lend] != '\n' then lend++
    text.slice(lstart, lend)

# parser: (state) -> Match|NoMatch|exception
class Parser

exports.newState = newState
exports.ParserState = ParserState
exports.Match = Match
exports.NoMatch = NoMatch
exports.Parser = Parser
