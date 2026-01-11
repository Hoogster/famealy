const mealsData = require('../server/data/meals.json');
const {
  getRegionFromPostalCode,
  isPromoValidForRegion,
  isProteinIngredient,
  calculateMealScore
} = require('../shared/mealLogic');

module.exports = (req, res) => {
  try {
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
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
