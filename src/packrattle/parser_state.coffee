util = require 'util'
debug_graph = require("./debug_graph")


class ParserState

  startDebugGraph: ->
    @internal.debugger = { graph: new debug_graph.DebugGraph() }




  debugGraphToDot: ->
    return unless @internal.debugger?.graph?
    @internal.debugger.graph.toDot()



exports.ParserState = ParserState
