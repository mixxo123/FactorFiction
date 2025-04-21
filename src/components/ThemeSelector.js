import React from 'react';
import './ThemeSelector.css';

const THEMES = [
  { id: 'classic', name: 'Klassisk', colors: { primary: '#5C62EC', secondary: '#4FD3C4', accent: '#FF7851' } },
  { id: 'dark', name: 'Mörk', colors: { primary: '#9146FF', secondary: '#3F464C', accent: '#FF6B6B' } },
  { id: 'nature', name: 'Natur', colors: { primary: '#2E7D32', secondary: '#81C784', accent: '#FFA000' } },
  { id: 'ocean', name: 'Hav', colors: { primary: '#0277BD', secondary: '#4FC3F7', accent: '#FFB74D' } },
  { id: 'candy', name: 'Godis', colors: { primary: '#E91E63', secondary: '#F48FB1', accent: '#9C27B0' } }
];

function ThemeSelector({ currentTheme, onThemeChange, onClose }) {
  return (
    <div className="theme-selector-modal">
      <div className="theme-selector-content">
        <h2>Välj tema</h2>
        
        <div className="themes-list">
          {THEMES.map(theme => (
            <div 
              key={theme.id}
              className={`theme-option ${currentTheme === theme.id ? 'selected' : ''}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <div className="theme-preview">
                <div 
                  className="theme-color primary" 
                  style={{ backgroundColor: theme.colors.primary }}
                ></div>
                <div 
                  className="theme-color secondary" 
                  style={{ backgroundColor: theme.colors.secondary }}
                ></div>
                <div 
                  className="theme-color accent" 
                  style={{ backgroundColor: theme.colors.accent }}
                ></div>
              </div>
              <div className="theme-name">{theme.name}</div>
            </div>
          ))}
        </div>
        
        <button className="close-button" onClick={onClose}>Spara tema</button>
      </div>
    </div>
  );
}

export default ThemeSelector;