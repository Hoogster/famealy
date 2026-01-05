import React, { useState, useEffect } from 'react';
import './App.css';

// Retailer configuration - easy to extend
const RETAILERS = [
  { id: 'migros', name: 'Migros', regional: true },
  { id: 'coop', name: 'Coop', regional: true },
  { id: 'aldi', name: 'Aldi', regional: false }
];

function App() {
  // Load postal code from localStorage
  const [postalCode, setPostalCode] = useState(
    () => localStorage.getItem('famealy_postalCode') || ''
  );

  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [maxPrepTime, setMaxPrepTime] = useState(60); // minutes
  const [familySize, setFamilySize] = useState(4);
  const [count, setCount] = useState(3);

  const [suggestions, setSuggestions] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [favorites, setFavorites] = useState(
    () => JSON.parse(localStorage.getItem('famealy_favorites') || '[]')
  );
  const [loading, setLoading] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipeUrls, setRecipeUrls] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [showWeeklyPlanner, setShowWeeklyPlanner] = useState(false);

  // Persist postal code to localStorage
  useEffect(() => {
    if (postalCode) {
      localStorage.setItem('famealy_postalCode', postalCode);
    }
  }, [postalCode]);

  // Persist favorites to localStorage
  useEffect(() => {
    localStorage.setItem('famealy_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleGetSuggestions = async () => {
    if (!selectedRetailer) {
      alert('Bitte wählen Sie zuerst einen Detailhändler aus!');
      return;
    }

    if (!postalCode) {
      alert('Bitte geben Sie Ihre Postleitzahl ein!');
      return;
    }

    setLoading(true);
    setSelectedMeal(null);
    setRecipeUrls([]);

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedRetailer,
          postalCode,
          maxPrepTime,
          familySize,
          count
        })
      });
      const data = await response.json();
      setSuggestions(data.suggestions || []);

      if (data.suggestions.length === 0) {
        alert(`Keine Gerichte mit ${selectedRetailer}-Aktionen gefunden. Versuchen Sie einen höheren Zeitwert.`);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der Vorschläge:', error);
      alert('Fehler beim Laden der Vorschläge');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRecipe = async (meal) => {
    setSelectedMeal(meal);
    try {
      const response = await fetch(`/api/recipe/search?mealName=${encodeURIComponent(meal.name)}`);
      const data = await response.json();
      setRecipeUrls(data.searchUrls);
    } catch (error) {
      console.error('Fehler beim Suchen des Rezepts:', error);
    }
  };

  const handleExportShoppingList = async (meal) => {
    try {
      const response = await fetch('/api/shopping-list/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ingredients: meal.ingredients,
          mealName: meal.name
        })
      });
      const data = await response.json();

      navigator.clipboard.writeText(data.textFormat);
      setCopyFeedback(`Einkaufsliste für "${meal.name}" wurde kopiert!`);
      setTimeout(() => setCopyFeedback(''), 3000);
    } catch (error) {
      console.error('Fehler beim Exportieren:', error);
      setCopyFeedback('Fehler beim Kopieren');
      setTimeout(() => setCopyFeedback(''), 3000);
    }
  };

  const toggleFavorite = (mealId) => {
    setFavorites(prev =>
      prev.includes(mealId)
        ? prev.filter(id => id !== mealId)
        : [...prev, mealId]
    );
  };

  const generateWeeklyPlan = () => {
    if (suggestions.length < 7) {
      alert('Generieren Sie mindestens 7 Menüvorschläge für einen Wochenplan!');
      return;
    }

    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const plan = days.map((day, index) => ({
      day,
      meal: suggestions[index] || null
    }));

    setWeeklyPlan(plan);
    setShowWeeklyPlanner(true);
  };

  const updateWeeklyPlanDay = (dayIndex, newMeal) => {
    setWeeklyPlan(prev => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], meal: newMeal };
      return updated;
    });
  };

  const selectedRetailerObj = RETAILERS.find(r => r.id === selectedRetailer);
  const showPostalCode = selectedRetailerObj?.regional;

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ Famealy</h1>
        <p>Menüvorschläge basierend auf aktuellen Aktionen</p>
      </header>

      <div className="container">
        {/* Step 1: Retailer Selection */}
        <div className="preferences-section">
          <h2>1️⃣ Detailhändler wählen</h2>

          <div className="retailer-buttons">
            {RETAILERS.map(retailer => (
              <button
                key={retailer.id}
                className={`retailer-button ${selectedRetailer === retailer.id ? 'active' : ''}`}
                onClick={() => setSelectedRetailer(retailer.id)}
              >
                {retailer.name}
              </button>
            ))}
          </div>

          {/* Step 2: Postal Code (if regional retailer) */}
          {showPostalCode && (
            <div className="postal-code-section">
              <h2>2️⃣ Postleitzahl eingeben</h2>
              <input
                type="text"
                placeholder="z.B. 3072"
                maxLength="4"
                value={postalCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPostalCode(value);
                }}
                className="postal-code-input-large"
              />
              <small className="hint">Wird für nächste Session gespeichert</small>
            </div>
          )}

          {/* Step 3: Parameters */}
          <div className="parameters-section">
            <h2>3️⃣ Parameter</h2>

            <div className="param-group">
              <label>⏱️ Maximale Zubereitungszeit (Minuten):</label>
              <div className="time-selector">
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={maxPrepTime}
                  onChange={(e) => setMaxPrepTime(parseInt(e.target.value))}
                />
                <span className="time-value">{maxPrepTime} Min.</span>
              </div>
            </div>

            <div className="param-group">
              <label>👨‍👩‍👧‍👦 Familiengrösse (Personen):</label>
              <input
                type="number"
                min="1"
                max="12"
                value={familySize}
                onChange={(e) => setFamilySize(parseInt(e.target.value))}
              />
            </div>

            <div className="param-group">
              <label>📊 Anzahl Vorschläge:</label>
              <input
                type="number"
                min="1"
                max="14"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
              />
            </div>
          </div>

          <button
            className="suggest-button"
            onClick={handleGetSuggestions}
            disabled={loading || !selectedRetailer || !postalCode}
          >
            {loading ? 'Suche Aktionen...' : '🔍 Menüvorschläge generieren'}
          </button>
        </div>

        {copyFeedback && (
          <div className="feedback-message">
            ✓ {copyFeedback}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="suggestions-section">
            <div className="suggestions-header">
              <h2>Ihre Menüvorschläge ({selectedRetailer} Aktionen)</h2>
              {suggestions.length >= 7 && (
                <button
                  className="weekly-plan-button"
                  onClick={generateWeeklyPlan}
                >
                  📅 Wochenplan generieren
                </button>
              )}
            </div>

            <div className="meals-grid">
              {suggestions.map(meal => (
                <div key={meal.id} className="meal-card">
                  <div className="meal-header">
                    <h3>{meal.name}</h3>
                    <button
                      className={`favorite-button ${favorites.includes(meal.id) ? 'active' : ''}`}
                      onClick={() => toggleFavorite(meal.id)}
                      title={favorites.includes(meal.id) ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                    >
                      {favorites.includes(meal.id) ? '⭐' : '☆'}
                    </button>
                  </div>

                  <div className="meal-badges">
                    <span className="category-badge">{meal.category}</span>
                    {meal.promoCount > 0 && (
                      <span className="promo-badge">
                        🏷️ {meal.promoCount} {selectedRetailer}-Aktionen
                      </span>
                    )}
                  </div>

                  <div className="meal-info">
                    <span className="info-item">⏱️ {meal.prepTime} Min.</span>
                    <span className="info-item">👥 {meal.servings} Portionen</span>
                    {meal.nutrition && (
                      <span className="info-item">🔥 {meal.nutrition.calories} kcal</span>
                    )}
                  </div>

                  <div className="ingredients">
                    <strong>Zutaten:</strong>
                    <ul>
                      {meal.ingredients.map((ing, idx) => (
                        <li key={idx} className={ing.onPromo && ing.retailer === selectedRetailer ? 'promo-item' : ''}>
                          {ing.name} - {ing.amount}
                          {ing.onPromo && ing.retailer === selectedRetailer && (
                            <span className="promo-tag">🏷️ Aktion</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="meal-actions">
                    <button
                      className="action-button recipe-button"
                      onClick={() => handleSearchRecipe(meal)}
                    >
                      📖 Rezept suchen
                    </button>
                    <button
                      className="action-button shopping-button"
                      onClick={() => handleExportShoppingList(meal)}
                    >
                      🛒 Einkaufsliste
                    </button>
                  </div>

                  {selectedMeal?.id === meal.id && recipeUrls.length > 0 && (
                    <div className="recipe-links">
                      <h4>Rezepte online finden:</h4>
                      {recipeUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="recipe-link"
                        >
                          {url.name} →
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Planner */}
        {showWeeklyPlanner && weeklyPlan.length > 0 && (
          <div className="weekly-planner">
            <h2>📅 Wochenplan</h2>
            <div className="weekly-plan-grid">
              {weeklyPlan.map((dayPlan, index) => (
                <div key={index} className="day-plan">
                  <h3>{dayPlan.day}</h3>
                  {dayPlan.meal ? (
                    <div className="day-meal">
                      <div className="day-meal-name">{dayPlan.meal.name}</div>
                      <small>⏱️ {dayPlan.meal.prepTime} Min.</small>
                      <select
                        className="change-meal-select"
                        value={dayPlan.meal.id}
                        onChange={(e) => {
                          const newMeal = suggestions.find(m => m.id === parseInt(e.target.value));
                          updateWeeklyPlanDay(index, newMeal);
                        }}
                      >
                        {suggestions.map(meal => (
                          <option key={meal.id} value={meal.id}>
                            {meal.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="no-meal">Kein Gericht</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        {suggestions.length > 0 && (
          <div className="info-box">
            <h3>💡 Workflow</h3>
            <ol>
              <li>✅ Detailhändler gewählt: <strong>{selectedRetailer}</strong></li>
              <li>✅ PLZ eingegeben: <strong>{postalCode}</strong></li>
              <li>✅ Menüvorschläge mit {selectedRetailer}-Aktionen generiert</li>
              <li>Optional: Rezept online suchen (Klick auf "📖 Rezept suchen")</li>
              <li>Optional: Einkaufsliste exportieren (Klick auf "🛒 Einkaufsliste")</li>
              {suggestions.length >= 7 && <li>Optional: Wochenplan generieren (Klick auf "📅 Wochenplan")</li>}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
