/**
 * Shared Business Logic for Famealy
 *
 * This module contains all shared functions used by both:
 * - /api/index.js (Vercel serverless function)
 * - /server/index.js (Local Express server)
 *
 * Eliminates 240+ lines of code duplication
 */

/**
 * Determine Swiss region from postal code
 * @param {number|string} postalCode - Swiss postal code (1000-9999)
 * @returns {string|null} Region name or null
 */
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

/**
 * Check if ingredient promotion is valid for region
 * @param {object} ingredient - Ingredient object with onPromo, retailer, regions
 * @param {string} retailer - Selected retailer (e.g., 'Migros', 'Coop')
 * @param {number|string} postalCode - User's postal code
 * @returns {boolean} True if promotion is valid for this region
 */
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

/**
 * Check if ingredient is a protein source
 * @param {string} ingredientName - Name of the ingredient
 * @returns {boolean} True if ingredient is a protein source
 */
function isProteinIngredient(ingredientName) {
  const proteinKeywords = [
    'fleisch', 'hack', 'rind', 'schwein', 'poulet', 'huhn', 'chicken',
    'lachs', 'fisch', 'fish', 'salmon', 'thon', 'thunfisch',
    'tofu', 'bohnen', 'linsen', 'kichererbsen'
  ];
  const nameLower = ingredientName.toLowerCase();
  return proteinKeywords.some(keyword => nameLower.includes(keyword));
}

/**
 * Calculate intelligent score for meal based on promotions
 *
 * Scoring algorithm:
 * - Base: 10 points per promo item
 * - Protein bonus: +30 points for protein on promo
 * - Savings ratio: 0-40 points based on % of ingredients on promo
 * - Variety bonus: +15-25 points for diverse categories
 * - Multiple promos: +10-20 points for 3+ promos
 *
 * @param {object} meal - Meal object with ingredients array
 * @param {string} selectedRetailer - Selected retailer
 * @param {number|string} postalCode - User's postal code
 * @returns {number} Calculated score (0-150+)
 */
function calculateMealScore(meal, selectedRetailer, postalCode) {
  const promoIngredients = meal.ingredients.filter(ing =>
    isPromoValidForRegion(ing, selectedRetailer, postalCode)
  );

  const promoCount = promoIngredients.length;
  const totalIngredients = meal.ingredients.length;

  if (promoCount === 0) return 0;

  // Base score: 10 points per promo item
  let score = promoCount * 10;

  // PROTEIN BONUS: +30 points for protein ingredients on promo
  const hasProteinPromo = promoIngredients.some(ing =>
    isProteinIngredient(ing.name)
  );
  if (hasProteinPromo) {
    score += 30;
  }

  // SAVINGS RATIO BONUS: Percentage of ingredients on promo (0-40 points)
  const promoRatio = promoCount / totalIngredients;
  score += Math.floor(promoRatio * 40);

  // VARIETY BONUS: Multiple different types of promos
  const promoCategories = new Set();
  promoIngredients.forEach(ing => {
    if (isProteinIngredient(ing.name)) promoCategories.add('protein');
    else if (ing.name.toLowerCase().includes('pasta') ||
             ing.name.toLowerCase().includes('reis') ||
             ing.name.toLowerCase().includes('kartoffel') ||
             ing.name.toLowerCase().includes('hörnli')) {
      promoCategories.add('starch');
    } else if (ing.name.toLowerCase().includes('gemüse') ||
               ing.name.toLowerCase().includes('salat') ||
               ing.name.toLowerCase().includes('paprika') ||
               ing.name.toLowerCase().includes('tomat') ||
               ing.name.toLowerCase().includes('zucchetti')) {
      promoCategories.add('vegetable');
    } else {
      promoCategories.add('other');
    }
  });

  // Bonus for variety (different categories)
  if (promoCategories.size >= 3) {
    score += 25; // Excellent variety
  } else if (promoCategories.size === 2) {
    score += 15; // Good variety
  }

  // MULTIPLE PROMOS BONUS: Extra boost for many promos
  if (promoCount >= 4) {
    score += 20;
  } else if (promoCount >= 3) {
    score += 10;
  }

  return score;
}

module.exports = {
  getRegionFromPostalCode,
  isPromoValidForRegion,
  isProteinIngredient,
  calculateMealScore
};
