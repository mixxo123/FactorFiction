import React, { useState } from 'react';
import './FactBank.css';

// Faktabanken - använd detta som inspiration när du inte kommer på egna påståenden
const FACT_CATEGORIES = [
  {
    name: 'Djur',
    facts: [
      { text: 'Kolibrier kan flyga baklänges.', isTrue: true },
      { text: 'Giraffer kan simma.', isTrue: false },
      { text: 'Katter har 9 liv.', isTrue: false },
      { text: 'Strutsar kan springa fortare än hästar.', isTrue: true },
      { text: 'Pingviner kan hoppa upp till 2 meter högt.', isTrue: true }
    ]
  },
  {
    name: 'Vetenskap',
    facts: [
      { text: 'Det finns mer bakterier i din mun än människor på jorden.', isTrue: true },
      { text: 'Ljus färdas snabbare i vatten än i luft.', isTrue: false },
      { text: 'Den mänskliga hjärnan kan lagra 2,5 petabyte information.', isTrue: true },
      { text: 'En kubs alla sidor kan göras av en enda kvadrat.', isTrue: true },
      { text: 'Guld löser sig i vanligt vatten.', isTrue: false }
    ]
  },
  {
    name: 'Historia',
    facts: [
      { text: 'Kleopatra levde närmare månlandningen än pyramidernas byggande.', isTrue: true },
      { text: 'Vikings bar hjälmar med horn.', isTrue: false },
      { text: 'Napoleon Bonaparte var kortare än genomsnittet.', isTrue: false },
      { text: 'Coca-Cola var ursprungligen grön.', isTrue: false },
      { text: 'Ishockey uppfanns i Kanada.', isTrue: true }
    ]
  },
  {
    name: 'Mat',
    facts: [
      { text: 'Choklad är giftigt för hundar.', isTrue: true },
      { text: 'Tomater var länge ansedda som giftiga i Europa.', isTrue: true },
      { text: 'Bananer växer på träd.', isTrue: false },
      { text: 'Honung kan aldrig bli dålig.', isTrue: true },
      { text: 'Jordnötter är en typ av ärtor, inte nötter.', isTrue: true }
    ]
  },
  {
    name: 'Sverige',
    facts: [
      { text: 'IKEA grundades i Stockholm.', isTrue: false },
      { text: 'Sverige har fler än 100,000 sjöar.', isTrue: true },
      { text: 'Smörgåsbord är ett svenskt ord som används internationellt.', isTrue: true },
      { text: 'Den svenska flaggan är den äldsta nationsflaggan i världen.', isTrue: false },
      { text: 'Volvo betyder "jag rullar" på latin.', isTrue: true }
    ]
  }
];

function FactBank({ onSelectFact, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState(FACT_CATEGORIES[0].name);
  
  const handleSelectFact = (fact) => {
    onSelectFact(fact);
    onClose();
  };
  
  const currentCategory = FACT_CATEGORIES.find(cat => cat.name === selectedCategory) || FACT_CATEGORIES[0];

  return (
    <div className="factbank-modal">
      <div className="factbank-content">
        <h2>Faktabank</h2>
        <p className="factbank-info">Välj ett påstående för inspiration!</p>
        
        <div className="category-tabs">
          {FACT_CATEGORIES.map(category => (
            <button 
              key={category.name}
              className={`category-tab ${selectedCategory === category.name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.name)}
            >
              {category.name}
            </button>
          ))}
        </div>
        
        <div className="facts-list">
          {currentCategory.facts.map((fact, index) => (
            <div 
              key={index}
              className="fact-item"
              onClick={() => handleSelectFact(fact)}
            >
              <div className="fact-text">{fact.text}</div>
              <div className={`fact-type ${fact.isTrue ? 'true' : 'false'}`}>
                {fact.isTrue ? 'SANT' : 'FALSKT'}
              </div>
            </div>
          ))}
        </div>
        
        <button className="close-button" onClick={onClose}>Stäng</button>
      </div>
    </div>
  );
}

export default FactBank;