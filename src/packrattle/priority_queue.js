"use strict";

let top = 0;
let total = 0;

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

  inspect() {
    return this.queue.slice().reverse();
  }

  get length() {
    return this.queue.length;
  }

  get isEmpty() {
    this._trim();
    return this.queue.length == 0;
  }

  clear() {
    this.queue = [];
  }

  get() {
    this._trim();
    if (this.queue.length == 0) throw new Error("Queue is empty");
    return this.queue.pop().item;
  }

  /*
   * add a job to the queue, at a given priority.
   * if `condition` is given, it must be a function that returns true or false.
   * if it returns false, the item will be skipped on `get()`.
   */
  put(item, priority, condition) {
    const job = { item, priority };
    if (condition) job.condition = condition;

    // most of the time, the new job will be highest priority.
    if (this.queue.length == 0 || priority > this.queue[this.queue.length - 1].priority) {
      this.queue.push(job);
      return;
    }
    this._putRange(0, this.queue.length, job);
  }

  _putRange(left, right, job) {
    if (left >= right) {
      // end of line.
      return this.queue.splice(left, 0, job);
    }
    const n = left + Math.floor((right - left) / 2);
    if (this.queue[n].priority >= job.priority) {
      this._putRange(left, n, job);
    } else {
      this._putRange(n + 1, right, job);
    }
  }

  // remove dead entries from the head of the queue.
  _trim() {
    while (true) {
      if (this.queue.length == 0) return;
      const { item, priority, condition } = this.queue[this.queue.length - 1];
      if (!condition || condition()) return;
      this.queue.pop();
    }
  }
}


exports.PriorityQueue = PriorityQueue;
