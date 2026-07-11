import express from 'express';
import http from 'http';
import socketIo from 'socket.io';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import crdtLib from 'crdt-lib';
import PouchDB from 'pouchdb';

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// Database setup
const db = new PouchDB('documents');

// In-memory cache for documents
let documents = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle document creation
  socket.on('createDocument', async () => {
    const documentId = uuidv4();
    const initialDoc = { _id: documentId, text: '', history: [], crdtState: {} };
    await db.put(initialDoc);
    documents[documentId] = { ...initialDoc, crdtState: crdtLib.create() };
    socket.join(documentId);
    socket.emit('documentLoaded', documents[documentId]);
  });

  // Handle document updates
  socket.on('updateDocument', async ({ documentId, newText }) => {
    const doc = documents[documentId];
    if (doc) {
      const oldText = doc.text;
      const crdtState = doc.crdtState;
      const [newCrdtState, ops] = crdtLib.apply(crdtState, newText);
      const updatedDoc = { ...doc, text: newText, crdtState: newCrdtState };
      await db.put(updatedDoc);
      documents[documentId] = updatedDoc;
      io.to(documentId).emit('documentUpdated', { newText, ops });
    }
  });

  // Handle document deletion
  socket.on('deleteDocument', async (documentId) => {
    const doc = documents[documentId];
    if (doc) {
      await db.remove(doc);
      delete documents[documentId];
      socket.leave(documentId);
    }
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

This code extends the basic Express server with Socket.IO to handle real-time communication between clients. It includes endpoints for creating, updating, and deleting documents using CRDTs for operational transforms. The server maintains a simple in-memory cache of documents, each represented by its ID, current text content, and CRDT state. Changes are persisted to a PouchDB database for persistence and conflict resolution.