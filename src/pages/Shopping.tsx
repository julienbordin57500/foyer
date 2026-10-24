import { useState, type FormEvent } from 'react'
import { Minus, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { isLow, sortProducts } from '../lib/finance'
import type { Product } from '../lib/types'
import { Button, Card, Empty, Field, PageHeader, SectionTitle, Sheet, cx } from '../components/ui'

export default function ShoppingPage() {
  const { data, insert } = useStore()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)

  const sorted = sortProducts(data.products)
  const low = sorted.filter(isLow)
  const ok = sorted.filter((p) => !isLow(p))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    insert('products', { name: n, stock: 0, threshold: 1 })
    setName('')
  }

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={low.length ? `${low.length} produit${low.length > 1 ? 's' : ''} à racheter` : 'Tout est en stock'}
      />

      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un produit…"
          aria-label="Nouveau produit"
          className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 text-[16px] outline-none ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
        />
        <button aria-label="Ajouter" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink active:scale-95 disabled:opacity-40" disabled={!name.trim()}>
          <Plus size={22} />
        </button>
      </form>

      {data.products.length === 0 && (
        <Empty icon={<ShoppingBasket />} title="Liste vide" text="Ajoutez les produits que vous achetez régulièrement, avec leur seuil d'alerte." />
      )}

      {low.length > 0 && (
        <>
          <SectionTitle>À racheter</SectionTitle>
          <ul className="space-y-2">
            {low.map((p) => (
              <ProductRow key={p.id} p={p} onEdit={() => setEditing(p)} />
            ))}
          </ul>
        </>
      )}

      {ok.length > 0 && (
        <>
          <SectionTitle>En stock</SectionTitle>
          <Card className="px-0 py-0">
            <ul className="divide-y divide-line">
              {ok.map((p) => (
                <ProductRow key={p.id} p={p} onEdit={() => setEditing(p)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      <ProductSheet product={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function ProductRow({ p, onEdit }: { p: Product; onEdit(): void }) {
  const { adjustStock } = useStore()
  const low = isLow(p)
  const out = p.stock === 0

  return (
    <li
      className={cx(
        'flex items-center gap-2 px-4 py-2.5',
        low && 'rounded-3xl ring-1',
        low && (out ? 'bg-danger-soft ring-danger-line' : 'bg-warn-soft ring-warn-line'),
      )}
    >
      <button onClick={onEdit} className="min-w-0 flex-1 py-1 text-left">
        <span className="block truncate font-medium">{p.name}</span>
        <span className={cx('block text-xs', low ? (out ? 'font-semibold text-danger' : 'font-semibold text-warn') : 'text-muted')}>
          {out ? 'Rupture' : low ? 'Stock bas' : 'En stock'} · seuil {p.threshold}
        </span>
      </button>
      <div className="flex items-center rounded-full bg-surface ring-1 ring-line">
        <button
          onClick={() => adjustStock(p.id, -1)}
          disabled={out}
          aria-label={`Retirer un ${p.name}`}
          className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2 disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <span className={cx('num w-8 text-center text-lg font-bold', out && 'text-danger')} aria-live="polite">
          {p.stock}
        </span>
        <button
          onClick={() => adjustStock(p.id, 1)}
          aria-label={`Ajouter un ${p.name}`}
          className="grid size-10 place-items-center rounded-full text-accent active:bg-surface-2"
        >
          <Plus size={18} />
        </button>
      </div>
    </li>
  )
}

function ProductSheet({ product, onClose }: { product: Product | null; onClose(): void }) {
  return (
    <Sheet open={!!product} title="Modifier le produit" onClose={onClose}>
      {product && <ProductForm key={product.id} product={product} onClose={onClose} />}
    </Sheet>
  )
}

function ProductForm({ product, onClose }: { product: Product; onClose(): void }) {
  const { update, remove } = useStore()
  const [name, setName] = useState(product.name)
  const [stock, setStock] = useState(String(product.stock))
  const [threshold, setThreshold] = useState(String(product.threshold))

  const save = (e: FormEvent) => {
    e.preventDefault()
    update('products', product.id, {
      name: name.trim() || product.name,
      stock: Math.max(0, parseInt(stock) || 0),
      threshold: Math.max(0, parseInt(threshold) || 0),
    })
    onClose()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stock" type="number" inputMode="numeric" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        <Field
          label="Seuil d'alerte"
          type="number"
          inputMode="numeric"
          min={0}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
      </div>
      <p className="px-1 text-xs text-muted">Le produit passe en « À racheter » quand le stock atteint le seuil.</p>
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="danger"
          aria-label="Supprimer"
          className="px-4"
          onClick={() => {
            if (confirm(`Supprimer « ${product.name} » ?`)) {
              remove('products', product.id)
              onClose()
            }
          }}
        >
          <Trash2 size={18} />
        </Button>
        <Button className="flex-1">Enregistrer</Button>
      </div>
    </form>
  )
}
