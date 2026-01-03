import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [preferences, setPreferences] = useState({
    familySize: 4,
    allergens: [],
    preferences: [],
    difficulty: 'alle',
    count: 3,
    preferBalanced: true,
    preferPromotions: true
  });

  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipeUrls, setRecipeUrls] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState('');

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
    setSelectedMeal(null);
    setRecipeUrls([]);
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

      // Copy to clipboard
      navigator.clipboard.writeText(data.textFormat);
      setCopyFeedback(`Einkaufsliste für "${meal.name}" wurde in die Zwischenablage kopiert!`);
      setTimeout(() => setCopyFeedback(''), 3000);
    } catch (error) {
      console.error('Fehler beim Exportieren der Einkaufsliste:', error);
      setCopyFeedback('Fehler beim Kopieren');
      setTimeout(() => setCopyFeedback(''), 3000);
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

  const countPromoItems = (meal) => {
    return meal.ingredients.filter(ing => ing.onPromo).length;
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ Famealy</h1>
        <p>Ausgewogene Menüvorschläge mit Schweizer Aktionen</p>
      </header>

      <div className="container">
        <div className="preferences-section">
          <h2>Ihre Präferenzen</h2>

          <div className="preference-group">
            <label>
              Familiengrösse (Personen):
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

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.preferBalanced}
                onChange={(e) =>
                  setPreferences({ ...preferences, preferBalanced: e.target.checked })
                }
              />
              Ausgewogene Mahlzeiten bevorzugen
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.preferPromotions}
                onChange={(e) =>
                  setPreferences({ ...preferences, preferPromotions: e.target.checked })
                }
              />
              Aktionen von Schweizer Detailhändlern bevorzugen
            </label>
          </div>

          {allergens.length > 0 && (
            <div className="preference-group">
              <label>Ausschliessen (Allergene):</label>
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

        {copyFeedback && (
          <div className="feedback-message">
            ✓ {copyFeedback}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="suggestions-section">
            <h2>Ihre Menüvorschläge</h2>
            <div className="meals-grid">
              {suggestions.map(meal => {
                const promoCount = countPromoItems(meal);
                return (
                  <div key={meal.id} className="meal-card">
                    <div className="meal-header">
                      <h3>{meal.name}</h3>
                      <span className="category-badge">{meal.category}</span>
                    </div>

                    {meal.nutrition?.balanced && (
                      <div className="balanced-badge">
                        ✓ Ausgewogen
                      </div>
                    )}

                    {promoCount > 0 && (
                      <div className="promo-badge">
                        🏷️ {promoCount} Zutaten im Angebot
                      </div>
                    )}

                    <div className="meal-info">
                      <span className="info-item">⏱️ {meal.prepTime} Min.</span>
                      <span className="info-item">👥 {meal.servings} Portionen</span>
                      <span className="info-item">
                        📊 {meal.difficulty.charAt(0).toUpperCase() + meal.difficulty.slice(1)}
                      </span>
                      {meal.nutrition && (
                        <span className="info-item">
                          🔥 {meal.nutrition.calories} kcal
                        </span>
                      )}
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
                          <li key={idx} className={ingredient.onPromo ? 'promo-item' : ''}>
                            {ingredient.name} - {ingredient.amount}
                            {ingredient.onPromo && (
                              <span className="promo-tag">
                                🏷️ {ingredient.retailer}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {meal.allergens.length > 0 && (
                      <div className="allergens">
                        <strong>⚠️ Allergene:</strong> {meal.allergens.join(', ')}
                      </div>
                    )}

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
                        🛒 Einkaufsliste kopieren
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
                );
              })}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="info-box">
            <h3>💡 Tipps zur Einkaufsliste</h3>
            <p>
              Klicken Sie auf "Einkaufsliste kopieren", um die Zutaten in die Zwischenablage zu kopieren.
              Sie können diese dann direkt in Family Wall einfügen:
            </p>
            <ol>
              <li>Öffnen Sie Family Wall App</li>
              <li>Gehen Sie zur Einkaufsliste</li>
              <li>Fügen Sie die kopierten Zutaten ein</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
