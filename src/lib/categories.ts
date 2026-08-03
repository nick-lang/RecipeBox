// Fixed category taxonomy, based on the grandmasRecipes archive. The
// transcription pipeline picks exactly one of these per recipe.
export const CATEGORIES = [
  "Appetizers & Snacks",
  "Beverages",
  "Breads",
  "Breakfast",
  "Cakes & Frostings",
  "Candy",
  "Casseroles & Main Dishes",
  "Cookies & Bars",
  "Desserts",
  "Meats",
  "Pies",
  "Pickles & Preserves",
  "Salads",
  "Soups",
  "Vegetables & Sides",
  "Odds & Ends",
] as const;

export type Category = (typeof CATEGORIES)[number];
