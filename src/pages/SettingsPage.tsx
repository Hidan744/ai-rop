import { useRef, useState } from 'react'
import { Database, Download, GitBranch, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesStore } from '@/store/salesStore'
import { generateDealCsvTemplate, parseDealCsv } from '@/lib/sales/csvDealImport'
import { DATA_CONNECTORS, CRM_LABELS } from '@/types/sales'

const CONNECTOR_ICONS = { amocrm: Database, bitrix24: GitBranch } as const

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const profile = useSalesStore((s) => s.profile)
  const managers = useSalesStore((s) => s.managers)
  const importDealsFromCsv = useSalesStore((s) => s.importDealsFromCsv)
  const updateMonthlyPlan = useSalesStore((s) => s.updateMonthlyPlan)
  const reset = useSalesStore((s) => s.reset)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState(String(profile?.monthlyPlan ?? ''))

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseDealCsv(text)
      setWarnings(parsed.warnings)
      if (parsed.rows.length > 0) {
        const result = importDealsFromCsv(parsed.rows)
        setImportSummary(
          `Импортировано сделок: ${result.importedCount}.` +
            (result.createdManagers.length > 0 ? ` Созданы новые менеджеры: ${result.createdManagers.join(', ')}.` : ''),
        )
      } else {
        setImportSummary(null)
      }
    }
    reader.readAsText(file)
  }

  function handlePlanSave() {
    const n = Number(planDraft.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) updateMonthlyPlan(n)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Настройки</h1>
        <p className="text-sm text-ink-500 mt-1">Профиль, источники данных, план и импорт</p>
      </div>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Профиль компании</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-ink-500 mb-1">Компания</div>
              <div className="text-ink-100">{profile.companyName}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500 mb-1">Ниша</div>
              <div className="text-ink-100">{profile.niche || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500 mb-1">CRM</div>
              <div className="text-ink-100">{CRM_LABELS[profile.crm]}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500 mb-1">Менеджеров</div>
              <div className="text-ink-100">{managers.length}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Плановая выручка на месяц</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative w-48">
            <input
              type="text"
              inputMode="decimal"
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 pr-8 text-sm text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">₽</span>
          </div>
          <Button size="sm" onClick={handlePlanSave}>Сохранить</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Источники данных</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-400">
            Прямые интеграции с amoCRM и Битрикс24 подключаются в следующей фазе. Сейчас сделки можно
            загрузить вручную через CSV ниже — тот же формат, в который в будущем будут писать живые коннекторы.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DATA_CONNECTORS.map((connector) => {
              const Icon = CONNECTOR_ICONS[connector.id]
              return (
                <div key={connector.id} className="rounded-xl border border-ink-800 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-ink-800 text-ink-400">
                      <Icon className="size-4" />
                    </div>
                    <div className="text-sm font-medium text-ink-100">{connector.name}</div>
                  </div>
                  <p className="text-xs text-ink-500 leading-relaxed flex-1">{connector.description}</p>
                  <Button variant="secondary" size="sm" disabled className="justify-center">
                    Подключить · скоро
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Импорт сделок из CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-400">
            Колонки: Менеджер, Название, Стадия, Сумма, Дата создания, Исход, Причина отказа. Незнакомые
            менеджеры будут созданы автоматически.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="outline" size="sm" onClick={() => downloadTextFile('ai-rop-deals-template.csv', generateDealCsvTemplate())}>
              <Download className="size-4" /> Скачать шаблон
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" /> Загрузить CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
          </div>
          {importSummary && <p className="text-sm text-positive-500">{importSummary}</p>}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-warning-500/25 bg-warning-500/10 p-3.5 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-warning-500">
                  {w}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-negative-500/30">
        <CardHeader>
          <CardTitle>Опасная зона</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-400 mb-3">Полностью сбросить рабочее пространство и начать заново.</p>
          <Button variant="destructive" onClick={reset}>
            Сбросить всё
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
