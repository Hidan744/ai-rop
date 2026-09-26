import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { LostReasonBreakdown } from '@/features/deals/LostReasonBreakdown'
import { CATEGORICAL, CHART_CHROME } from '@/lib/chartColors'
import { cn, formatCurrency, formatSigned } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { useSalesFacts } from '@/hooks/useSalesFacts'
import { applyWhatIfToForecast, calculateMonthToDateWonValue, daysBetween, DEFAULT_WHAT_IF_PARAMS, type WhatIfParams } from '@/lib/sales/formulas'

const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' })

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)))
}

export function ForecastPage() {
  const profile = useSalesStore((s) => s.profile)
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const planFactHistory = useSalesStore((s) => s.planFactHistory)
  const updateMonthlyPlan = useSalesStore((s) => s.updateMonthlyPlan)
  const referenceISO = new Date().toISOString()
  const facts = useSalesFacts(referenceISO)

  const [params, setParams] = useState<WhatIfParams>(DEFAULT_WHAT_IF_PARAMS)

  const monthToDateFact = calculateMonthToDateWonValue(deals, referenceISO)
  const currentMonthKey = referenceISO.slice(0, 7)

  const chartData = useMemo(
    () => [
      ...planFactHistory.map((m) => ({ label: monthLabel(m.month), План: m.plan, Факт: m.fact })),
      { label: `${monthLabel(currentMonthKey)} (тек.)`, План: profile?.monthlyPlan ?? 0, Факт: monthToDateFact },
    ],
    [planFactHistory, currentMonthKey, profile?.monthlyPlan, monthToDateFact],
  )

  const projectedWeighted = applyWhatIfToForecast({
    baseWeightedForecast: facts.weightedPipelineValue,
    currentHeadcount: managers.length || 1,
    params,
  })
  const baseProjectedMonthEnd = monthToDateFact + facts.weightedPipelineValue
  const simulatedProjectedMonthEnd = monthToDateFact + projectedWeighted
  const plan = profile?.monthlyPlan ?? 0
  const planFactPct = plan > 0 ? (simulatedProjectedMonthEnd / plan) * 100 : null

  function updateParam<K extends keyof WhatIfParams>(key: K, value: WhatIfParams[K]) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  const lostThisMonth = useMemo(
    () => deals.filter((d) => d.outcome === 'lost' && d.closedAt && daysBetween(d.closedAt, referenceISO) <= 30),
    [deals, referenceISO],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Прогноз</h1>
        <p className="text-sm text-ink-500 mt-1">План/факт по месяцам, взвешенный прогноз воронки и симулятор «что если»</p>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium text-ink-200 mb-4">План / факт по месяцам</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_CHROME.gridline} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: CHART_CHROME.mutedInk, fontSize: 12 }} axisLine={{ stroke: CHART_CHROME.axis }} tickLine={false} />
            <YAxis
              tick={{ fill: CHART_CHROME.mutedInk, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
              width={90}
            />
            <Tooltip
              contentStyle={{ background: '#0c0a08', border: '1px solid #2a221c', borderRadius: 12, fontSize: 12 }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: CHART_CHROME.mutedInk }} />
            <Bar dataKey="План" fill={CATEGORICAL.slot1} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Факт" fill={CATEGORICAL.slot2} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Взвешенный прогноз на текущий месяц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Факт с начала месяца" value={formatCurrency(monthToDateFact)} />
            <Row label="Взвешенная открытая воронка" value={formatCurrency(facts.weightedPipelineValue)} />
            <Row label="Прогноз на конец месяца" value={formatCurrency(baseProjectedMonthEnd)} strong />
            <Row label="План месяца" value={formatCurrency(plan)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Плановая выручка на месяц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-400">Изменить план можно и здесь, и в Настройках — значение общее.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={plan}
                onChange={(e) => updateMonthlyPlan(Math.max(0, Number(e.target.value) || 0))}
                className="flex h-10 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              />
              <span className="text-sm text-ink-500">₽</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <LostReasonBreakdown deals={lostThisMonth} />

      <Card>
        <CardHeader>
          <CardTitle>Симулятор «что если»</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <SimSlider
              label="Объём лидов"
              value={params.leadVolumeChangePct}
              onChange={(v) => updateParam('leadVolumeChangePct', v)}
              min={-50}
              max={100}
            />
            <SimSlider
              label="Конверсия по стадиям"
              value={params.conversionRateChangePct}
              onChange={(v) => updateParam('conversionRateChangePct', v)}
              min={-50}
              max={50}
            />
            <SimSlider
              label="Средний чек сделки"
              value={params.avgDealSizeChangePct}
              onChange={(v) => updateParam('avgDealSizeChangePct', v)}
              min={-50}
              max={100}
            />
            <SimSlider
              label="Штат менеджеров"
              value={params.headcountDelta}
              onChange={(v) => updateParam('headcountDelta', v)}
              min={-Math.max(1, managers.length - 1)}
              max={10}
              step={1}
              suffix=""
              isCount
              currentHeadcount={managers.length}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setParams(DEFAULT_WHAT_IF_PARAMS)}>
              Сбросить параметры
            </Button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-ink-800">
            <SimResult label="Взвешенная воронка" value={formatCurrency(projectedWeighted)} />
            <SimResult label="Прогноз на конец месяца" value={formatCurrency(simulatedProjectedMonthEnd)} highlight />
            <SimResult
              label="% от плана"
              value={planFactPct !== null ? `${Math.round(planFactPct)}%` : '—'}
              accent={planFactPct !== null ? (planFactPct >= 100 ? 'positive' : planFactPct >= 80 ? undefined : 'negative') : undefined}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', strong && 'pt-2 border-t border-ink-800')}>
      <span className={strong ? 'text-ink-300' : 'text-ink-400'}>{label}</span>
      <span className={strong ? 'text-brand-400 font-semibold' : 'text-ink-100 font-medium'}>{value}</span>
    </div>
  )
}

function SimSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 5,
  suffix = '%',
  isCount = false,
  currentHeadcount,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  isCount?: boolean
  currentHeadcount?: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-ink-300">{label}</span>
        <span className="font-medium text-ink-50">
          {formatSigned(value, (v) => `${Math.round(v)}${suffix}`)}
          {isCount && currentHeadcount !== undefined && (
            <span className="text-ink-500 font-normal"> ({currentHeadcount + value} чел.)</span>
          )}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

function SimResult({ label, value, highlight, accent }: { label: string; value: string; highlight?: boolean; accent?: 'positive' | 'negative' }) {
  return (
    <div>
      <div className="text-xs text-ink-500 mb-1">{label}</div>
      <div
        className={cn(
          'font-display text-xl font-semibold',
          highlight && 'text-brand-400',
          accent === 'positive' && 'text-positive-500',
          accent === 'negative' && 'text-negative-500',
          !highlight && !accent && 'text-ink-50',
        )}
      >
        {value}
      </div>
    </div>
  )
}
