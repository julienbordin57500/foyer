import { useState } from 'react'
import { Bell, BellRing, CalendarPlus, Users } from 'lucide-react'
import { usePartner, useSession } from '../auth/AuthGate'
import { toLocalInput } from '../lib/dates'
import { calendarUrl, isUrgent, quickReminder, reminderLabel, type QuickReminder } from '../lib/reminders'
import { isDemo } from '../lib/supabase'
import { OptionRow, cx } from './ui'

export interface ReminderValue {
  remind_at: string | null
  remind_to: string | null
}

type Mode = 'none' | QuickReminder | 'custom'

/** Choix d'un rappel, de haut en bas : quand, l'heure exacte, pour qui, puis le calendrier. */
export function ReminderPicker({ value, onChange, title }: { value: ReminderValue; onChange(v: ReminderValue): void; title: string }) {
  const { me } = useSession()
  const partner = usePartner()
  const [mode, setMode] = useState<Mode>(value.remind_at ? 'custom' : 'none')

  const pick = (m: Mode) => {
    setMode(m)
    if (m === 'none') onChange({ remind_at: null, remind_to: value.remind_to })
    else if (m !== 'custom') onChange({ ...value, remind_at: quickReminder(m) })
    else if (!value.remind_at) onChange({ ...value, remind_at: quickReminder('tomorrow') })
  }

  return (
    <div className="space-y-2">
      <OptionRow<Mode>
        label="Rappel"
        icon={<Bell size={18} />}
        value={mode}
        onChange={pick}
        options={[
          { value: 'none', label: 'Aucun' },
          { value: 'hour', label: 'Dans 1 heure' },
          { value: 'tonight', label: 'Ce soir' },
          { value: 'tomorrow', label: 'Demain 9 h' },
          { value: 'custom', label: 'À une heure précise' },
        ]}
      />
      {value.remind_at && (
        <div className="animate-pop space-y-2">
          {mode === 'custom' ? (
            <input
              type="datetime-local"
              value={toLocalInput(value.remind_at)}
              onChange={(e) => e.target.value && onChange({ ...value, remind_at: new Date(e.target.value).toISOString() })}
              className="h-14 w-full rounded-2xl bg-surface-2 px-4 text-center text-[16px] font-semibold outline-none ring-1 ring-line/50 focus:ring-2 focus:ring-sec/50"
              aria-label="Date et heure du rappel"
            />
          ) : (
            <p className="text-center text-[14px] font-semibold text-sec">🔔 {reminderLabel(value.remind_at)}</p>
          )}
          <OptionRow
            label="Prévenir"
            icon={<Users size={18} />}
            value={value.remind_to ?? 'both'}
            onChange={(v) => onChange({ ...value, remind_to: v === 'both' ? null : v })}
            options={[
              { value: 'both', label: 'Nous deux' },
              { value: me.user_id, label: 'Moi' },
              ...(partner ? [{ value: partner.user_id, label: partner.display_name }] : []),
            ]}
          />
          {!isDemo && (
            <a
              href={calendarUrl(title, value.remind_at)}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-sec ring-1 ring-sec/30 active:scale-[0.98]"
            >
              <CalendarPlus size={17} /> Ajouter aussi à mon calendrier
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/** Petite pastille « 🔔 Aujourd'hui 18:30 » dans les listes ; rouge quand c'est imminent. */
export function ReminderBadge({ iso }: { iso: string }) {
  const urgent = isUrgent(iso)
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
        urgent ? 'bg-late/15 text-late' : 'bg-sec/15 text-sec',
      )}
    >
      <BellRing size={11} className={urgent ? 'animate-ring' : ''} />
      {reminderLabel(iso)}
    </span>
  )
}
