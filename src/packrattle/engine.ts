// import PromiseSet from "./promise_set";

import { DebugGraph } from "./debug_graph";
import { Match } from "./match";
import { Parser } from "./parser";
import { newParserState, ParserState } from "./parser_state";
import { PriorityQueue } from "./priority_queue";
import { PromiseSet, PromiseSetOptions } from "./promise_set";
import { quote } from "./strings";

export interface EngineOptions {
  log?: (text: string) => void;
  // dotfile?: string | ((data: string) => void);
  debugGraph?: DebugGraph;
}

/*
 * an Engine processes a string through a tree of parsers, tracking state
 * is it goes for debugging.
 */
export class Engine {
  workQueue = new PriorityQueue<ParserState<any>>();

  // cache of (parser, position) -> PromiseSet
  cache: { [id: string]: PromiseSet<Match<any>> } = {};

  // how many parsers have we run?
  ticks = 0;

  log?: (text: string) => void;

  debugGraph?: DebugGraph;

  // if any handler throws an error, abort immediately.
  currentError?: Error;

  // set of ParserState that haven't received a result yet
  unresolvedStates: { [id: string]: ParserState<any> } = {};

  constructor(public text: string, options: EngineOptions = {}) {
    this.log = options.log;
    this.debugGraph = options.debugGraph;

  //   // track the currently-executing state for debugging (so we can graph the flow on request)
  //   this.currentState = null;
  //
  //
  }

  /*
   * schedule a parser to be executed, starting from a given state and a new
   * position.
   * returns a PromiseSet which should eventually hold the result.
   * (if this parser/state has already run or been scheduled, the existing
   * PromiseSet will be returned.)
   */
  schedule<T>(
    state: ParserState<any>,
    parser: Parser<T>,
    pos: number,
    validCheck?: () => boolean
  ): PromiseSet<Match<T>> {
    // skip if we've already done or scheduled this one.
    const id = `${parser.id}:${pos}`;
    if (this.cache[id]) return this.cache[id];

    const options: PromiseSetOptions = {
      exceptionHandler: (error: Error) => {
        this.currentError = error;
      }
    };
    if (this.log) {
      const log = this.log;
      options.log = (text: string) => log(`-> ${id} = ${text}`);
    }
    const result = new PromiseSet<Match<T>>(options);
    this.cache[id] = result;

    const newState = state.next(parser, pos, result);
    this.unresolvedStates[id] = newState;
    result.then(() => {
      delete this.unresolvedStates[id];
    });

    if (this.debugGraph) {
      this.debugGraph.addNode(id, parser, pos);
      this.debugGraph.addEdge(state.id, id);
    }

    if (this.log) this.log(`schedule: ${id} ${parser.inspect()}`);
    this.workQueue.put(newState, newState.depth, validCheck);
    return result;
  }

  // execute a parser over a string.
  execute<T>(parser: Parser<T>): Match<T> {
    const state = newParserState(this);
    const successes: Match<T>[] = [];
    const failures: Match<T>[] = [];

    if (this.log) this.log(`Try '${quote(this.text)}' in ${parser.inspect()}`);

    this.schedule(state, parser, 0).then(match => {
      if (match.ok) {
        if (this.log) this.log(`-> SUCCESS: ${match.inspect()}`);
        if (this.debugGraph) this.debugGraph.addEdge(match.state.id, "success");
        successes.push(match);
      } else {
        if (this.log) this.log(`-> FAILURE: ${match.inspect()}`);
        if (this.debugGraph) this.debugGraph.markFailure(match.state.id);
        failures.push(match);
      }
    });

    // start the engine!
    while (Object.keys(this.unresolvedStates).length > 0) {
      while (!this.workQueue.isEmpty && successes.length == 0 && !this.currentError) {
        const state = this.workQueue.get();

        this.ticks++;
        if (this.log) {
          const ticks = ("    " + this.ticks.toString()).slice(-4);
          this.log(`${ticks}. [${state.parser.id}]${state.parser.inspect()} @ ${state.inspect()}`);
        }

        state.parser.matcher(state, state.parser.children);
      }

      if (this.currentError) throw this.currentError;

      this.flushUnresolvedState();
    }

    // message with 'commit' set has highest priority. secondary sort by depth.
    failures.sort((a, b) => b.priority - a.priority);

    if (this.log) {
      if (successes.length > 0) {
        this.log("### successes:");
        successes.forEach(x => this.log ? this.log("    " + x.inspect()) : null);
      } else {
        this.log("### failures:");
        failures.forEach(x => this.log ? this.log("    " + x.inspect()) : null);
      }
    }

  //   if (this.dotfile) this.dotfile(this.debugGraph.toDot());

    return successes.length > 0 ? successes[0] : failures[0];
  }

  /*
   * okay, gather round, kids.
   *
   * GLL handles recursion by allowing cycles in the parser graph, and
   * assuming that if there's a successful match, some number of recursions
   * will find it. (the recursions are done cheaply in parallel by memoizing.
   * check out the docs folder for more about that.)
   *
   * but if there's no match, the engine will give up and declare failure
   * without necessarily marking all nodes as failed. for example:
   *
   *     const expr = alt(number, [ () => expr, "+", () => expr ]);
   *
   * if the "number" parser fails, then "expr" can never succeed. GLL handles
   * this by making the 2nd alternative's result dependent on "expr". once
   * "number" fails, it runs out of ways forward and gives up without
   * explicitly marking "expr" as failed. this is correct, but for certain
   * kinds of transform, we'd like to notice all failures and generate a good
   * error message (or even convert it to a success, in the case of "not").
   *
   * so we track unresolved parser states, and if the engine ends with any
   * still unresolved, we pick the deepest state (the state that nested most
   * deeply before cycling back), mark it as failed, and let the engine run
   * again to see if it can make any more progress. we repeat this until all
   * states are resolved; usually, each failure triggers a cascade of other
   * failures that finish off one cycle.
   */
  flushUnresolvedState() {
    const states: ParserState<any>[] = [];
    Object.keys(this.unresolvedStates).forEach(key => {
      states.push(this.unresolvedStates[key]);
    });
    if (states.length == 0) return;
    states.sort((a, b) => b.depth - a.depth);
    if (this.log) this.log("unresolved states: " + states.map(s => s.id).join(", "));

    const state = states[0];
    if (this.log) this.log(`forcing fail of ${state.id}`);
    this.cache[state.id].add(state.failure());
  }
}
