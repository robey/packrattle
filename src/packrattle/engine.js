"use strict";

const parser_state = require("./parser_state");
const priority_queue = require("./priority_queue");
const promise_set = require("./promise_set");
const resolve = require("./resolve");

/*
 * an Engine processes a string through a tree of parsers, tracking state
 * is it goes for debugging.
 */
class Engine {
  constructor(text, options = {}) {
    this.text = text;
    this.debugger = options.debugger;
    this.debugGraph = options.debugGraph;

    // queue contains items of { parser: Parser, state: ParserState, results: PromiseSet }.
    this.workQueue = new priority_queue.PriorityQueue();

    // cache of (parser, position) -> PromiseSet
    this.cache = {};

    // how many parsers have we run?
    this.ticks = 0;

    // cache of function -> parser (rebuilt for each execution)
    this.lazyCache = {};
  }

  process(parser, state, results) {
    // first: `parser` could be a function or need to be converted implicitly from another type.
    parser = resolve(parser, this.cache);

    this.ticks++;
    const newState = state.next(parser);
    if (this.debugger) this.debugger(`${rpad(this.ticks, 4)}. ${parser.toString()} @ ${newState.toString()}`)

    if (this.debugGraph) {
      this.debugGraph.addNode(newState.id, parser, newState.span());
      this.debugGraph.addEdge(state.id, newState.id);
    }

    parser.matcher(newState, results);
  }

  /*
   * schedule a parser to be executed at a given state.
   * returns a PromiseSet which should eventually hold the result.
   * (if this parser/state has already run or been scheduled, the existing
   * PromiseSet will be returned.)
   */
  schedule(parser, state) {
    // skip if we've already done or scheduled this one.
    if (this.cache[state.id]) return this.cache[state.id];

    const results = new promise_set.PromiseSet({
      debugger: this.debugger ? (line) => this.debugger(`-> ${state.id} = ${line}`) : null
    });
    this.cache[state.id] = results;

    this.workQueue.put({ parser, state, results }, state.depth);
    return results;
  }

  // execute a parser over a string.
  execute(parser) {
    const state = parser_state.newParserState(this);
    const successes = [];
    const failures = [];

    this.schedule(parser, state).then(match => {
      if (match.ok) {
        if (this.debugGraph) this.debugGraph.addEdge(match.state.id, "success");
        successes.push(match);
      } else {
        if (this.debugGraph) this.debugGraph.addEdge(match.state.id, "failure");
        failures.push(match);
      }
    });

    // start the engine!
    while (!this.workQueue.isEmpty && successes.length == 0) {
      const { parser, state, results } = this.workQueue.get();
      this.process(parser, state, results);
    }

    // message with 'abort' set has highest priority. secondary sort by index.
    failures.sort((a, b) => {
      return (a.abort != b.abort) ? (b.abort ? 1 : -1) : (b.state.depth - a.state.depth);
    });

    if (this.debugger) {
      if (successes.length > 0) {
        this.debugger("### successes:");
        successes.forEach(x => this.debugger("    " + x.toString()));
      } else {
        this.debugger("### failures:");
        failures.forEach(x => this.debugger("    " + x.toString()));
      }
    }

    return successes.length > 0 ? successes[0] : failures[0];
  }
}


function rpad(s, n) {
  s = s.toString();
  while (s.length < n) s = " " + s;
  return s;
}


exports.Engine = Engine;
