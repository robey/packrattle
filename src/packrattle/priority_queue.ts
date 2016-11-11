/*
 * a priority queue, which stores an item with an associated priority
 * (number). higher numbers are bumped up ahead of lower ones.
 * for our internal array representation, the tail of the array is the head
 * of the queue.
 */
export class PriorityQueue<T> {
  private queue: T[] = [];
  private priorities: number[] = [];
  private validChecks: (() => boolean)[] = [];

  inspect() {
    return this.queue.map((item, i) => {
      return { item, priority: this.priorities[i], valid: this.validChecks[i]() };
    });
  }

  get length(): number {
    return this.queue.length;
  }

  get isEmpty(): boolean {
    this.trim();
    return this.queue.length == 0;
  }

  clear(): void {
    this.queue = [];
    this.priorities = [];
    this.validChecks = [];
  }

  get(): T {
    this.trim();
    if (this.queue.length == 0) {
      throw new Error("Queue is empty");
    } else {
      this.priorities.pop();
      this.validChecks.pop();
      // the || here is just to work around a typescript bug.
      return this.queue.pop() || this.queue[0];
    }
  }

  /*
   * add a job to the queue, at a given priority.
   * if `validCheck` is given, it will be tested on `get()`, and the item
   * will be skipped & discarded if it's no longer valid.
   */
  put(item: T, priority: number, validCheck: () => boolean = (() => true)): void {
    // most of the time, the new job will be highest priority.
    if (this.queue.length == 0 || priority > this.priorities[this.queue.length - 1]) {
      this.queue.push(item);
      this.priorities.push(priority);
      this.validChecks.push(validCheck);
      return;
    }
    this._putRange(0, this.queue.length, item, priority, validCheck);
  }

  _putRange(left: number, right: number, item: T, priority: number, validCheck: () => boolean) {
    if (left >= right) {
      // end of line.
      this.queue.splice(left, 0, item);
      this.priorities.splice(left, 0, priority);
      this.validChecks.splice(left, 0, validCheck);
      return;
    }

    const n = left + Math.floor((right - left) / 2);
    if (this.priorities[n] >= priority) {
      this._putRange(left, n, item, priority, validCheck);
    } else {
      this._putRange(n + 1, right, item, priority, validCheck);
    }
  }

  // remove dead entries from the head of the queue.
  private trim() {
    while (this.validChecks.length > 0) {
      if (this.validChecks[this.validChecks.length - 1]()) return;
      this.queue.pop();
      this.priorities.pop();
      this.validChecks.pop();
    }
  }
}
