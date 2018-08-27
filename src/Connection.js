import _ from 'lodash';
import net from 'net';
import { EventEmitter } from 'events';
import CSocket from './CSocket.js';
import C from './constants.js';
import PDU from './PDU.js';
import DicomMessage from './Message.js';

class StoreHandle extends EventEmitter {
  super () {
    EventEmitter.call(this);
  }
}

class Connection extends EventEmitter {
  super (options) {
    EventEmitter.call(this);
    this.options = Object.assign({
      maxPackageSize: C.DEFAULT_MAX_PACKAGE_SIZE,
      idle: false,
      reconnect: true,
      vr: {
        split: true
      }
    }, options);

    this.reset();
  }

  reset () {
    this.defaultPeer = null;
    this.defaultServer = null;

    _.each(this.peers, (peerInfo) => {
      _.each(peerInfo.sockets, (socket) => socket.emit('close'));
    });

    this.peers = {};
  }

  addPeer (options) {
    if (!options.aeTitle || !options.host || !options.port) {
      return false;
    }

    const peer = {
      host: options.host,
      port: options.port,
      sockets: {}
    };

    this.peers[options.aeTitle] = peer;
    if (options.default) {
      if (options.server) {
        this.defaultServer = options.aeTitle;
      } else {
        this.defaultPeer = options.aeTitle;
      }
    }

    if (options.server) {
    // Start listening
      peer.server = net.createServer();
      peer.server.listen(options.port, options.host, () => {
        console.info('listening on', this.address());
      });
      peer.server.on('error', (err) => {
        console.info('server error', err);
      });
      peer.server.on('connection', (nativeSocket) => {
      // Incoming connections
        const socket = new CSocket(nativeSocket, this.options);

        this.addSocket(options.aeTitle, socket);

        // Close server on close socket
        socket.on('close', function () {
          peer.server.close();
        });
      });
    }
  }

  selectPeer (aeTitle) {
    if (!aeTitle || !this.peers[aeTitle]) {
      throw new Error('No such peer');
    }

    return this.peers[aeTitle];
  }

  _sendFile (socket, sHandle, file, maxSend, metaLength, list) {
    const fileNameText = typeof file.file === 'string' ? file.file : 'buffer';
    const self = this;

    console.info(`Sending file ${fileNameText}`);
    const useContext = socket.getContextByUID(file.context);

    PDU.generatePDatas(useContext.id, file.file, maxSend, null, metaLength, (err, handle) => {
      if (err) {
        console.info('Error while sending file');

        return;
      }

      const processNext = () => {
        const next = list.shift();

        if (next) {
          self._sendFile(socket, sHandle, next, maxSend, metaLength, list);
        } else {
          socket.release();
        }
      };

      const store = socket.storeInstance(useContext.abstractSyntax, file.uid);

      handle.on('pdv', (pdv) => {
        socket.sendPData(pdv);
      });
      handle.on('error', (err) => {
        sHandle.emit('file', err, fileNameText);
        processNext();
      });
      store.on('response', (msg) => {
        const statusText = msg.getStatus().toString(16);

        console.info('STORE reponse with status', statusText);
        let error = null;

        if (msg.failure()) {
          error = new Error(statusText);
        }

        sHandle.emit('file', error, fileNameText);
        processNext();
      });
    });
  }

  storeInstances (fileList) {
    const contexts = {};
    let read = 0;
    const length = fileList.length;
    const toSend = [];
    const self = this;
    const handle = new StoreHandle();
    let lastProcessedMetaLength;

    fileList.forEach((bufferOrFile) => {
      const fileNameText = typeof bufferOrFile === 'string' ? bufferOrFile : 'buffer';

      DicomMessage.readMetaHeader(bufferOrFile, (err, metaMessage, metaLength) => {
        read++;
        if (err) {
          handle.emit('file', err, fileNameText);
          if (read === length && toSend.length > 0 && lastProcessedMetaLength) {
            this._sendProcessedFiles(self, contexts, toSend, handle, lastProcessedMetaLength);
          }

          return;
        }

        console.info(`Dicom file ${(typeof bufferOrFile === 'string' ? bufferOrFile : 'buffer')} found`);
        lastProcessedMetaLength = metaLength;
        const syntax = metaMessage.getValue(0x00020010);
        const sopClassUID = metaMessage.getValue(0x00020002);
        const instanceUID = metaMessage.getValue(0x00020003);

        if (!contexts[sopClassUID]) {
          contexts[sopClassUID] = [];
        }

        if (syntax && contexts[sopClassUID].indexOf(syntax) === -1) {
          contexts[sopClassUID].push(syntax);
        }

        toSend.push({
          file: bufferOrFile,
          context: sopClassUID,
          uid: instanceUID
        });

        if (read === length) {
          this._sendProcessedFiles(self, contexts, toSend, handle, metaLength);
        }
      });
    });

    return handle;
  }

  storeResponse (messageId, msg) {
    const rq = this.messages[messageId];

    if (rq.listener[2]) {
      const status = rq.listener[2].call(this, msg);

      if (status !== undefined && status !== null && rq.command.store) {
        // Store ok, ready to send c-store-rsp
        const storeSr = rq.command.store;
        const replyMessage = storeSr.replyWith(status);

        replyMessage.setAffectedSOPInstanceUID(this.lastCommand.getSOPInstanceUID());
        replyMessage.setReplyMessageId(this.lastCommand.messageId);
        this.sendMessage(replyMessage, null, null, storeSr);
      } else {
        throw new Error('Missing store status');
      }
    }
  }

  allClosed () {
    let allClosed = true;

    for (const i in this.peers) {
      if (Object.keys(this.peers[i].sockets).length > 0) {
        allClosed = false;
        break;
      }
    }

    return allClosed;
  }

  addSocket (hostAE, socket) {
    const peerInfo = this.selectPeer(hostAE);

    peerInfo.sockets[socket.id] = socket;

    socket.on('close', () => {
      if (peerInfo.sockets[this.id]) {
        delete peerInfo.sockets[this.id];
      }
    });
  }

  associate (options, callback) {
    const hostAE = options.hostAE ? options.hostAE : this.defaultPeer;
    const sourceAE = options.sourceAE ? options.sourceAE : this.defaultServer;

    if (!hostAE || !sourceAE) {
      throw new Error('Peers not provided or no defaults in settings');
    }

    const peerInfo = this.selectPeer(hostAE);
    const nativeSocket = new net.Socket();

    const socket = new CSocket(nativeSocket, this.options);

    if (callback) {
      socket.once('associated', callback);
    }

    console.info('Starting Connection...');

    socket.setCalledAe(hostAE);
    socket.setCallingAE(sourceAE);

    nativeSocket.connect({
      host: peerInfo.host,
      port: peerInfo.port
    }, () => {
      // Connected
      this.addSocket(hostAE, socket);

      if (options.contexts) {
        socket.setPresentationContexts(options.contexts);
      } else {
        throw new Error('Contexts must be specified');
      }

      socket.associate();
    });

    return socket;
  }

  // Starts to send dcm files
  _sendProcessedFiles (connection, contexts, toSend, handle, metaLength) {
    const useContexts = [];

    _.each(contexts, (useSyntaxes, context) => {
      if (useSyntaxes.length > 0) {
        useContexts.push({
          context,
          syntaxes: useSyntaxes
        });
      } else {
        throw new Error(`No syntax specified for context ${context}`);
      }
    });

    connection.associate({
      contexts: useContexts
    }, (ac) => {
      const maxSend = ac.getMaxSize();
      const next = toSend.shift();

      connection._sendFile(this, handle, next, maxSend, metaLength, toSend);
    });
  }
}

export default Connection;
