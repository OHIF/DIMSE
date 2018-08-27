import C from './../constants.js';
import Tag from './tag.js';
import vrByType from './vrByType.js';
import {
  explicitVRList,
  binaryVRs,
  fieldsLength } from './dataUtilities.js';
import { elementDataByTag } from './findByTag.js';

export default class {
  constructor (tag, vr, vm, value, vvr, syntax, options) {
    this.vr = vr ? vrByType(vr) : null;
    this.tag = vvr ? tag : new Tag(tag);
    this.value = value;
    this.vm = vm;
    this.vvr = Boolean(vvr);
    this.setOptions(options);
    this.setSyntax(syntax ? syntax : C.IMPLICIT_LITTLE_ENDIAN);
  }

  setOptions (options) {
    this.options = Object.assign({
      split: true
    }, options);
  }

  setSyntax (syn) {
    this.syntax = syn;
    this.implicit = this.syntax === C.IMPLICIT_LITTLE_ENDIAN;
    this.endian = (this.syntax === C.IMPLICIT_LITTLE_ENDIAN || this.syntax === C.EXPLICIT_LITTLE_ENDIAN) ? C.LITTLE_ENDIAN : C.BIG_ENDIAN;
  }

  getValue () {
    if (!this.singleValue() && !this.isBinaryNumber()) {
      return this.options.split ? this.value.split(String.fromCharCode(0x5c)) : this.value;
    }

    return this.value;

  }

  singleValue () {
    return this.vm === C.VM_SINGLE;
  }

  getVMNum () {
    let num = 1;

    switch (this.vm) {
    case C.VM_SINGLE:
      num = 1;
      break;
    case C.VM_TWO:
      num = 2;
      break;
    case C.VM_THREE :
      num = 3;
      break;
    case C.VM_FOUR :
      num = 4;
      break;
    case C.VM_16 :
      num = 16;
      break;
    default : break;
    }

    return num;
  }

  isBinaryNumber () {
    return binaryVRs.indexOf(this.vr.type) !== -1;
  }

  length (fields) {
    // Let fields = this.vr.getFields(this.value);
    return fieldsLength(fields);
  }

  readBytes (stream) {
    const oldEndian = stream.endian;

    stream.setEndian(this.endian);

    const group = stream.read(C.TYPE_UINT16);
    const element = stream.read(C.TYPE_UINT16);
    const tag = tagFromNumbers(group, element);

    let length = null;
    let vr = null;
    let edata;
    let vm;

    try {
      edata = elementDataByTag(tag.value);
      vm = edata.vm;
    } catch (ex) {
      edata = null;
      vm = null;
    }

    if (this.implicit) {
      length = stream.read(C.TYPE_UINT32);
      if (edata) {
        vr = edata.vr;
      } else {
        if (length == 0xffffffff) {
          vr = 'SQ';
        } else if (tag.isPixelDataTag()) {
          vr = 'OW';
        }
        vr = 'UN';
      }
    } else {
      vr = stream.read(C.TYPE_ASCII, 2);
      if (explicitVRList.indexOf(vr) !== -1) {
        stream.increment(2);
        length = stream.read(C.TYPE_UINT32);
      } else {
        length = stream.read(C.TYPE_UINT16);
      }
    }

    this.vr = vrByType(vr);
    this.tag = tag;
    this.vm = vm;
    // Try {
    if (this.isBinaryNumber() && length > this.vr.maxLength) {
      const times = length / this.vr.maxLength;
      let  i = 0;

      this.value = [];// Console.log(times, length, this.vr.maxLength);return;
      // Try {
      while (i++ < times) {
        this.value.push(this.vr.read(stream, this.vr.maxLength));
      }
      // } catch (e) {  }
    } else {
      this.value = this.vr.read(stream, length, this.syntax);
    }
    // } catch (e) { console.log('error', vr, length); }

    stream.setEndian(oldEndian);
  }

  write (stream) {
    const oldEndian = stream.endian;

    stream.setEndian(this.endian);

    const fields = this.getFields();

    fields.forEach(function (field) {
      field.write(stream);
    });

    stream.setEndian(oldEndian);
  }

  getFields () {
    let fields = [new UInt16Field(this.tag.group()), new UInt16Field(this.tag.element())];
    const valueFields = this.vr.getFields(this.value, this.syntax);
    let valueLength = fieldsLength(valueFields);
    const vrType = this.vr.type;

    if (vrType === 'SQ') {
      valueLength = 0xffffffff;
    }

    if (this.implicit) {
      fields.push(new UInt32Field(valueLength));
    } else if (explicitVRList.indexOf(vrType) !== -1) {
      fields.push(new StringField(vrType), new ReservedField(2), new UInt32Field(valueLength));
    } else {
      fields.push(new StringField(vrType), new UInt16Field(valueLength));
    }

    fields = fields.concat(valueFields);

    return fields;
  }
}

