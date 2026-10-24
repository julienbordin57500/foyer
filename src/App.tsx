import { useEffect, useState } from 'react'
import { AlertCircle, House, ListChecks, ShoppingBasket, X } from 'lucide-react'
import { useStore } from './data/store'
import { cx } from './components/ui'
import { toISODate, today } from './lib/dates'
import HomePage from './pages/Home'
import GroceriesPage from './pages/Groceries'
import TodosPage from './pages/Todos'

export type Tab = 'accueil' | 'courses' | 'afaire'

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'accueil', label: 'Accueil', icon: House },
  { id: 'courses', label: 'Courses', icon: ShoppingBasket },
  { id: 'afaire', label: 'À faire', icon: ListChecks },
]

const readHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'accueil'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash)
  const { data, error, dismissError } = useStore()
  const lateCount = data.todos.filter((t) => !t.done_at && t.due_date && t.due_date < toISODate(today())).length

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
      {tab === 'courses' && <GroceriesPage />}
      {tab === 'afaire' && <TodosPage />}

      {error && (
        <div className="animate-fade fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-late-soft p-3 text-sm text-late">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">Synchronisation impossible : {error}</p>
          <button onClick={dismissError} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl">
        <ul className="mx-auto grid max-w-lg grid-cols-3">
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
                {id === 'afaire' && lateCount > 0 && (
                  <span className="num absolute right-[calc(50%-24px)] top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-late px-1 text-[10px] font-bold text-surface">
                    {lateCount}
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
