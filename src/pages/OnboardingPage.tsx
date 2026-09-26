import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, GitBranch, Database, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { BrandMark } from '@/components/icons/BrandMark'
import { useSalesStore } from '@/store/salesStore'
import { CRM_LABELS, type CrmChoice } from '@/types/sales'

const CRM_ICONS: Record<CrmChoice, typeof Database> = { amocrm: Database, bitrix24: GitBranch, none: X }
const CRM_HINTS: Record<CrmChoice, string> = {
  amocrm: 'Подключим синхронизацию сделок и звонков (скоро) — сейчас загрузим демо-данные в этом формате.',
  bitrix24: 'Подключим воронку и активность менеджеров (скоро) — сейчас загрузим демо-данные в этом формате.',
  none: 'Начните с пустого рабочего пространства и заведите сделки вручную или через CSV.',
}

type Step = 'company' | 'crm' | 'plan'

export function OnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useSalesStore((s) => s.completeOnboarding)
  const loadDemo = useSalesStore((s) => s.loadDemo)

  const [step, setStep] = useState<Step>('company')
  const [companyName, setCompanyName] = useState('')
  const [niche, setNiche] = useState('')
  const [crm, setCrm] = useState<CrmChoice | null>(null)
  const [monthlyPlan, setMonthlyPlan] = useState('')

  const steps: Step[] = ['company', 'crm', 'plan']
  const stepIndex = steps.indexOf(step)
  const progressPct = ((stepIndex + 1) / steps.length) * 100

  function handleSkipToDemo() {
    loadDemo()
    navigate('/app/dashboard')
  }

  function toNumber(v: string): number {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  function handleFinish() {
    if (crm === 'none') {
      completeOnboarding({
        companyName: companyName.trim() || 'Моя компания',
        niche: niche.trim(),
        monthlyPlan: toNumber(monthlyPlan) || 5_000_000,
        crm: 'none',
      })
      navigate('/app/dashboard')
      return
    }
    // amoCRM/Битрикс24 ещё не подключены напрямую (см. Настройки → «скоро») — на выбор одной
    // из них загружаем готовый демо-датасет в этом формате, чтобы сразу показать продукт в деле.
    loadDemo()
    navigate('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <header className="flex items-center justify-between px-4 lg:px-8 h-16 border-b border-ink-800">
        <div className="flex items-center gap-2">
          <BrandMark className="size-4 text-brand-400" />
          <span className="text-sm font-semibold text-ink-50">AI РОП</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkipToDemo}>
          Пропустить и открыть демо
        </Button>
      </header>

      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
            <span>Шаг {stepIndex + 1} из {steps.length}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} />
        </div>

        {step === 'company' && (
          <>
            <h1 className="text-2xl font-semibold text-ink-50 mb-2">Расскажите о компании</h1>
            <p className="text-sm text-ink-400 mb-6">Понадобится для дашборда и прогнозов — можно пропустить и посмотреть на демо-данных.</p>
            <div className="space-y-3">
              <Input autoFocus placeholder="Название компании" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Input placeholder="Ниша, например «Дистрибуция оборудования»" value={niche} onChange={(e) => setNiche(e.target.value)} />
            </div>
            <div className="flex items-center justify-end mt-8">
              <Button onClick={() => setStep('crm')}>Далее</Button>
            </div>
          </>
        )}

        {step === 'crm' && (
          <>
            <h1 className="text-2xl font-semibold text-ink-50 mb-2">Какую CRM вы используете?</h1>
            <p className="text-sm text-ink-400 mb-6">Прямые интеграции появятся в следующей версии — сейчас можно загрузить демо-данные или свои сделки через CSV.</p>
            <div className="grid gap-2.5">
              {(['amocrm', 'bitrix24', 'none'] as CrmChoice[]).map((option) => {
                const Icon = CRM_ICONS[option]
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCrm(option)}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                      crm === option ? 'border-brand-500 bg-brand-500/10' : 'border-ink-800 hover:bg-ink-900'
                    }`}
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-ink-800 text-ink-300 shrink-0">
                      <Icon className="size-4" />
                    </div>
                    <span>
                      <span className="block text-sm font-medium text-ink-100">{CRM_LABELS[option]}</span>
                      <span className="block text-xs text-ink-500 mt-0.5">{CRM_HINTS[option]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep('company')}>Назад</Button>
              <Button onClick={() => setStep('plan')} disabled={!crm}>Далее</Button>
            </div>
          </>
        )}

        {step === 'plan' && (
          <>
            <h1 className="text-2xl font-semibold text-ink-50 mb-2">Плановая выручка на месяц</h1>
            <p className="text-sm text-ink-400 mb-6">Используется для сравнения план/факт и прогноза — можно изменить позже в настройках.</p>
            <div className="relative">
              <Input
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={monthlyPlan}
                onChange={(e) => setMonthlyPlan(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">₽</span>
            </div>
            <div className="flex items-center justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep('crm')}>Назад</Button>
              <Button onClick={handleFinish}>
                <Building2 className="size-4" /> Готово
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
