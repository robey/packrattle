"use strict";

import DebugGraph from "./debug_graph";
import { newParserState } from "./parser_state";
import PriorityQueue from "./priority_queue";
import PromiseSet from "./promise_set";
import { quote } from "./strings";

/*
 * an Engine processes a string through a tree of parsers, tracking state
 * is it goes for debugging.
 */
export default class Engine {
  constructor(text, options = {}) {
    this.text = text;
    this.debugger = options.debugger;
    if (typeof this.debugger == "string") {
      const f = require("fs").openSync(this.debugger, "w");
      this.debugger = text => require("fs").writeSync(f, text + "\n");
    }
    if (options.dotfile) {
      this.dotfile = typeof options.dotfile == "string" ?
        data => require("fs").writeFileSync(options.dotfile, data) :
        options.dotfile;
      this.debugGraph = options.debugGraph || new DebugGraph();
    }

    // queue contains items of { state: ParserState, results: PromiseSet }.
    this.workQueue = new PriorityQueue();

    // cache of (parser, position) -> PromiseSet
    this.cache = {};

    // how many parsers have we run?
    this.ticks = 0;

    // track the currently-executing state for debugging (so we can graph the flow on request)
    this.currentState = null;

    // if any handler throws an exception, abort immediately.
    this.currentException = null;
  }

  /*
   * schedule a parser to be executed at a given state.
   * returns a PromiseSet which should eventually hold the result.
   * (if this parser/state has already run or been scheduled, the existing
   * PromiseSet will be returned.)
   */
  schedule(state, condition) {
    // skip if we've already done or scheduled this one.
    if (this.cache[state.id]) return this.cache[state.id];

    const results = new PromiseSet({
      debugger: this.debugger ? line => this.debugger(`-> ${state.id} = ${line}`) : null,
      exceptionHandler: error => {
        this.currentException = error;
      }
    });
    this.cache[state.id] = results;

    if (this.debugGraph) {
      this.debugGraph.addNode(state.id, state.parser, state.span());
      this.debugGraph.addEdge(this.currentState.id, state.id);
    }

    if (this.debugger) this.debugger(`schedule: ${state.id} ${state.parser.inspect()}`);
    this.workQueue.put({ state, results }, state.depth, condition);
    return results;
  }

  // execute a parser over a string.
  execute(parser) {
    const state = newParserState(this);
    const successes = [];
    const failures = [];

    this.currentState = state;
    if (this.debugger) this.debugger(`Try '${quote(this.text)}' in ${parser.inspect()}`);
    this.schedule(state.next(parser)).then(match => {
      if (match.ok) {
        if (this.debugger) this.debugger(`-> SUCCESS: ${match.inspect()}`);
        if (this.debugGraph) this.debugGraph.addEdge(match.state.id, "success");
        successes.push(match);
      } else {
        if (this.debugger) this.debugger(`-> FAILURE: ${match.inspect()}`);
        if (this.debugGraph) this.debugGraph.markFailure(match.state.id);
        failures.push(match);
      }
    });

    // start the engine!
    while (!this.workQueue.isEmpty && successes.length == 0 && !this.currentException) {
      const { state, results } = this.workQueue.get();

      this.ticks++;
      this.currentState = state;
      if (this.debugger) {
        this.debugger(`${rpad(this.ticks, 4)}. [${state.parser.id}]${state.parser.inspect()} @ ${state.inspect()}`);
      }

      state.parser.matcher(state, results, ...(state.parser.children || []));
    }

    if (this.currentException) throw this.currentException;

    this.currentState = null;

    // message with 'commit' set has highest priority. secondary sort by depth.
    failures.sort((a, b) => {
      return (a.commit != b.commit) ? (b.commit ? 1 : -1) : (b.state.startpos - a.state.startpos);
    });

    if (this.debugger) {
      if (successes.length > 0) {
        this.debugger("### successes:");
        successes.forEach(x => this.debugger("    " + x.inspect()));
      } else {
        this.debugger("### failures:");
        failures.forEach(x => this.debugger("    " + x.inspect()));
      }
    }

    if (this.dotfile) this.dotfile(this.debugGraph.toDot());

    return successes.length > 0 ? successes[0] : failures[0];
  }
}


function rpad(s, n) {
  s = s.toString();
  while (s.length < n) s = " " + s;
  return s;
}
