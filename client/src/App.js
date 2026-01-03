import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [preferences, setPreferences] = useState({
    familySize: 4,
    allergens: [],
    preferences: [],
    difficulty: 'alle',
    count: 3
  });

  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load categories and allergens
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Fehler beim Laden der Kategorien:', err));

    fetch('/api/allergens')
      .then(res => res.json())
      .then(data => setAllergens(data))
      .catch(err => console.error('Fehler beim Laden der Allergene:', err));
  }, []);

  const handleGetSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Fehler beim Abrufen der Vorschläge:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAllergen = (allergen) => {
    setPreferences(prev => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter(a => a !== allergen)
        : [...prev.allergens, allergen]
    }));
  };

  const togglePreference = (pref) => {
    setPreferences(prev => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter(p => p !== pref)
        : [...prev.preferences, pref]
    }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ Famealy</h1>
        <p>Menüvorschläge für die ganze Familie</p>
      </header>

      <div className="container">
        <div className="preferences-section">
          <h2>Ihre Präferenzen</h2>

          <div className="preference-group">
            <label>
              Familiengröße (Personen):
              <input
                type="number"
                min="1"
                max="12"
                value={preferences.familySize}
                onChange={(e) =>
                  setPreferences({ ...preferences, familySize: parseInt(e.target.value) })
                }
              />
            </label>
          </div>

          <div className="preference-group">
            <label>Schwierigkeitsgrad:</label>
            <select
              value={preferences.difficulty}
              onChange={(e) =>
                setPreferences({ ...preferences, difficulty: e.target.value })
              }
            >
              <option value="alle">Alle</option>
              <option value="einfach">Einfach</option>
              <option value="mittel">Mittel</option>
            </select>
          </div>

          <div className="preference-group">
            <label>
              Anzahl der Vorschläge:
              <input
                type="number"
                min="1"
                max="10"
                value={preferences.count}
                onChange={(e) =>
                  setPreferences({ ...preferences, count: parseInt(e.target.value) })
                }
              />
            </label>
          </div>

          {allergens.length > 0 && (
            <div className="preference-group">
              <label>Ausschließen (Allergene):</label>
              <div className="checkbox-group">
                {allergens.map(allergen => (
                  <button
                    key={allergen}
                    className={`tag-button ${
                      preferences.allergens.includes(allergen) ? 'active' : ''
                    }`}
                    onClick={() => toggleAllergen(allergen)}
                  >
                    {allergen}
                  </button>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div className="preference-group">
              <label>Bevorzugte Kategorien:</label>
              <div className="checkbox-group">
                {categories.map(category => (
                  <button
                    key={category}
                    className={`tag-button ${
                      preferences.preferences.includes(category) ? 'active' : ''
                    }`}
                    onClick={() => togglePreference(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="suggest-button"
            onClick={handleGetSuggestions}
            disabled={loading}
          >
            {loading ? 'Suche Gerichte...' : '🎲 Vorschläge generieren'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="suggestions-section">
            <h2>Ihre Menüvorschläge</h2>
            <div className="meals-grid">
              {suggestions.map(meal => (
                <div key={meal.id} className="meal-card">
                  <div className="meal-header">
                    <h3>{meal.name}</h3>
                    <span className="category-badge">{meal.category}</span>
                  </div>
                  <div className="meal-info">
                    <span className="info-item">⏱️ {meal.prepTime} Min.</span>
                    <span className="info-item">👥 {meal.servings} Portionen</span>
                    <span className="info-item">
                      📊 {meal.difficulty.charAt(0).toUpperCase() + meal.difficulty.slice(1)}
                    </span>
                  </div>
                  <div className="meal-tags">
                    {meal.tags.map(tag => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="ingredients">
                    <strong>Zutaten:</strong>
                    <ul>
                      {meal.ingredients.map((ingredient, idx) => (
                        <li key={idx}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  {meal.allergens.length > 0 && (
                    <div className="allergens">
                      <strong>⚠️ Allergene:</strong> {meal.allergens.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
