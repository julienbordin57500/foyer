import { useState, type ReactNode } from 'react'
import { AlarmClock, CalendarClock, ChevronRight, PackageOpen, Settings } from 'lucide-react'
import type { Tab } from '../App'
import { useSession } from '../auth/AuthGate'
import { useStore } from '../data/store'
import { isLow, sortProducts, totals, upcomingDeadlines, upcomingDebits } from '../lib/finance'
import { ddmm, monthLabel, money, moneyRound, relativeDays, weekday } from '../lib/format'
import { today } from '../lib/dates'
import { Card, SectionTitle, cx, type Tone } from '../components/ui'
import SettingsSheet from '../components/SettingsSheet'

export default function HomePage({ go }: { go(t: Tab): void }) {
  const { me } = useSession()
  const { data, loading } = useStore()
  const [settings, setSettings] = useState(false)

  const t = totals(data)
  const debits = upcomingDebits(data, 7)
  const debitsTotal = debits.reduce((s, d) => s + d.amount, 0)
  const deadlines = upcomingDeadlines(data, 60)
  const low = sortProducts(data.products).filter(isLow)
  const urgentDeadline = deadlines.some((d) => d.info.tone === 'urgent')
  const negative = t.left < 0

  return (
    <>
      <header className="pt-safe mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm capitalize text-muted">{monthLabel(today())}</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Bonjour {me.display_name}</h1>
        </div>
        <button
          onClick={() => setSettings(true)}
          aria-label="Réglages du foyer"
          className="grid size-11 place-items-center rounded-full bg-surface text-muted ring-1 ring-line active:scale-95"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Reste à vivre */}
      <section
        className={cx(
          'relative overflow-hidden rounded-[28px] p-5 text-white shadow-lg',
          negative ? 'bg-gradient-to-br from-[#d23c3c] to-[#a3242b] shadow-red-900/20' : 'bg-gradient-to-br from-[#5b50f0] to-[#3a2fb8] shadow-indigo-900/20',
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <p className="text-sm font-medium text-white/80">Reste à vivre ce mois-ci</p>
        <p className={cx('num mt-1 text-[44px] font-bold leading-none tracking-tight', loading && 'opacity-40')}>{moneyRound(t.left)}</p>
        {negative && <p className="mt-2 text-sm font-semibold">Vos dépenses fixes dépassent vos revenus.</p>}
        <dl className="mt-5 grid grid-cols-3 gap-2 text-[13px]">
          <Stat label="Revenus" value={`+${moneyRound(t.income)}`} />
          <Stat label="Charges" value={`−${moneyRound(t.charges)}`} />
          <Stat label="Abonnements" value={`−${moneyRound(t.subs)}`} />
        </dl>
      </section>

      {/* Vue d'un coup d'œil */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Tile
          tone={deadlines.length ? (urgentDeadline ? 'danger' : 'warn') : 'neutral'}
          icon={<AlarmClock size={18} />}
          value={deadlines.length}
          label={deadlines.length > 1 ? 'résiliations' : 'résiliation'}
          onClick={() => go('abonnements')}
        />
        <Tile
          tone={low.length ? 'warn' : 'neutral'}
          icon={<PackageOpen size={18} />}
          value={low.length}
          label="stock bas"
          onClick={() => go('courses')}
        />
        <Tile
          tone="neutral"
          icon={<CalendarClock size={18} />}
          value={debits.length}
          label={debits.length > 1 ? 'prélèvements' : 'prélèvement'}
          onClick={() => document.getElementById('prelevements')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </div>

      {/* Ce qui demande une action */}
      {(deadlines.length > 0 || low.length > 0) && <SectionTitle>À faire</SectionTitle>}

      <div className="space-y-3">
        {deadlines.map(({ sub, info }) => {
          const urgent = info.tone === 'urgent'
          return (
            <button
              key={sub.id}
              onClick={() => go('abonnements')}
              className={cx(
                'flex w-full items-center gap-3 rounded-3xl p-4 text-left ring-1 active:scale-[0.99]',
                urgent ? 'bg-danger-soft ring-danger-line' : 'bg-warn-soft ring-warn-line',
              )}
            >
              <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl bg-surface', urgent ? 'text-danger' : 'text-warn')}>
                <AlarmClock size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">Résilier {sub.name} ?</span>
                <span className={cx('block text-sm', urgent ? 'text-danger' : 'text-warn')}>
                  Avant le {ddmm(info.date)} · {relativeDays(info.days)}
                </span>
              </span>
              <span className="num text-sm font-semibold">{money(sub.amount)}</span>
            </button>
          )
        })}

        {low.length > 0 && (
          <button
            onClick={() => go('courses')}
            className="w-full rounded-3xl bg-warn-soft p-4 text-left ring-1 ring-warn-line active:scale-[0.99]"
          >
            <span className="mb-3 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface text-warn">
                <PackageOpen size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">À racheter</span>
                <span className="block text-sm text-warn">
                  {low.length} produit{low.length > 1 ? 's' : ''} sous le seuil
                </span>
              </span>
              <ChevronRight size={20} className="text-warn" />
            </span>
            <span className="flex flex-wrap gap-1.5">
              {low.map((p) => (
                <span key={p.id} className="rounded-full bg-surface px-3 py-1 text-sm font-medium">
                  {p.name}
                  <span className={cx('num ml-1.5', p.stock === 0 ? 'font-bold text-danger' : 'text-muted')}>{p.stock}</span>
                </span>
              ))}
            </span>
          </button>
        )}
      </div>

      {/* Prélèvements à venir */}
      <div id="prelevements" className="scroll-mt-4">
        <SectionTitle aside={debits.length ? money(debitsTotal) : undefined}>Prélèvements · 7 jours</SectionTitle>
      </div>
      <Card className="py-1">
        {debits.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Aucun prélèvement prévu cette semaine.</p>
        ) : (
          <ul className="divide-y divide-line">
            {debits.map((d) => (
              <li key={d.kind + d.id} className="flex items-center gap-3 py-3">
                <span
                  className={cx(
                    'flex w-12 shrink-0 flex-col items-center rounded-xl py-1 leading-tight',
                    d.days <= 1 ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                  )}
                >
                  <span className="text-[11px] font-medium uppercase">{weekday(d.date)}</span>
                  <span className="num text-sm font-bold">{ddmm(d.date)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.label}</span>
                  <span className="block text-xs text-muted">
                    {d.kind} · {relativeDays(d.days)}
                  </span>
                </span>
                <span className="num font-semibold">−{money(d.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-2.5 py-2 backdrop-blur-sm">
      <dt className="text-[11px] text-white/75">{label}</dt>
      <dd className="num truncate font-semibold">{value}</dd>
    </div>
  )
}

const tileTones: Record<Tone, string> = {
  neutral: 'bg-surface ring-line text-ink',
  warn: 'bg-warn-soft ring-warn-line text-warn',
  danger: 'bg-danger-soft ring-danger-line text-danger',
  good: 'bg-good-soft ring-line text-good',
  accent: 'bg-accent-soft ring-line text-accent',
}

function Tile({ tone, icon, value, label, onClick }: { tone: Tone; icon: ReactNode; value: number; label: string; onClick(): void }) {
  return (
    <button onClick={onClick} className={cx('rounded-3xl p-3.5 text-left ring-1 transition active:scale-[0.97]', tileTones[tone])}>
      <span className={cx('mb-2 block', tone === 'neutral' && 'text-muted')}>{icon}</span>
      <span className="num block text-2xl font-bold leading-none">{value}</span>
      <span className={cx('mt-1 block text-xs font-medium', tone === 'neutral' ? 'text-muted' : 'opacity-90')}>{label}</span>
    </button>
  )
}
