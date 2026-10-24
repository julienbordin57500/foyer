import type { Category } from './types'

// Mots-clés courants → rayon. Volontairement court : le reste tombe dans « Autre », modifiable d'un appui.
const KEYWORDS: Record<Exclude<Category, 'Autre'>, string[]> = {
  'Fruits & légumes': [
    'pomme', 'poire', 'banane', 'orange', 'citron', 'clementine', 'mandarine', 'kiwi', 'fraise', 'framboise',
    'raisin', 'peche', 'abricot', 'melon', 'pasteque', 'ananas', 'mangue', 'avocat', 'tomate', 'salade',
    'laitue', 'carotte', 'courgette', 'aubergine', 'poivron', 'concombre', 'oignon', 'echalote', 'ail',
    'pomme de terre', 'patate', 'champignon', 'brocoli', 'chou', 'epinard', 'haricot vert', 'poireau',
    'radis', 'navet', 'potiron', 'butternut', 'persil', 'basilic', 'coriandre', 'menthe', 'ciboulette',
    'fruit', 'legume', 'myrtille', 'cerise', 'prune', 'betterave', 'celeri', 'fenouil', 'endive',
  ],
  Frais: [
    'lait', 'beurre', 'creme', 'yaourt', 'yogourt', 'fromage', 'emmental', 'comte', 'mozzarella', 'parmesan',
    'feta', 'chevre', 'camembert', 'raclette', 'oeuf', 'jambon', 'lardon', 'saucisse', 'poulet', 'dinde',
    'boeuf', 'steak', 'hache', 'porc', 'veau', 'agneau', 'viande', 'poisson', 'saumon', 'cabillaud', 'thon frais',
    'crevette', 'surimi', 'chorizo', 'saucisson', 'pate a tarte', 'pate feuilletee', 'pate brisee', 'gnocchi',
    'ravioli', 'tofu', 'houmous', 'skyr', 'fromage blanc', 'petit suisse', 'compote', 'dessert',
  ],
  Épicerie: [
    'pate', 'pates', 'spaghetti', 'riz', 'semoule', 'quinoa', 'lentille', 'pois chiche', 'farine', 'sucre', 'sel',
    'poivre', 'huile', 'vinaigre', 'moutarde', 'mayonnaise', 'ketchup', 'sauce', 'conserve', 'thon', 'mais',
    'cafe', 'the', 'chocolat', 'cacao', 'cereale', 'muesli', 'biscuit', 'gateau', 'confiture', 'miel', 'nutella',
    'pain', 'baguette', 'brioche', 'biscotte', 'chips', 'apero', 'olive', 'epice', 'bouillon', 'levure',
    'pain de mie', 'tortilla', 'wrap', 'soupe', 'puree', 'compote', 'croissant',
  ],
  Surgelés: ['surgele', 'glace', 'frites', 'pizza', 'poisson pane', 'nugget', 'petits pois surgeles', 'sorbet', 'buche'],
  Boissons: [
    'eau', 'jus', 'soda', 'coca', 'limonade', 'sirop', 'biere', 'vin', 'champagne', 'cidre', 'perrier', 'boisson',
    'lait vegetal', 'lait d\'amande', 'lait d\'avoine', 'ice tea', 'capsule',
  ],
  'Maison & hygiène': [
    'papier toilette', 'pq', 'essuie-tout', 'sopalin', 'mouchoir', 'lessive', 'adoucissant', 'liquide vaisselle',
    'pastille', 'eponge', 'sac poubelle', 'poubelle', 'javel', 'nettoyant', 'savon', 'gel douche', 'shampoing',
    'shampooing', 'apres-shampoing', 'dentifrice', 'brosse a dent', 'deodorant', 'coton', 'rasoir', 'creme main',
    'serviette', 'tampon', 'protege', 'ampoule', 'pile', 'aluminium', 'film', 'allumette', 'bougie',
  ],
  Bébé: [
    'couche', 'lingette', 'lait infantile', 'lait bebe', '2eme age', '1er age', 'petit pot', 'biberon', 'tetine',
    'liniment', 'bebe', 'sterilis', 'compote bebe', 'creme change', 'serum phy',
  ],
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .trim()

// Ordre de test : les rayons les plus spécifiques d'abord (« lait bébé » avant « lait »).
const ORDER: Exclude<Category, 'Autre'>[] = ['Bébé', 'Surgelés', 'Boissons', 'Maison & hygiène', 'Fruits & légumes', 'Frais', 'Épicerie']

export function guessCategory(name: string): Category {
  const n = ` ${normalize(name)} `
  let best: { cat: Category; len: number } = { cat: 'Autre', len: 0 }
  for (const cat of ORDER) {
    for (const kw of KEYWORDS[cat]) {
      const k = normalize(kw)
      // Mot entier (avec pluriel en s/x) : « pate » ne doit pas matcher « patate ».
      const re = new RegExp(`[^a-z]${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|x)?[^a-z]`)
      if (re.test(n) && k.length > best.len) best = { cat, len: k.length }
    }
  }
  return best.cat
}
