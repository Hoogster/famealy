const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  getRegionFromPostalCode,
  isPromoValidForRegion,
  isProteinIngredient,
  calculateMealScore
} = require('../shared/mealLogic');

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
  try {
    res.json(mealsData);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({
      error: 'Failed to fetch meals',
      message: error.message
    });
  }
});

// Get meal suggestions based on preferences
app.post('/api/suggestions', (req, res) => {
  try {
    const {
      familySize = 4,
      maxPrepTime = 60,
      count = 3,
      selectedRetailer = null,
      postalCode = null
    } = req.body;

    // Input validation
    if (postalCode !== null) {
      const postalCodeNum = parseInt(postalCode);
      if (isNaN(postalCodeNum) || postalCodeNum < 1000 || postalCodeNum > 9999) {
        return res.status(400).json({
          error: 'Invalid postal code. Must be between 1000 and 9999.'
        });
      }
    }

    if (familySize < 1 || familySize > 12) {
      return res.status(400).json({
        error: 'Invalid family size. Must be between 1 and 12.'
      });
    }

    if (maxPrepTime < 15 || maxPrepTime > 120) {
      return res.status(400).json({
        error: 'Invalid preparation time. Must be between 15 and 120 minutes.'
      });
    }

    if (count < 1 || count > 20) {
      return res.status(400).json({
        error: 'Invalid count. Must be between 1 and 20.'
      });
    }

  // STRICT filtering: ONLY meals with promotions from selected retailer
  let validMeals = mealsData.filter(meal => {
    // Must have at least one promo from selected retailer
    if (selectedRetailer) {
      const hasRetailerPromo = meal.ingredients.some(ing =>
        isPromoValidForRegion(ing, selectedRetailer, postalCode)
      );
      if (!hasRetailerPromo) return false;
    }

    // Filter by max prep time
    if (meal.prepTime > maxPrepTime) {
      return false;
    }

    // Filter by family size (within range)
    if (Math.abs(meal.servings - familySize) > 2) {
      return false;
    }

    return true;
  });

  // Calculate intelligent scores for each meal
  const mealsWithScores = validMeals.map(meal => {
    const promoCount = meal.ingredients.filter(ing =>
      isPromoValidForRegion(ing, selectedRetailer, postalCode)
    ).length;

    const score = calculateMealScore(meal, selectedRetailer, postalCode);
    const savingsRatio = Math.round((promoCount / meal.ingredients.length) * 100);

    return {
      ...meal,
      promoCount,
      savingsScore: score,
      savingsRatio
    };
  });

  // Sort by intelligent score (highest savings/best deals first)
  const sortedMeals = mealsWithScores.sort((a, b) => b.savingsScore - a.savingsScore);

  const suggestions = sortedMeals.slice(0, count);

    res.json({
      suggestions,
      total: validMeals.length,
      selectedRetailer,
      postalCode,
      region: postalCode ? getRegionFromPostalCode(postalCode) : null
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate meal suggestions',
      message: error.message
    });
  }
});

// Get categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = [...new Set(mealsData.map(meal => meal.category))];
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

// Get all available allergens
app.get('/api/allergens', (req, res) => {
  try {
    const allergens = [...new Set(mealsData.flatMap(meal => meal.allergens))];
    res.json(allergens);
  } catch (error) {
    console.error('Error fetching allergens:', error);
    res.status(500).json({
      error: 'Failed to fetch allergens',
      message: error.message
    });
  }
});

// Search for recipes online
app.get('/api/recipe/search', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error generating recipe search URLs:', error);
    res.status(500).json({
      error: 'Failed to generate recipe search URLs',
      message: error.message
    });
  }
});

// Export shopping list
app.post('/api/shopping-list/export', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error exporting shopping list:', error);
    res.status(500).json({
      error: 'Failed to export shopping list',
      message: error.message
    });
  }
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
