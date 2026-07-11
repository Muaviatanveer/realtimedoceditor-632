const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for documents
let documents = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle document creation
  socket.on('createDocument', (documentId) => {
    if (!documents[documentId]) {
      documents[documentId] = { text: '', history: [] };
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

This code sets up a basic Express server with Socket.IO to handle real-time communication between clients. It includes endpoints for creating, updating, and deleting documents in memory. The server maintains a simple in-memory store of documents, each represented by its ID and current text content.

To extend this into a full-fledged collaborative document editor, you would need to implement additional features such as:

1. **Operational Transforms/CRDTs**: To ensure consistency across multiple clients during concurrent edits.
2. **Comments**: A system for users to add, edit, and delete comments within the document.
3. **Version History**: Keeping track of previous versions of the document for rollback or review purposes.
4. **Offline Editing**: Allowing users to edit documents even when they are not connected to the internet.
5. **Conflict Resolution**: Handling situations where multiple clients make conflicting changes simultaneously.

These features would require more complex state management, possibly involving databases, distributed systems, and advanced algorithms for handling conflicts.