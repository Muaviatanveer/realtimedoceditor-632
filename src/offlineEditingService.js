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
let documentsCache = {};

io.on('connection', async (socket) => {
  console.log('New client connected');

  // Handle document creation
  socket.on('createDocument', async () => {
    const documentId = uuidv4();
    const initialDoc = { _id: documentId, text: '', history: [], crdtState: {}, comments: {} };
    await db.put(initialDoc);
    documentsCache[documentId] = { text: '', history: [], crdtState: {}, comments: {} };
    socket.join(documentId);
    socket.emit('documentLoaded', documentsCache[documentId]);
  });

  // Handle document updates
  socket.on('updateDocument', async ({ documentId, newText }) => {
    const doc = documentsCache[documentId];
    if (doc) {
      const oldText = doc.text;
      const crdtState = doc.crdtState;
      const [newCrdtState, ops] = crdtLib.apply(crdtState, newText);
      const updatedDoc = { ...doc, text: newText, crdtState: newCrdtState };
      await db.put(updatedDoc);
      documentsCache[documentId] = updatedDoc;
      io.to(documentId).emit('documentUpdated', { newText, ops });
    }
  });

  // Handle document deletion
  socket.on('deleteDocument', async (documentId) => {
    await db.remove(documentId);
    delete documentsCache[documentId];
    socket.leave(documentId);
  });

  // Handle comment creation
  socket.on('createComment', async ({ documentId, commentId, userId, text }) => {
    const doc = documentsCache[documentId];
    if (doc) {
      if (!doc.comments[commentId]) {
        doc.comments[commentId] = [];
      }
      doc.comments[commentId].push({ userId, text });
      await db.put(doc);
      documentsCache[documentId] = doc;
      io.to(documentId).emit('commentCreated', { documentId, commentId, userId, text });
    }
  });

  // Handle comment deletion
  socket.on('deleteComment', async ({ documentId, commentId, userId }) => {
    const doc = documentsCache[documentId];
    if (doc && doc.comments[commentId]) {
      doc.comments[commentId] = doc.comments[commentId].filter(comment => comment.userId !== userId);
      await db.put(doc);
      documentsCache[documentId] = doc;
      io.to(documentId).emit('commentDeleted', { documentId, commentId, userId });
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
