import { useEffect, useState } from 'react'
import { AlertCircle, House, PieChart, Repeat, ShoppingBasket, X } from 'lucide-react'
import { useStore } from './data/store'
import { isLow } from './lib/finance'
import { cx } from './components/ui'
import HomePage from './pages/Home'
import ShoppingPage from './pages/Shopping'
import SubscriptionsPage from './pages/Subscriptions'
import BudgetPage from './pages/Budget'

export type Tab = 'accueil' | 'courses' | 'abonnements' | 'budget'

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'accueil', label: 'Accueil', icon: House },
  { id: 'courses', label: 'Courses', icon: ShoppingBasket },
  { id: 'abonnements', label: 'Abonnements', icon: Repeat },
  { id: 'budget', label: 'Budget', icon: PieChart },
]

const readHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'accueil'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash)
  const { data, error, dismissError } = useStore()
  const lowCount = data.products.filter(isLow).length

  useEffect(() => {
    const onHash = () => setTab(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (t: Tab) => {
    if (t !== tab) history.pushState(null, '', `#${t}`)
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-28">
      {tab === 'accueil' && <HomePage go={go} />}
      {tab === 'courses' && <ShoppingPage />}
      {tab === 'abonnements' && <SubscriptionsPage />}
      {tab === 'budget' && <BudgetPage />}

      {error && (
        <div className="animate-fade fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger ring-1 ring-danger-line">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">Synchronisation impossible : {error}</p>
          <button onClick={dismissError} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => go(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cx(
                  'relative flex w-full flex-col items-center gap-1 pb-1 pt-2.5 text-[11px] font-medium transition',
                  tab === id ? 'text-accent' : 'text-muted',
                )}
              >
                <span className={cx('grid h-8 w-14 place-items-center rounded-full transition', tab === id && 'bg-accent-soft')}>
                  <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
                </span>
                {label}
                {id === 'courses' && lowCount > 0 && (
                  <span className="num absolute right-[calc(50%-24px)] top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warn px-1 text-[10px] font-bold text-surface">
                    {lowCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
