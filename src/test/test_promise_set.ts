import { PromiseSet } from "../";

import "should";
import "source-map-support/register";

describe("PromiseSet", () => {
  it("sets one value and then receives it", () => {
    return new Promise(resolve => {
      const p = new PromiseSet<number>();
      p.add(23);
      p.then(v => {
        v.should.eql(23);
        resolve();
      });
    });
  });

  it("notifies an early listener of a value", () => {
    return new Promise(resolve => {
      const p = new PromiseSet();
      p.then(v => {
        v.should.eql(23);
        resolve();
      });
      p.add(23);
    });
  });

  it("handles multiple values", () => {
    return new Promise(resolve => {
      const p = new PromiseSet<number>();

      p.add(1);
      p.add(2);

      const results: number[] = [];
      p.then(v => {
        results.push(v);
        if (v == 4) {
          results.should.eql([ 1, 2, 3, 4 ]);
          resolve();
        }
      });

      p.add(3);
      p.add(4);
    });
  });

  it("handles multiple listeners", () => {
    const p = new PromiseSet<number>();
    let count = 0;

    p.then(_ => {
      count += 1;
    });
    p.then(_ => {
      count += 1;
    });

    p.add(100);
    p.then(_ => {
      count += 1;
    });

    count.should.eql(3);
  });
});
