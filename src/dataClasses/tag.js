import { paddingLeft } from './dataUtilities.js';

export default class {
  constructor (value) {
    this.value = value;
  }
  toString () {
    return `(${paddingLeft('0000', this.group().toString(16))},${
      paddingLeft('0000', this.element().toString(16))})`;
  }

  is (t) {
    return this.value === t;
  }

  group () {
    return this.value >>> 16;
  }

  element () {
    return this.value & 0xffff;
  }

  isPixelDataTag () {
    return this.is(0x7fe00010);
  }
}

