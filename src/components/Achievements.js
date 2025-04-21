import React from 'react';
import './Achievements.css';

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Första segern', icon: '🏆', desc: 'Vann din första omgång', points: 10 },
  { id: 'fooled_all', name: 'Mästerbedragare', icon: '🎭', desc: 'Lurade alla med en falsk fakta', points: 25 },
  { id: 'perfect_score', name: 'Detektiv', icon: '🔍', desc: 'Gissade rätt 5 gånger i rad', points: 30 },
  { id: 'quick_thinker', name: 'Snabbtänkare', icon: '⚡', desc: 'Svarade på under 5 sekunder', points: 15 },
  { id: 'truth_master', name: 'Sanningssökare', icon: '✨', desc: 'Avslöjade 10 lögner', points: 20 },
];

function Achievements({ playerAchievements = [], onClose }) {
  return (
    <div className="achievements-modal">
      <div className="achievements-content">
        <h2>Prestationer <span className="achievements-badge">{playerAchievements.length}/{ACHIEVEMENTS.length}</span></h2>
        
        <div className="achievements-list">
          {ACHIEVEMENTS.map(achievement => {
            const unlocked = playerAchievements.includes(achievement.id);
            return (
              <div 
                key={achievement.id} 
                className={`achievement-item ${unlocked ? 'unlocked' : 'locked'}`}
              >
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-details">
                  <h3>{achievement.name}</h3>
                  <p>{achievement.desc}</p>
                  <div className="achievement-points">+{achievement.points} poäng</div>
                </div>
                <div className="achievement-status">
                  {unlocked ? '✓' : '🔒'}
                </div>
              </div>
            );
          })}
        </div>
        
        <button className="close-button" onClick={onClose}>Stäng</button>
      </div>
    </div>
  );
}

export default Achievements;