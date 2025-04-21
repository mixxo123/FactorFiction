import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Initiera socket-anslutning
const socket = io('http://localhost:5000');

function App() {
  // State variabler
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [roomCode, setRoomCode] = useState(''); // För att visa rumskod
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [gameMode, setGameMode] = useState('classic');
  const [facts, setFacts] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [currentSubmitter, setCurrentSubmitter] = useState('');
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(30);
  const [voted, setVoted] = useState(false);
  const [result, setResult] = useState(null);
  const [notification, setNotification] = useState(null);
  const [notificationType, setNotificationType] = useState('info');
  const [darkMode, setDarkMode] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('Classic');
  const [devMode, setDevMode] = useState(false); // Developer-läge
  const [offlineMode, setOfflineMode] = useState(false); // Offline-läge för utveckling
  
  // Lobby-relaterade states
  const [inLobby, setInLobby] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [userVote, setUserVote] = useState(null);
  
  // Refs
  const timerIntervalRef = useRef(null);
  const chatContainerRef = useRef(null);
  const botIdCounter = useRef(1);

  // Tema-lista
  const themes = [
    { name: 'Classic', emoji: '🎮', primary: '#7856ff', secondary: '#5e43cc' },
    { name: 'Ocean', emoji: '🌊', primary: '#0077b6', secondary: '#0096c7' },
    { name: 'Forest', emoji: '🌲', primary: '#2d6a4f', secondary: '#40916c' },
    { name: 'Sunset', emoji: '🌅', primary: '#ff7b00', secondary: '#ff9e00' },
    { name: 'Space', emoji: '🚀', primary: '#3a0ca3', secondary: '#4cc9f0' }
  ];

  // Notifieringsfunktion
  const showNotification = (message, type = 'info') => {
    setNotification(message);
    setNotificationType(type);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Utvecklar-funktionalitet
  const toggleDevMode = () => {
    const newDevMode = !devMode;
    setDevMode(newDevMode);
    
    if (newDevMode) {
      setOfflineMode(true);
      showNotification('Utvecklarläge aktiverat! Kör i offline-läge för testning.', 'info');
    } else {
      setOfflineMode(false);
      showNotification('Utvecklarläge inaktiverat', 'info');
    }
  };

  // Lägg till testspelare (bot)
  const addTestPlayer = () => {
    if (devMode) {
      const botNames = ['TestBot-Anna', 'TestBot-Erik', 'TestBot-Maria', 'TestBot-Johan'];
      const usedNames = players.map(p => p.name);
      const availableNames = botNames.filter(name => !usedNames.includes(name));
      
      if (availableNames.length > 0) {
        const botName = availableNames[0];
        const botId = `bot-${botIdCounter.current++}`;
        
        // Skapa ny testspelare
        const newBot = {
          id: botId,
          name: botName,
          score: 0,
          isHost: false,
          ready: true
        };
        
        // Lägg till i spelaristan
        setPlayers(prevPlayers => [...prevPlayers, newBot]);
        
        // Lägg till systemmeddelande i chatten
        const botMessage = {
          username: 'System',
          text: `${botName} har anslutit till spelet.`,
          ts: new Date().toISOString(),
          system: true
        };
        
        setChat(prevChat => [...prevChat, botMessage]);
        showNotification(`Testspelare ${botName} tillagd!`, 'success');
      } else {
        showNotification('Alla testspelare är redan tillagda!', 'warning');
      }
    }
  };

  // Starta spel i utvecklarläge
  const startDevGame = () => {
    if (devMode) {
      setInLobby(false);
      setGameStarted(true);
      setCurrentSubmitter(username); // Du börjar
      
      // Starta timer
      startLocalTimer(gameMode === 'rapid' ? 15 : 30);
      
      // Lägg till systemmeddelande
      const startMessage = {
        username: 'System',
        text: 'Spelet har startat! Det är din tur att skriva ett påstående.',
        ts: new Date().toISOString(),
        system: true
      };
      
      setChat(prevChat => [...prevChat, startMessage]);
      showNotification('Spelet har startat i utvecklarläge!', 'success');
    }
  };

  // Hantera join room
  const handleJoin = () => {
    if (username) {
      const generatedRoom = room || Math.floor(1000 + Math.random() * 9000).toString();
      
      if (devMode) {
        // Om i devläge, hantera lokalt
        setRoomCode(generatedRoom);
        setJoined(true);
        setIsHost(true);
        
        // Skapa lokal spelare
        const player = {
          id: 'player-1',
          name: username,
          score: 0,
          isHost: true,
          ready: true
        };
        
        setPlayers([player]);
        
        // Skapa välkomstmeddelande
        const welcomeMessage = {
          username: 'System',
          text: `Välkommen till rum ${generatedRoom}!`,
          ts: new Date().toISOString(),
          system: true
        };
        
        setChat([welcomeMessage]);
        
        showNotification(`Nytt spel skapat i utvecklarläge! Rumskod: ${generatedRoom}`, 'success');
      } else {
        // Normal anslutning via server
        socket.emit("join-room", { room: generatedRoom, username, gameMode });
        setRoomCode(generatedRoom);
        setJoined(true);
        showNotification(room ? `Välkommen till rum ${generatedRoom}!` : `Nytt spel skapat! Din rumskod är: ${generatedRoom}`, "success");
      }
    } else {
      showNotification("Du måste ange ett användarnamn", "error");
    }
  };

  // Förbättrad timer-funktion
  const startLocalTimer = (initialTime) => {
    clearInterval(timerIntervalRef.current);
    setTimer(initialTime);
    
    const endTime = Date.now() + initialTime * 1000;
    
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      
      setTimer(prevTimer => {
        if (prevTimer !== remaining) {
          return remaining;
        }
        return prevTimer;
      });
      
      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        
        // Utvecklarläge - simulera nästa steg när timer är slut
        if (devMode && gameStarted) {
          simulateNextStep();
        }
      }
    }, 100);
  };

  // Simulera nästa steg i spelet
  const simulateNextStep = () => {
    if (currentSubmitter === username && !submitted) {
      // Om användarens tid är slut utan att skicka påstående
      handleAutoSubmitFact();
    } else if (submitted && !voted && currentSubmitter !== username) {
      // Om tid för röstning är slut
      simulateVoteResult();
    }
  };

  // Auto-generera ett påstående om tiden går ut
  const handleAutoSubmitFact = () => {
    const autofacts = [
      { text: "Vatten kokar vid 100 grader Celsius vid havsnivå.", isTrue: true },
      { text: "En blixt slår aldrig ner på samma ställe två gånger.", isTrue: false },
      { text: "Glas är en vätska som flyter mycket långsamt.", isTrue: false },
      { text: "Människans DNA är till 50% identiskt med en banans.", isTrue: true }
    ];
    
    const randomFact = autofacts[Math.floor(Math.random() * autofacts.length)];
    
    handleSubmitFact(randomFact.text, randomFact.isTrue);
    showNotification("Tiden är slut! Ett automatiskt påstående har genererats.", "warning");
  };

  // Funktion för att byta tema
  const changeTheme = (themeName) => {
    const theme = themes.find(t => t.name === themeName);
    if (theme) {
      document.documentElement.style.setProperty('--primary-color', theme.primary);
      document.documentElement.style.setProperty('--secondary-color', theme.secondary);
      setCurrentTheme(theme.name);
    }
  };

  // Hantera submit fact
  const handleSubmitFact = (fact, isTrue) => {
    if (devMode) {
      // I utvecklarläge, hantera lokalt
      // Lägg till påståendet i listan
      const newFact = { fact, username, isTrue };
      setFacts(prev => [...prev, newFact]);
      setSubmitted(true);
      
      // Systemmeddelande om påståendet
      const factMessage = {
        username: 'System',
        text: `${username} har skrivit ett påstående.`,
        ts: new Date().toISOString(),
        system: true
      };
      
      setChat(prev => [...prev, factMessage]);
      
      // Byt till nästa spelare (en bot)
      const bots = players.filter(p => p.id !== 'player-1');
      if (bots.length > 0) {
        // Väj en slumpmässig bot för röstning
        setCurrentSubmitter('');  // Ingen tur nu - dags för röstning
        
        // Starta timer för röstning
        startLocalTimer(gameMode === 'rapid' ? 10 : 20);
      } else {
        showNotification("Inga bots att rösta! Lägg till testspelare först.", "error");
        setSubmitted(false);
      }
    } else {
      // Normal användning med server
      socket.emit("submit-fact", { room: roomCode, fact, isTrue, username });
    }
  };

  // Simulera röstresultat
  const simulateVoteResult = () => {
    const currentFact = facts[facts.length - 1];
    const botVotes = [];
    
    // Simulera röster från botar
    players.forEach(player => {
      if (player.id !== 'player-1') {  // Inte användaren
        // Botar gissar rätt 60% av tiden
        const guessCorrect = Math.random() < 0.6;
        const botVote = guessCorrect ? currentFact.isTrue : !currentFact.isTrue;
        
        botVotes.push({
          voter: player.id,
          vote: botVote
        });
        
        // Lägg till röstmeddelande i chat
        const voteMsg = {
          username: player.name,
          text: `Jag röstar ${botVote ? "SANT" : "FALSKT"}!`,
          ts: new Date().toISOString()
        };
        
        setChat(prev => [...prev, voteMsg]);
      }
    });
    
    // Om användaren har röstat, lägg till deras röst
    const allVotes = [...botVotes];
    if (userVote !== null) {
      allVotes.push({
        voter: 'player-1',
        vote: userVote
      });
    }
    
    // Uppdatera spelarpoäng baserat på röster
    const updatedPlayers = [...players].map(player => ({...player}));
    
    // Ge poäng till den som skrev påståendet för varje fel gissning
    const factAuthor = updatedPlayers.find(p => p.name === currentFact.username);
    if (factAuthor) {
      const wrongVotes = allVotes.filter(v => v.vote !== currentFact.isTrue).length;
      factAuthor.score += wrongVotes;
    }
    
    // Ge poäng för rätta gissningar
    allVotes.forEach(vote => {
      if (vote.vote === currentFact.isTrue) {
        const voter = updatedPlayers.find(p => p.id === vote.voter);
        if (voter) voter.score += 1;
      }
    });
    
    setPlayers(updatedPlayers);
    
    // Visa resultat
    setResult({
      fact: currentFact.fact,
      isTrue: currentFact.isTrue,
      votes: allVotes
    });
    
    setVoted(true);
    
    // Systemmeddelande om resultatet
    const resultMsg = {
      username: 'System',
      text: `Påståendet var ${currentFact.isTrue ? "SANT" : "FALSKT"}!`,
      ts: new Date().toISOString(),
      system: true
    };
    
    setChat(prev => [...prev, resultMsg]);
    
    // Starta nästa runda efter en stund
    setTimeout(() => {
      startNextRound();
    }, 5000);
  };

  // Starta nästa runda
  const startNextRound = () => {
    setSubmitted(false);
    setVoted(false);
    setResult(null);
    setUserVote(null);
    
    // Välj nästa spelare
    let nextPlayerIndex = 0;
    const currentIndex = players.findIndex(p => p.name === currentSubmitter);
    
    if (currentIndex !== -1) {
      nextPlayerIndex = (currentIndex + 1) % players.length;
    }
    
    const nextPlayer = players[nextPlayerIndex];
    setCurrentSubmitter(nextPlayer.name);
    
    // Starta timer för nästa runda
    startLocalTimer(gameMode === 'rapid' ? 15 : 30);
    
    // Om nästa spelare är en bot, simulera deras påstående
    if (nextPlayer.id !== 'player-1') {
      setTimeout(() => {
        simulateBotFact(nextPlayer);
      }, 3000);
    }
  };

  // Simulera ett påstående från en bot
  const simulateBotFact = (bot) => {
    const botFacts = [
      { text: "Björnar tillbringar upp till 16 timmar om dagen med att äta.", isTrue: true },
      { text: "Den kinesiska muren är synlig från månen.", isTrue: false },
      { text: "Människor använder bara 10% av sin hjärna.", isTrue: false },
      { text: "En katt kan hoppa upp till sex gånger sin längd.", isTrue: true },
      { text: "Dinosaurier och människor levde under samma tidsperiod.", isTrue: false },
      { text: "Koala-björnar är inte björnar utan pungdjur.", isTrue: true },
      { text: "En snigel kan sova i upp till tre år.", isTrue: true },
      { text: "Blåvalar är jordens största djur någonsin.", isTrue: true }
    ];
    
    // Välj slumpmässigt påstående
    const randomIndex = Math.floor(Math.random() * botFacts.length);
    const botFact = botFacts[randomIndex];
    
    // Skapa faktum
    const newFact = { 
      fact: botFact.text, 
      username: bot.name,
      isTrue: botFact.isTrue 
    };
    
    setFacts(prev => [...prev, newFact]);
    setSubmitted(true);
    
    // Chatmeddelande
    const factMsg = {
      username: bot.name,
      text: botFact.text,
      ts: new Date().toISOString()
    };
    
    setChat(prev => [...prev, factMsg]);
    
    // Sätt currentSubmitter till tomt för att indikera röstningsfas
    setCurrentSubmitter('');
    
    // Starta timer för röstning
    startLocalTimer(gameMode === 'rapid' ? 10 : 20);
  };

  // Hantera vote
  const handleVote = (vote) => {
    if (devMode) {
      setUserVote(vote);
      setVoted(true);
      
      // Lägg till röstmeddelande i chatten
      const voteMsg = {
        username: username,
        text: `Jag röstar ${vote ? "SANT" : "FALSKT"}!`,
        ts: new Date().toISOString()
      };
      
      setChat(prev => [...prev, voteMsg]);
      
      // Simulera botröster och visa resultat
      setTimeout(() => {
        simulateVoteResult();
      }, 1500);
    } else {
      socket.emit("vote-fact", { room: roomCode, vote });
      setVoted(true);
    }
  };

  // Hantera chat
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      // Skapa chatmeddelande
      const chatMsg = {
        username: username,
        text: message,
        ts: new Date().toISOString()
      };
      
      setChat(prev => [...prev, chatMsg]);
      
      if (!devMode) {
        socket.emit("send-message", { room: roomCode, message });
      }
      
      setMessage("");
      
      // Scrolla ner i chatten
      if (chatContainerRef.current) {
        setTimeout(() => {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }, 100);
      }
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Lämna spelet
  const leaveGame = () => {
    socket.disconnect();
    window.location.reload();
  };

  // Toggle ready status i lobby
  const toggleReady = () => {
    setIsReady(!isReady);
    
    if (devMode) {
      const updatedPlayers = [...players];
      const playerIndex = updatedPlayers.findIndex(p => p.name === username);
      
      if (playerIndex !== -1) {
        updatedPlayers[playerIndex].ready = !isReady;
        setPlayers(updatedPlayers);
      }
    } else {
      socket.emit('toggle-ready', { room: roomCode });
    }
  };

  // Starta spelet (endast för host)
  const startGame = () => {
    if (devMode || players.length >= 2) {
      if (devMode) {
        startDevGame();
      } else {
        socket.emit('start-game', { room: roomCode });
      }
    } else {
      showNotification("Minst 2 spelare krävs för att starta spelet", "error");
    }
  };

  // Socket event listeners
  useEffect(() => {
    // Keydown event listener för utvecklarläge (Shift+D)
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'D') {
        toggleDevMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    // Socket-lyssnare (endast aktiva om inte i devläge)
    if (!devMode) {
      socket.on("update-players", (updatedPlayers) => {
        setPlayers(updatedPlayers);
      });

      socket.on("chat-message", (msg) => {
        setChat((prevChat) => [...prevChat, msg]);
        if (chatContainerRef.current) {
          setTimeout(() => {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }, 100);
        }
      });

      socket.on("chat-history", (history) => {
        setChat(history);
      });

      socket.on("timer", (seconds) => {
        startLocalTimer(seconds);
      });

      socket.on("your-turn", ({ username: turnUsername }) => {
        setCurrentSubmitter(turnUsername);
        setSubmitted(false);
        setVoted(false);
        setResult(null);
      });

      socket.on("new-fact", ({ fact, username: factUsername }) => {
        setFacts((prevFacts) => [...prevFacts, { fact, username: factUsername }]);
        setSubmitted(true);
        setVoted(false);
        setResult(null);
      });

      socket.on("reveal-fact", ({ fact, isTrue, votes, players: updatedPlayers, timeout }) => {
        setResult({ fact, isTrue, votes });
        setVoted(true);
        setPlayers(updatedPlayers);
        
        if (timeout) {
          showNotification("Tiden ran ut!", "warning");
        }
      });

      socket.on("join-error", (errorMsg) => {
        showNotification(errorMsg, "error");
        setJoined(false);
      });
      
      socket.on('lobby-status', ({ players: updatedPlayers, gameMode: updatedGameMode, inLobby: updatedInLobby, gameStarted: updatedGameStarted }) => {
        setPlayers(updatedPlayers);
        setGameMode(updatedGameMode);
        setInLobby(updatedInLobby);
        setGameStarted(updatedGameStarted);
        
        const currentPlayer = updatedPlayers.find(p => p.name === username);
        if (currentPlayer) {
          setIsHost(currentPlayer.isHost);
          setIsReady(currentPlayer.ready);
        }
      });
      
      socket.on('game-started', () => {
        setInLobby(false);
        setGameStarted(true);
        showNotification('Spelet har startat!', 'success');
      });
      
      socket.on('game-error', (errorMsg) => {
        showNotification(errorMsg, 'error');
      });
    }

    // Preferenser för mörkt läge
    const prefersDarkMode = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDarkMode);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      
      if (!devMode) {
        socket.off("update-players");
        socket.off("chat-message");
        socket.off("chat-history");
        socket.off("timer");
        socket.off("your-turn");
        socket.off("new-fact");
        socket.off("reveal-fact");
        socket.off("join-error");
        socket.off('lobby-status');
        socket.off('game-started');
        socket.off('game-error');
      }
      
      clearInterval(timerIntervalRef.current);
    };
  }, [devMode, username]);

  // Separat useEffect för timer cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Komponent-rendering
  return (
    <div className={`App ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      {notification && (
        <div className={`notification ${notificationType}`}>
          {notification}
        </div>
      )}

      {!joined ? (
        // Startskärm
        <div className="join-container">
          <div className="background-effects">
            <div className="particles">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="particle"></div>
              ))}
            </div>
            <div className="floating-shapes">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className={`shape shape-${i % 5}`}></div>
              ))}
            </div>
          </div>

          <div className="game-intro">
            <div className="logo">
              <div className="logo-text">
                <span className="logo-word fact">Fact</span>
                <span className="logo-word or">or</span>
                <span className="logo-word fiction">Fiction</span>
              </div>
              <div className="logo-underline"></div>
            </div>
            
            <div className="tagline">
              <span>Kan du skilja sanning från lögn?</span>
            </div>
          </div>

          <div className="content-card">
            <div className="card-inner">
              <div className="input-area">
                <div className="input-group">
                  <label htmlFor="username">
                    <span className="input-icon">👤</span>
                    <span className="input-label">Ditt Namn</span>
                  </label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Vad heter du?"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="fancy-input"
                  />
                </div>
                
                <div className="input-group">
                  <label htmlFor="roomcode">
                    <span className="input-icon">🔑</span>
                    <span className="input-label">Rumskod</span>
                  </label>
                  <input
                    id="roomcode"
                    type="text"
                    placeholder="Lämna tomt för att skapa nytt"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="fancy-input"
                  />
                </div>
              </div>
              
              <div className="gamemode-selection">
                <h3 className="selection-title">
                  <span className="icon">🎲</span> Välj Spelläge
                </h3>
                <div className="gamemode-options">
                  <label className={`gamemode-card ${gameMode === 'classic' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="gamemode"
                      value="classic"
                      checked={gameMode === 'classic'}
                      onChange={() => setGameMode('classic')}
                    />
                    <div className="card-content">
                      <span className="mode-icon">🎮</span>
                      <h4 className="mode-title">Klassiskt</h4>
                      <p className="mode-description">30 sekunder per runda</p>
                      <div className="select-indicator"></div>
                    </div>
                  </label>
                  
                  <label className={`gamemode-card ${gameMode === 'rapid' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="gamemode"
                      value="rapid"
                      checked={gameMode === 'rapid'}
                      onChange={() => setGameMode('rapid')}
                    />
                    <div className="card-content">
                      <span className="mode-icon">⚡</span>
                      <h4 className="mode-title">Snabbt</h4>
                      <p className="mode-description">15 sekunder per runda</p>
                      <div className="select-indicator"></div>
                    </div>
                  </label>
                  
                  <label className={`gamemode-card ${gameMode === 'expert' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="gamemode"
                      value="expert"
                      checked={gameMode === 'expert'}
                      onChange={() => setGameMode('expert')}
                    />
                    <div className="card-content">
                      <span className="mode-icon">🧠</span>
                      <h4 className="mode-title">Expert</h4>
                      <p className="mode-description">Avancerade påståenden</p>
                      <div className="select-indicator"></div>
                    </div>
                  </label>
                </div>
              </div>

              <button 
                className="join-button" 
                onClick={handleJoin}
                disabled={!username}
              >
                <div className="button-content">
                  <span className="button-icon">{room ? '🚪' : '🎲'}</span>
                  <span className="button-text">{room ? 'Gå med i spelet' : 'Skapa nytt spel'}</span>
                </div>
                <div className="button-effects"></div>
              </button>
            </div>
          </div>

          <div className="theme-selector">
            <h3 className="selection-title">
              <span className="icon">🎨</span> Välj Tema
            </h3>
            <div className="theme-options">
              {themes.map((theme) => (
                <div 
                  key={theme.name}
                  className={`theme-item ${theme.name === currentTheme ? 'active' : ''}`}
                  onClick={() => changeTheme(theme.name)}
                  style={{'--theme-color': theme.primary, '--theme-secondary': theme.secondary}}
                >
                  <div className="theme-preview">
                    <div className="theme-emoji">{theme.emoji}</div>
                  </div>
                  <div className="theme-name">{theme.name}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mode-toggle">
            <button 
              className="toggle-button" 
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="toggle-track">
                <div className="toggle-icons">
                  <span className="sun">☀️</span>
                  <span className="moon">🌙</span>
                </div>
                <div className={`toggle-thumb ${darkMode ? 'dark' : 'light'}`}></div>
              </div>
              <span className="toggle-label">{darkMode ? 'Ljust läge' : 'Mörkt läge'}</span>
            </button>
          </div>
          
          <div className="footer">
            <p>Skapa ett spelrum eller gå med i ett befintligt!</p>
            {devMode && (
              <div className="dev-mode-badge pulse-effect">Utvecklarläge aktivt (Shift+D)</div>
            )}
          </div>
        </div>
      ) : inLobby ? (
        // Lobby-skärmen
        <div className="lobby-container">
          <div className="lobby-header">
            <h1>Väntelobby</h1>
            <div className="room-code-display">
              <span className="room-label">Rumskod: </span>
              <span className="room-value">{roomCode}</span>
              <button 
                className="copy-button" 
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  showNotification('Rumskod kopierad till urklipp!', 'success');
                }}
                title="Kopiera rumskod"
              >
                📋
              </button>
            </div>
            <div className="game-mode-indicator">
              Spelläge: <span>{gameMode === 'rapid' ? 'Snabbt' : gameMode === 'expert' ? 'Expert' : 'Klassiskt'}</span>
            </div>
          </div>
          
          <div className="player-list-container">
            <h2>Spelare ({players.length}/10)</h2>
            <div className="player-list lobby-players">
              {players.map((player, idx) => (
                <div key={idx} className={`player-item ${player.name === username ? 'current-player' : ''}`}>
                  <div className="player-name">
                    {player.name} {player.isHost && <span className="host-badge">👑</span>}
                  </div>
                  <div className="player-status">
                    {player.ready ? <span className="ready-badge">✅ Redo</span> : <span className="not-ready-badge">⏳ Inte redo</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lobby-actions">
            {isHost ? (
              <div className="host-actions">
                <button 
                  className={`start-game-btn ${players.length < 2 && !devMode ? 'disabled' : ''}`}
                  onClick={startGame}
                  disabled={players.length < 2 && !devMode}
                >
                  Starta spelet
                </button>
                <p className="host-info">Du är spelledare och kan starta spelet när alla är redo.</p>
              </div>
            ) : (
              <div className="player-actions">
                <button 
                  className={`ready-btn ${isReady ? 'not-ready' : 'ready'}`}
                  onClick={toggleReady}
                >
                  {isReady ? 'Markera som inte redo' : 'Markera som redo'}
                </button>
                <p className="player-info">Vänta på att spelledaren startar spelet.</p>
              </div>
            )}
            
            {devMode && (
              <div className="dev-controls">
                <h3 className="dev-title">Utvecklarverktyg</h3>
                <div className="dev-buttons">
                  <button className="dev-btn" onClick={addTestPlayer}>
                    Lägg till testspelare
                  </button>
                  <button className="dev-btn" onClick={startDevGame}>
                    Tvinga spelstart
                  </button>
                </div>
              </div>
            )}
            
            <button className="leave-game-btn" onClick={leaveGame}>
              Lämna Spelet
            </button>
          </div>
          
          {/* Tema-väljare i lobbyn */}
          <div className="theme-selector-lobby">
            <h3>Välj Tema:</h3>
            <div className="themes-list-lobby">
              {themes.map((theme) => (
                <div 
                  key={theme.name}
                  className={`theme-option-lobby ${theme.name === currentTheme ? 'selected' : ''}`}
                  onClick={() => changeTheme(theme.name)}
                >
                  {theme.emoji} {theme.name}
                </div>
              ))}
            </div>
          </div>
          
          {/* Instruktioner för spelet */}
          <div className={`instructions ${darkMode ? 'dark-instructions' : ''}`}>
            <h3>Hur man spelar:</h3>
            <ol>
              <li>Varje spelare turas om att skriva ett påstående</li>
              <li>Påståendet kan vara sant (fakta) eller falskt (fiktion)</li>
              <li>Andra spelare röstar om de tror att det är sant eller falskt</li>
              <li>Få poäng för korrekta gissningar eller för att lura andra!</li>
              <li>Ju snabbare du svarar, desto fler poäng får du!</li>
            </ol>
          </div>
          
          {/* Chat i lobbyn */}
          <div className="chat-container" ref={chatContainerRef}>
            <div className="chat-messages">
              {chat.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`chat-message ${msg.username === username ? "own-message" : ""} ${msg.system ? "system-message" : ""} animate-in`}
                  style={{animationDelay: `${idx < 5 ? 0.1 * idx : 0}s`}}
                >
                  <div className="message-header">
                    <span className="message-username">{msg.username}</span>
                    <span className="message-time">
                      {new Date(msg.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))}
            </div>
            <form className="chat-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Skriv ett meddelande..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit">Skicka</button>
            </form>
          </div>
        </div>
      ) : (
        // Spelskärm
        <div className="game-container">
          {/* Header med spelinformation */}
          <div className="game-header">
            <h1>Fact or Fiction - Rum: {roomCode}</h1>
            <div className="game-mode">
              Läge: {gameMode === 'rapid' ? 'Snabbt' : gameMode === 'expert' ? 'Expert' : 'Klassiskt'}
            </div>
            <div className="dark-mode-toggle">
              <button onClick={toggleDarkMode}>
                {darkMode ? '☀️ Ljust läge' : '🌙 Mörkt läge'}
              </button>
              {devMode && <div className="dev-badge">Dev Mode</div>}
            </div>
          </div>

          <div className="game-content">
            <div className="game-main">
              {/* Spelets innehåll */}
              <div className="game-area">
                {currentSubmitter === username && !submitted && (
                  <div className="submit-container">
                    <h2>Din tur! Skapa ett påstående</h2>
                    <div className="fact-instructions">
                      <p>Skriv ett påstående som kan vara sant eller falskt</p>
                      <p>De andra spelarna kommer att gissa om det är sant eller falskt</p>
                    </div>
                    <div className="fact-form">
                      <textarea
                        id="fact-input"
                        placeholder="Skriv ditt påstående här..."
                      ></textarea>
                      <div className="fact-buttons">
                        <button
                          className="fact-button true"
                          onClick={() => handleSubmitFact(document.getElementById("fact-input").value, true)}
                        >
                          Skicka som SANT
                        </button>
                        <button
                          className="fact-button false"
                          onClick={() => handleSubmitFact(document.getElementById("fact-input").value, false)}
                        >
                          Skicka som FALSKT
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                                {submitted && facts.length > 0 && !voted && currentSubmitter !== username && (
                                  <div className="vote-container">
                                    <h2>Rösta på påståendet</h2>
                                    <div className="current-fact">
                                      <p>{facts[facts.length - 1].fact}</p>
                                      <p className="fact-author">Skrivet av: {facts[facts.length - 1].username}</p>
                                    </div>
                                    <div className="vote-buttons">
                                      <button className="vote-button true" onClick={() => handleVote(true)}>
                                        SANT
                                      </button>
                                      <button className="vote-button false" onClick={() => handleVote(false)}>
                                        FALSKT
                                      </button>
                                    </div>
                                  </div>
                                )}
                
                                {result && (
                                  <div className="result-container">
                                    <h2>Resultat</h2>
                                    <div className="result-fact">
                                      <p>{result.fact}</p>
                                      <p className="fact-result">Detta påstående var {result.isTrue ? "SANT" : "FALSKT"}!</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                
                            {/* Sidopanel med timer och spelare */}
                            <div className="game-sidebar">
                              <div className="timer-container">
                                <div className="timer">
                                  <div className="timer-value">{timer}</div>
                                  <div className="timer-label">sekunder kvar</div>
                                </div>
                              </div>
                              
                              <div className="players-container">
                                <h3>Spelare</h3>
                                <div className="player-list">
                                  {players.map((player, index) => (
                                    <div key={index} className={`player-item ${player.name === currentSubmitter ? 'current-turn' : ''}`}>
                                      <div className="player-info">
                                        <span className="player-name">{player.name}</span>
                                        {player.name === username && <span className="current-player-indicator">(Du)</span>}
                                        {player.isHost && <span className="host-indicator">👑</span>}
                                      </div>
                                      <div className="player-score">{player.score}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                
                          {/* Chat area */}
                          <div className="chat-container" ref={chatContainerRef}>
                            <div className="chat-messages">
                              {chat.map((msg, idx) => (
                                <div 
                                  key={idx} 
                                  className={`chat-message ${msg.username === username ? "own-message" : ""} ${msg.system ? "system-message" : ""}`}
                                >
                                  <div className="message-header">
                                    <span className="message-username">{msg.username}</span>
                                    <span className="message-time">
                                      {new Date(msg.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <div className="message-text">{msg.text}</div>
                                </div>
                              ))}
                            </div>
                            <form className="chat-input" onSubmit={handleSendMessage}>
                              <input
                                type="text"
                                placeholder="Skriv ett meddelande..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                              />
                              <button type="submit">Skicka</button>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                
                export default App;
                    