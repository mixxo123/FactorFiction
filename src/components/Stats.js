import React from 'react';
import './Stats.css';

function Stats({ playerStats, onClose }) {
  const { 
    gamesPlayed = 0, 
    wins = 0, 
    correctGuesses = 0, 
    totalGuesses = 0,
    avgResponseTime = 0,
    bestStreak = 0,
    truths = 0,
    lies = 0
  } = playerStats || {};
  
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0;

  return (
    <div className="stats-modal">
      <div className="stats-content">
        <h2>Dina spelstatistik</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{gamesPlayed}</div>
            <div className="stat-label">Spelade matcher</div>
          </div>
          
          <div className="stat-card highlight">
            <div className="stat-value">{winRate}%</div>
            <div className="stat-label">Vinstprocent</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{wins}</div>
            <div className="stat-label">Vinster</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{accuracy}%</div>
            <div className="stat-label">Gissningsnoggranhet</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{avgResponseTime.toFixed(1)}s</div>
            <div className="stat-label">Genomsnittlig svarstid</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{bestStreak}</div>
            <div className="stat-label">Bästa svit</div>
          </div>
        </div>
        
        <div className="truth-lie-stats">
          <h3>Dina påståenden</h3>
          <div className="truth-lie-bar">
            <div 
              className="truth-bar" 
              style={{width: `${truths + lies > 0 ? (truths / (truths + lies)) * 100 : 0}%`}}
            >
              <span className="truth-label">Sanna: {truths}</span>
            </div>
            <div 
              className="lie-bar"
              style={{width: `${truths + lies > 0 ? (lies / (truths + lies)) * 100 : 0}%`}}
            >
              <span className="lie-label">Falska: {lies}</span>
            </div>
          </div>
        </div>
        
        <button className="close-button" onClick={onClose}>Stäng</button>
      </div>
    </div>
  );
}

export default Stats;