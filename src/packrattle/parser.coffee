util = require 'util'
combiners = require './combiners'
debug_graph = require './debug_graph'
helpers = require './helpers'
parser_state = require './parser_state'



  # create a dot graph of the parser nesting
  toDot: (maxLength = 40) ->
    seen = {}
    nodes = []
    edges = []
    traverse = (parser) ->
      seen[parser.id] = true
      nodes.push { id: parser.id, kind: parser.kind, description: parser.description() }
      for p in parser.nested
        p = resolve(p)
        edges.push { from: parser.id, to: p.id }
        if not seen[p.id]? then traverse(p)
    traverse @
    edges = edges.map (e) -> "  \"#{e.from}\" -> \"#{e.to}\";"
    nodes = nodes.map (n) ->
      description = if n.description.length > maxLength then "#{n.description[...maxLength]}..." else n.description
      description = description.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
      kind = n.kind.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
      label = "#{kind}\\n#{description}"
      "  \"#{n.id}\" [label=\"#{label}\"];"
    data = [
      "digraph packrattle {"
      "  node [fontname=Courier];"
    ]
    data = data.concat(edges)
    data.push ""
    data = data.concat(nodes)
    data.push "}"
    data.join("\n") + "\n"



  # ----- transformations and combinations:




  repeat: (minCount, maxCount) -> combiners.repeat(@, minCount, maxCount)

  times: (count) -> combiners.repeat(@, count, count)







exports.newParser = newParser
exports.Parser = Parser

exports.end = end
exports.reject = reject
exports.succeed = succeed
exports.string = string
exports.regex = regex

exports.parse = parse
exports.consume = consume
