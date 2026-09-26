import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Filter,
  Gauge,
  LineChart,
  Radar,
  Search,
  Sliders,
  Upload,
  Users,
  Wand2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandMark } from '@/components/icons/BrandMark'
import { useSalesStore } from '@/store/salesStore'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '#features', label: 'Возможности' },
  { href: '#how', label: 'Как это работает' },
  { href: '#demo', label: 'Демо' },
]

const FEATURES = [
  {
    icon: Radar,
    title: 'Рекомендации, а не просто графики',
    text: 'Движок каждый день сканирует воронку и говорит, что именно происходит: у какого менеджера зависли сделки и почему просела конверсия — с конкретными цифрами.',
    gradient: 'from-aurora-amber-soft via-aurora-violet to-ink-900',
  },
  {
    icon: Filter,
    title: 'Воронка под контролем',
    text: 'Конверсия между каждой парой стадий, дни в стадии и стоимость зависших сделок — с динамикой к прошлой неделе, а не только моментальный снимок.',
    gradient: 'from-aurora-blue-soft via-aurora-amber-soft to-ink-900',
  },
  {
    icon: Users,
    title: 'Менеджеры под лупой',
    text: 'Конверсия, средний цикл сделки и число зависших сделок по каждому продавцу — сразу видно, кому нужна помощь.',
    gradient: 'from-aurora-violet via-aurora-blue to-ink-900',
  },
  {
    icon: LineChart,
    title: 'Прогноз и план/факт',
    text: 'Взвешенный прогноз выручки на месяц по вероятности закрытия каждой стадии, калиброванной на исторических сделках.',
    gradient: 'from-aurora-blue via-aurora-violet to-ink-900',
  },
  {
    icon: Sliders,
    title: 'Симулятор «что если»',
    text: 'Меняйте объём лидов, конверсию, средний чек и штат менеджеров ползунками — прогноз выручки пересчитывается мгновенно.',
    gradient: 'from-aurora-amber-soft via-aurora-blue-soft to-ink-900',
  },
  {
    icon: Gauge,
    title: 'Здоровье отдела продаж в одном экране',
    text: 'Сквозная конверсия, план/факт месяца, средний цикл сделки и количество сделок, требующих внимания — статус на главном экране.',
    gradient: 'from-negative-500 via-aurora-amber-soft to-ink-900',
  },
]

const HOW_STEPS = [
  { icon: Upload, title: 'Подключите CRM', text: 'amoCRM или Битрикс24 (скоро) — или загрузите сделки через CSV в том же формате уже сейчас.' },
  { icon: Wand2, title: 'Считаем показатели', text: 'Дни в каждой стадии, конверсия между этапами, длина цикла сделки — по каждому менеджеру и по отделу в целом.' },
  { icon: Search, title: 'Находим проблемы', text: 'Правило-based движок ищет зависшие сделки и падение конверсии — и объясняет, где именно теряются деньги.' },
  { icon: BarChart3, title: 'Получаете инструкцию', text: 'Не график, а прямое указание: какой менеджер, какая стадия, что стоит проверить.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const loadDemo = useSalesStore((s) => s.loadDemo)

  function handleDemo() {
    loadDemo()
    navigate('/app/dashboard')
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-ink-50 overflow-x-clip">
      <div className="aurora-backdrop" />

      <header className="sticky top-0 z-40 py-5">
        <div className="relative z-10 max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-[30px] items-center justify-center rounded-[9px] bg-linear-to-br from-aurora-amber-soft via-aurora-violet to-aurora-blue shrink-0 shadow-[0_0_18px_rgba(139,111,232,0.4)]">
              <BrandMark className="size-4 text-ink-950" />
            </div>
            <span className="font-display text-sm font-semibold truncate">AI РОП</span>
          </div>

          <nav className="hidden md:flex items-center gap-0.5 rounded-full border border-ink-800 bg-white/[0.03] backdrop-blur-md p-1.5">
            {NAV_LINKS.map((l) =>
              l.href === '#demo' ? (
                <button
                  key={l.href}
                  type="button"
                  onClick={handleDemo}
                  className="text-sm font-medium text-ink-300 hover:text-ink-50 hover:bg-white/[0.06] rounded-full px-4 py-2 transition-colors"
                >
                  {l.label}
                </button>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium text-ink-300 hover:text-ink-50 hover:bg-white/[0.06] rounded-full px-4 py-2 transition-colors"
                >
                  {l.label}
                </a>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" asChild>
              <Link to="/auth">Войти</Link>
            </Button>
            <Button size="sm" className="rounded-full btn-aurora-glow text-ink-50 shadow-none" asChild>
              <Link to="/onboarding">Начать бесплатно</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-4xl mx-auto text-center px-4 pt-10 pb-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-white/[0.04] px-4 py-1.5 text-xs text-ink-300 mb-7">
            <span className="size-1.5 rounded-full bg-positive-500 shadow-[0_0_8px_rgba(12,163,12,0.7)]" />
            Надстройка над amoCRM и Битрикс24 — работает прямо в браузере
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            Цифровой РОП,
            <br />
            который видит всю воронку
          </h1>
          <p className="mt-6 text-lg text-ink-300 max-w-2xl mx-auto">
            AI РОП анализирует воронку продаж, длину цикла сделки и причины отказов — и вместо очередной панели с
            графиками ежедневно подсказывает собственнику, где менеджер завис и почему просела конверсия. Плюс
            прогноз выручки и симулятор «что если» для планирования.
          </p>
          <div className="mt-9 mb-14 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="rounded-full btn-aurora-glow text-ink-50 shadow-none" asChild>
              <Link to="/onboarding">
                Попробовать бесплатно <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full" onClick={handleDemo}>
              Посмотреть демо
            </Button>
          </div>

          <RecommendationExample />
        </section>

        <section id="features" className="max-w-6xl mx-auto px-4 pt-20 pb-24 scroll-mt-24">
          <SectionHead eyebrow="Возможности" title="Всё, что нужно РОПу для контроля отдела">
            От загрузки сделок до конкретной инструкции — без ручного разбора отчётов из CRM.
          </SectionHead>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, text, gradient }) => (
              <Card key={title} className="overflow-hidden p-0">
                <div className={cn('relative h-32 bg-linear-to-br', gradient)}>
                  <Icon className="absolute top-4 right-4 size-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]" />
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold text-ink-50 mb-2">{title}</h3>
                  <p className="text-[13px] text-ink-500 leading-relaxed">{text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="max-w-6xl mx-auto px-4 pb-24 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-11">
            <span className="inline-block text-xs font-semibold tracking-[0.14em] uppercase text-aurora-blue-soft mb-3.5">
              Как это работает
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">От сырых данных до инструкции</h2>
            <p className="text-ink-400">Детерминированный движок правил — объяснимый и без «чёрного ящика».</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_STEPS.map(({ title, text }, i) => (
              <Card key={title} className="p-6">
                <span className="text-aurora-gradient font-display text-2xl font-bold block mb-4">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-base font-semibold text-ink-50 mb-2">{title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{text}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-7 flex flex-col sm:flex-row items-center justify-between gap-6 bg-linear-to-br from-aurora-violet/10 to-aurora-blue/5 border-ink-700">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-50 mb-1">Готовы начать?</h3>
              <p className="text-sm text-ink-400">Заполните короткую анкету — 3 шага, без регистрации.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Button className="rounded-full btn-aurora-glow text-ink-50 shadow-none" asChild>
                <Link to="/onboarding">Попробовать бесплатно</Link>
              </Button>
              <Button variant="outline" className="rounded-full" onClick={handleDemo}>
                Смотреть демо
              </Button>
            </div>
          </Card>
        </section>

        <section id="demo" className="max-w-2xl mx-auto px-4 pb-16 text-center scroll-mt-24">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-4">Посмотрите на реальном примере</h2>
          <p className="text-ink-400 mb-8">
            Демо-кабинет B2B-дистрибьютора «Северный Мост»: 5 менеджеров, ~55 сделок за 3 месяца, включая менеджера
            с зависшими сделками на этапе КП. Без регистрации.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="rounded-full btn-aurora-glow text-ink-50 shadow-none" onClick={handleDemo}>
              Посмотреть демо
            </Button>
            <Button size="lg" variant="outline" className="rounded-full" asChild>
              <Link to="/onboarding">
                Создать свой кабинет <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-28 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-9">
            <span className="inline-block text-xs font-semibold tracking-[0.14em] uppercase text-aurora-blue-soft mb-3.5">Тарифы</span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-3">Простая цена, без скрытых условий</h2>
          </div>
          <Card className="max-w-md mx-auto p-7 border-brand-500/30 bg-brand-500/5">
            <div className="text-sm font-medium text-ink-300 mb-1">MVP-доступ</div>
            <div className="font-display text-4xl font-bold text-ink-50 mb-1">Бесплатно</div>
            <p className="text-sm text-ink-400 mb-5">На время MVP — полный доступ к демо и CSV-импорту, без ограничений.</p>
            <ul className="space-y-2 text-sm text-ink-300 mb-6">
              <li>· Воронка, менеджеры, сделки, прогноз</li>
              <li>· Рекомендации и симулятор «что если»</li>
              <li>· CSV-импорт сделок</li>
              <li>· amoCRM / Битрикс24 — скоро</li>
            </ul>
            <Button className="w-full rounded-full btn-aurora-glow text-ink-50 shadow-none" asChild>
              <Link to="/onboarding">Начать бесплатно</Link>
            </Button>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-ink-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-xs text-ink-500 text-center space-y-1.5">
          <p>AI РОП — MVP. Рекомендации формируются детерминированным движком правил, без внешних вызовов LLM.</p>
          <p>
            Сделано в{' '}
            <a
              href="https://vinakovlab.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-400 hover:text-ink-200 underline underline-offset-2"
            >
              vinakovlab.ru
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 mb-11">
      <div>
        <span className="block text-xs font-semibold tracking-[0.14em] uppercase text-aurora-blue-soft mb-3.5">{eyebrow}</span>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold max-w-[16ch]">{title}</h2>
      </div>
      <p className="text-sm text-ink-500 max-w-[34ch]">{children}</p>
    </div>
  )
}

/** Статичная карточка-пример: ровно тот стиль рекомендации, что генерирует движок (см. recommendations.ts),
 * используя дословный пример из брифа продукта. */
function RecommendationExample() {
  return (
    <div className="max-w-2xl mx-auto rounded-[20px] border border-ink-700 bg-ink-900 overflow-hidden shadow-2xl text-left">
      <div className="flex items-center gap-1.5 px-4 py-3 bg-ink-800 border-b border-ink-800">
        <span className="size-2 rounded-full bg-negative-500" />
        <span className="size-2 rounded-full bg-warning-500" />
        <span className="size-2 rounded-full bg-positive-500" />
        <span className="ml-2 text-xs text-ink-500">ai-rop.app · Dashboard · Рекомендации</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3.5 rounded-2xl border border-negative-500/30 bg-negative-500/10 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-negative-500/10">
            <XCircle className="size-4.5 text-negative-500" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 text-negative-500">Критично</div>
            <p className="text-sm text-ink-100 leading-relaxed">
              Менеджер Иван завис на этапе КП отправлено по 3 крупным сделкам. Конверсия из звонка во встречу упала
              на 15% за неделю. Обратите внимание на его скрипт.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500 px-1">
          <Radar className="size-3.5" />
          Именно такую карточку сгенерировал движок на демо-данных — не иллюстрация, а реальный вывод.
        </div>
      </div>
    </div>
  )
}
