const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const crdtLib = require('crdt-lib');
const pouchdb = require('pouchdb');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// Database setup
const db = new pouchdb('documents');

// In-memory cache for documents
let documentsCache = {};

io.on('connection', async (socket) => {
  console.log('New client connected');

  // Handle document creation
  socket.on('createDocument', async () => {
    const documentId = uuidv4();
    const initialDoc = { _id: documentId, text: '', history: [], crdtState: {} };
    await db.put(initialDoc);
    documentsCache[documentId] = { text: '', history: [], crdtState: {} };
    socket.join(documentId);
    socket.emit('documentLoaded', documentsCache[documentId]);
  });

  // Handle document updates
  socket.on('updateDocument', async ({ documentId, newText }) => {
    const doc = documentsCache[documentId];
    if (doc) {
      const oldText = doc.text;
      const crdtState = crdtLib.apply(doc.crdtState, newText);
      const updatedDoc = { ...doc, text: newText, crdtState };
      await db.put(updatedDoc);
      documentsCache[documentId] = updatedDoc;
      io.to(documentId).emit('documentUpdated', { newText });
    }
  });

  // Handle document deletion
  socket.on('deleteDocument', async (documentId) => {
    await db.remove(documentId);
    delete documentsCache[documentId];
    socket.leave(documentId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

This code extends the basic Express server with Socket.IO to handle real-time communication between clients. It includes endpoints for creating, updating, and deleting documents using PouchDB for database operations and CRDT-Lib for operational transforms/CRDTs to ensure consistency across multiple clients during concurrent edits. The server maintains a simple in-memory cache of documents, each represented by its ID, current text content, and CRDT state. This setup provides a foundation for building a collaborative document editor with real-time synchronization and operational transforms.