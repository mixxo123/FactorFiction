const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Health check route for Render.com
app.get("/", (req, res) => {
  res.send("Fact or Fiction Backend Working! 🎉 Skapad av Mixo");
});

// In-memory game state
let rooms = {};

function getRoomPlayers(room) {
  return rooms[room]?.players || [];
}

function getNextSubmitter(room) {
  const players = getRoomPlayers(room);
  if (!players.length) return null;
  const idx = rooms[room].lastSubmitterIndex ?? -1;
  return players[(idx + 1) % players.length];
}

function resetTimer(room, seconds = 30) {
  // Clear existing timer
  clearTimeout(rooms[room]?.timer);
  clearInterval(rooms[room]?.timerInterval);
  
  // Set initial timer state
  rooms[room].timerSeconds = seconds;
  io.to(room).emit('timer', rooms[room].timerSeconds);
  
  // Start countdown
  rooms[room].timerInterval = setInterval(() => {
    rooms[room].timerSeconds--;
    io.to(room).emit('timer', rooms[room].timerSeconds);
    
    if (rooms[room].timerSeconds <= 0) {
      clearInterval(rooms[room].timerInterval);
      io.to(room).emit('timer', 0);
      io.to(room).emit('round-timeout');
      
      // Set timeout to start next round
      rooms[room].timer = setTimeout(() => {
        if (rooms[room] && rooms[room].players.length > 0) {
          startNextRound(room);
        }
      }, 2000);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  // Check if a room exists
  socket.on('check-room', (room) => {
    socket.emit('room-check-result', rooms[room] ? true : false);
  });

  socket.on('join-room', ({ room, username, gameMode = 'classic' }) => {
    socket.join(room);
    
    // Create room if it doesn't exist
    if (!rooms[room]) {
      rooms[room] = { 
        players: [], 
        facts: [], 
        chat: [], 
        lastSubmitterIndex: -1, 
        timer: null, 
        timerInterval: null,
        timerSeconds: 0,
        gameMode: gameMode
      };
    }
    
    // Add player if not already in the room
    if (!rooms[room].players.find(p => p.id === socket.id)) {
      rooms[room].players.push({ id: socket.id, name: username, score: 0 });
    }
    
    // Update room mode if it's a new room or empty
    if (rooms[room].players.length === 1) {
      rooms[room].gameMode = gameMode;
    }
    
    io.to(room).emit('update-players', rooms[room].players);
    io.to(socket.id).emit('chat-history', rooms[room].chat);

    // If first player, auto-start round
    if (rooms[room].players.length === 1) {
      startNextRound(room);
    }
  });

  socket.on('submit-fact', ({ room, fact, isTrue, username }) => {
    // Only allow submitter to submit!
    const submitter = getNextSubmitter(room);
    if (!submitter || submitter.id !== socket.id) return;
    
    rooms[room].facts.push({ fact, isTrue, submittedBy: socket.id, username, votes: [] });
    io.to(room).emit('new-fact', { fact, username });
    
    // Clear current timer and start voting timer
    clearInterval(rooms[room].timerInterval);
    clearTimeout(rooms[room].timer);
    
    // Set timer based on game mode
    const timerDuration = rooms[room].gameMode === 'rapid' ? 15 : 30;
    rooms[room].timerSeconds = timerDuration;
    io.to(room).emit('timer', rooms[room].timerSeconds);
    
    // Start new timer for voting
    resetTimer(room, timerDuration);
  });

  socket.on('vote-fact', ({ room, vote }) => {
    const facts = rooms[room]?.facts;
    if (!facts || facts.length === 0) return;
    
    const lastFact = facts[facts.length - 1];
    // Prevent submitter from voting
    if (lastFact.submittedBy === socket.id) return;
    // Prevent duplicate votes
    if (lastFact.votes.find(v => v.voter === socket.id)) return;
    
    lastFact.votes.push({ voter: socket.id, vote });
    
    // Check if all players have voted
    if (lastFact.votes.length === rooms[room].players.length - 1) {
      clearInterval(rooms[room].timerInterval);
      clearTimeout(rooms[room].timer);
      finishRound(room, lastFact);
    }
  });

  socket.on('chat', ({ room, username, text }) => {
    const msg = { username, text, ts: Date.now() };
    rooms[room].chat.push(msg);
    if (rooms[room].chat.length > 64) rooms[room].chat.shift();
    io.to(room).emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(room => {
      if (!rooms[room]) return;
      
      rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);
      io.to(room).emit('update-players', rooms[room].players);
      
      if (rooms[room].players.length === 0) {
        clearInterval(rooms[room].timerInterval);
        clearTimeout(rooms[room].timer);
        delete rooms[room];
      }
    });
  });

  socket.on('start-next-round', (room) => {
    startNextRound(room);
  });

  socket.on('round-timeout', (room) => {
    const facts = rooms[room]?.facts;
    if (!facts) return;
    const lastFact = facts[facts.length - 1];
    finishRound(room, lastFact, true); // force finish
  });
});

function startNextRound(room) {
  if (!rooms[room] || !rooms[room].players || rooms[room].players.length === 0) return;
  
  rooms[room].lastSubmitterIndex = (rooms[room].lastSubmitterIndex + 1) % rooms[room].players.length;
  const submitter = rooms[room].players[rooms[room].lastSubmitterIndex];
  io.to(room).emit('round-start', { submitterId: submitter.id, submitterName: submitter.name });
  
  // Set timer based on game mode
  const timerDuration = rooms[room].gameMode === 'rapid' ? 15 : 30;
  resetTimer(room, timerDuration);
}

function finishRound(room, lastFact, timeout = false) {
  if (!rooms[room]) return;
  
  const gameMode = rooms[room].gameMode;
  let correctCount = 0;
  
  (lastFact.votes || []).forEach(voteObj => {
    if (voteObj.vote === lastFact.isTrue) {
      const player = rooms[room].players.find(p => p.id === voteObj.voter);
      if (player) {
        // Award points based on game mode
        if (gameMode === 'expert') {
          player.score += 2; // More points in expert mode
        } else {
          player.score += 1;
        }
      }
      correctCount++;
    }
  });
  
  // Award submitter points for fooling others
  if (correctCount < rooms[room].players.length - 1 && !timeout) {
    const submitter = rooms[room].players.find(p => p.id === lastFact.submittedBy);
    if (submitter) {
      // More points for fooling in expert mode
      if (gameMode === 'expert') {
        submitter.score += (rooms[room].players.length - 1 - correctCount);
      } else {
        submitter.score += 1;
      }
    }
  }
  
  io.to(room).emit('reveal-fact', {
    fact: lastFact.fact,
    isTrue: lastFact.isTrue,
    votes: lastFact.votes,
    players: rooms[room].players,
    timeout
  });
  
  setTimeout(() => {
    if (rooms[room] && rooms[room].players.length > 0) {
      startNextRound(room);
    }
  }, 5000);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`   Fact or Fiction Server Running on Port ${PORT}!`);
  console.log(`   Created by Mixo`);
  console.log(`   Open http://localhost:3000 in your browser to play`);
  console.log(`======================================================\n`);
});