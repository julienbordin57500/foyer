import { useEffect, useState } from 'react'
import { AlertCircle, ClipboardList, House, ListChecks, ShoppingBasket, X } from 'lucide-react'
import { useStore } from './data/store'
import { cx } from './components/ui'
import { toISODate, today } from './lib/dates'
import { Splash } from './auth/AuthGate'
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
  const { data, loading, error, dismissError, toast } = useStore()
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

  if (loading) return <Splash />

  return (
    <div data-section={tab} className="mx-auto min-h-dvh max-w-lg px-4 pb-36">
      {tab === 'accueil' && <HomePage go={go} />}
      {tab === 'courses' && <GroceriesPage />}
      {tab === 'afaire' && <TodosPage />}
      {tab === 'listes' && <ListsPage />}

      {toast && (
        <div className="animate-pop fixed inset-x-4 bottom-28 z-40 mx-auto flex h-12 max-w-md items-center gap-3 rounded-2xl bg-ink pl-4 pr-1.5 text-[14px] text-bg shadow-soft">
          <p className="min-w-0 flex-1 truncate">{toast.message}</p>
          <button onClick={toast.undo} className="h-9 rounded-xl px-3 font-semibold text-sec active:bg-white/10">
            Annuler
          </button>
        </div>
      )}

      {error && (
        <div className="animate-fade fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-late-soft p-3 text-sm text-late">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">Synchronisation impossible : {error}</p>
          <button onClick={dismissError} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Barre d'onglets flottante ; chaque onglet s'allume dans la couleur de sa rubrique. */}
      <nav className="fixed inset-x-3 z-30 mx-auto max-w-md" style={{ bottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <ul className="relative grid grid-cols-4 rounded-[28px] p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/8 backdrop-blur-xl" style={{ background: 'var(--nav)' }}>
          <span
            aria-hidden
            className="absolute bottom-1.5 left-1.5 top-1.5 transition-transform duration-500 ease-smooth"
            style={{ width: 'calc((100% - 12px) / 4)', transform: `translateX(${index * 100}%)` }}
          >
            <span data-section={tab} className="block h-full rounded-[22px] bg-sec/16 transition-colors duration-500" />
          </span>
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id} data-section={id}>
              <button
                onClick={() => go(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cx(
                  'relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-300 active:scale-95',
                  tab === id ? 'text-sec' : 'text-[#8e8e95]',
                )}
              >
                <Icon size={21} strokeWidth={tab === id ? 2.3 : 1.9} />
                {label}
                {id === 'afaire' && lateCount > 0 && (
                  <span className="num absolute right-[calc(50%-20px)] top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-late px-1 text-[10px] font-bold text-white">
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
