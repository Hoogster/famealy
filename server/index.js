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
    maxPrepTime = 60,
    count = 3,
    selectedRetailer = null,
    postalCode = null
  } = req.body;

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

  // Add promo count to each meal
  const mealsWithPromoCount = validMeals.map(meal => {
    const promoCount = meal.ingredients.filter(ing =>
      isPromoValidForRegion(ing, selectedRetailer, postalCode)
    ).length;

    return { ...meal, promoCount };
  });

  // Sort by promo count (most promos first)
  const sortedMeals = mealsWithPromoCount.sort((a, b) => b.promoCount - a.promoCount);

  const suggestions = sortedMeals.slice(0, count);

  res.json({
    suggestions,
    total: validMeals.length,
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
