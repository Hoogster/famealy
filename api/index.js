const mealsData = require('../server/data/meals.json');

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

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  // GET /api/meals
  if (pathname === '/api/meals' && req.method === 'GET') {
    return res.json(mealsData);
  }

  // GET /api/categories
  if (pathname === '/api/categories' && req.method === 'GET') {
    const categories = [...new Set(mealsData.map(meal => meal.category))];
    return res.json(categories);
  }

  // GET /api/allergens
  if (pathname === '/api/allergens' && req.method === 'GET') {
    const allergens = [...new Set(mealsData.flatMap(meal => meal.allergens))];
    return res.json(allergens);
  }

  // POST /api/suggestions
  if (pathname === '/api/suggestions' && req.method === 'POST') {
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

    return res.json({
      suggestions,
      total: validMeals.length,
      selectedRetailer,
      postalCode,
      region: postalCode ? getRegionFromPostalCode(postalCode) : null
    });
  }

  // GET /api/recipe/search
  if (pathname.startsWith('/api/recipe/search') && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const mealName = url.searchParams.get('mealName');

    if (!mealName) {
      return res.status(400).json({ error: 'Meal name is required' });
    }

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

    return res.json({
      mealName,
      searchUrls
    });
  }

  // POST /api/shopping-list/export
  if (pathname === '/api/shopping-list/export' && req.method === 'POST') {
    const { ingredients, mealName } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }

    const textFormat = ingredients
      .map(ing => `${ing.name} - ${ing.amount}`)
      .join('\n');

    const csvFormat = 'Zutat,Menge,Aktion,Händler\n' +
      ingredients
        .map(ing => `"${ing.name}","${ing.amount}","${ing.onPromo ? 'Ja' : 'Nein'}","${ing.retailer || '-'}"`)
        .join('\n');

    return res.json({
      mealName,
      textFormat,
      csvFormat,
      count: ingredients.length
    });
  }

  res.status(404).json({ error: 'Not found' });
};
