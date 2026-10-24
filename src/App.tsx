import { useEffect, useState } from 'react'
import { AlertCircle, ClipboardList, House, ListChecks, ShoppingBasket, X } from 'lucide-react'
import { useStore } from './data/store'
import { cx } from './components/ui'
import { toISODate, today } from './lib/dates'
import HomePage from './pages/Home'
import GroceriesPage from './pages/Groceries'
import TodosPage from './pages/Todos'
import ListsPage from './pages/Lists'

export type Tab = 'accueil' | 'courses' | 'afaire' | 'listes'

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'accueil', label: 'Accueil', icon: House },
  { id: 'courses', label: 'Courses', icon: ShoppingBasket },
  { id: 'afaire', label: 'À faire', icon: ListChecks },
  { id: 'listes', label: 'Listes', icon: ClipboardList },
]

const readHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'accueil'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash)
  const { data, error, dismissError } = useStore()
  const index = TABS.findIndex((t) => t.id === tab)
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
      {tab === 'listes' && <ListsPage />}

      {error && (
        <div className="animate-fade fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-late-soft p-3 text-sm text-late">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">Synchronisation impossible : {error}</p>
          <button onClick={dismissError} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/80 backdrop-blur-xl">
        <ul className="relative mx-auto grid max-w-lg grid-cols-4 px-2">
          {/* Pastille qui glisse sous l'onglet actif */}
          <span
            aria-hidden
            className="absolute left-2 top-2.5 flex h-8 justify-center transition-transform duration-500 ease-smooth"
            style={{ width: 'calc((100% - 16px) / 4)', transform: `translateX(${index * 100}%)` }}
          >
            <span className="h-full w-14 rounded-full bg-accent-soft" />
          </span>
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => go(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cx(
                  'relative flex w-full flex-col items-center gap-1 pb-1 pt-2.5 text-[11px] font-medium transition-colors duration-300',
                  tab === id ? 'text-accent' : 'text-muted',
                )}
              >
                <span className="grid h-8 w-14 place-items-center">
                  <Icon size={21} strokeWidth={tab === id ? 2.3 : 1.9} />
                </span>
                {label}
                {id === 'afaire' && lateCount > 0 && (
                  <span className="num absolute right-[calc(50%-22px)] top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-late px-1 text-[10px] font-bold text-surface">
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
