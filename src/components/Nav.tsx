import { createContext, useContext } from 'react'
import type { Tab } from '../App'
import { Segmented } from './ui'

/** Navigation entre onglets, accessible depuis les pages. */
export const NavContext = createContext<(t: Tab) => void>(() => {})
export const useGo = () => useContext(NavContext)

/** Bascule Tâches | Listes en haut de l'onglet « À faire » : deux parties, une seule place dans la barre. */
export function TasksSwitch({ current }: { current: 'afaire' | 'listes' }) {
  const go = useGo()
  return (
    <div className="mb-2">
      <Segmented<'afaire' | 'listes'>
        value={current}
        onChange={go}
        options={[
          { value: 'afaire', label: '✓  Tâches' },
          { value: 'listes', label: '▦  Listes' },
        ]}
      />
    </div>
  )
}
