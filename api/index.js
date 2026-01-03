const mealsData = require('../server/data/meals.json');

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
      allergens = [],
      preferences = [],
      difficulty = 'alle',
      count = 3,
      preferBalanced = true,
      preferPromotions = true
    } = req.body;

    let filteredMeals = mealsData.filter(meal => {
      if (allergens.length > 0) {
        const hasAllergen = meal.allergens.some(allergen =>
          allergens.includes(allergen)
        );
        if (hasAllergen) return false;
      }

      if (difficulty !== 'alle' && meal.difficulty !== difficulty) {
        return false;
      }

      if (Math.abs(meal.servings - familySize) > 2) {
        return false;
      }

      if (preferences.length > 0) {
        const matchesPreference =
          preferences.includes(meal.category) ||
          meal.tags.some(tag => preferences.includes(tag));
        return matchesPreference;
      }

      return true;
    });

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

    const scoredMeals = filteredMeals.map(meal => {
      let score = 0;
      if (preferBalanced && meal.nutrition?.balanced) {
        score += 10;
      }
      if (preferPromotions) {
        const promoCount = meal.ingredients.filter(ing => ing.onPromo).length;
        score += promoCount * 2;
      }
      return { ...meal, score };
    });

    const sortedMeals = scoredMeals.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      return scoreDiff + (Math.random() - 0.5) * 5;
    });

    const suggestions = sortedMeals.slice(0, count);

    return res.json({
      suggestions,
      total: filteredMeals.length
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
