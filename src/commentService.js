const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for documents
let documents = {};
let comments = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle document creation
  socket.on('createDocument', (documentId) => {
    if (!documents[documentId]) {
      documents[documentId] = { text: '', history: [], comments: {} };
    }
    socket.join(documentId);
    socket.emit('documentLoaded', documents[documentId]);
  });

  // Handle document updates
  socket.on('updateDocument', ({ documentId, newText }) => {
    const doc = documents[documentId];
    if (doc) {
      const oldText = doc.text;
      doc.history.push({ oldText, newText });
      doc.text = newText;
      io.to(documentId).emit('documentUpdated', { newText });
    }
  });

  // Handle document deletion
  socket.on('deleteDocument', (documentId) => {
    delete documents[documentId];
    socket.leave(documentId);
  });

  // Handle comment creation
  socket.on('createComment', ({ documentId, commentId, userId, text }) => {
    if (!comments[documentId]) {
      comments[documentId] = {};
    }
    if (!comments[documentId][commentId]) {
      comments[documentId][commentId] = [];
    }
    comments[documentId][commentId].push({ userId, text });
    io.to(documentId).emit('commentCreated', { commentId, userId, text });
  });

  // Handle comment deletion
  socket.on('deleteComment', ({ documentId, commentId, userId }) => {
    if (comments[documentId] && comments[documentId][commentId]) {
      comments[documentId][commentId] = comments[documentId][commentId].filter(comment => comment.userId !== userId);
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

This updated code extends the basic server setup to include support for comments within documents. It maintains an in-memory store of documents and their associated comments. Clients can create and delete comments, and other clients will receive real-time updates about these changes. This provides a foundation for building a collaborative document editor with basic commenting functionality.