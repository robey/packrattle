/*
 * a priority queue, which stores an item with an associated priority
 * (number). higher numbers are bumped up ahead of lower ones.
 * for our internal array representation, the tail of the array is the head
 * of the queue.
 */
export class PriorityQueue<T> {
  private queue: T[] = [];
  private priorities: number[] = [];

  inspect() {
    return this.queue.map((item, i) => {
      return { item, priority: this.priorities[i] };
    });
  }

  get length(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.priorities = [];
  }

  get(): T {
    if (this.queue.length == 0) {
      throw new Error("Queue is empty");
    } else {
      this.priorities.pop();
      // the || here is just to work around a typescript bug.
      return this.queue.pop() || this.queue[0];
    }
  }

  /*
   * add a job to the queue, at a given priority.
   */
  put(item: T, priority: number): void {
    // most of the time, the new job will be highest priority.
    if (this.queue.length == 0 || priority >= this.priorities[this.queue.length - 1]) {
      this.queue.push(item);
      this.priorities.push(priority);
      return;
    }
    this._putRange(0, this.queue.length, item, priority);
  }

  _putRange(left: number, right: number, item: T, priority: number) {
    if (left >= right) {
      // end of line.
      this.queue.splice(left, 0, item);
      this.priorities.splice(left, 0, priority);
      return;
    }

    const n = left + Math.floor((right - left) / 2);
    if (this.priorities[n] > priority) {
      this._putRange(left, n, item, priority);
    } else {
      this._putRange(n + 1, right, item, priority);
    }
  }
}
