# debug the parser by plotting a directed graph of parse nodes as it works
# on a string.
class DebugGraph
  constructor: ->
    @nodes = {}
    @edges = []

  addEdge: (from, to) ->
    @edges.push { from, to }

  addNode: (name, parser, state) ->
    @nodes[name] = { parser, state }

  # filter out parsers with a name of "kind"
  filterOut: (kind) ->
    nodesToRemove = []
    for k, v of @nodes
      if v.parser.kind == kind then nodesToRemove.push k
    for node in nodesToRemove then @removeNode(node)

  removeNode: (node) ->
    targets = @edges.filter((edge) -> edge.from == node).map((edge) -> edge.to)
    dangles = @edges.filter((edge) -> edge.to == node).map((edge) -> edge.from)
    delete @nodes[node]
    @edges = @edges.filter((edge) -> edge.from != node and edge.to != node)
    for source in dangles
      for target in targets
        @addEdge(source, target)

  toDot: ->
    @filterOut("chain")
    @filterOut("seq")
    @filterOut("onMatch")
    data = [
      "digraph packrattle {"
      "  node [fontname=Courier];"
#      "  graph [rankdir=LR];"
    ]
    data = data.concat(for edge in @edges then "  \"#{edge.from}\" -> \"#{edge.to}\";")
    data.push ""
    data = data.concat(for k, v of @nodes then "  \"#{k}\" [label=\"@#{v.state.pos}: #{v.parser.kind}\\n'#{v.state.around(4)}'\"];")
    data.push ""
    data.push "  \"start\" [shape=rect, style=filled, fillcolor=yellow];"
    data.push "  \"success\" [shape=rect, style=filled, fillcolor=green];"
    data.push "}"
    data.join("\n") + "\n"


exports.DebugGraph = DebugGraph
