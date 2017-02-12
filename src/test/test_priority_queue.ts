import { PriorityQueue } from "../";

import "should";
import "source-map-support/register";

describe("PriorityQueue", () => {
  it("puts items sorted", () => {
    const q = new PriorityQueue<string>();
    q.put("a", 3);
    q.inspect().should.eql([ { item: "a", priority: 3 } ]);
    q.put("b", 2);
    q.inspect().should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 }
    ]);
    q.put("c", 6);
    q.inspect().should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "c", priority: 6 }
    ]);
    q.put("d", 6);
    q.inspect().should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "c", priority: 6 },
      { item: "d", priority: 6 }
    ]);
    q.put("e", 4);
    q.inspect().should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "e", priority: 4 },
      { item: "c", priority: 6 },
      { item: "d", priority: 6 }
    ]);
    q.put("f", 3);
    q.inspect().should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "f", priority: 3 },
      { item: "e", priority: 4 },
      { item: "c", priority: 6 },
      { item: "d", priority: 6 }
    ]);
  });

  it("gets items sorted", () => {
    const q = new PriorityQueue();
    q.put("a", 3);
    q.put("b", 2);
    q.put("c", 6);
    q.put("d", 6);
    q.put("e", 4);
    q.put("f", 3);
    q.get().should.eql("d");
    q.get().should.eql("c");
    q.get().should.eql("e");
    q.get().should.eql("f");
    q.get().should.eql("a");
    q.get().should.eql("b");
    (() => q.get()).should.throw(/empty/);
  });

  it("preserves ordering with the same priority", () => {
    const q = new PriorityQueue();
    q.put("a", 0);
    q.put("b", 0);
    q.put("c", 0);
    q.inspect().map(x => x.item).should.eql([ "a", "b", "c" ]);
  });
});
