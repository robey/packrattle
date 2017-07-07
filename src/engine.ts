import { DebugGraph, NodeState } from "./debug_graph";
import { fail, Match, MatchFailure, MatchResult, MatchSuccess, Schedule, Sequence } from "./matcher";
import { Parser } from "./parser";
import { PriorityQueue } from "./priority_queue";
import { PromiseSet, PromiseSetOptions } from "./promise_set";
import { quote } from "./strings";

export class ParseTask<A, Out> {
  cacheKey: string;

  // stream is known by the engine
  constructor(public parser: Parser<A, Out>, public index: number, public result: PromiseSet<Match<Out>>) {
    this.cacheKey = `${this.parser.id}:${this.index}`;
  }

  toString() {
    return `ParseTask[${this.cacheKey}, ${this.parser.inspect()}]`;
  }
}

export interface EngineOptions {
  logger?: (message: string) => void;

  makeDot?: (graph: string) => void;
}

/*
 * an Engine processes a string through a tree of parsers, tracking state
 * is it goes for debugging.
 */
export class Engine<A> {
  workQueue = new PriorityQueue<ParseTask<A, any>>();

  // cache of ParseTask -> PromiseSet
  cache: { [id: string]: ParseTask<A, any> } = {};

  // set of ParseTasks that haven't received a result yet
  unresolvedTasks: { [id: string]: string } = {};

  // how many parsers have we run?
  ticks = 0;

  // build a debug graph so we can generate a dot file?
  debugGraph?: DebugGraph;

  // for debugging, we want to mark success/failure of the primary task in the debug groph.
  primaryTask: ParseTask<A, any>;


  constructor(public stream: Sequence<A>, public options: EngineOptions = {}) {
    if (options.makeDot) this.debugGraph = new DebugGraph();
  }

  // execute a parser over a string.
  execute<Out>(parser: Parser<A, Out>): Match<Out> {
    const successes: MatchSuccess<Out>[] = [];
    const failures: MatchFailure<Out>[] = [];

    if (this.options.logger) this.options.logger(`Try '${inspect(this.stream)}' in ${inspect(parser)}`);

    this.primaryTask = this.schedule(parser, 0);
    if (this.debugGraph) this.debugGraph.start(this.primaryTask);
    this.primaryTask.result.then(match => {
      if (match instanceof MatchSuccess) {
        if (this.options.logger) this.options.logger(`-> SUCCESS: ${inspect(match.value)}`);
        successes.push(match);
      } else {
        if (this.options.logger) this.options.logger(`-> FAILURE: ${match.message}`);
        failures.push(match);
      }
    });

    // start the engine!
    while (Object.keys(this.unresolvedTasks).length > 0 && successes.length == 0) {
      while (this.workQueue.length > 0 && successes.length == 0) {
        const task = this.workQueue.get();
        this.ticks++;
        if (this.options.logger) {
          const ticks = ("    " + this.ticks.toString()).slice(-4);
          this.options.logger(`${ticks}. [${task.parser.id} @ ${task.index}] ${task.parser.inspect()}`);
        }

        try {
          const matchResult = task.parser.matcher(this.stream, task.index);
          matchResult.forEach(r => r.taskKey = task.cacheKey);
          this.processResult(task, matchResult);
        } catch (error) {
          if (this.options.logger) this.options.logger(`Parser ${task.parser.id} threw error: ${error.message}`);
          throw error;
        }
      }

      if (successes.length == 0) this.flushUnresolvedTask();
    }

    failures.sort((a, b) => b.span.start - a.span.start);

    if (this.options.logger) {
      if (successes.length > 0) {
        this.options.logger("### successes:");
        successes.forEach(x => this.options.logger ? this.options.logger("    " + x.toString()) : null);
      } else {
        this.options.logger("### failures:");
        failures.forEach(x => this.options.logger ? this.options.logger("    " + x.toString()) : null);
      }
    }

    if (this.options.makeDot && this.debugGraph) this.options.makeDot(this.debugGraph.toDot());

    return successes.length > 0 ? successes[0] : failures[0];
  }

  processResult<T>(task: ParseTask<A, T>, mr: MatchResult<A, T>) {
    mr.forEach(result => {
      if (result instanceof Schedule) {
        const newTask = this.schedule(result.parser, result.index);
        newTask.result.then(match => {
          const newResult = result.handler(match);
          newResult.forEach(r => r.taskKey = match.taskKey);
          this.processResult(task, newResult);
        });

        if (this.debugGraph) this.debugGraph.step(result.taskKey || "", newTask);
      } else {
        if (this.debugGraph) {
          if (result instanceof MatchSuccess) {
            if (this.primaryTask.cacheKey == task.cacheKey && result.taskKey !== undefined) {
              this.debugGraph.mark(result.taskKey, NodeState.SUCCESS);
            }
          } else {
            if (result.taskKey !== undefined) {
              this.debugGraph.mark(result.taskKey, NodeState.FAILURE);
            }
          }
        }
        task.result.add(result);
      }
    });
  }

  /*
   * schedule a parser to be executed, starting from a given state and a new
   * position.
   * returns a PromiseSet which should eventually hold the result.
   * (if this parser/state has already run or been scheduled, the existing
   * PromiseSet will be returned.)
   */
  schedule<T>(parser: Parser<A, T>, index: number): ParseTask<A, T> {
    // skip if we've already done or scheduled this one.
    const id = `${parser.id}:${index}`;
    if (this.cache[id]) return this.cache[id];

    const options: PromiseSetOptions = {};

    if (this.options.logger) {
      const log = this.options.logger;
      options.logger = (text: string) => {
        log(`      [${task.parser.id} @ ${task.index}] = ${text}`);
      };
    }
    const task = new ParseTask<A, T>(parser, index, new PromiseSet<Match<T>>(options));
    this.cache[task.cacheKey] = task;
    this.unresolvedTasks[task.cacheKey] = task.cacheKey;
    task.result.then(() => {
      delete this.unresolvedTasks[task.cacheKey];
    });

    if (this.options.logger) {
      this.options.logger(`      -> schedule: [${task.parser.id} @ ${task.index}] ${inspect(parser)}`);
    }
    this.workQueue.put(task, task.index);
    return task;
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
  flushUnresolvedTask() {
    const ids = Object.keys(this.unresolvedTasks).sort((a, b) => this.cache[b].index - this.cache[a].index);
    if (ids.length == 0) return;
    if (this.options.logger) this.options.logger("unresolved tasks: " + ids.join(", "));

    const task = this.cache[ids[0]];
    if (this.options.logger) this.options.logger(`forcing fail of ${task.cacheKey}`);
    task.result.add(fail(task.index, task.parser)[0]);
  }
}

function inspect(x: any): string {
  if (x == null) return "(null)";
  if (x["inspect"] && typeof x["inspect"] == "function") return x["inspect"]();
  return quote(x);
}
