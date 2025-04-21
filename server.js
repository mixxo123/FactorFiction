const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

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
  clearTimeout(rooms[room]?.timer);
  rooms[room].timerSeconds = seconds;
  rooms[room].timer = setInterval(() => {
    rooms[room].timerSeconds--;
    io.to(room).emit('timer', rooms[room].timerSeconds);
    if (rooms[room].timerSeconds <= 0) {
      clearInterval(rooms[room].timer);
      io.to(room).emit('timer', 0);
      io.to(room).emit('round-timeout');
    }
  }, 1000);
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ room, username }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = { players: [], facts: [], chat: [], lastSubmitterIndex: -1, timer: null, timerSeconds: 0 };
    if (!rooms[room].players.find(p => p.id === socket.id)) {
      rooms[room].players.push({ id: socket.id, name: username, score: 0 });
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
    clearInterval(rooms[room].timer);
    rooms[room].timerSeconds = 30;
    io.to(room).emit('timer', rooms[room].timerSeconds);
  });

  socket.on('vote-fact', ({ room, vote }) => {
    const facts = rooms[room]?.facts;
    if (!facts || facts.length === 0) return;
    const lastFact = facts[facts.length - 1];
    // Prevent submitter from voting
    if (lastFact.submittedBy === socket.id) return;
    if (lastFact.votes.find(v => v.voter === socket.id)) return;
    lastFact.votes.push({ voter: socket.id, vote });
    if (lastFact.votes.length === rooms[room].players.length - 1) {
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
      rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);
      io.to(room).emit('update-players', rooms[room].players);
      if (rooms[room].players.length === 0) {
        clearInterval(rooms[room].timer);
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
  rooms[room].lastSubmitterIndex = (rooms[room].lastSubmitterIndex + 1) % rooms[room].players.length;
  const submitter = rooms[room].players[rooms[room].lastSubmitterIndex];
  io.to(room).emit('round-start', { submitterId: submitter.id, submitterName: submitter.name });
  resetTimer(room, 30);
}

function finishRound(room, lastFact, timeout = false) {
  let correctCount = 0;
  (lastFact.votes || []).forEach(voteObj => {
    if (voteObj.vote === lastFact.isTrue) {
      const player = rooms[room].players.find(p => p.id === voteObj.voter);
      if (player) player.score += 1;
      correctCount++;
    }
  });
  if (correctCount < rooms[room].players.length - 1 && !timeout) {
    const submitter = rooms[room].players.find(p => p.id === lastFact.submittedBy);
    if (submitter) submitter.score += 1;
  }
  io.to(room).emit('reveal-fact', {
    fact: lastFact.fact,
    isTrue: lastFact.isTrue,
    votes: lastFact.votes,
    players: rooms[room].players,
    timeout
  });
  setTimeout(() => {
    startNextRound(room);
  }, 5000);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));