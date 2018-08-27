import constants from './../constants.js';
import { fieldsLength } from './utilities.js';

export default class {
  constructor (type) {
    this.type = type;
    this.multi = false;
  }

  read (stream, length, syntax) {
    if (this.fixed && this.maxLength) {
      if (!length) {
        return this.defaultValue;
      }

      if (this.maxLength !== length) {
        console.log(`Invalid length for fixed length tag, vr ${this.type}, length ${this.maxLength} !== ${length}`);
      }
    }

    return this.readBytes(stream, length, syntax);
  }

  readBytes (stream, length) {
    return stream.read(constants.TYPE_ASCII, length);
  }

  readNullPaddedString (stream, length) {
    if (!length) {
      return '';
    }

    let str = stream.read(constants.TYPE_ASCII, length - 1);

    if (stream.read(constants.TYPE_UINT8) !== 0) {
      stream.increment(-1);
      str += stream.read(constants.TYPE_ASCII, 1);
    }

    return str;
  }

  getFields (fields) {
    let valid = true;

    if (this.checkLength) {
      valid = this.checkLength(fields);
    } else if (this.maxCharLength) {
      const check = this.maxCharLength;
      let length = 0;

      fields.forEach((field) => {
        if (typeof field.value === 'string') {
          length += field.value.length;
        }
      });
      valid = length <= check;
    } else if (this.maxLength) {
      const check = this.maxLength;
      const length = fieldsLength(fields);

      valid = length <= check;
    }

    if (!valid) {
      throw new Error('Value exceeds max length');
    }

    // Check for odd
    const length = fieldsLength(fields);

    if (length & 1) {
      fields.push(new HexField(this.padByte));
    }

    for (let i = 0; i < fields.length; i++) {
      if (fields[i].isNumeric() && (fields[i].value === '' || fields[i].value === null)) {
        fields[i] = new StringField('');
      }
    }

    return fields;
  }
}

