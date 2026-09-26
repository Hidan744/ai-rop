import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, TrendingUp, Minus, ClipboardPlus, Phone, Users as UsersIcon, FileText, UserPlus, Timer, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency, formatHoursMinutes, formatPercent } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import {
  average,
  calculateAverageCycleLengthDays,
  calculateAverageFirstResponseHours,
  calculateMonthToDateWonValue,
  calculateOverallFunnelConversion,
  calculatePeriodGrowthPct,
  calculateWeightedPipelineValue,
  calibrateStageWinProbabilities,
  flagStuckDeals,
} from '@/lib/sales/formulas'
import { buildManagerTaskSummaries } from '@/lib/sales/tasks'
import { isDealWithoutActivity } from '@/lib/sales/dealAttention'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'

const PERIOD_DAYS = 45
const ACTIVITY_WINDOW_DAYS = 7

export function ManagersPage() {
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const tasks = useSalesStore((s) => s.tasks)
  const activityLog = useSalesStore((s) => s.activityLog)
  const profile = useSalesStore((s) => s.profile)
  const navigate = useNavigate()
  const referenceISO = new Date().toISOString()
  const now = new Date(referenceISO).getTime()
  const periodMs = PERIOD_DAYS * 24 * 60 * 60 * 1000
  const [assignManagerId, setAssignManagerId] = useState<string | null>(null)

  const winProbByStage = useMemo(() => calibrateStageWinProbabilities(deals), [deals])
  const taskSummaries = useMemo(() => buildManagerTaskSummaries(tasks, managers, referenceISO), [tasks, managers, referenceISO])
  const taskSummaryByManager = useMemo(() => new Map(taskSummaries.map((s) => [s.managerId, s])), [taskSummaries])

  const rows = managers.map((manager) => {
    const managerDeals = deals.filter((d) => d.managerId === manager.id)
    const currentPeriod = managerDeals.filter((d) => now - new Date(d.createdAt).getTime() <= periodMs)
    const previousPeriod = managerDeals.filter((d) => {
      const age = now - new Date(d.createdAt).getTime()
      return age > periodMs && age <= periodMs * 2
    })

    const conversion = calculateOverallFunnelConversion(managerDeals)
    const currentConversion = calculateOverallFunnelConversion(currentPeriod)
    const previousConversion = calculateOverallFunnelConversion(previousPeriod)
    const trendPct =
      currentConversion !== null && previousConversion !== null ? calculatePeriodGrowthPct(currentConversion, previousConversion) : null

    const avgCycleLengthDays = calculateAverageCycleLengthDays(managerDeals)
    const stuckCount = flagStuckDeals(managerDeals, referenceISO).length
    const openCount = managerDeals.filter((d) => d.outcome === 'open').length
    const wonDeals = managerDeals.filter((d) => d.outcome === 'won')
    const lostCount = managerDeals.filter((d) => d.outcome === 'lost').length

    // Упрощение MVP: у продукта нет плана в разрезе менеджера, поэтому план отдела делится
    // поровну между продавцами — как ориентир, не как точный KPI-план.
    const plan = managers.length > 0 ? (profile?.monthlyPlan ?? 0) / managers.length : 0
    const fact = calculateMonthToDateWonValue(managerDeals, referenceISO)
    const factPct = plan > 0 ? (fact / plan) * 100 : null
    const pipeline = calculateWeightedPipelineValue(
      managerDeals.filter((d) => d.outcome === 'open'),
      winProbByStage,
    )
    const avgCheck = average(wonDeals.map((d) => d.value))

    return {
      manager,
      dealCount: managerDeals.length,
      openCount,
      wonCount: wonDeals.length,
      lostCount,
      conversion,
      trendPct,
      avgCycleLengthDays,
      stuckCount,
      plan,
      fact,
      factPct,
      pipeline,
      avgCheck,
      taskSummary: taskSummaryByManager.get(manager.id),
    }
  })

  rows.sort((a, b) => b.stuckCount - a.stuckCount || (b.conversion ?? 0) - (a.conversion ?? 0))

  // --- Активность отдела (за последнюю неделю) ---
  const windowStart = now - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const windowActivity = activityLog.filter((a) => new Date(a.date).getTime() >= windowStart)
  const totalCalls = windowActivity.reduce((s, a) => s + a.calls, 0)
  const totalMeetings = windowActivity.reduce((s, a) => s + a.meetings, 0)
  const proposalsSentCount = deals.filter((d) =>
    d.stageHistory.some((h) => h.stage === 'proposal_sent' && new Date(h.enteredAt).getTime() >= windowStart),
  ).length
  const newLeadsCount = deals.filter((d) => new Date(d.createdAt).getTime() >= windowStart).length
  const noActivityCount = deals.filter((d) => isDealWithoutActivity(d, referenceISO)).length
  const avgFirstResponseHours = calculateAverageFirstResponseHours(deals)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Менеджеры</h1>
        <p className="text-sm text-ink-500 mt-1">Конверсия, план/факт, pipeline и задачи по каждому продавцу — клик по строке открывает его сделки</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сводка по отделу</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 border-b border-ink-800">
                <th className="py-2.5 pr-4 font-medium">Менеджер</th>
                <th className="py-2.5 pr-4 font-medium text-right">План</th>
                <th className="py-2.5 pr-4 font-medium text-right">Факт</th>
                <th className="py-2.5 pr-4 font-medium text-right">%</th>
                <th className="py-2.5 pr-4 font-medium text-right">Pipeline</th>
                <th className="py-2.5 pr-4 font-medium text-right">Конверсия</th>
                <th className="py-2.5 pr-4 font-medium text-right">Ср. чек</th>
                <th className="py-2.5 pr-4 font-medium text-right">Тренд</th>
                <th className="py-2.5 pr-4 font-medium text-right">Ср. цикл</th>
                <th className="py-2.5 pr-4 font-medium text-right">Зависших</th>
                <th className="py-2.5 pr-4 font-medium text-right">Задачи</th>
                <th className="py-2.5 font-medium text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({ manager, conversion, trendPct, avgCycleLengthDays, stuckCount, plan, fact, factPct, pipeline, avgCheck, taskSummary }) => (
                  <tr
                    key={manager.id}
                    onClick={() => navigate(`/app/deals?manager=${manager.id}`)}
                    className="cursor-pointer border-b border-ink-800/60 last:border-0 hover:bg-ink-900/40"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-ink-800 text-xs font-medium text-ink-200 shrink-0">
                          {manager.initials}
                        </div>
                        <span className="text-ink-100">{manager.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-400 whitespace-nowrap">{formatCurrency(plan)}</td>
                    <td className="py-3 pr-4 text-right text-ink-100 font-medium whitespace-nowrap">{formatCurrency(fact)}</td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      <span className={cn('font-medium', factPct !== null && factPct >= 80 ? 'text-positive-500' : 'text-ink-300')}>
                        {factPct !== null ? formatPercent(factPct, 0) : '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-200 whitespace-nowrap">{formatCurrency(pipeline)}</td>
                    <td className="py-3 pr-4 text-right text-ink-100 font-medium">{conversion !== null ? formatPercent(conversion) : '—'}</td>
                    <td className="py-3 pr-4 text-right text-ink-200 whitespace-nowrap">{avgCheck !== null ? formatCurrency(avgCheck) : '—'}</td>
                    <td className="py-3 pr-4 text-right">
                      <TrendBadge value={trendPct} />
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-200">
                      {avgCycleLengthDays !== null ? `${Math.round(avgCycleLengthDays)} дн.` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={cn('font-medium', stuckCount > 0 ? 'text-negative-500' : 'text-ink-400')}>{stuckCount}</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <TaskBadge openCount={taskSummary?.openCount ?? 0} overdueCount={taskSummary?.overdueCount ?? 0} />
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssignManagerId(manager.id)
                        }}
                      >
                        <ClipboardPlus className="size-3.5" />
                        Задача
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Активность отдела за неделю</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <ActivityStat icon={<Phone className="size-4 text-ink-500" />} label="Звонки" value={String(totalCalls)} />
          <ActivityStat icon={<UsersIcon className="size-4 text-ink-500" />} label="Встречи" value={String(totalMeetings)} />
          <ActivityStat icon={<FileText className="size-4 text-ink-500" />} label="КП отправлено" value={String(proposalsSentCount)} />
          <ActivityStat icon={<UserPlus className="size-4 text-ink-500" />} label="Новые лиды" value={String(newLeadsCount)} />
          <ActivityStat icon={<AlertCircle className="size-4 text-ink-500" />} label="Без активности" value={String(noActivityCount)} accent={noActivityCount > 0 ? 'warning' : undefined} />
          <ActivityStat icon={<Timer className="size-4 text-ink-500" />} label="Ср. время отклика" value={avgFirstResponseHours !== null ? formatHoursMinutes(avgFirstResponseHours) : '—'} />
        </CardContent>
      </Card>

      <CreateTaskDialog open={assignManagerId !== null} onOpenChange={(open) => !open && setAssignManagerId(null)} initialManagerId={assignManagerId} />
    </div>
  )
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-500 inline-flex items-center gap-1 justify-end"><Minus className="size-3.5" />—</span>
  if (Math.abs(value) < 1) return <span className="text-ink-500 inline-flex items-center gap-1 justify-end"><Minus className="size-3.5" />0%</span>
  const isUp = value > 0
  return (
    <span className={cn('inline-flex items-center gap-1 justify-end font-medium', isUp ? 'text-positive-500' : 'text-negative-500')}>
      {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(Math.round(value))}%
    </span>
  )
}

/** Бейдж открытых задач — предупреждающий (STATUS.warning) цвет только если есть просроченные. */
function TaskBadge({ openCount, overdueCount }: { openCount: number; overdueCount: number }) {
  if (openCount === 0) return <span className="text-ink-600">—</span>
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        overdueCount > 0 ? 'bg-warning-500/10 text-warning-500' : 'bg-ink-800 text-ink-300',
      )}
      title={overdueCount > 0 ? `${overdueCount} просрочено` : 'Просроченных нет'}
    >
      {overdueCount > 0 && <span className="size-1.5 rounded-full bg-warning-500" aria-hidden />}
      {openCount}
    </span>
  )
}

function ActivityStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: 'warning' }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-1.5">
        {icon}
        {label}
      </div>
      <div className={cn('font-display text-lg font-semibold', accent === 'warning' ? 'text-warning-500' : 'text-ink-50')}>{value}</div>
    </div>
  )
}
