import DicomMessage from './dicomMessage.js';
import C from './../constants.js';

export default class extends DicomMessage {
  construtor (syntax) {
    super(syntax);
    this.type = C.DATA_TYPE_COMMAND;
    this.priority = C.PRIORITY_MEDIUM;
    this.dataSetPresent = true;
  }

  getFields () {
    return this.command(super.getFields.call(this));
  }
}
