/*
 * a promise set is like a promise that can be resolved multiple times as
 * new results are added.
 *
 * it starts out with zero values and zero listeners.
 *
 * whenever a new value is posted, it's sent immediately to all listeners.
 * the value set can grow but never shrink; values must implement "equals()"
 * and redundant values will not be added.
 *
 * whenever a new listener is attached, it will immediately receive all current
 * values. if a new value is added later, it will receive the new value later.
 */
class PromiseSet {
  constructor(options = {}) {
    // optimize for the case of 1 value or 1 listener.
    this.value0 = null;
    this.values = null;
    this.listener0 = null;
    this.listeners = null;
    this.debugger = options.debugger;
  }

  add(value) {
    if (!this.value0) {
      this.value0 = value;
    } else {
      if (!this.values) this.values = [];
      if (this.value0 == value || (this.value0.equals && this.value0.equals(value))) return;
      // babel bug: "for (let v of this.values)" causes it to try to refer to Symbol, which it fails to define.
      for (let i = 0; i < this.values.length; i++) {
        const v = this.values[i];
        if (v == value || (v.equals && v.equals(value))) return;
      }
      this.values.push(value);
    }

    if (this.debugger) this.debugger(value.toString());

    if (this.listener0) this.listener0(value);
    if (this.listeners) this.listeners.forEach(f => f(value));

    return this;
  }

  then(callback) {
    if (!this.listener0) {
      this.listener0 = callback;
    } else {
      if (!this.listeners) this.listeners = [];
      this.listeners.push(callback);
    }

    if (this.value0) callback(this.value0);
    if (this.values) this.values.forEach(callback);

    return this;
  }
}


exports.PromiseSet = PromiseSet;
