import DicomMessage from './dicomMessage.js';
import C from './../constants.js';

export default class extends DicomMessage {
  super (syntax) {
    DicomMessage.call(this, syntax);
    this.type = C.DATA_TYPE_COMMAND;
    this.dataSetPresent = true;
  }

  isResponse () {
    return true;
  }

  respondedTo () {
    return this.getValue(0x00000120);
  }

  isFinal () {
    return this.success() || this.failure() || this.cancel();
  }

  warning () {
    const status = this.getStatus();

    return (status == 0x0001) || (status >> 12 == 0xb);
  }

  success () {
    return this.getStatus() == 0x0000;
  }

  failure () {
    const status = this.getStatus();

    return (status >> 12 == 0xa) || (status >> 12 == 0xc) || (status >> 8 == 0x1);
  }

  cancel () {
    return this.getStatus() == C.STATUS_CANCEL;
  }

  pending () {
    const status = this.getStatus();

    return (status == 0xff00) || (status == 0xff01);
  }

  getStatus () {
    return this.getValue(0x00000900);
  }

  setStatus (status) {
    this.setElement(0x00000900, status);
  }

  // Following four methods only available to C-GET-RSP and C-MOVE-RSP
  getNumOfRemainingSubOperations () {
    return this.getValue(0x00001020);
  }

  getNumOfCompletedSubOperations () {
    return this.getValue(0x00001021);
  }

  getNumOfFailedSubOperations () {
    return this.getValue(0x00001022);
  }

  getNumOfWarningSubOperations () {
    return this.getValue(0x00001023);
  }

  getFields () {
    return this.response(this.super_.prototype.getFields.call(this));
  }
}
