"use strict";

// pretend like js has a collections library.
function exists(array, f) {
  for (let i = 0; i < array.length; i++) if (f(array[i])) return true;
  return false;
}

/*
 * debug the parser by plotting a directed graph of parse nodes as it works
 * on a string.
 */
class DebugGraph {
  constructor() {
    this.nodes = {};
    this.edges = [];
    this.success = false;
    this.failure = false;
  }

  addEdge(from, to) {
    this.edges.push({ from, to });
    if (this.nodes[from]) this.nodes[from].children.push(to);
    if (this.nodes[to]) this.nodes[to].parents.push(from);
    if (to == "success") this.success = true;
    if (to == "failure") this.failure = true;
  }

  addNode(name, parser, span) {
    const node = { parser, span, parents: [], children: [] };
    this.edges.forEach(edge => {
      if (edge.from == name) node.children.push(edge.to);
      if (edge.to == name) node.parents.push(edge.from);
    });
    this.nodes[name] = node;
  }

  markFailure(name) {
    this.nodes[name].failure = true;
  }

  // filter out parsers with certain names
  filterOut(...names) {
    const nodesToRemove = [];

    Object.keys(this.nodes).forEach(name => {
      const node = this.nodes[name];
      if (names.indexOf(node.parser.name) < 0) return;

      const edgesToRemove = [];
      // skip deleting a node that would make the graph bushier
      if (node.parents.length > 1 && node.children.length > 1) return;

      node.parents.forEach(p => {
        edgesToRemove.push({ from: p, to: name });
        if (this.nodes[p]) this.nodes[p].children = this.nodes[p].children.filter(c => c != name);
      });
      node.children.forEach(c => {
        edgesToRemove.push({ from: name, to: c });
        if (this.nodes[c]) this.nodes[c].parents = this.nodes[c].parents.filter(p => p != name);
      });
      node.parents.forEach(p => {
        node.children.forEach(c => {
          this.addEdge(p, c);
        });
      });
      delete this.nodes[name];

      this.edges = this.edges.filter(edge => !exists(edgesToRemove, e => e.from == edge.from && e.to == edge.to));
    });
  }

  toDot(maxLength = 40) {
    this.filterOut("map", "filter", "drop", "optional");

    const data = [
      "digraph packrattle {",
      "  node [fontname=Courier];"
    ];
    data.push("");
    this.edges.forEach(edge => {
      data.push(`  "${edge.from}" -> "${edge.to}";`);
    });
    data.push("");
    Object.keys(this.nodes).forEach(name => {
      const node = this.nodes[name];
      if (!node.parser) return;
      let description = node.parser.inspect();
      if (description.length > maxLength) description = description.slice(0, maxLength) + "...";
      description = description.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      const around = node.span.around(4).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      const label = `label="@${node.span.start}: ${description}\\n'${around}'"`;
      const style = node.failure ? [ "style=filled", "fillcolor=pink" ] : [];
      const attrs = [ label, "shape=rect" ].concat(style).join(", ");
      data.push(`  "${name}" [${attrs}];`);
    });
    data.push("");
    data.push("  \"start\" [shape=circle, style=filled, fillcolor=yellow];");
    if (this.success) data.push("  \"success\" [shape=rect, style=filled, fillcolor=green];");
    if (this.failure) data.push("  \"failure\" [shape=rect, style=filled, fillcolor=red];");
    data.push("}");
    return data.join("\n") + "\n";
  }
}


exports.DebugGraph = DebugGraph;
