/*
 * a priority queue, which stores an item with an associated priority
 * (number). higher numbers are bumped up ahead of lower ones.
 * for our internal array representation, the tail of the array is the head
 * of the queue.
 */
class PriorityQueue {
  constructor() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }

  get isEmpty() {
    return this.queue.length == 0;
  }

  get() {
    if (this.queue.length == 0) throw new Error("Queue is empty");
    return this.queue.pop().item;
  }

  put(item, priority) {
    this.putRange(0, this.queue.length, item, priority);
  }

  putRange(left, right, item, priority) {
    if (left >= right) {
      // end of line.
      return this.queue.splice(left, 0, { item, priority });
    }
    const n = left + Math.floor((right - left) / 2);
    if (this.queue[n].priority >= priority) {
      this.putRange(left, n, item, priority);
    } else {
      this.putRange(n + 1, right, item, priority);
    }
  }

  inspect() {
    return this.queue.slice().reverse();
  }
}


exports.PriorityQueue = PriorityQueue;
