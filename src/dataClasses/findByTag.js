import DataElement from './dataElement.js';
import { dicomNDict } from './../elements_data.js';

const elementByType = (type, value, syntax) => {
  let elem = null;
  const nk = dicomNDict[type];

  if (nk) {
    if (nk.vr === 'SQ') {
      const sq = [];

      if (value) {
        value.forEach(function (el) {
          const values = [];

          for (const tag in el) {
            values.push(elementByType(tag, el[tag], syntax));
          }

          sq.push(values);
        });
      }
      elem = new DataElement(type, nk.vr, nk.vm, sq, false, syntax);
    } else {
      elem = new DataElement(type, nk.vr, nk.vm, value, false, syntax);
    }
  } else {
    throw new Error('Unrecognized element type');
  }

  return elem;
};

const elementDataByTag = (tag) => {
  const nk = dicomNDict[tag];

  if (nk) {
    return nk;
  }

  throw new Error(`Unrecognized tag ${(tag >>> 0).toString(16)}`);
};

const elementKeywordByTag = (tag) => {
  try {
    const nk = elementDataByTag(tag);

    return nk.keyword;
  } catch (ex) {
    return 'UnknownTag';
  }
};

export {
  elementByType,
  elementDataByTag,
  elementKeywordByTag
};
