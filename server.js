const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const app = express();
const server = http.createServer(app);
const cors = require('cors');

// Konfigurera CORS för development
app.use(cors({
  origin: "*", // Allows all origins in development
  methods: ["GET", "POST"]
}));

// Konfigurera för produktion
// if (process.env.NODE_ENV === 'production') {
 // app.use(express.static(path.join(__dirname, 'client/build')));
  //app.get('*', (req, res) => {
   // res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  //});
// }

const io = new Server(server, {
  cors: {
    origin: "*", // Allows all origins in development
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Datastrukturer
let rooms = {};
let playerStats = {}; // För att lagra spelarstatistik
const roomsInLobby = {}; // För att hålla reda på rum i lobby-läge

// Hjälpfunktioner
function getNextSubmitter(room) {
  if (!rooms[room] || rooms[room].players.length === 0) return null;
  
  const nextSubmitterIndex = (rooms[room].lastSubmitterIndex + 1) % rooms[room].players.length;
  rooms[room].lastSubmitterIndex = nextSubmitterIndex;
  
  return rooms[room].players[nextSubmitterIndex];
}

function resetTimer(room, seconds = 30) {
  if (!rooms[room]) return;
  
  clearInterval(rooms[room].timerInterval);
  clearTimeout(rooms[room].timer);
  
  rooms[room].timerSeconds = seconds;
  io.to(room).emit('timer', rooms[room].timerSeconds);
  
  rooms[room].timerInterval = setInterval(() => {
    if (rooms[room].timerSeconds > 0) {
      rooms[room].timerSeconds -= 1;
      io.to(room).emit('timer', rooms[room].timerSeconds);
    }
  }, 1000);
  
  rooms[room].timer = setTimeout(() => {
    clearInterval(rooms[room].timerInterval);
    
    const facts = rooms[room]?.facts;
    if (facts && facts.length > 0) {
      const lastFact = facts[facts.length - 1];
      
      if (lastFact.votes.length < rooms[room].players.length - 1) {
        // Force end round if time's up and not everyone voted
        finishRound(room, lastFact, true);
      }
    } else {
      startNextRound(room);
    }
  }, seconds * 1000);
}

function startNextRound(room) {
  // Kontrollera om spelet har startat
  if (!rooms[room] || rooms[room].inLobby || !rooms[room].gameStarted) {
    return; // Gör ingenting om spelet är i lobby-läge
  }
  
  const submitter = getNextSubmitter(room);
  
  if (!submitter) return;
  
  rooms[room].currentSubmitter = submitter.id;
  io.to(room).emit('next-submitter', {
    submitterId: submitter.id,
    submitterName: submitter.name
  });
  
  // Set timer based on game mode
  const timerDuration = rooms[room].gameMode === 'rapid' ? 15 : 30;
  rooms[room].timerSeconds = timerDuration;
  io.to(room).emit('timer', rooms[room].timerSeconds);
  
  resetTimer(room, timerDuration);
}

// Uppdatera finishRound-funktionen för att ge poäng baserade på svarstid
function finishRound(room, lastFact, timeout = false) {
  if (!rooms[room]) return;
  
  const gameMode = rooms[room].gameMode;
  let correctCount = 0;
  
  // Sortera röster efter svarstid (snabbast först)
  const sortedVotes = [...(lastFact.votes || [])].sort((a, b) => 
    (a.voteTime || Infinity) - (b.voteTime || Infinity)
  );
  
  // Håll reda på snabba röster för bonuspoäng
  let fastVoteCounter = 0;
  
  sortedVotes.forEach(voteObj => {
    if (voteObj.vote === lastFact.isTrue) {
      const player = rooms[room].players.find(p => p.id === voteObj.voter);
      if (player) {
        // Basen för korrekt svar
        let points = 1;
        
        // Bonuspoäng för snabbt svar (upp till 1000 poäng för snabbast)
        if (fastVoteCounter === 0) {
          points += 1000; // Snabbast
        } else if (fastVoteCounter === 1) {
          points += 700; // Näst snabbast
        } else if (fastVoteCounter === 2) {
          points += 500; // Tredje snabbast
        } else if (fastVoteCounter < 5) {
          points += 300; // Fortfarande snabb
        } else if (fastVoteCounter < 8) {
          points += 100; // Medel
        }
        
        // Expert-läge ger extra grundpoäng
        if (gameMode === 'expert') {
          points += 1;
        }
        
        player.score += points;
        
        // Uppdatera spelarstatistik för svarstid
        updatePlayerStats(voteObj.voter, 'correct-guess', { 
          responseTime: voteObj.voteTime || 30,
          points: points
        });
      }
      correctCount++;
      fastVoteCounter++;
    } else {
      // Även felaktiga gissningar uppdaterar spelarens statistik
      updatePlayerStats(voteObj.voter, 'wrong-guess');
      fastVoteCounter++;
    }
  });
  
  // Award submitter points for fooling others
  if (correctCount < rooms[room].players.length - 1 && !timeout) {
    const submitter = rooms[room].players.find(p => p.id === lastFact.submittedBy);
    if (submitter) {
      // Poäng baserat på antal spelare som lurades
      const fooledPlayers = rooms[room].players.length - 1 - correctCount;
      let points = fooledPlayers * 300; // 300 poäng per lurad spelare
      
      // Extra poäng i expertläge
      if (gameMode === 'expert') {
        points *= 1.5;
      }
      
      submitter.score += points;
      
      // Uppdatera statistik
      updatePlayerStats(lastFact.submittedBy, 'submit-fact', { isTrue: lastFact.isTrue });
      
      // Om submitter lurade alla
      if (fooledPlayers === rooms[room].players.length - 1 && fooledPlayers > 0) {
        updatePlayerStats(lastFact.submittedBy, 'fooled-all');
      }
    }
  }
  
  // Avrunda poäng till heltal
  rooms[room].players.forEach(player => {
    player.score = Math.round(player.score);
  });
  
  // Sortera spelare efter poäng (leaderboard-sortering)
  rooms[room].players.sort((a, b) => b.score - a.score);
  
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

// Funktion för spelarstatistik
function updatePlayerStats(playerId, action, data = {}) {
  // Se till att vi har en spelardatastruktur
  if (!playerStats[playerId]) {
    playerStats[playerId] = {
      gamesPlayed: 0,
      wins: 0,
      correctGuesses: 0,
      totalGuesses: 0,
      responseTimes: [],
      avgResponseTime: 0,
      bestStreak: 0,
      currentStreak: 0,
      truths: 0,
      lies: 0,
      achievements: []
    };
  }
  
  const stats = playerStats[playerId];
  
  switch(action) {
    case 'submit-fact':
      if (data.isTrue) {
        stats.truths += 1;
      } else {
        stats.lies += 1;
      }
      break;
      
    case 'correct-guess':
      stats.correctGuesses += 1;
      stats.totalGuesses += 1;
      stats.currentStreak += 1;
      
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
      
      if (data.responseTime) {
        stats.responseTimes.push(data.responseTime);
        // Beräkna genomsnittlig svarstid
        stats.avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
      }
      
      // Kolla prestationer
      checkAchievements(playerId);
      break;
      
    case 'wrong-guess':
      stats.totalGuesses += 1;
      stats.currentStreak = 0;
      break;
      
    case 'win-game':
      stats.wins += 1;
      stats.gamesPlayed += 1;
      
      // Kontrollera om det är deras första vinst
      if (stats.wins === 1 && !stats.achievements.includes('first_win')) {
        stats.achievements.push('first_win');
        io.to(playerId).emit('achievement-unlocked', 'first_win');
      }
      break;
      
    case 'game-completed':
      stats.gamesPlayed += 1;
      break;
      
    case 'fooled-all':
      if (!stats.achievements.includes('fooled_all')) {
        stats.achievements.push('fooled_all');
        io.to(playerId).emit('achievement-unlocked', 'fooled_all');
      }
      break;
  }
  
  return stats;
}

function checkAchievements(playerId) {
  const stats = playerStats[playerId];
  
  // Kontrollera detektiv-prestationen
  if (stats.currentStreak >= 5 && !stats.achievements.includes('perfect_score')) {
    stats.achievements.push('perfect_score');
    io.to(playerId).emit('achievement-unlocked', 'perfect_score');
  }
  
  // Kontrollera sanningssökare-prestationen
  if (stats.correctGuesses >= 10 && !stats.achievements.includes('truth_master')) {
    stats.achievements.push('truth_master');
    io.to(playerId).emit('achievement-unlocked', 'truth_master');
  }
  
  // Kontrollera snabbtänkare
  if (stats.responseTimes.some(time => time < 5) && !stats.achievements.includes('quick_thinker')) {
    stats.achievements.push('quick_thinker');
    io.to(playerId).emit('achievement-unlocked', 'quick_thinker');
  }
}

// Socket.io events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Uppdatera socket.on('join-room') för att hantera 10 spelare
  socket.on('join-room', ({ room, username, gameMode = 'classic' }) => {
    // Kolla om rummet redan har 10 spelare
    if (rooms[room] && rooms[room].players.length >= 10) {
      socket.emit('join-error', 'Rummet är fullt (max 10 spelare)');
      return;
    }
    
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
        gameMode: gameMode,
        inLobby: true, // Nytt flag för att indikera att rummet är i lobby-läge
        gameStarted: false // Nytt flag för att indikera att spelet inte har startat
      };
      
      // Lägg till rummet i lobby-listan
      roomsInLobby[room] = true;
    }
    
    // Add player if not already in the room
    if (!rooms[room].players.find(p => p.id === socket.id)) {
      // Första spelaren är automatiskt spelledare
      const isHost = rooms[room].players.length === 0;
      rooms[room].players.push({ 
        id: socket.id, 
        name: username, 
        score: 0,
        isHost: isHost, // Markera spelledaren
        ready: false // Spelare börjar som inte redo
      });
    }
    
    // Update room mode if it's a new room
    if (rooms[room].players.length === 1) {
      rooms[room].gameMode = gameMode;
    }
    
    // Sortera spelare efter poäng
    rooms[room].players.sort((a, b) => b.score - a.score);
    
    // Skicka lobby-status till alla i rummet
    io.to(room).emit('lobby-status', {
      players: rooms[room].players,
      gameMode: rooms[room].gameMode,
      inLobby: rooms[room].inLobby,
      gameStarted: rooms[room].gameStarted
    });
    
    io.to(socket.id).emit('chat-history', rooms[room].chat);
    
    // Lägg till en chatt-meddelande när någon går med
    const msg = { 
      username: 'System', 
      text: `${username} gick med i spelet`, 
      ts: Date.now(),
      system: true 
    };
    rooms[room].chat.push(msg);
    io.to(room).emit('chat-message', msg);

    // Om spelet redan har startat, starta för den nya spelaren
    if (rooms[room].gameStarted && !rooms[room].inLobby) {
      io.to(socket.id).emit('game-started');
    }
  });

  // Lägg till en ny händelse för att markera sig som redo
  socket.on('toggle-ready', ({ room }) => {
    if (!rooms[room]) return;
    
    const player = rooms[room].players.find(p => p.id === socket.id);
    if (player) {
      player.ready = !player.ready;
      
      // Skicka uppdaterad spelarstatus till alla i rummet
      io.to(room).emit('lobby-status', {
        players: rooms[room].players,
        gameMode: rooms[room].gameMode,
        inLobby: rooms[room].inLobby,
        gameStarted: rooms[room].gameStarted
      });
    }
  });

  // Lägg till en ny händelse för att starta spelet
  socket.on('start-game', ({ room }) => {
    if (!rooms[room]) return;
    
    // Kontrollera att den som försöker starta är spelledaren
    const player = rooms[room].players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('game-error', 'Endast spelledaren kan starta spelet');
      return;
    }
    
    // Kontrollera att det finns minst 2 spelare
    if (rooms[room].players.length < 2) {
      socket.emit('game-error', 'Minst 2 spelare behövs för att starta spelet');
      return;
    }
    
    // Starta spelet
    rooms[room].inLobby = false;
    rooms[room].gameStarted = true;
    
    // Ta bort från lobby-listan
    delete roomsInLobby[room];
    
    // Meddela alla i rummet att spelet har startat
    io.to(room).emit('game-started');
    
    // Starta första rundan
    startNextRound(room);
  });
  
  // Uppdatera socket.on('vote-fact') för att spåra svarstid
  socket.on('vote-fact', ({ room, vote }) => {
    const facts = rooms[room]?.facts;
    if (!facts || facts.length === 0) return;
    
    const lastFact = facts[facts.length - 1];
    // Prevent submitter from voting
    if (lastFact.submittedBy === socket.id) return;
    // Prevent duplicate votes
    if (lastFact.votes.find(v => v.voter === socket.id)) return;
    
    // Calculate vote time (since fact was submitted)
    const currentTime = Date.now();
    const voteTime = (currentTime - (lastFact.submittedAt || currentTime)) / 1000;
    
    lastFact.votes.push({ 
      voter: socket.id, 
      vote,
      voteTime: Math.min(voteTime, 30) // Cap at 30 seconds
    });
    
    // Check if all players have voted
    if (lastFact.votes.length === rooms[room].players.length - 1) {
      clearInterval(rooms[room].timerInterval);
      clearTimeout(rooms[room].timer);
      finishRound(room, lastFact);
    }
  });

  // Uppdatera socket.on('submit-fact') för att lagra tidpunkt när fakta läggs till
  socket.on('submit-fact', ({ room, fact, isTrue, username }) => {
    // Only allow submitter to submit!
    const submitter = getNextSubmitter(room);
    if (!submitter || submitter.id !== socket.id) return;
    
    rooms[room].facts.push({ 
      fact, 
      isTrue, 
      submittedBy: socket.id, 
      username, 
      votes: [],
      submittedAt: Date.now() // Tidpunkt för inskickad fakta
    });
    
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

  socket.on('chat-message', ({ room, message, username }) => {
    if (!rooms[room]) return;
    
    // Simple spam protection
    const recentMessages = rooms[room].chat.filter(
      msg => msg.username === username && Date.now() - msg.ts < 2000
    );
    
    if (recentMessages.length > 3) {
      socket.emit('chat-error', 'Skickar meddelanden för snabbt, vänta lite');
      return;
    }
    
    const msg = { username, text: message, ts: Date.now() };
    rooms[room].chat.push(msg);
    
    // Keep chat history to last 100 messages
    if (rooms[room].chat.length > 100) {
      rooms[room].chat = rooms[room].chat.slice(-100);
    }
    
    io.to(room).emit('chat-message', msg);
  });

  // Uppdatera socket.on('disconnect') för att hantera när en användare lämnar
  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(room => {
      if (!rooms[room]) return;
      
      // Hitta om den här spelaren var med i rummet
      const playerIndex = rooms[room].players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Få tag på spelarens namn innan vi tar bort dem
        const leavingPlayerName = rooms[room].players[playerIndex].name;
        const wasHost = rooms[room].players[playerIndex].isHost;
        
        // Ta bort spelaren från rummet
        rooms[room].players.splice(playerIndex, 1);
        
        // Om spelledaren lämnade och det finns andra spelare, välj en ny spelledare
        if (wasHost && rooms[room].players.length > 0) {
          rooms[room].players[0].isHost = true;
        }
        
        // Sortera spelare efter poäng
        rooms[room].players.sort((a, b) => b.score - a.score);
        
        // Uppdatera spelarlistorn och lobby-status
        io.to(room).emit('update-players', rooms[room].players);
        io.to(room).emit('lobby-status', {
          players: rooms[room].players,
          gameMode: rooms[room].gameMode,
          inLobby: rooms[room].inLobby,
          gameStarted: rooms[room].gameStarted
        });
        
        // Lägg till systemmeddelande om att spelaren lämnade
        const msg = { 
          username: 'System', 
          text: `${leavingPlayerName} lämnade spelet`, 
          ts: Date.now(),
          system: true 
        };
        rooms[room].chat.push(msg);
        io.to(room).emit('chat-message', msg);
        
        // Om spelledaren lämnade, informera om ny spelledare
        if (wasHost && rooms[room].players.length > 0) {
          const newHostMsg = { 
            username: 'System', 
            text: `${rooms[room].players[0].name} är ny spelledare`, 
            ts: Date.now(),
            system: true 
          };
          rooms[room].chat.push(newHostMsg);
          io.to(room).emit('chat-message', newHostMsg);
        }
        
        // Om den aktuella submitter lämnade, starta om rundan
        if (rooms[room].lastSubmitterIndex === playerIndex) {
          clearInterval(rooms[room].timerInterval);
          clearTimeout(rooms[room].timer);
          
          if (rooms[room].players.length > 0) {
            // Justera lastSubmitterIndex eftersom spelaren lämnade
            if (rooms[room].lastSubmitterIndex >= rooms[room].players.length) {
              rooms[room].lastSubmitterIndex = rooms[room].players.length - 1;
            }
            startNextRound(room);
          }
        } 
        // Om spelaren var nästa submitter, justera index
        else if (playerIndex <= rooms[room].lastSubmitterIndex) {
          rooms[room].lastSubmitterIndex--;
        }
        
        // Ta bort rummet om det är tomt
        if (rooms[room].players.length === 0) {
          clearInterval(rooms[room].timerInterval);
          clearTimeout(rooms[room].timer);
          delete rooms[room];
          delete roomsInLobby[room];
        }
      }
    });
  });
});

// Starta servern
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});