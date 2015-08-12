import pr from "../../lib";

require("should");
require("source-map-support").install();

describe("PriorityQueue", () => {
  it("puts items sorted", () => {
    const q = new pr.PriorityQueue();
    q.put("a", 3);
    q.queue.should.eql([ { item: "a", priority: 3 } ]);
    q.put("b", 2);
    q.queue.should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 }
    ]);
    q.put("c", 6);
    q.queue.should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "c", priority: 6 }
    ]);
    q.put("d", 6);
    q.queue.should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "d", priority: 6 },
      { item: "c", priority: 6 }
    ]);
    q.put("e", 4);
    q.queue.should.eql([
      { item: "b", priority: 2 },
      { item: "a", priority: 3 },
      { item: "e", priority: 4 },
      { item: "d", priority: 6 },
      { item: "c", priority: 6 }
    ]);
    q.put("f", 3);
    q.queue.should.eql([
      { item: "b", priority: 2 },
      { item: "f", priority: 3 },
      { item: "a", priority: 3 },
      { item: "e", priority: 4 },
      { item: "d", priority: 6 },
      { item: "c", priority: 6 }
    ]);
  });

  it("gets items sorted", () => {
    const q = new pr.PriorityQueue();
    q.put("a", 3);
    q.put("b", 2);
    q.put("c", 6);
    q.put("d", 6);
    q.put("e", 4);
    q.put("f", 3);
    q.get().should.eql("c");
    q.get().should.eql("d");
    q.get().should.eql("e");
    q.get().should.eql("a");
    q.get().should.eql("f");
    q.get().should.eql("b");
    (() => q.get()).should.throw(/empty/);
  });

  it("preserves ordering with the same priority", () => {
    const q = new pr.PriorityQueue();
    q.put("a", 0);
    q.put("b", 0);
    q.put("c", 0);
    q.queue.map(x => x.item).should.eql([ "c", "b", "a" ]);
  });

  it("skips items that fail their conditional", () => {
    const q = new pr.PriorityQueue();
    q.put("a", 3, () => false);
    q.put("b", 2);
    q.put("c", 6);
    q.get().should.eql("c");
    q.get().should.eql("b");
    q.isEmpty.should.eql(true);
  });
});
