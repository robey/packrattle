import PromiseSet from "../../lib/packrattle/promise_set";

require("should");
require("source-map-support").install();

describe("PromiseSet", () => {
  it("sets one value and then receives it", done => {
    const p = new PromiseSet();
    p.add(23);
    p.then(v => {
      v.should.eql(23);
      done();
    });
  });

  it("notifies an early listener of a value", done => {
    const p = new PromiseSet();
    p.then(v => {
      v.should.eql(23);
      done();
    });
    p.add(23);
  });

  it("handles multiple values", done => {
    const p = new PromiseSet();

    p.add(1);
    p.add(2);

    const results = [];
    p.then(v => {
      results.push(v);
      if (v == 4) {
        results.should.eql([ 1, 2, 3, 4 ]);
        done();
      }
    });

    p.add(3);
    p.add(4);
  });

  it("handles multiple listeners", () => {
    const p = new PromiseSet();
    let count = 0;

    p.then(v => {
      count += 1;
    });
    p.then(v => {
      count += 1;
    });

    p.add(100);
    p.then(v => {
      count += 1;
    });

    count.should.eql(3);
  })
});
