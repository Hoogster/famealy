const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load meals data
const mealsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'meals.json'), 'utf8')
);

// Helper function to determine region from postal code
function getRegionFromPostalCode(postalCode) {
  if (!postalCode) return null;
  const firstDigit = parseInt(postalCode.toString()[0]);
  const regions = {
    1: 'Westschweiz', // Geneva, Lausanne
    2: 'Westschweiz', // Neuchâtel
    3: 'Bern',
    4: 'Basel',
    5: 'Aargau/Solothurn',
    6: 'Zentralschweiz', // Lucerne
    7: 'Graubünden/Ticino',
    8: 'Zürich',
    9: 'Ostschweiz' // St. Gallen, Thurgau
  };
  return regions[firstDigit] || null;
}

// Check if ingredient promotion is valid for region
function isPromoValidForRegion(ingredient, retailer, postalCode) {
  if (!ingredient.onPromo) return false;
  if (ingredient.retailer !== retailer) return false;

  // For Migros and Coop, check regional availability
  if ((retailer === 'Migros' || retailer === 'Coop') && postalCode) {
    const region = getRegionFromPostalCode(postalCode);
    // If ingredient has regional restrictions, check them
    if (ingredient.regions && ingredient.regions.length > 0) {
      return ingredient.regions.includes(region);
    }
  }

  return true;
}

// Get all meals
app.get('/api/meals', (req, res) => {
  res.json(mealsData);
});

// Get meal suggestions based on preferences
app.post('/api/suggestions', (req, res) => {
  const {
    familySize = 4,
    allergens = [],
    preferences = [],
    difficulty = 'alle',
    count = 3,
    preferBalanced = true,
    preferPromotions = true,
    selectedRetailer = null,
    postalCode = null
  } = req.body;

  // Filter meals based on criteria
  let filteredMeals = mealsData.filter(meal => {
    // Filter by allergens
    if (allergens.length > 0) {
      const hasAllergen = meal.allergens.some(allergen =>
        allergens.includes(allergen)
      );
      if (hasAllergen) return false;
    }

    // Filter by difficulty
    if (difficulty !== 'alle' && meal.difficulty !== difficulty) {
      return false;
    }

    // Filter by servings (within range)
    if (Math.abs(meal.servings - familySize) > 2) {
      return false;
    }

    // Prefer meals matching preferences
    if (preferences.length > 0) {
      const matchesPreference =
        preferences.includes(meal.category) ||
        meal.tags.some(tag => preferences.includes(tag));

      return matchesPreference;
    }

    return true;
  });

  // If too few results, relax some constraints
  if (filteredMeals.length < count) {
    filteredMeals = mealsData.filter(meal => {
      if (allergens.length > 0) {
        const hasAllergen = meal.allergens.some(allergen =>
          allergens.includes(allergen)
        );
        if (hasAllergen) return false;
      }
      return true;
    });
  }

  // Score meals based on preferences and retailer
  const scoredMeals = filteredMeals.map(meal => {
    let score = 0;

    // Prefer balanced meals (moderate weight)
    if (preferBalanced && meal.nutrition?.balanced) {
      score += 5;
    }

    // STRONG preference for promotions
    if (preferPromotions) {
      let validPromoCount = 0;

      meal.ingredients.forEach(ing => {
        // If retailer is selected, only count promotions from that retailer
        if (selectedRetailer) {
          if (isPromoValidForRegion(ing, selectedRetailer, postalCode)) {
            validPromoCount++;
          }
        } else {
          // No retailer selected, count all promotions
          if (ing.onPromo) {
            validPromoCount++;
          }
        }
      });

      // Heavy weight for promotions - 10 points per promo item
      score += validPromoCount * 10;

      // Extra bonus if meal has 3+ promo items
      if (validPromoCount >= 3) {
        score += 20;
      }

      // If retailer is selected, strongly penalize meals with no matching promos
      if (selectedRetailer && validPromoCount === 0) {
        score -= 50;
      }
    }

    return { ...meal, score, validPromoCount: score > 0 ? Math.floor(score / 10) : 0 };
  });

  // Sort by score with minimal randomness (prioritize high-scoring meals)
  const sortedMeals = scoredMeals
    .filter(meal => !selectedRetailer || meal.score >= 0) // Filter out penalized meals
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      // Minimal randomness to keep high scorers on top
      return scoreDiff + (Math.random() - 0.5) * 2;
    });

  const suggestions = sortedMeals.slice(0, count);

  res.json({
    suggestions,
    total: filteredMeals.length,
    selectedRetailer,
    postalCode,
    region: postalCode ? getRegionFromPostalCode(postalCode) : null
  });
});

// Get categories
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(mealsData.map(meal => meal.category))];
  res.json(categories);
});

// Get all available allergens
app.get('/api/allergens', (req, res) => {
  const allergens = [...new Set(mealsData.flatMap(meal => meal.allergens))];
  res.json(allergens);
});

// Search for recipes online
app.get('/api/recipe/search', async (req, res) => {
  const { mealName } = req.query;

  if (!mealName) {
    return res.status(400).json({ error: 'Meal name is required' });
  }

  // Return search URL for the recipe
  // Using Swiss-specific recipe sites
  const searchUrls = [
    {
      name: 'Betty Bossi',
      url: `https://www.bettybossi.ch/de/Suche?q=${encodeURIComponent(mealName)}`
    },
    {
      name: 'Swissmilk',
      url: `https://www.swissmilk.ch/de/rezepte-kochideen/?q=${encodeURIComponent(mealName)}`
    },
    {
      name: 'Fooby (Coop)',
      url: `https://fooby.ch/de/rezepte.html?q=${encodeURIComponent(mealName)}`
    },
    {
      name: 'Google Rezepte',
      url: `https://www.google.com/search?q=${encodeURIComponent(mealName + ' Rezept Schweiz')}`
    }
  ];

  res.json({
    mealName,
    searchUrls
  });
});

// Export shopping list
app.post('/api/shopping-list/export', (req, res) => {
  const { ingredients, mealName } = req.body;

  if (!ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Ingredients array is required' });
  }

  // Format for Family Wall (simple text format)
  const textFormat = ingredients
    .map(ing => `${ing.name} - ${ing.amount}`)
    .join('\n');

  // CSV format
  const csvFormat = 'Zutat,Menge,Aktion,Händler\n' +
    ingredients
      .map(ing => `"${ing.name}","${ing.amount}","${ing.onPromo ? 'Ja' : 'Nein'}","${ing.retailer || '-'}"`)
      .join('\n');

  res.json({
    mealName,
    textFormat,
    csvFormat,
    count: ingredients.length
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🍽️  Famealy Server läuft auf Port ${PORT}`);
});
