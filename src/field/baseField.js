import { calcLength } from './../dataClasses/dataUtilities.js';

export default class {
  constructor (type, value) {
    this.type = type;
    this.value = value;
  }

  length () {
    return calcLength(this.type, this.value);
  }

  write (stream) {
    stream.write(this.type, this.value);
  }

  isNumeric () {
    return false;
  }
}
