import { normalizeName } from './format'

export type BookRecipe = { name: string; emoji: string; ingredients: string[] }

/**
 * Recettes d'office, écrites pour 4 et servies pour 2 (voir `forTwo`). La quantité vient en tête
 * (« 500 g spaghetti ») pour que l'ajout aux courses la sépare du nom. Sel, poivre et huile sont supposés là.
 */
export const RECIPE_BOOK: BookRecipe[] = [
  { name: 'Pâtes carbonara', emoji: '🍝', ingredients: ['500 g spaghetti', '200 g lardons', '4 œufs', '100 g parmesan', 'Crème fraîche'] },
  {
    name: 'Pâtes bolognaise',
    emoji: '🍝',
    ingredients: ['500 g spaghetti', '500 g bœuf haché', '1 oignon', '1 carotte', 'Coulis de tomate', 'Parmesan'],
  },
  {
    name: 'Lasagnes',
    emoji: '🧀',
    ingredients: ['Feuilles de lasagne', '500 g bœuf haché', 'Coulis de tomate', '1 oignon', 'Béchamel', '150 g emmental râpé'],
  },
  {
    name: 'Gratin dauphinois',
    emoji: '🥔',
    ingredients: ['1 kg pommes de terre', '50 cl crème fraîche', '50 cl lait', 'Ail', 'Emmental râpé'],
  },
  {
    name: 'Hachis parmentier',
    emoji: '🥔',
    ingredients: ['1 kg pommes de terre', '500 g bœuf haché', '1 oignon', 'Lait', 'Beurre', 'Emmental râpé'],
  },
  { name: 'Poulet rôti et pommes de terre', emoji: '🍗', ingredients: ['1 poulet', '1 kg pommes de terre', 'Ail', 'Thym', 'Beurre'] },
  {
    name: 'Poulet curry coco',
    emoji: '🍛',
    ingredients: ['600 g blancs de poulet', '40 cl lait de coco', '1 oignon', 'Curry', '300 g riz'],
  },
  {
    name: 'Blanquette de veau',
    emoji: '🥘',
    ingredients: ['1 kg veau', '250 g champignons', '2 carottes', '1 oignon', '20 cl crème fraîche', '300 g riz'],
  },
  {
    name: 'Bœuf bourguignon',
    emoji: '🍷',
    ingredients: ['1 kg bœuf à braiser', '75 cl vin rouge', '200 g lardons', '250 g champignons', '3 carottes', '2 oignons'],
  },
  {
    name: 'Chili con carne',
    emoji: '🌶️',
    ingredients: [
      '500 g bœuf haché',
      '1 boîte haricots rouges',
      '1 boîte tomates concassées',
      '1 oignon',
      '1 poivron',
      'Épices chili',
      '300 g riz',
    ],
  },
  {
    name: 'Risotto aux champignons',
    emoji: '🍄',
    ingredients: ['300 g riz arborio', '400 g champignons', '1 oignon', 'Bouillon de légumes', '100 g parmesan', 'Vin blanc'],
  },
  {
    name: 'Quiche lorraine',
    emoji: '🥧',
    ingredients: ['1 pâte brisée', '200 g lardons', '3 œufs', '20 cl crème fraîche', '20 cl lait', 'Emmental râpé'],
  },
  {
    name: 'Tarte aux poireaux',
    emoji: '🥧',
    ingredients: ['1 pâte brisée', '3 poireaux', '3 œufs', '20 cl crème fraîche', 'Emmental râpé'],
  },
  { name: 'Croque-monsieur', emoji: '🥪', ingredients: ['Pain de mie', '8 tranches de jambon', 'Emmental', 'Béchamel', 'Salade verte'] },
  {
    name: 'Raclette',
    emoji: '🧀',
    ingredients: ['800 g fromage à raclette', '1,5 kg pommes de terre', 'Charcuterie', 'Cornichons', 'Salade verte'],
  },
  {
    name: 'Tartiflette',
    emoji: '🧀',
    ingredients: ['1 reblochon', '1 kg pommes de terre', '200 g lardons', '1 oignon', '20 cl crème fraîche'],
  },
  { name: 'Croziflette', emoji: '🧀', ingredients: ['400 g crozets', '1 reblochon', '200 g lardons', '1 oignon', '20 cl crème fraîche'] },
  {
    name: 'Burgers maison',
    emoji: '🍔',
    ingredients: ['4 pains burger', '4 steaks hachés', 'Cheddar', '1 tomate', 'Salade verte', '1 oignon rouge', 'Frites surgelées'],
  },
  {
    name: 'Tacos',
    emoji: '🌮',
    ingredients: ['8 tortillas', '500 g bœuf haché', '1 avocat', '2 tomates', 'Salade verte', 'Cheddar râpé', 'Crème fraîche'],
  },
  {
    name: 'Fajitas au poulet',
    emoji: '🌯',
    ingredients: ['8 tortillas', '600 g blancs de poulet', '2 poivrons', '1 oignon', 'Épices fajitas', 'Crème fraîche'],
  },
  {
    name: 'Pizza maison',
    emoji: '🍕',
    ingredients: ['2 pâtes à pizza', 'Coulis de tomate', '2 mozzarellas', 'Jambon', 'Champignons', 'Olives'],
  },
  { name: 'Saumon, riz et brocolis', emoji: '🐟', ingredients: ['4 pavés de saumon', '300 g riz', '1 brocoli', '1 citron'] },
  {
    name: 'Poisson pané et purée',
    emoji: '🐟',
    ingredients: ['8 poissons panés', '1 kg pommes de terre', 'Lait', 'Beurre', 'Haricots verts'],
  },
  { name: 'Moules frites', emoji: '🦪', ingredients: ['2 kg moules', '2 échalotes', 'Vin blanc', 'Persil', 'Frites surgelées'] },
  {
    name: 'Couscous',
    emoji: '🥘',
    ingredients: [
      '500 g semoule',
      '4 cuisses de poulet',
      '4 merguez',
      '3 carottes',
      '2 courgettes',
      '1 boîte pois chiches',
      'Épices couscous',
    ],
  },
  {
    name: 'Paella',
    emoji: '🥘',
    ingredients: [
      '400 g riz rond',
      '4 cuisses de poulet',
      '300 g crevettes',
      '500 g moules',
      '1 chorizo',
      '1 poivron',
      'Petits pois',
      'Safran',
    ],
  },
  { name: 'Ratatouille', emoji: '🍆', ingredients: ['2 aubergines', '3 courgettes', '2 poivrons', '4 tomates', '2 oignons', 'Ail'] },
  {
    name: 'Soupe de légumes',
    emoji: '🥣',
    ingredients: ['4 carottes', '3 pommes de terre', '2 poireaux', '1 navet', 'Bouillon de légumes'],
  },
  {
    name: 'Velouté de potiron',
    emoji: '🎃',
    ingredients: ['1 kg potiron', '2 pommes de terre', '1 oignon', '20 cl crème fraîche', 'Bouillon de légumes'],
  },
  {
    name: 'Salade César',
    emoji: '🥗',
    ingredients: ['2 salades romaines', '400 g blancs de poulet', 'Croûtons', 'Parmesan', 'Sauce César'],
  },
  {
    name: 'Salade niçoise',
    emoji: '🥗',
    ingredients: ['Salade verte', '4 tomates', '4 œufs', '2 boîtes de thon', 'Olives noires', 'Haricots verts', '1 poivron'],
  },
  { name: 'Omelette et salade', emoji: '🍳', ingredients: ['8 œufs', 'Champignons', 'Emmental râpé', 'Salade verte'] },
  { name: 'Saucisses aux lentilles', emoji: '🌭', ingredients: ['4 saucisses de Morteau', '500 g lentilles', '2 carottes', '1 oignon'] },
  { name: 'Endives au jambon', emoji: '🥬', ingredients: ['8 endives', '8 tranches de jambon', 'Béchamel', 'Emmental râpé'] },
  {
    name: 'Wok de nouilles',
    emoji: '🍜',
    ingredients: ['400 g nouilles chinoises', '400 g blancs de poulet', '2 carottes', '1 poivron', 'Pousses de soja', 'Sauce soja'],
  },
  { name: 'Crêpes', emoji: '🥞', ingredients: ['250 g farine', '4 œufs', '50 cl lait', 'Beurre', 'Pâte à tartiner'] },
]

/** « échalotes » → « échalote », « salades romaines » → « salade romaine » (jusqu'au « de » / « à »). */
function singular(words: string) {
  const parts = words.split(' ')
  const stop = parts.findIndex((w) => /^(de|à|d')$/i.test(w))
  return parts.map((w, i) => (stop !== -1 && i >= stop) || w.length < 4 ? w : w.replace(/eaux$/, 'eau').replace(/s$/, '')).join(' ')
}

const fmt = (n: number) => String(n).replace('.', ',')

/** « 500 g spaghetti » → « 250 g spaghetti », « 4 œufs » → « 2 œufs », « 1 oignon » reste 1. */
export function forTwo(line: string) {
  const m = line.match(/^(\d+(?:,\d+)?)\s?(kg|g|cl|ml|l)?\s+(.+)$/i)
  if (!m) return line
  let n = Number(m[1].replace(',', '.')) / 2
  let unit = m[2]?.toLowerCase()
  const rest = m[3]
  if (!unit) {
    const count = Math.max(1, Math.ceil(n))
    return `${count} ${count === 1 && n > 0.5 ? singular(rest) : rest}`
  }
  if (unit === 'kg' && n < 1) [n, unit] = [n * 1000, 'g']
  if (unit === 'l' && n < 1) [n, unit] = [n * 100, 'cl']
  if (unit === 'g') n = n >= 50 ? Math.round(n / 10) * 10 : Math.round(n)
  if (unit === 'cl') n = Math.round(n / 5) * 5 || 5
  return `${fmt(n)} ${unit} ${rest}`
}

/** Le carnet d'office, ramené à 2 personnes. */
export const BOOK_FOR_TWO: BookRecipe[] = RECIPE_BOOK.map((r) => ({ ...r, ingredients: r.ingredients.map(forTwo) }))

/** Recettes connues dont le nom contient ce qu'on tape (« carbo » → Pâtes carbonara). */
export function findRecipes<T extends { name: string }>(all: T[], query: string) {
  const q = normalizeName(query)
  if (q.length < 2) return []
  return all.filter((r) => normalizeName(r.name).includes(q))
}
