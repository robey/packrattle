"use strict";

const parser = require("./parser");
const util = require("util");

/*
 * chain together parsers p1 & p2 such that if p1 matches, p2 is executed on
 * the following state. if both match, `combiner` is called with the two
 * matched objects, to create a single match result.
 */
function chain(p1, p2, combiner) {
  return parser.newParser("chain", {
    children: [ p1, p2 ],
    describe: (list) => `${list[0]} then ${list[1]}`,
  }, (state, results) => {
    state.schedule(p1).then(match1 => {
      if (!match1.ok) {
        results.add(match1);
      } else {
        match1.state.schedule(p2).then(match2 => {
          if (!match2.ok) {
            // no backtracking if the left match was commit()'d.
            if (match1.commit) match2.abort = true;
            results.add(match2);
          } else {
            const newState = match2.state.merge(match1.state);
            const value = combiner(match1.value, match2.value);
            results.add(match1.commit || match2.commit ? newState.commitSuccess(value) : newState.success(value));
          }
        });
      }
    });
  });
}

/*
 * try each of these parsers, in order (starting from the same position),
 * looking for the first match.
 */
function alt(...parsers) {
  return parser.newParser("alt", {
    children: parsers,
    describe: list => list.join(" or ")
  }, (state, results) => {
    let aborting = false;
    parsers.forEach(p => {
      console.log("schedule: " + p.toString());
      state.schedule(p).then(match => {
        console.log("run: " + p.toString() + " got " + match.toString());
        if (aborting) return;
        if (match.abort) aborting = true;
        results.add(match);
      });
    });
  });
}


exports.alt = alt;
exports.chain = chain;
