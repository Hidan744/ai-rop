import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, ClipboardPlus, Percent, TrendingUp, Wallet, AlertOctagon, Target, Clock, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/features/dashboard/KpiCard'
import { AttentionPanel } from '@/features/deals/AttentionPanel'
import { CompactFunnelStrip } from '@/features/deals/CompactFunnelStrip'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'
import { SourceBadge } from '@/features/sales/SourceBadge'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { useSalesFacts } from '@/hooks/useSalesFacts'
import { calculateCurrentStageDwellDays, calculateMonthToDateWonValue, calibrateStageWinProbabilities } from '@/lib/sales/formulas'
import {
  buildAttentionSummary,
  daysSinceLastActivity,
  isDealReadyToClose,
  isDealWithoutActivity,
  isNextStepOverdue,
  nextStepOverdueDays,
} from '@/lib/sales/dealAttention'
import { BIG_DEAL_VALUE_THRESHOLD } from '@/lib/sales/recommendations'
import {
  DEAL_SOURCE_LABELS,
  FUNNEL_STAGE_LABELS,
  NEXT_STEP_TYPE_LABELS,
  type Deal,
  type DealSource,
  type FunnelStage,
  type NextStepType,
} from '@/types/sales'

const ALL = '__all__'
const FUNNEL_ORDER: FunnelStage[] = ['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost']

type SortKey =
  | 'title'
  | 'manager'
  | 'stage'
  | 'source'
  | 'probability'
  | 'value'
  | 'weightedValue'
  | 'nextStepType'
  | 'nextStepDate'
  | 'daysWithoutActivity'
  | 'daysInStage'

type ChipFilter = 'all' | 'mine' | 'overdue' | 'today' | 'week' | 'big' | 'noActivity' | 'closingSoon'

const CHIPS: Array<{ key: ChipFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'mine', label: 'Мои' },
  { key: 'overdue', label: 'Просроченные' },
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'На этой неделе' },
  { key: 'big', label: 'Крупные' },
  { key: 'noActivity', label: 'Без активности' },
  { key: 'closingSoon', label: 'Скоро закрытие' },
]

export function DealsPage() {
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const profile = useSalesStore((s) => s.profile)
  const referenceISO = new Date().toISOString()
  const now = new Date(referenceISO).getTime()
  const managerById = useMemo(() => new Map(managers.map((m) => [m.id, m])), [managers])
  const facts = useSalesFacts(referenceISO)

  const [searchParams] = useSearchParams()
  const managerFromUrl = searchParams.get('manager')

  const [stageFilter, setStageFilter] = useState<string>(ALL)
  const [managerFilter, setManagerFilter] = useState<string>(managerFromUrl ?? ALL)
  const [sourceFilter, setSourceFilter] = useState<string>(ALL)
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [probMin, setProbMin] = useState('')
  const [probMax, setProbMax] = useState('')
  const [nextStepFrom, setNextStepFrom] = useState('')
  const [nextStepTo, setNextStepTo] = useState('')
  const [chip, setChip] = useState<ChipFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('daysInStage')
  const [sortDesc, setSortDesc] = useState(true)
  const [taskDialogDeal, setTaskDialogDeal] = useState<Deal | null>(null)

  const winProbByStage = useMemo(() => calibrateStageWinProbabilities(deals), [deals])
  const attentionSummary = useMemo(() => buildAttentionSummary(deals, winProbByStage, referenceISO), [deals, winProbByStage, referenceISO])

  // --- KPI-строка ---
  const plan = profile?.monthlyPlan ?? 0
  const monthToDateFact = calculateMonthToDateWonValue(deals, referenceISO)
  const factPct = plan > 0 ? (monthToDateFact / plan) * 100 : null
  const needToClose = Math.max(0, plan - monthToDateFact)
  const forecast = monthToDateFact + facts.weightedPipelineValue
  const monthStart = new Date(Date.UTC(new Date(referenceISO).getUTCFullYear(), new Date(referenceISO).getUTCMonth(), 1)).getTime()
  const newDealsCount = deals.filter((d) => new Date(d.createdAt).getTime() >= monthStart).length

  const rows = useMemo(() => {
    let filtered = deals
    if (stageFilter !== ALL) filtered = filtered.filter((d) => d.stage === stageFilter)
    if (managerFilter !== ALL) filtered = filtered.filter((d) => d.managerId === managerFilter)
    if (sourceFilter !== ALL) filtered = filtered.filter((d) => d.source === sourceFilter)
    if (valueMin) filtered = filtered.filter((d) => d.value >= Number(valueMin))
    if (valueMax) filtered = filtered.filter((d) => d.value <= Number(valueMax))
    if (probMin || probMax) {
      filtered = filtered.filter((d) => {
        const prob = (winProbByStage[d.stage] ?? 0) * 100
        if (probMin && prob < Number(probMin)) return false
        if (probMax && prob > Number(probMax)) return false
        return true
      })
    }
    if (nextStepFrom) filtered = filtered.filter((d) => d.nextStep && new Date(d.nextStep.dueDate).getTime() >= new Date(nextStepFrom).getTime())
    if (nextStepTo) filtered = filtered.filter((d) => d.nextStep && new Date(d.nextStep.dueDate).getTime() <= new Date(nextStepTo).getTime())

    switch (chip) {
      // 'mine' — в этом демо-продукте нет логина менеджеров и своей учётной записи для чужих
      // сделок (см. бриф): РОП видит все сделки, поэтому чип функционально равен «Все».
      case 'mine':
      case 'all':
        break
      case 'overdue':
        filtered = filtered.filter((d) => isNextStepOverdue(d, referenceISO))
        break
      case 'today':
        filtered = filtered.filter((d) => d.nextStep && new Date(d.nextStep.dueDate).toISOString().slice(0, 10) === new Date(referenceISO).toISOString().slice(0, 10))
        break
      case 'week':
        filtered = filtered.filter((d) => {
          if (!d.nextStep) return false
          const due = new Date(d.nextStep.dueDate).getTime()
          return due >= now && due <= now + 7 * 24 * 60 * 60 * 1000
        })
        break
      case 'big':
        filtered = filtered.filter((d) => d.value >= BIG_DEAL_VALUE_THRESHOLD)
        break
      case 'noActivity':
        filtered = filtered.filter((d) => isDealWithoutActivity(d, referenceISO))
        break
      case 'closingSoon':
        filtered = filtered.filter((d) => isDealReadyToClose(d, winProbByStage))
        break
    }

    const withComputed = filtered.map((d) => ({
      deal: d,
      probability: winProbByStage[d.stage] ?? 0,
      weightedValue: d.value * (winProbByStage[d.stage] ?? 0),
      daysWithoutActivity: daysSinceLastActivity(d, referenceISO),
      daysInStage: calculateCurrentStageDwellDays(d, referenceISO),
    }))

    withComputed.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
          cmp = a.deal.title.localeCompare(b.deal.title, 'ru')
          break
        case 'manager':
          cmp = (managerById.get(a.deal.managerId)?.name ?? '').localeCompare(managerById.get(b.deal.managerId)?.name ?? '', 'ru')
          break
        case 'stage':
          cmp = FUNNEL_ORDER.indexOf(a.deal.stage) - FUNNEL_ORDER.indexOf(b.deal.stage)
          break
        case 'source':
          cmp = DEAL_SOURCE_LABELS[a.deal.source].localeCompare(DEAL_SOURCE_LABELS[b.deal.source], 'ru')
          break
        case 'probability':
          cmp = a.probability - b.probability
          break
        case 'value':
          cmp = a.deal.value - b.deal.value
          break
        case 'weightedValue':
          cmp = a.weightedValue - b.weightedValue
          break
        case 'nextStepType': {
          const la = a.deal.nextStep ? NEXT_STEP_TYPE_LABELS[a.deal.nextStep.type] : ''
          const lb = b.deal.nextStep ? NEXT_STEP_TYPE_LABELS[b.deal.nextStep.type] : ''
          cmp = la === lb ? 0 : la === '' ? 1 : lb === '' ? -1 : la.localeCompare(lb, 'ru')
          break
        }
        case 'nextStepDate': {
          const da = a.deal.nextStep ? new Date(a.deal.nextStep.dueDate).getTime() : Number.POSITIVE_INFINITY
          const db = b.deal.nextStep ? new Date(b.deal.nextStep.dueDate).getTime() : Number.POSITIVE_INFINITY
          cmp = da - db
          break
        }
        case 'daysWithoutActivity':
          cmp = a.daysWithoutActivity - b.daysWithoutActivity
          break
        case 'daysInStage':
        default:
          cmp = a.daysInStage - b.daysInStage
      }
      return sortDesc ? -cmp : cmp
    })
    return withComputed
  }, [
    deals,
    stageFilter,
    managerFilter,
    sourceFilter,
    valueMin,
    valueMax,
    probMin,
    probMax,
    nextStepFrom,
    nextStepTo,
    chip,
    sortKey,
    sortDesc,
    winProbByStage,
    referenceISO,
    now,
    managerById,
  ])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Сделки</h1>
        <p className="text-sm text-ink-500 mt-1">Все сделки с прогнозом, вниманием к проблемным и фильтрами</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="План продаж" value={formatCurrency(plan)} tooltip="Плановая выручка на текущий месяц." icon={<Target className="size-4 text-ink-500" />} />
        <KpiCard label="Факт" value={formatCurrency(monthToDateFact)} tooltip="Закрытая выручка с начала месяца." icon={<Wallet className="size-4 text-ink-500" />} />
        <KpiCard
          label="% выполнения"
          value={factPct !== null ? formatPercent(factPct, 0) : '—'}
          tooltip="Факт к плану месяца."
          icon={<Percent className="size-4 text-ink-500" />}
          accent={factPct !== null ? (factPct >= 80 ? 'positive' : 'negative') : 'neutral'}
        />
        <KpiCard
          label="Взвешенный pipeline"
          value={formatCurrency(facts.weightedPipelineValue)}
          tooltip="Сумма открытых сделок × калиброванная вероятность выигрыша стадии."
          icon={<TrendingUp className="size-4 text-ink-500" />}
        />
        <KpiCard label="Нужно закрыть" value={formatCurrency(needToClose)} tooltip="План минус факт — сколько ещё нужно закрыть до конца месяца." icon={<Target className="size-4 text-ink-500" />} />
        <KpiCard label="Прогноз месяца" value={formatCurrency(forecast)} tooltip="Факт с начала месяца + взвешенный pipeline." icon={<TrendingUp className="size-4 text-ink-500" />} />
        <KpiCard label="Новых сделок" value={String(newDealsCount)} tooltip="Сделки, созданные с начала текущего месяца." icon={<Clock className="size-4 text-ink-500" />} />
        <KpiCard
          label="Просроченных сделок"
          value={String(attentionSummary.overdueNextStepCount)}
          tooltip="Открытые сделки с просроченным следующим шагом."
          icon={<AlertOctagon className="size-4 text-ink-500" />}
          accent={attentionSummary.overdueNextStepCount > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <AttentionPanel summary={attentionSummary} />

      <CompactFunnelStrip />

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChip(c.key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              chip === c.key ? 'bg-brand-500 text-ink-950 border-brand-500' : 'border-ink-700 text-ink-300 hover:bg-ink-800',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Стадия" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все стадии</SelectItem>
              {FUNNEL_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Менеджер" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Источник" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все источники</SelectItem>
              {(['amocrm', 'bitrix24', 'csv'] as DealSource[]).map((s) => (
                <SelectItem key={s} value={s}>{DEAL_SOURCE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <RangeFilter label="Сумма, ₽" min={valueMin} max={valueMax} onMin={setValueMin} onMax={setValueMax} />
          <RangeFilter label="Вероятность, %" min={probMin} max={probMax} onMin={setProbMin} onMax={setProbMax} />

          <div className="flex items-end gap-1.5">
            <div className="space-y-1">
              <div className="text-[11px] text-ink-500">Дата след. шага от</div>
              <Input type="date" value={nextStepFrom} onChange={(e) => setNextStepFrom(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-ink-500">до</div>
              <Input type="date" value={nextStepTo} onChange={(e) => setNextStepTo(e.target.value)} className="w-36 h-9 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 border-b border-ink-800">
                <SortableHeader label="Сделка" active={sortKey === 'title'} desc={sortDesc} onClick={() => toggleSort('title')} align="left" />
                <SortableHeader label="Менеджер" active={sortKey === 'manager'} desc={sortDesc} onClick={() => toggleSort('manager')} align="left" />
                <SortableHeader label="Стадия" active={sortKey === 'stage'} desc={sortDesc} onClick={() => toggleSort('stage')} align="left" />
                <SortableHeader label="Источник" active={sortKey === 'source'} desc={sortDesc} onClick={() => toggleSort('source')} align="left" />
                <SortableHeader label="Вероятность" active={sortKey === 'probability'} desc={sortDesc} onClick={() => toggleSort('probability')} />
                <SortableHeader label="Сумма" active={sortKey === 'value'} desc={sortDesc} onClick={() => toggleSort('value')} />
                <SortableHeader label="Взвеш. сумма" active={sortKey === 'weightedValue'} desc={sortDesc} onClick={() => toggleSort('weightedValue')} />
                <SortableHeader label="Следующий шаг" active={sortKey === 'nextStepType'} desc={sortDesc} onClick={() => toggleSort('nextStepType')} align="left" />
                <SortableHeader label="Дата след. шага" active={sortKey === 'nextStepDate'} desc={sortDesc} onClick={() => toggleSort('nextStepDate')} />
                <SortableHeader label="Дней без акт." active={sortKey === 'daysWithoutActivity'} desc={sortDesc} onClick={() => toggleSort('daysWithoutActivity')} />
                <SortableHeader label="Дней в стадии" active={sortKey === 'daysInStage'} desc={sortDesc} onClick={() => toggleSort('daysInStage')} />
                <th className="py-3 px-3 font-medium text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ deal, probability, weightedValue, daysWithoutActivity, daysInStage }) => (
                <tr key={deal.id} className="border-b border-ink-800/60 last:border-0 hover:bg-ink-900/40">
                  <td className="py-3 px-5 text-ink-100 max-w-52 truncate" title={deal.title}>{deal.title}</td>
                  <td className="py-3 px-3 text-ink-300 whitespace-nowrap">{managerById.get(deal.managerId)?.name ?? '—'}</td>
                  <td className="py-3 px-3">
                    <StageBadge stage={deal.stage} />
                  </td>
                  <td className="py-3 px-3"><SourceBadge source={deal.source} /></td>
                  <td className="py-3 px-3 text-right text-ink-200 whitespace-nowrap">
                    {deal.outcome === 'open' ? formatPercent(probability * 100, 0) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-ink-100 font-medium whitespace-nowrap">{formatCurrency(deal.value)}</td>
                  <td className="py-3 px-3 text-right text-ink-300 whitespace-nowrap">{deal.outcome === 'open' ? formatCurrency(weightedValue) : '—'}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <NextStepCell deal={deal} referenceISO={referenceISO} />
                  </td>
                  <td className="py-3 px-3 text-right text-ink-300 whitespace-nowrap">
                    {deal.nextStep ? new Date(deal.nextStep.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span className={cn(deal.outcome === 'open' && daysWithoutActivity > 5 ? 'text-warning-500 font-medium' : 'text-ink-300')}>
                      {deal.outcome === 'open' ? `${Math.round(daysWithoutActivity)} дн.` : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <DwellCell days={daysInStage} stage={deal.stage} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setTaskDialogDeal(deal)}>
                      <ClipboardPlus className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-ink-500">Нет сделок по выбранным фильтрам</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateTaskDialog
        open={taskDialogDeal !== null}
        onOpenChange={(open) => !open && setTaskDialogDeal(null)}
        initialManagerId={taskDialogDeal?.managerId}
        initialTitle={taskDialogDeal ? `По сделке «${taskDialogDeal.title}»` : undefined}
        initialDealId={taskDialogDeal?.id ?? null}
      />
    </div>
  )
}

function RangeFilter({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="flex items-center gap-1.5">
        <Input type="number" value={min} onChange={(e) => onMin(e.target.value)} placeholder="от" className="w-24 h-9 text-xs" />
        <Input type="number" value={max} onChange={(e) => onMax(e.target.value)} placeholder="до" className="w-24 h-9 text-xs" />
      </div>
    </div>
  )
}

function SortableHeader({
  label,
  active,
  desc,
  onClick,
  align = 'right',
}: {
  label: string
  active: boolean
  desc: boolean
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th className={cn('py-3 px-3 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={onClick}
        className={cn('inline-flex items-center gap-1 hover:text-ink-200 whitespace-nowrap', active ? 'text-ink-200' : 'text-ink-500')}
      >
        {label}
        <ArrowDownUp className={cn('size-3', active && desc && 'rotate-180')} />
      </button>
    </th>
  )
}

function StageBadge({ stage }: { stage: FunnelStage }) {
  const isTerminal = stage === 'won' || stage === 'lost'
  const isOpenLate = stage === 'proposal_sent' || stage === 'negotiation'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        stage === 'won' && 'bg-positive-500/10 text-positive-500',
        stage === 'lost' && 'bg-negative-500/10 text-negative-500',
        !isTerminal && isOpenLate && 'bg-warning-500/10 text-warning-500',
        !isTerminal && !isOpenLate && 'bg-ink-800 text-ink-300',
      )}
    >
      {FUNNEL_STAGE_LABELS[stage]}
    </span>
  )
}

function DwellCell({ days, stage }: { days: number; stage: FunnelStage }) {
  if (stage === 'won' || stage === 'lost') return <span className="text-ink-500">—</span>
  const rounded = Math.round(days)
  const isLong = rounded >= 20
  return <span className={cn(isLong ? 'text-negative-500 font-medium' : 'text-ink-300')}>{rounded} дн.</span>
}

function NextStepCell({ deal, referenceISO }: { deal: Deal; referenceISO: string }) {
  if (deal.outcome !== 'open') return <span className="text-ink-500">—</span>
  if (!deal.nextStep) return <span className="text-ink-600 text-xs">Не назначен</span>
  const overdue = isNextStepOverdue(deal, referenceISO)
  const overdueDays = nextStepOverdueDays(deal, referenceISO)
  const label: NextStepType = deal.nextStep.type
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ink-200 text-xs">{NEXT_STEP_TYPE_LABELS[label]}</span>
      {overdue && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-negative-500">
          <Flame className="size-3" />
          Просрочено на {overdueDays} дн.
        </span>
      )}
    </div>
  )
}
