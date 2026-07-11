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
    if (!documentsCache[documentId].comments[commentId]) {
      documentsCache[documentId].comments[commentId] = [];
    }
    documentsCache[documentId].comments[commentId].push({ userId, text });
    await db.get(documentId).then(doc => {
      doc.comments = documentsCache[documentId].comments;
      return db.put(doc);
    });
    io.to(documentId).emit('commentCreated', { commentId, userId, text });
  });

  // Handle comment deletion
  socket.on('deleteComment', async ({ documentId, commentId, userId }) => {
    if (documentsCache[documentId].comments[commentId]) {
      documentsCache[documentId].comments[commentId] = documentsCache[documentId].comments[commentId].filter(comment => comment.userId !== userId);
      await db.get(documentId).then(doc => {
        doc.comments = documentsCache[documentId].comments;
        return db.put(doc);
      });
      io.to(documentId).emit('commentDeleted', { commentId, userId });
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
