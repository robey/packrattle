import { scheduleMap } from "./combiners";
import { MatchSuccess, mergeSpan } from "./matcher";
import { LazyParser, Parser } from "./parser";

/*
 * limited-extent sequence combiners that return a tuple type instead of an
 * abstract array.
 */

export function seq2<A, T1, T2>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>
): Parser<A, [ T1, T2 ]> {
  return new Parser<A, [ T1, T2 ]>("seq2", {
    cacheable: true,
    children: [ p1, p2 ],
    describe: list => `seq2(${list[0]}, ${list[1]})`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return [ new MatchSuccess<[ T1, T2 ]>(mergeSpan(span1, span2), [ value1, value2 ]) ];
        });
      });
    };
  });
}

export function seq3<A, T1, T2, T3>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>
): Parser<A, [ T1, T2, T3 ]> {
  return new Parser<A, [ T1, T2, T3 ]>("seq3", {
    cacheable: true,
    children: [ p1, p2, p3 ],
    describe: list => `seq3(${list[0]}, ${list[1]}, ${list[2]})`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return [ new MatchSuccess<[ T1, T2, T3 ]>(mergeSpan(span1, span3), [ value1, value2, value3 ]) ];
          });
        });
      });
    };
  });
}

export function seq4<A, T1, T2, T3, T4>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>,
  p4: LazyParser<A, T4>
): Parser<A, [ T1, T2, T3, T4 ]> {
  return new Parser<A, [ T1, T2, T3, T4 ]>("seq4", {
    cacheable: true,
    children: [ p1, p2, p3, p4 ],
    describe: list => `seq4(${list[0]}, ${list[1]}, ${list[2]}, ${list[3]})`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return scheduleMap(children[3], span3.end, (span4, value4) => {
              return [
                new MatchSuccess<[ T1, T2, T3, T4 ]>(mergeSpan(span1, span4), [ value1, value2, value3, value4 ])
              ];
            });
          });
        });
      });
    };
  });
}

export function seq5<A, T1, T2, T3, T4, T5>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>,
  p4: LazyParser<A, T4>,
  p5: LazyParser<A, T5>
): Parser<A, [ T1, T2, T3, T4, T5 ]> {
  return new Parser<A, [ T1, T2, T3, T4, T5 ]>("seq5", {
    cacheable: true,
    children: [ p1, p2, p3, p4, p5 ],
    describe: list => `seq5(${list[0]}, ${list[1]}, ${list[2]}, ${list[3]}, ${list[4]})`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return scheduleMap(children[3], span3.end, (span4, value4) => {
              return scheduleMap(children[4], span4.end, (span5, value5) => {
                return [
                  new MatchSuccess<[ T1, T2, T3, T4, T5 ]>(
                    mergeSpan(span1, span5),
                    [ value1, value2, value3, value4, value5 ]
                  )
                ];
              });
            });
          });
        });
      });
    };
  });
}

export function seq6<A, T1, T2, T3, T4, T5, T6>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>,
  p4: LazyParser<A, T4>,
  p5: LazyParser<A, T5>,
  p6: LazyParser<A, T6>
): Parser<A, [ T1, T2, T3, T4, T5, T6 ]> {
  return new Parser<A, [ T1, T2, T3, T4, T5, T6 ]>("seq7", {
    cacheable: true,
    children: [ p1, p2, p3, p4, p5, p6 ],
    describe: list => `seq6(${list[0]}, ${list[1]}, ${list[2]}, ${list[3]}, ${list[4]}, ${list[5]}`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return scheduleMap(children[3], span3.end, (span4, value4) => {
              return scheduleMap(children[4], span4.end, (span5, value5) => {
                return scheduleMap(children[5], span5.end, (span6, value6) => {
                  return [
                    new MatchSuccess<[ T1, T2, T3, T4, T5, T6 ]>(
                      mergeSpan(span1, span6),
                      [ value1, value2, value3, value4, value5, value6 ]
                    )
                  ];
                });
              });
            });
          });
        });
      });
    };
  });
}

export function seq7<A, T1, T2, T3, T4, T5, T6, T7>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>,
  p4: LazyParser<A, T4>,
  p5: LazyParser<A, T5>,
  p6: LazyParser<A, T6>,
  p7: LazyParser<A, T7>
): Parser<A, [ T1, T2, T3, T4, T5, T6, T7 ]> {
  return new Parser<A, [ T1, T2, T3, T4, T5, T6, T7 ]>("seq7", {
    cacheable: true,
    children: [ p1, p2, p3, p4, p5, p6, p7 ],
    describe: list => `seq7(${list[0]}, ${list[1]}, ${list[2]}, ${list[3]}, ${list[4]}, ${list[5]}, ${list[6]})`
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return scheduleMap(children[3], span3.end, (span4, value4) => {
              return scheduleMap(children[4], span4.end, (span5, value5) => {
                return scheduleMap(children[5], span5.end, (span6, value6) => {
                  return scheduleMap(children[6], span6.end, (span7, value7) => {
                    return [
                      new MatchSuccess<[ T1, T2, T3, T4, T5, T6, T7 ]>(
                        mergeSpan(span1, span7),
                        [ value1, value2, value3, value4, value5, value6, value7 ]
                      )
                    ];
                  });
                });
              });
            });
          });
        });
      });
    };
  });
}

export function seq8<A, T1, T2, T3, T4, T5, T6, T7, T8>(
  p1: LazyParser<A, T1>,
  p2: LazyParser<A, T2>,
  p3: LazyParser<A, T3>,
  p4: LazyParser<A, T4>,
  p5: LazyParser<A, T5>,
  p6: LazyParser<A, T6>,
  p7: LazyParser<A, T7>,
  p8: LazyParser<A, T8>
): Parser<A, [ T1, T2, T3, T4, T5, T6, T7, T8 ]> {
  return new Parser<A, [ T1, T2, T3, T4, T5, T6, T7, T8 ]>("seq8", {
    cacheable: true,
    children: [ p1, p2, p3, p4, p5, p6, p7, p8 ],
    describe: list => {
      return `seq8(${list[0]}, ${list[1]}, ${list[2]}, ${list[3]}, ${list[4]}, ${list[5]}, ${list[6]}, ${list[7]})`;
    }
  }, children => {
    return (stream, index) => {
      return scheduleMap(children[0], index, (span1, value1) => {
        return scheduleMap(children[1], span1.end, (span2, value2) => {
          return scheduleMap(children[2], span2.end, (span3, value3) => {
            return scheduleMap(children[3], span3.end, (span4, value4) => {
              return scheduleMap(children[4], span4.end, (span5, value5) => {
                return scheduleMap(children[5], span5.end, (span6, value6) => {
                  return scheduleMap(children[6], span6.end, (span7, value7) => {
                    return scheduleMap(children[7], span7.end, (span8, value8) => {
                      return [
                        new MatchSuccess<[ T1, T2, T3, T4, T5, T6, T7, T8 ]>(
                          mergeSpan(span1, span8),
                          [ value1, value2, value3, value4, value5, value6, value7, value8 ]
                        )
                      ];
                    });
                  });
                });
              });
            });
          });
        });
      });
    };
  });
}
