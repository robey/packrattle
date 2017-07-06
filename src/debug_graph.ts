import { ParseTask } from "./engine";
import { Parser } from "./parser";

// pretend like js has a collections library.
function exists<A>(array: A[], f: (item: A) => boolean): boolean {
  for (let i = 0; i < array.length; i++) if (f(array[i])) return true;
  return false;
}

export enum NodeState {
  NORMAL, SUCCESS, FAILURE
}

export class Node {
  constructor(
    public parser: Parser<any, any>,
    public index: number,
    public parents: string[] = [],
    public children: string[] = [],
    public failure: boolean = false,
    public state: NodeState = NodeState.NORMAL
  ) {
    // pass
  }
}

/*
 * debug the parser by plotting a directed graph of parse nodes as it works
 * on a string.
 */
export class DebugGraph {
  nodes: { [name: string]: Node } = {};
  edges: { from: string, to: string }[] = [];
  hasSuccess = false;
  hasFailure = false;

  start(task: ParseTask<any, any>) {
    this.addNode(task.cacheKey, task.parser, task.index);
    this.addEdge("start", task.cacheKey);
  }

  step(fromKey: string, newTask: ParseTask<any, any>) {
    this.addNode(newTask.cacheKey, newTask.parser, newTask.index);
    this.addEdge(fromKey, newTask.cacheKey);
  }

  addEdge(from: string, to: string) {
    this.edges.push({ from, to });
    if (this.nodes[from]) this.nodes[from].children.push(to);
    if (this.nodes[to]) this.nodes[to].parents.push(from);
  }

  addNode(name: string, parser: Parser<any, any>, index: number) {
    if (this.nodes[name] !== undefined) return;
    const node = new Node(parser, index);
    this.edges.forEach(edge => {
      if (edge.from == name) node.children.push(edge.to);
      if (edge.to == name) node.parents.push(edge.from);
    });
    this.nodes[name] = node;
  }

  mark(name: string, state: NodeState) {
    this.nodes[name].state = state;
  }

  // filter out parsers with certain names
  filterOut(...names: string[]) {
    Object.keys(this.nodes).forEach(name => {
      const node = this.nodes[name];
      if (names.indexOf(node.parser.name) < 0) return;

      const edgesToRemove: { from: string, to: string }[] = [];
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

  toDot(maxLength: number = 40): string {
    this.filterOut("map", "filter", "mapError");

    const data: string[] = [
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
      let description = node.parser.description;
      if (description.length > maxLength) description = description.slice(0, maxLength) + "...";
      description = description.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      // const around = node.span.around(4).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      const label = `label="[${node.parser.id} @ ${node.index}]: ${description}"`;

      let style: string[] = [];
      switch (node.state) {
        case NodeState.SUCCESS:
          style.push("style=filled");
          style.push("fillcolor=green");
          break;
        case NodeState.FAILURE:
          style.push("style=filled");
          style.push("fillcolor=pink");
          break;
      }

      const attrs = [ label, "shape=rect" ].concat(style).join(", ");
      data.push(`  "${name}" [${attrs}];`);
    });
    data.push("");
    data.push("  \"start\" [shape=circle, style=filled, fillcolor=yellow];");
    data.push("}");
    return data.join("\n") + "\n";
  }
}
