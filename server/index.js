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
    count = 3
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

  // Shuffle and pick random meals
  const shuffled = filteredMeals.sort(() => 0.5 - Math.random());
  const suggestions = shuffled.slice(0, count);

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
