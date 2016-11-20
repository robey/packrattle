export interface PromiseSetOptions {
  log?: (text: string) => void;
  exceptionHandler?: (error: Error) => void;
}

/*
 * a promise set is like a promise that can be resolved multiple times as
 * new results are added.
 *
 * it starts out with zero values and zero listeners.
 *
 * whenever a new value is posted, it's sent immediately to all listeners.
 * the value set can grow but never shrink.
 *
 * whenever a new listener is attached, it will immediately receive all
 * current values. if a new value is added later, it will receive the new
 * value later.
 *
 * the added value may not be null.
 */
export class PromiseSet<T> {
  // optimize for the case of 1 value and 2 listeners.
  value0?: T;
  values?: T[];
  listener0?: (value: T) => void;
  listener1?: (value: T) => void;
  listeners?: ((value: T) => void)[];

  log?: (text: string) => void;
  exceptionHandler?: (error: Error) => void;

  constructor(options: PromiseSetOptions = {}) {
    this.log = options.log;
    this.exceptionHandler = options.exceptionHandler;
  }

  add(value: T) {
    if (this.value0 === undefined) {
      this.value0 = value;
    } else {
      if (this.values === undefined) this.values = [];
      this.values.push(value);
    }

    if (this.log) this.log(value["inspect"] ? value["inspect"]() : value.toString());

    if (this.listener0 !== undefined) this.listener0(value);
    if (this.listener1 !== undefined) this.listener1(value);
    if (this.listeners !== undefined) this.listeners.forEach(f => f(value));

    return this;
  }

  then(callback: (value: T) => void) {
    const safeCallback = (__value: T) => {
      try {
        callback(__value);
      } catch (error) {
        if (this.exceptionHandler !== undefined) this.exceptionHandler(error);
      }
    };

    if (this.listener0 === undefined) {
      this.listener0 = safeCallback;
    } else if (this.listener1 === undefined) {
      this.listener1 = safeCallback;
    } else {
      if (this.listeners === undefined) this.listeners = [];
      this.listeners.push(safeCallback);
    }

    if (this.value0 !== undefined) safeCallback(this.value0);
    if (this.values !== undefined) this.values.forEach(safeCallback);

    return this;
  }

  get isSettled() {
    return (this.value0 !== undefined || this.values !== undefined);
  }
}
