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
    preferPromotions = true
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

  // Score meals based on preferences
  const scoredMeals = filteredMeals.map(meal => {
    let score = 0;

    // Prefer balanced meals
    if (preferBalanced && meal.nutrition?.balanced) {
      score += 10;
    }

    // Prefer meals with promotions
    if (preferPromotions) {
      const promoCount = meal.ingredients.filter(ing => ing.onPromo).length;
      score += promoCount * 2;
    }

    return { ...meal, score };
  });

  // Sort by score and add some randomness
  const sortedMeals = scoredMeals.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    // Add randomness while preferring higher scores
    return scoreDiff + (Math.random() - 0.5) * 5;
  });

  const suggestions = sortedMeals.slice(0, count);

  res.json({
    suggestions,
    total: filteredMeals.length
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
