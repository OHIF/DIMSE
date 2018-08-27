import C from './../constants.js';
import DataElement from './../dataClasses/dataElement.js';
import {
  elementByType,
  elementKeywordByTag
} from './../dataClasses/findByTag.js';

export default class {
  constructor (syntax) {
    this.syntax = syntax ? syntax : null;
    this.type = C.DATA_TYPE_COMMAND;
    this.messageId = C.DEFAULT_MESSAGE_ID;
    this.elementPairs = {};
  }

  isCommand () {
    return this.type == C.DATA_TYPE_COMMAND;
  }

  setSyntax (syntax) {
    this.syntax = syntax;

    for (const tag in this.elementPairs) {
      this.elementPairs[tag].setSyntax(this.syntax);
    }
  }

  setMessageId (id) {
    this.messageId = id;
  }

  setReplyMessageId (id) {
    this.replyMessageId = id;
  }

  command (cmds) {
    cmds.unshift(this.newElement(0x00000800, this.dataSetPresent ? C.DATA_SET_PRESENT : C.DATE_SET_ABSENCE));
    cmds.unshift(this.newElement(0x00000700, this.priority));
    cmds.unshift(this.newElement(0x00000110, this.messageId));
    cmds.unshift(this.newElement(0x00000100, this.commandType));
    cmds.unshift(this.newElement(0x00000002, this.contextUID));

    let length = 0;

    cmds.forEach((cmd) => {
      length += cmd.length(cmd.getFields());
    });

    cmds.unshift(this.newElement(0x00000000, length));

    return cmds;
  }

  response (cmds) {
    cmds.unshift(this.newElement(0x00000800, this.dataSetPresent ? C.DATA_SET_PRESENT : C.DATE_SET_ABSENCE));
    cmds.unshift(this.newElement(0x00000120, this.replyMessageId));
    cmds.unshift(this.newElement(0x00000100, this.commandType));
    if (this.contextUID) {
      cmds.unshift(this.newElement(0x00000002, this.contextUID));
    }

    let length = 0;

    cmds.forEach((cmd) => {
      length += cmd.length(cmd.getFields());
    });

    cmds.unshift(this.newElement(0x00000000, length));

    return cmds;
  }

  setElements (pairs) {
    const p = {};

    for (const tag in pairs) {
      p[tag] = this.newElement(tag, pairs[tag]);
    }

    this.elementPairs = p;
  }

  newElement (tag, value) {
    elementByType(tag, value, this.syntax);
  }

  setElement (key, value) {
    this.elementPairs[key] = elementByType(key, value);
  }

  setElementPairs (pairs) {
    this.elementPairs = pairs;
  }

  setContextId (context) {
    this.contextUID = context;
  }

  setPriority (pri) {
    this.priority = pri;
  }

  setType (type) {
    this.type = type;
  }

  setDataSetPresent (present) {
    this.dataSetPresent = present != 0x0101;
  }

  haveData () {
    return this.dataSetPresent;
  }

  tags () {
    return Object.keys(this.elementPairs);
  }

  key (tag) {
    return elementKeywordByTag(tag);
  }

  getValue (tag) {
    return this.elementPairs[tag] ? this.elementPairs[tag].getValue() : null;
  }

  affectedSOPClassUID () {
    return this.getValue(0x00000002);
  }

  getMessageId () {
    return this.getValue(0x00000110);
  }

  getFields () {
    const eles = [];

    for (const tag in this.elementPairs) {
      eles.push(this.elementPairs[tag]);
    }

    return eles;
  }

  length (elems) {
    let len = 0;

    elems.forEach((elem) => {
      len += elem.length(elem.getFields());
    });

    return len;
  }

  isResponse () { 
    return false; 
  }

  is (type) { 
    return this.commandType == type; 
  }

  write (stream) {
    const fields = this.getFields();
    const self = this;

    fields.forEach((field) => {
      field.setSyntax(self.syntax);
      field.write(stream);
    });
  }

  printElements (pairs, indent) {
    let typeName = '';

    for (const tag in pairs) {
      const value = pairs[tag].getValue();

      typeName += `${(' '.repeat(indent)) + this.key(tag)} : `;
      if (value instanceof Array) {
        const self = this;

        value.forEach((p) => {
          if (typeof p === 'object') {
            typeName += `[\n${self.printElements(p, indent + 2)}${' '.repeat(indent)}]`;
          } else {
            typeName += `[${p}]`;
          }
        });
        if (typeName[typeName.length - 1] != '\n') {
          typeName += '\n';
        }
      } else {
        typeName += `${value}\n`;
      }
    }

    return typeName;
  }

  typeString () {
    let typeName = '';

    if (this.isCommand()) {
      switch (this.commandType) {
      case C.COMMAND_C_GET_RSP:
        typeName = 'C-GET-RSP';
        break;
      case C.COMMAND_C_MOVE_RSP:
        typeName = 'C-MOVE-RSP';
        break;
      case C.COMMAND_C_GET_RQ:
        typeName = 'C-GET-RQ';
        break;
      case C.COMMAND_C_STORE_RQ:
        typeName = 'C-STORE-RQ';
        break;
      case C.COMMAND_C_FIND_RSP:
        typeName = 'C-FIND-RSP';
        break;
      case C.COMMAND_C_MOVE_RQ:
        typeName = 'C-MOVE-RQ';
        break;
      case C.COMMAND_C_FIND_RQ:
        typeName = 'C-FIND-RQ';
        break;
      case C.COMMAND_C_STORE_RSP:
        typeName = 'C-STORE-RSP';
        break;
      }
    } else {
      typeName = 'DateSet Message';
    }

    return typeName;
  }

  toString () {
    let typeName = this.typeString();

    typeName += ' [\n';
    typeName += this.printElements(this.elementPairs, 0);
    typeName += ']';

    return typeName;
  }

  walkObject (pairs) {
    const obj = {};
    const self = this;

    for (const tag in pairs) {
      const v = pairs[tag].getValue();
      let u = v;

      if (v instanceof Array) {
        u = [];
        v.forEach((a) => {
          if (typeof a === 'object') {
            u.push(self.walkObject(a));
          } else {
            u.push(a);
          }
        });
      }

      obj[tag] = u;
    }

    return obj;
  }

  toObject () {
    return this.walkObject(this.elementPairs);
  }

  readToPairs (stream, syntax, options) {
    const pairs = {};

    while (!stream.end()) {
      const elem = new DataElement();

      if (options) {
        elem.setOptions(options);
      }

      elem.setSyntax(syntax);
      elem.readBytes(stream);
      pairs[elem.tag.value] = elem;
    }

    return pairs;
  }
}
