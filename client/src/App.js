import React, { useState, useEffect } from 'react';
import './App.css';
import './enhancements.css';

// Retailer configuration - easy to extend for future phases
// Phase 1: Migros only (hardcoded)
// Phase 2: Uncomment and add to ENABLED_RETAILERS = ['Migros', 'Coop']
// const RETAILERS = [
//   { id: 'Migros', name: 'Migros', regional: true },
//   { id: 'Coop', name: 'Coop', regional: true },
//   { id: 'Aldi Suisse', name: 'Aldi', regional: false }
// ];

// Migros cooperative mapping based on postal code
const getMigrosCooperative = (plz) => {
  if (!plz || plz.length < 4) return null;

  const firstTwo = parseInt(plz.substring(0, 2));

  // Migros Genève
  if (firstTwo === 12) return 'Migros Genève';

  // Migros Vaud
  if (firstTwo === 10 || (firstTwo >= 13 && firstTwo <= 16)) return 'Migros Vaud';

  // Migros Neuenburg-Freiburg
  if (firstTwo === 17 || firstTwo === 20 || firstTwo === 25 || firstTwo === 26 || firstTwo === 27 || firstTwo === 28) {
    return 'Migros Neuenburg-Freiburg';
  }

  // Migros Aare (Bern, Solothurn, parts of Aargau)
  if (firstTwo === 30 || firstTwo === 31 || firstTwo === 32 || firstTwo === 33 ||
      firstTwo === 34 || firstTwo === 35 || firstTwo === 36 || firstTwo === 37 ||
      firstTwo === 38 || firstTwo === 45 || firstTwo === 46 ||
      (firstTwo >= 47 && firstTwo <= 49) || firstTwo === 50 || firstTwo === 52 || firstTwo === 53) {
    return 'Migros Aare';
  }

  // Migros Basel
  if (firstTwo === 40 || firstTwo === 41 || firstTwo === 42 || firstTwo === 43 || firstTwo === 44) {
    return 'Migros Basel';
  }

  // Migros Luzern (Zentralschweiz)
  if (firstTwo === 60 || firstTwo === 61 || firstTwo === 62 || firstTwo === 63 || firstTwo === 64 || firstTwo === 65) {
    return 'Migros Luzern';
  }

  // Migros Ticino
  if (firstTwo === 69) return 'Migros Ticino';

  // Migros Ostschweiz/Graubünden
  if (firstTwo === 70 || firstTwo === 71 || firstTwo === 72 || firstTwo === 73 || firstTwo === 74 ||
      firstTwo === 75 || firstTwo === 76 || firstTwo === 77 || firstTwo === 78 || firstTwo === 79 ||
      firstTwo === 90 || firstTwo === 91 || firstTwo === 92 || firstTwo === 93 || firstTwo === 94 ||
      firstTwo === 95 || firstTwo === 96 || firstTwo === 97 || firstTwo === 98 || firstTwo === 99) {
    return 'Migros Ostschweiz';
  }

  // Migros Zürich
  if (firstTwo >= 80 && firstTwo <= 86) return 'Migros Zürich';

  // Migros Aargau (eastern part)
  if (firstTwo === 51 || firstTwo === 54 || firstTwo === 55 || firstTwo === 56 || firstTwo === 57) {
    return 'Migros Aare';
  }

  return 'Migros';
};

// Postal code to city mapping for Swiss regions
const POSTAL_CODE_CITIES = {
  '1000': 'Lausanne', '1200': 'Genève', '1700': 'Fribourg',
  '2000': 'Neuchâtel', '2500': 'Biel/Bienne',
  '3000': 'Bern', '3072': 'Ostermundigen', '3600': 'Thun',
  '4000': 'Basel', '4500': 'Solothurn',
  '5000': 'Aarau', '5400': 'Baden',
  '6000': 'Luzern', '6300': 'Zug',
  '7000': 'Chur', '6900': 'Lugano',
  '8000': 'Zürich', '8400': 'Winterthur', '8600': 'Dübendorf',
  '9000': 'St. Gallen', '9500': 'Wil'
};

// Get city name from postal code (matches first 2-4 digits)
const getCityFromPostalCode = (plz) => {
  if (!plz || plz.length < 4) return '';

  // Try exact match first
  if (POSTAL_CODE_CITIES[plz]) {
    return POSTAL_CODE_CITIES[plz];
  }

  // Try matching first 3 digits
  const prefix3 = plz.substring(0, 3) + '0';
  if (POSTAL_CODE_CITIES[prefix3]) {
    return POSTAL_CODE_CITIES[prefix3];
  }

  // Try matching first 2 digits
  const prefix2 = plz.substring(0, 2) + '00';
  if (POSTAL_CODE_CITIES[prefix2]) {
    return POSTAL_CODE_CITIES[prefix2];
  }

  // Return region based on first digit
  const firstDigit = parseInt(plz[0]);
  const regions = {
    1: 'Westschweiz', 2: 'Westschweiz', 3: 'Bern',
    4: 'Basel', 5: 'Aargau', 6: 'Zentralschweiz',
    7: 'Graubünden', 8: 'Zürich', 9: 'Ostschweiz'
  };
  return regions[firstDigit] || '';
};

function App() {
  // Load postal code from localStorage
  const [postalCode, setPostalCode] = useState(
    () => localStorage.getItem('famealy_postalCode') || ''
  );

  // Auto-select Migros (Phase 1: Migros only)
  const selectedRetailer = 'Migros'; // Hardcoded for Phase 1
  const [migrosCooperative, setMigrosCooperative] = useState(() => {
    const savedPostalCode = localStorage.getItem('famealy_postalCode');
    return savedPostalCode ? getMigrosCooperative(savedPostalCode) : null;
  });
  const [cityName, setCityName] = useState(() => {
    const savedPostalCode = localStorage.getItem('famealy_postalCode');
    return savedPostalCode ? getCityFromPostalCode(savedPostalCode) : '';
  });
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

  // NEW: Enhanced weekly planner with persistence
  useEffect(() => {
    const saved = localStorage.getItem('famealy_weeklyPlan');
    if (saved) {
      setWeeklyPlan(JSON.parse(saved));
    } else {
      // Initialize with empty week
      const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      setWeeklyPlan(days.map(day => ({ day, meal: null, customText: '' })));
    }
  }, []);

  // Save weekly plan to localStorage whenever it changes
  useEffect(() => {
    if (weeklyPlan.length > 0) {
      localStorage.setItem('famealy_weeklyPlan', JSON.stringify(weeklyPlan));
    }
  }, [weeklyPlan]);

  const generateWeeklyPlan = () => {
    if (suggestions.length < 7) {
      alert('Generieren Sie mindestens 7 Menüvorschläge für einen Wochenplan!');
      return;
    }

    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const plan = days.map((day, index) => ({
      day,
      meal: suggestions[index] || null,
      customText: ''
    }));

    setWeeklyPlan(plan);
    setShowWeeklyPlanner(true);
  };

  const addMealToWeeklyPlan = (meal) => {
    if (weeklyPlan.length === 0) {
      const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      setWeeklyPlan(days.map(day => ({ day, meal: null, customText: '' })));
    }

    // Find first empty day slot
    setWeeklyPlan(prev => {
      const updated = [...prev];
      const emptyIndex = updated.findIndex(d => !d.meal && !d.customText);

      if (emptyIndex >= 0) {
        updated[emptyIndex] = { ...updated[emptyIndex], meal };
        setShowWeeklyPlanner(true);
        setCopyFeedback(`${meal.name} zu ${updated[emptyIndex].day} hinzugefügt!`);
        setTimeout(() => setCopyFeedback(''), 3000);
      } else {
        alert('Wochenplan ist voll! Bitte entfernen Sie zuerst ein Gericht.');
      }

      return updated;
    });
  };

  const updateWeeklyPlanDay = (dayIndex, meal) => {
    setWeeklyPlan(prev => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], meal, customText: '' };
      return updated;
    });
  };

  const updateWeeklyPlanCustomText = (dayIndex, text) => {
    setWeeklyPlan(prev => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], customText: text, meal: null };
      return updated;
    });
  };

  const clearWeeklyPlanDay = (dayIndex) => {
    setWeeklyPlan(prev => {
      const updated = [...prev];
      updated[dayIndex] = { day: updated[dayIndex].day, meal: null, customText: '' };
      return updated;
    });
  };

  const clearWeeklyPlan = () => {
    if (window.confirm('Möchten Sie den gesamten Wochenplan löschen?')) {
      const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      setWeeklyPlan(days.map(day => ({ day, meal: null, customText: '' })));
    }
  };

  const exportWeeklyShoppingList = () => {
    const allIngredients = [];

    weeklyPlan.forEach(({ day, meal }) => {
      if (meal && meal.ingredients) {
        meal.ingredients.forEach(ing => {
          const existing = allIngredients.find(item => item.name === ing.name);
          if (existing) {
            // Consolidate same ingredient
            existing.days.push(day);
          } else {
            allIngredients.push({
              name: ing.name,
              amount: ing.amount,
              onPromo: ing.onPromo && ing.retailer === selectedRetailer,
              originalPrice: ing.originalPrice,
              promoPrice: ing.promoPrice,
              savings: ing.savings,
              days: [day]
            });
          }
        });
      }
    });

    // Format shopping list
    let text = '📅 WOCHENEINKAUFSLISTE\n';
    text += '='.repeat(50) + '\n\n';

    // Group by promo/non-promo
    const promoItems = allIngredients.filter(i => i.onPromo);
    const regularItems = allIngredients.filter(i => !i.onPromo);

    if (promoItems.length > 0) {
      text += '🏷️ AKTIONEN:\n';
      promoItems.forEach(item => {
        text += `\n• ${item.name} - ${item.amount}`;
        if (item.savings) {
          text += ` (CHF ${item.savings.toFixed(2)} gespart)`;
        }
        text += `\n  Benötigt für: ${item.days.join(', ')}`;
      });
      text += '\n\n';
    }

    if (regularItems.length > 0) {
      text += 'WEITERE ZUTATEN:\n';
      regularItems.forEach(item => {
        text += `\n• ${item.name} - ${item.amount}`;
        text += `\n  Benötigt für: ${item.days.join(', ')}`;
      });
    }

    // Calculate total savings
    const totalSavings = promoItems.reduce((sum, item) => sum + (item.savings || 0), 0);
    if (totalSavings > 0) {
      text += `\n\n${'='.repeat(50)}\n`;
      text += `💰 WOCHENERSPARNIS: CHF ${totalSavings.toFixed(2)}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopyFeedback('📋 Wocheneinkaufsliste wurde kopiert!');
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ Famealy</h1>
        <p>Menüvorschläge basierend auf aktuellen Aktionen</p>
      </header>

      <div className="container">
        <div className="preferences-section">
          {/* Migros-only Phase 1 */}
          <div className="migros-header">
            <div className="migros-logo">🟠 Migros</div>
            {migrosCooperative && <div className="migros-coop-badge">{migrosCooperative}</div>}
          </div>

          {/* Step 1: Postal Code */}
          <div className="postal-code-section">
            <h2>1️⃣ Postleitzahl eingeben</h2>
            <input
              type="text"
              placeholder="z.B. 3072"
              maxLength="4"
              value={postalCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPostalCode(value);
                const city = getCityFromPostalCode(value);
                const coop = getMigrosCooperative(value);
                setCityName(city);
                setMigrosCooperative(coop);
              }}
              className="postal-code-input-large"
            />
            {cityName && <div className="city-name">📍 {cityName}</div>}
            {migrosCooperative && <div className="migros-coop-name">🟠 {migrosCooperative}</div>}
            <small className="hint">Wird für nächste Session gespeichert</small>
          </div>

          {/* Step 2: Parameters */}
          <div className="parameters-section">
            <h2>2️⃣ Parameter</h2>

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
              <div className="time-scale">
                <span>⚡ Schnell (15-30)</span>
                <span>🕐 Mittel (30-60)</span>
                <span>🕐🕐 Lang (60-120)</span>
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
            disabled={loading || !postalCode}
          >
            {loading ? 'Suche Migros-Aktionen...' : '🔍 Menüvorschläge generieren'}
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
              {suggestions.map(meal => {
                // Calculate total savings for this meal
                const promoIngredients = meal.ingredients.filter(ing =>
                  ing.onPromo && ing.retailer === selectedRetailer && ing.savings
                );
                const totalSavings = promoIngredients.reduce((sum, ing) => sum + ing.savings, 0);
                const totalOriginal = promoIngredients.reduce((sum, ing) => sum + (ing.originalPrice || 0), 0);
                const totalPromo = promoIngredients.reduce((sum, ing) => sum + (ing.promoPrice || 0), 0);
                const savingsPercent = totalOriginal > 0 ? Math.round((totalSavings / totalOriginal) * 100) : 0;

                return (
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

                    {/* SAVINGS SUMMARY - NEW */}
                    {totalSavings > 0 && (
                      <div className="savings-summary">
                        <div className="savings-header">
                          <strong>💰 Gesamtersparnis:</strong>
                          <span className="savings-amount">CHF {totalSavings.toFixed(2)} (-{savingsPercent}%)</span>
                        </div>
                        <div className="savings-details">
                          <div className="price-comparison">
                            <span className="original-total">Regulär: CHF {totalOriginal.toFixed(2)}</span>
                            <span className="promo-total">Mit Aktionen: CHF {totalPromo.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="savings-meter">
                          <div className="meter-bar">
                            <div
                              className="meter-fill"
                              style={{width: `${Math.min(meal.savingsRatio || 0, 100)}%`}}
                            ></div>
                          </div>
                          <div className="meter-label">{meal.savingsRatio || 0}% der Zutaten im Angebot</div>
                        </div>
                      </div>
                    )}

                    {/* INGREDIENTS WITH PRICING - ENHANCED */}
                    <div className="ingredients">
                      <strong>Zutaten:</strong>
                      <ul>
                        {meal.ingredients.map((ing, idx) => {
                          const isPromo = ing.onPromo && ing.retailer === selectedRetailer;

                          return (
                            <li key={idx} className={isPromo ? 'promo-item' : ''}>
                              <div className="ingredient-main">
                                <span className="ingredient-name">{ing.name} - {ing.amount}</span>
                                {isPromo && ing.originalPrice && (
                                  <div className="ingredient-pricing">
                                    <span className="price-original">CHF {ing.originalPrice.toFixed(2)}</span>
                                    <span className="price-promo">CHF {ing.promoPrice.toFixed(2)}</span>
                                    <span className="price-discount">-{ing.discountPercent}%</span>
                                  </div>
                                )}
                              </div>
                              {isPromo && (
                                <div className="promo-details">
                                  <span className="promo-tag">
                                    🏷️ CHF {ing.savings?.toFixed(2)} gespart
                                  </span>
                                  {ing.promoEndDate && (
                                    <span className="promo-expires">
                                      ⏰ Bis {new Date(ing.promoEndDate).toLocaleDateString('de-CH')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
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
                      <button
                        className="action-button add-to-plan-button"
                        onClick={() => addMealToWeeklyPlan(meal)}
                      >
                        📅 Zu Wochenplan
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

        {/* Enhanced Weekly Planner */}
        {showWeeklyPlanner && weeklyPlan.length > 0 && (
          <div className="weekly-planner">
            <div className="weekly-planner-header">
              <h2>📅 Wochenplan</h2>
              <div className="planner-actions">
                <button className="export-weekly-button" onClick={exportWeeklyShoppingList}>
                  🛒 Wocheneinkaufsliste
                </button>
                <button className="clear-plan-button" onClick={clearWeeklyPlan}>
                  🗑️ Plan löschen
                </button>
              </div>
            </div>

            <div className="weekly-plan-grid">
              {weeklyPlan.map((dayPlan, index) => {
                const hasMeal = dayPlan.meal !== null;
                const hasCustom = dayPlan.customText && dayPlan.customText.trim() !== '';

                return (
                  <div key={index} className="day-plan">
                    <div className="day-plan-header">
                      <h3>{dayPlan.day}</h3>
                      {(hasMeal || hasCustom) && (
                        <button
                          className="clear-day-button"
                          onClick={() => clearWeeklyPlanDay(index)}
                          title="Tag löschen"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {hasMeal ? (
                      <div className="day-meal">
                        <div className="day-meal-name">{dayPlan.meal.name}</div>
                        <small className="day-meal-info">
                          ⏱️ {dayPlan.meal.prepTime} Min. | 👥 {dayPlan.meal.servings} Pers.
                        </small>
                        {dayPlan.meal.promoCount > 0 && (
                          <div className="day-meal-promos">
                            🏷️ {dayPlan.meal.promoCount} Aktionen
                          </div>
                        )}

                        {suggestions.length > 0 && (
                          <select
                            className="change-meal-select"
                            value={dayPlan.meal.id}
                            onChange={(e) => {
                              const newMeal = suggestions.find(m => m.id === parseInt(e.target.value));
                              if (newMeal) updateWeeklyPlanDay(index, newMeal);
                            }}
                          >
                            <option value="">-- Gericht wechseln --</option>
                            {suggestions.map(meal => (
                              <option key={meal.id} value={meal.id}>
                                {meal.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : hasCustom ? (
                      <div className="day-custom">
                        <div className="custom-meal-display">{dayPlan.customText}</div>
                        <input
                          type="text"
                          className="custom-meal-input"
                          value={dayPlan.customText}
                          onChange={(e) => updateWeeklyPlanCustomText(index, e.target.value)}
                          placeholder="z.B. Auswärts essen, Pizza bestellen..."
                        />
                      </div>
                    ) : (
                      <div className="day-empty">
                        <div className="empty-options">
                          {suggestions.length > 0 && (
                            <select
                              className="add-meal-select"
                              onChange={(e) => {
                                const meal = suggestions.find(m => m.id === parseInt(e.target.value));
                                if (meal) updateWeeklyPlanDay(index, meal);
                              }}
                            >
                              <option value="">+ Gericht wählen</option>
                              {suggestions.map(meal => (
                                <option key={meal.id} value={meal.id}>
                                  {meal.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="or-divider">oder</div>
                          <input
                            type="text"
                            className="custom-meal-input"
                            placeholder="Eigenen Eintrag erstellen..."
                            onBlur={(e) => {
                              if (e.target.value.trim()) {
                                updateWeeklyPlanCustomText(index, e.target.value);
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                updateWeeklyPlanCustomText(index, e.target.value);
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Weekly Summary */}
            <div className="weekly-summary">
              <h3>📊 Wochenübersicht</h3>
              <div className="summary-stats">
                <div className="stat">
                  <div className="stat-value">{weeklyPlan.filter(d => d.meal || d.customText).length}/7</div>
                  <div className="stat-label">Tage geplant</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {weeklyPlan.reduce((sum, d) => sum + (d.meal?.promoCount || 0), 0)}
                  </div>
                  <div className="stat-label">Aktionen</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    CHF {weeklyPlan.reduce((sum, d) => {
                      if (!d.meal) return sum;
                      const savings = d.meal.ingredients
                        .filter(ing => ing.onPromo && ing.retailer === selectedRetailer && ing.savings)
                        .reduce((s, ing) => s + ing.savings, 0);
                      return sum + savings;
                    }, 0).toFixed(2)}
                  </div>
                  <div className="stat-label">Wochenersparnis</div>
                </div>
              </div>
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
