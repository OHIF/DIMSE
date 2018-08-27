import C from './../constants.js';

const paddingLeft = (paddingValue, string) => String(paddingValue + string).slice(-paddingValue.length);

const rtrim = (str) => str.replace(/\s*$/g, '');

const ltrim = (str) => str.replace(/^\s*/g, '');

const fieldsLength = (fields) => {
  let length = 0;

  fields.forEach((field) => {
    length += field.length();
  });

  return length;
};

const explicitVRList = ['OB', 'OW', 'OF', 'SQ', 'UC', 'UR', 'UT', 'UN'];
const binaryVRs = ['FL', 'FD', 'SL', 'SS', 'UL', 'US'];

const isString = (type) => {
  if (type === C.TYPE_ASCII || type === C.TYPE_HEX) {
    return true;
  }

  return false;

};

const calcLength = (type, value) => {
  let size = NaN;

  switch (type) {
  case C.TYPE_HEX:
    size = Buffer.byteLength(value, 'hex');
    break;
  case C.TYPE_ASCII:
    size = Buffer.byteLength(value, 'ascii');
    break;
  case C.TYPE_UINT8:
    size = 1;
    break;
  case C.TYPE_UINT16:
    size = 2;
    break;
  case C.TYPE_UINT32:
    size = 4;
    break;
  case C.TYPE_FLOAT:
    size = 4;
    break;
  case C.TYPE_DOUBLE:
    size = 8;
    break;
  case C.TYPE_INT8:
    size = 1;
    break;
  case C.TYPE_INT16:
    size = 2;
    break;
  case C.TYPE_INT32:
    size = 4;
    break;
  default:
    break;
  }

  return size;
};

export {
  paddingLeft,
  rtrim,
  ltrim,
  fieldsLength,
  explicitVRList,
  binaryVRs,
  calcLength,
  isString
};
