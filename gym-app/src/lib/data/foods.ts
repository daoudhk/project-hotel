import type { FoodItem } from "../types";

/**
 * A small built-in food reference with approximate values per common serving
 * (rounded from public food-composition data such as USDA FoodData Central).
 * It is a starting point: a production build would connect to a full food
 * database and barcode service (see lib/integrations).
 */
export const FOODS: FoodItem[] = [
  { id: "egg", name: "Egg", serving: "1 large (50 g)", kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, tags: ["eggs"] },
  { id: "egg_white", name: "Egg whites", serving: "100 g", kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 },
  { id: "oats", name: "Rolled oats", serving: "50 g dry", kcal: 190, protein: 6.7, carbs: 33, fat: 3.4, tags: ["oatmeal", "porridge"] },
  { id: "greek_yogurt", name: "Greek yogurt, 2%", serving: "170 g pot", kcal: 146, protein: 17, carbs: 7, fat: 3.8, tags: ["yoghurt", "yogurt"] },
  { id: "milk", name: "Milk, semi-skimmed", serving: "250 ml", kcal: 122, protein: 8.2, carbs: 12, fat: 4.8 },
  { id: "whey", name: "Whey protein", serving: "1 scoop (30 g)", kcal: 120, protein: 24, carbs: 3, fat: 1.5, tags: ["protein shake", "shake"] },
  { id: "banana", name: "Banana", serving: "1 medium", kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "apple", name: "Apple", serving: "1 medium", kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: "berries", name: "Mixed berries", serving: "150 g", kcal: 75, protein: 1, carbs: 18, fat: 0.4 },
  { id: "orange", name: "Orange", serving: "1 medium", kcal: 62, protein: 1.2, carbs: 15, fat: 0.2 },
  { id: "bread", name: "Wholemeal bread", serving: "1 slice", kcal: 80, protein: 4, carbs: 13.5, fat: 1.1, tags: ["toast"] },
  { id: "bagel", name: "Bagel", serving: "1 plain", kcal: 270, protein: 10.5, carbs: 53, fat: 1.7 },
  { id: "rice", name: "White rice, cooked", serving: "1 cup (160 g)", kcal: 205, protein: 4.3, carbs: 45, fat: 0.4 },
  { id: "brown_rice", name: "Brown rice, cooked", serving: "1 cup (195 g)", kcal: 216, protein: 5, carbs: 45, fat: 1.8 },
  { id: "pasta", name: "Pasta, cooked", serving: "1 cup (140 g)", kcal: 220, protein: 8.1, carbs: 43, fat: 1.3 },
  { id: "potato", name: "Potato, baked", serving: "1 medium (175 g)", kcal: 160, protein: 4.3, carbs: 37, fat: 0.2 },
  { id: "sweet_potato", name: "Sweet potato, baked", serving: "1 medium (150 g)", kcal: 135, protein: 3, carbs: 31, fat: 0.2 },
  { id: "quinoa", name: "Quinoa, cooked", serving: "1 cup (185 g)", kcal: 222, protein: 8.1, carbs: 39, fat: 3.6 },
  { id: "tortilla", name: "Flour tortilla", serving: "1 large", kcal: 210, protein: 5.5, carbs: 35, fat: 5, tags: ["wrap"] },
  { id: "chicken_breast", name: "Chicken breast, cooked", serving: "150 g", kcal: 248, protein: 46.5, carbs: 0, fat: 5.4, tags: ["chicken"] },
  { id: "chicken_thigh", name: "Chicken thigh, cooked", serving: "150 g", kcal: 315, protein: 39, carbs: 0, fat: 16.5 },
  { id: "beef_mince", name: "Beef mince 5%, cooked", serving: "150 g", kcal: 260, protein: 39, carbs: 0, fat: 11, tags: ["ground beef", "mince"] },
  { id: "steak", name: "Sirloin steak, cooked", serving: "200 g", kcal: 400, protein: 58, carbs: 0, fat: 17.6, tags: ["beef"] },
  { id: "salmon", name: "Salmon, cooked", serving: "150 g", kcal: 310, protein: 33, carbs: 0, fat: 19, tags: ["fish"] },
  { id: "tuna", name: "Tuna, canned in water", serving: "1 can (110 g drained)", kcal: 120, protein: 27, carbs: 0, fat: 1 },
  { id: "white_fish", name: "Cod, cooked", serving: "150 g", kcal: 158, protein: 34, carbs: 0, fat: 1.3, tags: ["fish"] },
  { id: "prawns", name: "Prawns, cooked", serving: "100 g", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, tags: ["shrimp"] },
  { id: "tofu", name: "Tofu, firm", serving: "150 g", kcal: 216, protein: 24, carbs: 4.3, fat: 13 },
  { id: "tempeh", name: "Tempeh", serving: "100 g", kcal: 192, protein: 20, carbs: 7.6, fat: 10.8 },
  { id: "lentils", name: "Lentils, cooked", serving: "1 cup (200 g)", kcal: 230, protein: 18, carbs: 40, fat: 0.8 },
  { id: "chickpeas", name: "Chickpeas, cooked", serving: "1 cup (165 g)", kcal: 269, protein: 14.5, carbs: 45, fat: 4.2 },
  { id: "black_beans", name: "Black beans, cooked", serving: "1 cup (172 g)", kcal: 227, protein: 15, carbs: 41, fat: 0.9, tags: ["beans"] },
  { id: "cottage_cheese", name: "Cottage cheese", serving: "150 g", kcal: 147, protein: 16.5, carbs: 5, fat: 6.5 },
  { id: "cheddar", name: "Cheddar cheese", serving: "30 g", kcal: 121, protein: 7.5, carbs: 0.4, fat: 10, tags: ["cheese"] },
  { id: "peanut_butter", name: "Peanut butter", serving: "2 tbsp (32 g)", kcal: 190, protein: 7, carbs: 7, fat: 16 },
  { id: "almonds", name: "Almonds", serving: "30 g", kcal: 173, protein: 6.3, carbs: 6, fat: 15, tags: ["nuts"] },
  { id: "olive_oil", name: "Olive oil", serving: "1 tbsp", kcal: 119, protein: 0, carbs: 0, fat: 13.5, tags: ["oil"] },
  { id: "avocado", name: "Avocado", serving: "½ fruit", kcal: 120, protein: 1.5, carbs: 6.4, fat: 11 },
  { id: "broccoli", name: "Broccoli", serving: "1 cup (90 g)", kcal: 31, protein: 2.5, carbs: 6, fat: 0.3, tags: ["veg", "vegetables"] },
  { id: "salad", name: "Mixed salad", serving: "1 bowl (100 g)", kcal: 20, protein: 1.3, carbs: 3.5, fat: 0.2 },
  { id: "spinach", name: "Spinach", serving: "1 cup (30 g)", kcal: 7, protein: 0.9, carbs: 1.1, fat: 0.1 },
  { id: "mixed_veg", name: "Mixed vegetables", serving: "1 cup (150 g)", kcal: 65, protein: 3, carbs: 12, fat: 0.5, tags: ["veg", "vegetables"] },
  { id: "hummus", name: "Hummus", serving: "2 tbsp (30 g)", kcal: 70, protein: 2, carbs: 4, fat: 5 },
  { id: "granola", name: "Granola", serving: "50 g", kcal: 230, protein: 5, carbs: 32, fat: 9 },
  { id: "protein_bar", name: "Protein bar", serving: "1 bar (60 g)", kcal: 220, protein: 20, carbs: 22, fat: 7 },
  { id: "dark_chocolate", name: "Dark chocolate 70%", serving: "20 g", kcal: 120, protein: 1.6, carbs: 9, fat: 8.5, tags: ["chocolate"] },
  { id: "honey", name: "Honey", serving: "1 tbsp", kcal: 64, protein: 0, carbs: 17, fat: 0 },
  { id: "orange_juice", name: "Orange juice", serving: "250 ml", kcal: 112, protein: 1.7, carbs: 26, fat: 0.5, tags: ["juice"] },
  { id: "sports_drink", name: "Sports drink", serving: "500 ml", kcal: 130, protein: 0, carbs: 34, fat: 0 },
  { id: "coffee_latte", name: "Latte", serving: "medium (350 ml)", kcal: 190, protein: 12, carbs: 18, fat: 7, tags: ["coffee"] },
  { id: "pizza", name: "Pizza, cheese", serving: "1 slice", kcal: 285, protein: 12, carbs: 36, fat: 10 },
  { id: "burger", name: "Beef burger in bun", serving: "1 burger", kcal: 540, protein: 30, carbs: 40, fat: 29 },
  { id: "burrito", name: "Chicken burrito", serving: "1 burrito", kcal: 650, protein: 38, carbs: 75, fat: 20 },
  { id: "sushi", name: "Salmon sushi roll", serving: "6 pieces", kcal: 300, protein: 12, carbs: 45, fat: 7 },
  { id: "shawarma", name: "Chicken shawarma wrap", serving: "1 wrap", kcal: 560, protein: 35, carbs: 50, fat: 23 },
  { id: "falafel", name: "Falafel", serving: "4 pieces", kcal: 230, protein: 9, carbs: 22, fat: 12 },
  { id: "dates", name: "Dates, Medjool", serving: "2 dates", kcal: 133, protein: 0.9, carbs: 36, fat: 0.1 },
  { id: "rice_cakes", name: "Rice cakes", serving: "2 cakes", kcal: 70, protein: 1.4, carbs: 15, fat: 0.6 },
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export const getFood = (id: string) => BY_ID.get(id);

export function searchFoods(q: string, limit = 12): FoodItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return FOODS.slice(0, limit);
  return FOODS.map((f) => {
    const name = f.name.toLowerCase();
    const tags = (f.tags ?? []).join(" ");
    const score = name.startsWith(s) ? 3 : name.includes(s) ? 2 : tags.includes(s) ? 1 : 0;
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map((x) => x.f);
}
