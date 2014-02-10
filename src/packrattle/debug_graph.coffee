util = require 'util'

# debug the parser by plotting a directed graph of parse nodes as it works
# on a string.
class DebugGraph
  constructor: ->
    @nodes = {}
    @edges = []
    @success = false
    @failure = false

  addEdge: (from, to) ->
    @edges.push { from, to }
    if @nodes[from]? then @nodes[from].children.push to
    if @nodes[to]? then @nodes[to].parents.push from
    if to == "success" then @success = true
    if to == "failure" then @failure = true

  addNode: (name, parser, state) ->
    node = { parser, state, parents: [], children: [] }
    for edge in @edges
      if edge.from == name then node.children.push edge.to
      if edge.to == name then node.parents.push edge.from
    @nodes[name] = node

  # filter out parsers with a name of "kind"
  filterOut: (kinds...) ->
    nodesToRemove = []
    for k, v of @nodes when v.parser?.kind in kinds then nodesToRemove.push k
    for name in nodesToRemove
      edgesToRemove = []
      node = @nodes[name]
      # skip deleting a node that would make the graph bushier
      continue if node.parents.length > 1 and node.children.length > 1
      for p in node.parents
        edgesToRemove.push { from: p, to: name }
        if @nodes[p]? then @nodes[p].children = @nodes[p].children.filter (c) -> c != name
      for c in node.children
        edgesToRemove.push { from: name, to: c }
        if @nodes[c]? then @nodes[c].parents = @nodes[c].parents.filter (p) -> p != name
      for p in node.parents then for c in node.children
        @addEdge(p, c)
      delete @nodes[name]
      @edges = @edges.filter (edge) ->
        keep = true
        for e in edgesToRemove then if e.from == edge.from and e.to == edge.to then keep = false
        keep

  toDot: (maxLength = 40) ->
    @filterOut("chain", "seq", "onMatch", "matchIf")
    edges = for edge in @edges then "  \"#{edge.from}\" -> \"#{edge.to}\";"
    nodes = for k, v of @nodes when v.parser?
      description = v.parser.description()
      if description.length > maxLength then description = v.parser.kind + "..."
      description = description.replace("\\", "\\\\").replace("\"", "\\\"")
      label = "@#{v.state.pos()} #{v.state.depth}: #{description}\\n'#{v.state.around(4)}'"
      label = label.replace /"/g, "\\\""
      "  \"#{k}\" [label=\"#{label}\"];"
    data = [
      "digraph packrattle {"
      "  node [fontname=Courier];"
    ]
    data = data.concat(edges)
    data.push ""
    data = data.concat(nodes)
    data.push ""
    data.push "  \"start\" [shape=rect, style=filled, fillcolor=yellow];"
    if @success
      data.push "  \"success\" [shape=rect, style=filled, fillcolor=green];"
    if @failure
      data.push "  \"failure\" [shape=rect, style=filled, fillcolor=red];"
    data.push "}"
    data.join("\n") + "\n"


exports.DebugGraph = DebugGraph
