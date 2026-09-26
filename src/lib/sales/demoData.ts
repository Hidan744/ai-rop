import { generateBusinessId, generateId } from '@/lib/id'
import type { Task, TaskComment } from '@/lib/sales/tasks'
import type {
  ActivityLogEntry,
  Deal,
  DealOutcome,
  DealSource,
  FunnelStage,
  LostReason,
  Manager,
  MonthlyPlanFact,
  NextStep,
  NextStepType,
  SalesProfile,
  StageHistoryEntry,
} from '@/types/sales'

export interface DemoWorkspace {
  profile: SalesProfile
  managers: Manager[]
  deals: Deal[]
  activityLog: ActivityLogEntry[]
  planFactHistory: MonthlyPlanFact[]
  tasks: Task[]
}

/** Простой seeded PRNG (mulberry32) — стабильный демо-датасет между перезапусками/тестами. */
function createRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function daysAgoISO(now: Date, days: number): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]
}

const COMPANY_NAMES = [
  'ООО «Northwind Логистика»',
  'ИП Ковалёв, дистрибуция',
  'ООО «Гранит Строй»',
  'АО «ПромТехСервис»',
  'ООО «Вектор Ритейл»',
  'ООО «Балтика Софт»',
  'ИП Соловьёва, консалтинг',
  'ООО «Мегаполис Групп»',
  'ООО «АгроХолдинг Юг»',
  'ООО «ТехноПласт»',
  'АО «Феникс Инвест»',
  'ООО «Кристалл Медиа»',
]

const LOST_REASONS: LostReason[] = ['price', 'no_budget', 'chose_competitor', 'no_response', 'not_relevant', 'timing', 'other']

/** Правдоподобный следующий шаг по умолчанию для каждой открытой стадии воронки. */
const NEXT_STEP_OPTIONS_BY_STAGE: Partial<Record<FunnelStage, NextStepType[]>> = {
  new_lead: ['call'],
  qualification: ['call', 'schedule_meeting'],
  meeting_scheduled: ['send_proposal'],
  proposal_sent: ['get_decision', 'call'],
  negotiation: ['send_contract', 'get_payment', 'get_decision'],
}

/** Build stage history for a deal that has progressed linearly through `stagesReached`, with
 * dwell time per stage drawn from a per-stage range (days), ending either open at the last
 * stage or closed (won/lost) at referenceNow minus `closedDaysAgo`. */
function buildProgression(
  rng: () => number,
  now: Date,
  startedDaysAgo: number,
  stagesReached: FunnelStage[],
  dwellRangeByStage: (stage: FunnelStage) => [number, number],
): { history: StageHistoryEntry[]; createdAt: string; stageEnteredAt: string; totalElapsedDays: number } {
  let elapsed = 0
  const history: StageHistoryEntry[] = []
  const createdAt = daysAgoISO(now, startedDaysAgo)
  let cursorDaysAgo = startedDaysAgo
  for (const stage of stagesReached) {
    history.push({ stage, enteredAt: daysAgoISO(now, cursorDaysAgo) })
    const [min, max] = dwellRangeByStage(stage)
    const dwell = min + rng() * (max - min)
    elapsed += dwell
    cursorDaysAgo = Math.max(0, cursorDaysAgo - dwell)
  }
  const stageEnteredAt = history[history.length - 1].enteredAt
  return { history, createdAt, stageEnteredAt, totalElapsedDays: elapsed }
}

const TYPICAL_DWELL: Record<FunnelStage, [number, number]> = {
  new_lead: [1, 3],
  qualification: [2, 5],
  meeting_scheduled: [2, 4],
  proposal_sent: [2, 6],
  negotiation: [3, 8],
  won: [0, 0],
  lost: [0, 0],
}

/**
 * Демо-датасет «Северный Мост» — B2B-дистрибьютор промышленного оборудования, 5 продавцов,
 * ~55 сделок за последние 3 месяца. Числа подобраны так, чтобы движок рекомендаций
 * (recommendations.ts) реально находил историю менеджера Ивана Соколова: 3 крупные сделки
 * зависли на «КП отправлено», а его конверсия звонок → встреча упала на этой неделе — то есть
 * демо доказывает, что правила работают, а не просто иллюстрирует UI.
 */
export function buildDemoWorkspace(now: Date = new Date()): DemoWorkspace {
  const rng = createRng(42)

  const managers: Manager[] = [
    { id: 'mgr_ivan', name: 'Иван Соколов', initials: 'ИС' },
    { id: 'mgr_olga', name: 'Ольга Титова', initials: 'ОТ' },
    { id: 'mgr_dmitry', name: 'Дмитрий Волков', initials: 'ДВ' },
    { id: 'mgr_anna', name: 'Анна Кузнецова', initials: 'АК' },
    { id: 'mgr_pavel', name: 'Павел Морозов', initials: 'ПМ' },
  ]

  const deals: Deal[] = []
  const activityLog: ActivityLogEntry[] = []
  const sources: DealSource[] = ['amocrm', 'bitrix24', 'csv']

  function addDeal(input: {
    managerId: string
    companyIdx: number
    value: number
    source: DealSource
    startedDaysAgo: number
    stagesReached: FunnelStage[]
    outcome: DealOutcome
    lostReason?: LostReason | null
    closedDaysAgo?: number
    dwellOverride?: (stage: FunnelStage) => [number, number]
    /** Принудительно задать следующий шаг (или явно null) — для headline-историй демо. */
    nextStepOverride?: NextStep | null
    /** Принудительно задать «дней без активности» (не берётся из случайного распределения). */
    lastActivityDaysAgoOverride?: number
  }): Deal {
    const { history, createdAt, stageEnteredAt } = buildProgression(
      rng,
      now,
      input.startedDaysAgo,
      input.stagesReached,
      input.dwellOverride ?? ((s) => TYPICAL_DWELL[s]),
    )
    const lastStage = input.stagesReached[input.stagesReached.length - 1]
    const closedAt = input.outcome !== 'open' ? daysAgoISO(now, input.closedDaysAgo ?? 1) : null

    let nextStep: NextStep | null = null
    if (input.outcome === 'open') {
      if (input.nextStepOverride !== undefined) {
        nextStep = input.nextStepOverride
      } else if (rng() >= 0.15) {
        // ~15% открытых сделок намеренно оставлены без следующего шага — сами по себе сигнал
        // внимания (см. dealAttention.ts isDealWithoutNextStep).
        const options = NEXT_STEP_OPTIONS_BY_STAGE[lastStage] ?? ['call']
        const type = pick(rng, options)
        const overdue = rng() < 0.35
        const offsetDays = overdue ? -(1 + Math.floor(rng() * 12)) : 1 + Math.floor(rng() * 10)
        nextStep = { type, dueDate: daysAgoISO(now, -offsetDays) }
      }
    }

    let lastActivityAt: string
    if (closedAt) {
      lastActivityAt = closedAt
    } else if (input.lastActivityDaysAgoOverride !== undefined) {
      lastActivityAt = daysAgoISO(now, input.lastActivityDaysAgoOverride)
    } else {
      const stale = rng() < 0.2 // ~20% открытых сделок намеренно «протухли» без активности
      const rawDaysSince = stale ? 6 + Math.floor(rng() * 20) : Math.floor(rng() * 4)
      const cappedDaysSince = Math.min(rawDaysSince, input.startedDaysAgo)
      lastActivityAt = daysAgoISO(now, cappedDaysSince)
    }

    const deal: Deal = {
      id: generateId('deal'),
      title: COMPANY_NAMES[input.companyIdx % COMPANY_NAMES.length],
      managerId: input.managerId,
      stage: input.outcome === 'won' ? 'won' : input.outcome === 'lost' ? 'lost' : lastStage,
      value: input.value,
      source: input.source,
      createdAt,
      stageEnteredAt: closedAt ?? stageEnteredAt,
      stageHistory: history,
      closedAt,
      outcome: input.outcome,
      lostReason: input.outcome === 'lost' ? (input.lostReason ?? pick(rng, LOST_REASONS)) : null,
      nextStep,
      lastActivityAt,
    }
    deals.push(deal)
    return deal
  }

  let companyIdx = 0

  // --- Иван Соколов: сильный старт воронки, но 3 крупные сделки зависли на «КП отправлено» ---
  // Стуковые (зависшие) крупные сделки — именно этот менеджер и эта стадия должны всплыть
  // в топ рекомендаций. Явно помечены просроченным следующим шагом и «протухшей» активностью,
  // чтобы та же история читалась и в блоке «Требуют внимания», и в задачах, поставленных Ивану.
  const ivanStuckDeal1 = addDeal({
    managerId: 'mgr_ivan', companyIdx: companyIdx++, value: 2_400_000, source: 'amocrm',
    startedDaysAgo: 34, stagesReached: ['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'],
    outcome: 'open', dwellOverride: (s) => (s === 'proposal_sent' ? [22, 22] : TYPICAL_DWELL[s]),
    nextStepOverride: { type: 'get_decision', dueDate: daysAgoISO(now, 9) },
    lastActivityDaysAgoOverride: 12,
  })
  const ivanStuckDeal2 = addDeal({
    managerId: 'mgr_ivan', companyIdx: companyIdx++, value: 1_850_000, source: 'bitrix24',
    startedDaysAgo: 30, stagesReached: ['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'],
    outcome: 'open', dwellOverride: (s) => (s === 'proposal_sent' ? [19, 19] : TYPICAL_DWELL[s]),
    nextStepOverride: { type: 'call', dueDate: daysAgoISO(now, -2) },
    lastActivityDaysAgoOverride: 6,
  })
  const ivanStuckDeal3 = addDeal({
    managerId: 'mgr_ivan', companyIdx: companyIdx++, value: 3_100_000, source: 'amocrm',
    startedDaysAgo: 40, stagesReached: ['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'],
    outcome: 'open', dwellOverride: (s) => (s === 'proposal_sent' ? [26, 26] : TYPICAL_DWELL[s]),
    nextStepOverride: { type: 'get_decision', dueDate: daysAgoISO(now, 15) },
    lastActivityDaysAgoOverride: 15,
  })
  // Остальные сделки Ивана — обычная активность за 3 месяца, включая выигрыши/проигрыши.
  const ivanMix: Array<[FunnelStage[], DealOutcome, number, number]> = [
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'won', 55, 3],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'won', 70, 8],
    [['new_lead', 'qualification', 'meeting_scheduled'], 'lost', 20, 4],
    [['new_lead', 'qualification'], 'lost', 15, 2],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'], 'lost', 45, 5],
    [['new_lead'], 'open', 3, 0],
    [['new_lead', 'qualification'], 'open', 6, 0],
    [['new_lead', 'qualification', 'meeting_scheduled'], 'open', 10, 0],
  ]
  for (const [stages, outcome, startedDaysAgo, closedDaysAgo] of ivanMix) {
    addDeal({
      managerId: 'mgr_ivan', companyIdx: companyIdx++, value: 150_000 + Math.floor(rng() * 500_000),
      source: pick(rng, sources), startedDaysAgo, stagesReached: stages, outcome, closedDaysAgo,
    })
  }

  // --- Остальные менеджеры: разнообразная, в целом здоровая воронка ---
  const otherManagerIds = ['mgr_olga', 'mgr_dmitry', 'mgr_anna', 'mgr_pavel']
  const mixTemplates: Array<[FunnelStage[], DealOutcome]> = [
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'won'],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'won'],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'won'],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'], 'lost'],
    [['new_lead', 'qualification'], 'lost'],
    [['new_lead'], 'lost'],
    [['new_lead', 'qualification', 'meeting_scheduled'], 'lost'],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent', 'negotiation'], 'open'],
    [['new_lead', 'qualification', 'meeting_scheduled', 'proposal_sent'], 'open'],
    [['new_lead', 'qualification', 'meeting_scheduled'], 'open'],
    [['new_lead', 'qualification'], 'open'],
    [['new_lead'], 'open'],
  ]
  for (const managerId of otherManagerIds) {
    for (const [stages, outcome] of mixTemplates) {
      const startedDaysAgo = 5 + Math.floor(rng() * 85)
      const closedDaysAgo = outcome !== 'open' ? Math.floor(rng() * Math.min(startedDaysAgo, 20)) : 0
      addDeal({
        managerId, companyIdx: companyIdx++, value: 80_000 + Math.floor(rng() * 900_000),
        source: pick(rng, sources), startedDaysAgo, stagesReached: stages, outcome, closedDaysAgo,
      })
    }
  }

  // --- Активность (звонки/встречи) за последние 4 недели, по будням, для каждого менеджера ---
  for (const manager of managers) {
    for (let dayOffset = 27; dayOffset >= 0; dayOffset--) {
      const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
      const weekday = date.getUTCDay()
      if (weekday === 0 || weekday === 6) continue // пропускаем выходные

      const isIvan = manager.id === 'mgr_ivan'
      const isCurrentWeek = dayOffset < 7
      const calls = 4 + Math.floor(rng() * 5)
      // У Ивана на этой неделе заметное падение конверсии звонок → встреча (скрипт даёт сбой),
      // на предыдущих неделях — нормальная конверсия ~40%. У остальных — стабильно ~35-46%.
      const meetingRate = isIvan && isCurrentWeek ? 0.28 + rng() * 0.08 : 0.34 + rng() * 0.12
      const meetings = Math.round(calls * meetingRate)
      activityLog.push({
        id: generateId('activity'),
        managerId: manager.id,
        date: date.toISOString().slice(0, 10),
        calls,
        meetings,
      })
    }
  }

  // --- Задачи и обратная связь: несколько задач Ивану Соколову по его же зависшим сделкам ---
  // (та же headline-история, что и в рекомендациях/блоке внимания), плюс пара задач другим
  // менеджерам для разнообразия доски — чтобы демо не выглядело пустым «из коробки».
  function comment(author: string, text: string, hoursAgo: number): TaskComment {
    return { id: generateId('comment'), author, text, createdAt: daysAgoISO(now, hoursAgo / 24) }
  }

  const tasks: Task[] = [
    {
      id: generateId('task'),
      managerId: 'mgr_ivan',
      title: `Узнать, что тормозит КП по «${ivanStuckDeal1.title}» — сделка на ${(ivanStuckDeal1.value / 1_000_000).toFixed(1)} млн ₽ зависла на 3 недели`,
      description: 'Клиент не даёт обратной связи по коммерческому предложению почти 3 недели. Нужно выяснить причину и понять, реально ли ещё закрыть сделку в этом квартале.',
      dealId: ivanStuckDeal1.id,
      startDate: daysAgoISO(now, 5),
      dueDate: daysAgoISO(now, 2),
      status: 'in_progress',
      createdAt: daysAgoISO(now, 5),
      comments: [
        comment('owner', 'Иван, что с КП по этой сделке? Уже 3 недели на этой стадии, сумма крупная — не хотелось бы её потерять.', 100),
        comment('Иван Соколов', 'Клиент запросил доработку тех. задания, жду от него правки. Договорились созвониться завтра, подтолкну.', 70),
      ],
    },
    {
      id: generateId('task'),
      managerId: 'mgr_ivan',
      title: `Проверить сделку «${ivanStuckDeal2.title}», зависшую на КП (${(ivanStuckDeal2.value / 1_000_000).toFixed(2)} млн ₽)`,
      description: null,
      dealId: ivanStuckDeal2.id,
      startDate: daysAgoISO(now, 3),
      dueDate: daysAgoISO(now, -2),
      status: 'new',
      createdAt: daysAgoISO(now, 3),
      comments: [
        comment('owner', 'Есть новости по этой сделке? Она тоже давно в «КП отправлено».', 60),
        comment('Иван Соколов', 'Пока не звонил, приоритет был на первую сделку — возьму в работу сегодня-завтра.', 40),
      ],
    },
    {
      id: generateId('task'),
      managerId: 'mgr_ivan',
      title: 'Разобрать снижение конверсии звонок → встреча на этой неделе',
      description: 'Конверсия упала почти вдвое к предыдущей неделе. Нужно понять причину — скрипт, качество лидов или что-то ещё — и вернуть показатель в норму.',
      dealId: null,
      startDate: daysAgoISO(now, 4),
      dueDate: daysAgoISO(now, 1),
      status: 'in_progress',
      createdAt: daysAgoISO(now, 4),
      comments: [
        comment('owner', 'Иван, обратили внимание — конверсия звонок → встреча упала почти в 2 раза за неделю. В чём дело?', 90),
        comment(
          'Иван Соколов',
          'Есть такое: часть звонков — по старой базе, много отказов на этапе «не актуально». Плюс тестирую новый скрипт, он явно слабее старого. Возвращаюсь к прежнему и отпишусь по результатам.',
          65,
        ),
      ],
    },
    {
      id: generateId('task'),
      managerId: 'mgr_ivan',
      title: `Прислать актуальный прайс по сделке «${ivanStuckDeal3.title}»`,
      description: null,
      dealId: ivanStuckDeal3.id,
      startDate: daysAgoISO(now, 8),
      dueDate: daysAgoISO(now, 6),
      status: 'done',
      createdAt: daysAgoISO(now, 8),
      comments: [
        comment('owner', 'Нужен обновлённый прайс с новыми ценами — отправь клиенту, пока сделка совсем не остыла.', 150),
        comment('Иван Соколов', 'Готово, отправил обновлённый прайс клиенту сегодня утром.', 130),
      ],
    },
    {
      id: generateId('task'),
      managerId: 'mgr_olga',
      title: 'Обновить данные по сделкам в CRM за прошлую неделю',
      description: null,
      dealId: null,
      startDate: daysAgoISO(now, 6),
      dueDate: daysAgoISO(now, 4),
      status: 'done',
      createdAt: daysAgoISO(now, 6),
      comments: [
        comment('owner', 'Ольга, актуализируй, пожалуйста, стадии по сделкам — в отчёте расхождения.', 120),
        comment('Ольга Титова', 'Сделала, все стадии актуальны на сегодняшнее утро.', 95),
      ],
    },
    {
      id: generateId('task'),
      managerId: 'mgr_dmitry',
      title: 'Подготовить коммерческое предложение для нового лида',
      description: 'Крупный входящий лид с сайта — нужно КП в течение двух дней, пока интерес не остыл.',
      dealId: null,
      startDate: daysAgoISO(now, 1),
      dueDate: daysAgoISO(now, -3),
      status: 'new',
      createdAt: daysAgoISO(now, 1),
      comments: [comment('owner', 'Дмитрий, возьми в работу — детали лида скинул в чат.', 20)],
    },
  ]

  // --- План/факт по прошлым месяцам (для страницы «Прогноз») ---
  // Масштаб плана подобран под суммарный объём демо-сделок (5 менеджеров × ~55 сделок), чтобы
  // план/факт и прогноз конца месяца выглядели правдоподобно, а не в разы отличались от плана.
  const monthNames = monthsBack(now, 4) // 3 прошлых месяца + текущий (текущий факт считается из сделок в сторе)
  const planFactHistory: MonthlyPlanFact[] = monthNames.slice(0, 3).map((month, i) => ({
    month,
    plan: 16_500_000 + i * 500_000,
    fact: 15_200_000 + Math.floor(rng() * 3_400_000),
  }))

  const profile: SalesProfile = {
    id: generateBusinessId(),
    companyName: 'Северный Мост',
    niche: 'Дистрибуция промышленного оборудования (B2B)',
    monthlyPlan: 18_000_000,
    crm: 'amocrm',
    createdAt: new Date().toISOString(),
  }

  return { profile, managers, deals, activityLog, planFactHistory, tasks }
}

function monthsBack(now: Date, count: number): string[] {
  const result: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return result
}
