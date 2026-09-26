import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SourceBadge } from '@/features/sales/SourceBadge'
import { cn, formatCurrency } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { calculateCurrentStageDwellDays } from '@/lib/sales/formulas'
import { DEAL_SOURCE_LABELS, FUNNEL_STAGE_LABELS, LOST_REASON_LABELS, type DealSource, type FunnelStage } from '@/types/sales'

type SortKey = 'value' | 'daysInStage' | 'createdAt'

const ALL = '__all__'

export function DealsPage() {
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const managerById = useMemo(() => new Map(managers.map((m) => [m.id, m])), [managers])
  const referenceISO = new Date().toISOString()

  const [stageFilter, setStageFilter] = useState<string>(ALL)
  const [managerFilter, setManagerFilter] = useState<string>(ALL)
  const [sourceFilter, setSourceFilter] = useState<string>(ALL)
  const [sortKey, setSortKey] = useState<SortKey>('daysInStage')
  const [sortDesc, setSortDesc] = useState(true)

  const rows = useMemo(() => {
    let filtered = deals
    if (stageFilter !== ALL) filtered = filtered.filter((d) => d.stage === stageFilter)
    if (managerFilter !== ALL) filtered = filtered.filter((d) => d.managerId === managerFilter)
    if (sourceFilter !== ALL) filtered = filtered.filter((d) => d.source === sourceFilter)

    const withComputed = filtered.map((d) => ({
      deal: d,
      daysInStage: calculateCurrentStageDwellDays(d, referenceISO),
    }))

    withComputed.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'value') cmp = a.deal.value - b.deal.value
      else if (sortKey === 'daysInStage') cmp = a.daysInStage - b.daysInStage
      else cmp = new Date(a.deal.createdAt).getTime() - new Date(b.deal.createdAt).getTime()
      return sortDesc ? -cmp : cmp
    })
    return withComputed
  }, [deals, stageFilter, managerFilter, sourceFilter, sortKey, sortDesc, referenceISO])

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
        <p className="text-sm text-ink-500 mt-1">Все сделки с фильтрами по стадии, менеджеру и источнику</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Стадия" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все стадии</SelectItem>
              {(['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost'] as FunnelStage[]).map((s) => (
                <SelectItem key={s} value={s}>{FUNNEL_STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Менеджер" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Источник" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все источники</SelectItem>
              {(['amocrm', 'bitrix24', 'csv'] as DealSource[]).map((s) => (
                <SelectItem key={s} value={s}>{DEAL_SOURCE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 border-b border-ink-800">
                <th className="py-3 px-5 font-medium">Сделка</th>
                <th className="py-3 px-3 font-medium">Менеджер</th>
                <th className="py-3 px-3 font-medium">Стадия</th>
                <th className="py-3 px-3 font-medium">Источник</th>
                <SortableHeader label="Сумма" active={sortKey === 'value'} desc={sortDesc} onClick={() => toggleSort('value')} />
                <SortableHeader label="Дней в стадии" active={sortKey === 'daysInStage'} desc={sortDesc} onClick={() => toggleSort('daysInStage')} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ deal, daysInStage }) => (
                <tr key={deal.id} className="border-b border-ink-800/60 last:border-0 hover:bg-ink-900/40">
                  <td className="py-3 px-5 text-ink-100 max-w-56 truncate" title={deal.title}>{deal.title}</td>
                  <td className="py-3 px-3 text-ink-300 whitespace-nowrap">{managerById.get(deal.managerId)?.name ?? '—'}</td>
                  <td className="py-3 px-3">
                    <StageBadge stage={deal.stage} />
                    {deal.outcome === 'lost' && deal.lostReason && (
                      <div className="text-[11px] text-ink-500 mt-1">{LOST_REASON_LABELS[deal.lostReason]}</div>
                    )}
                  </td>
                  <td className="py-3 px-3"><SourceBadge source={deal.source} /></td>
                  <td className="py-3 px-3 text-right text-ink-100 font-medium whitespace-nowrap">{formatCurrency(deal.value)}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <DwellCell days={daysInStage} stage={deal.stage} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-500">Нет сделок по выбранным фильтрам</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function SortableHeader({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  return (
    <th className="py-3 px-3 font-medium text-right">
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-ink-200', active ? 'text-ink-200' : 'text-ink-500')}>
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
