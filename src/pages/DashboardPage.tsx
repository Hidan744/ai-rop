import { CheckCircle2, Percent, Timer, Wallet, AlertOctagon } from 'lucide-react'
import { KpiCard } from '@/features/dashboard/KpiCard'
import { RecommendationCard } from '@/features/dashboard/RecommendationCard'
import { SalesHealthPanel, type SalesHealthStatus } from '@/features/dashboard/SalesHealthPanel'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { useRecommendations } from '@/hooks/useRecommendations'
import { useSalesFacts } from '@/hooks/useSalesFacts'
import { calculateMonthToDateWonValue } from '@/lib/sales/formulas'

export function DashboardPage() {
  const profile = useSalesStore((s) => s.profile)
  const managers = useSalesStore((s) => s.managers)
  const deals = useSalesStore((s) => s.deals)
  const referenceISO = new Date().toISOString()
  const recommendations = useRecommendations(referenceISO)
  const facts = useSalesFacts(referenceISO)

  if (!profile) return null

  const criticalCount = recommendations.filter((r) => r.severity === 'critical').length
  const warningCount = recommendations.filter((r) => r.severity === 'warning').length
  const healthStatus: SalesHealthStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'attention' : 'stable'

  const monthToDateFact = calculateMonthToDateWonValue(deals, referenceISO)
  const planFactPct = profile.monthlyPlan > 0 ? (monthToDateFact / profile.monthlyPlan) * 100 : null
  const projectedMonthEnd = monthToDateFact + facts.weightedPipelineValue

  const managerById = new Map(managers.map((m) => [m.id, m]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">{profile.companyName} · {profile.niche}</p>
      </div>

      {/* Рекомендации — герой дашборда: продукт говорит «вот что делать», а не только показывает цифры. */}
      <div>
        <h2 className="text-sm font-semibold text-ink-200 mb-3">Рекомендации на сегодня</h2>
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        ) : (
          <Card className="p-5 flex items-center gap-3 border-positive-500/30 bg-positive-500/10">
            <CheckCircle2 className="size-5 text-positive-500 shrink-0" />
            <p className="text-sm text-ink-100">
              Явных проблем не найдено. Воронка и активность менеджеров в норме.
            </p>
          </Card>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Сквозная конверсия воронки"
          value={facts.overallConversion !== null ? formatPercent(facts.overallConversion) : '—'}
          tooltip="Доля лидов, дошедших от первой стадии воронки до «Закрыта (успех)»."
          icon={<Percent className="size-4 text-ink-500" />}
        />
        <KpiCard
          label="Средний цикл сделки"
          value={facts.avgCycleLengthDays !== null ? `${Math.round(facts.avgCycleLengthDays)} дн.` : '—'}
          tooltip="Среднее время от создания сделки до закрытия (успех или отказ)."
          icon={<Timer className="size-4 text-ink-500" />}
        />
        <KpiCard
          label="План/факт месяца"
          value={planFactPct !== null ? formatPercent(planFactPct) : '—'}
          tooltip="Закрытая выручка с начала месяца к плану."
          icon={<Wallet className="size-4 text-ink-500" />}
          accent={planFactPct !== null ? (planFactPct >= 80 ? 'positive' : 'negative') : 'neutral'}
        />
        <KpiCard
          label="Сделок требуют внимания"
          value={String(facts.stuckFlags.length)}
          tooltip="Открытые сделки, зависшие в текущей стадии дольше типичного времени."
          icon={<AlertOctagon className="size-4 text-ink-500" />}
          accent={facts.stuckFlags.length > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesHealthPanel
            status={healthStatus}
            overallConversionPct={facts.overallConversion}
            planFactPct={planFactPct}
            avgCycleLengthDays={facts.avgCycleLengthDays}
            criticalCount={criticalCount}
            warningCount={warningCount}
          />
        </div>

        <Card className="p-6 flex flex-col">
          <div className="text-sm font-medium text-ink-200 mb-3">Прогноз месяца</div>
          <div className="space-y-2.5 text-sm flex-1">
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Факт с начала месяца</span>
              <span className="text-ink-100 font-medium">{formatCurrency(monthToDateFact)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Взвешенная воронка</span>
              <span className="text-ink-100 font-medium">{formatCurrency(facts.weightedPipelineValue)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-ink-800">
              <span className="text-ink-300">Прогноз на конец месяца</span>
              <span className="text-brand-400 font-semibold">{formatCurrency(projectedMonthEnd)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">План месяца</span>
              <span className="text-ink-100 font-medium">{formatCurrency(profile.monthlyPlan)}</span>
            </div>
          </div>
        </Card>
      </div>

      {facts.stuckFlags.length > 0 && (
        <Card className="p-5">
          <div className="text-sm font-medium text-ink-200 mb-3">Топ зависших сделок</div>
          <div className="space-y-2">
            {facts.stuckFlags.slice(0, 5).map((flag) => (
              <div key={flag.deal.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-ink-100 truncate">{flag.deal.title}</div>
                  <div className="text-xs text-ink-500">{managerById.get(flag.deal.managerId)?.name ?? '—'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-ink-100 font-medium">{formatCurrency(flag.deal.value)}</div>
                  <div className="text-xs text-negative-500">{Math.round(flag.daysInStage)} дн. в стадии</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
