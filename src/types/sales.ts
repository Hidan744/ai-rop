/** Стадии воронки продаж — фиксированный порядок, тот же для всех менеджеров и сделок. */
export type FunnelStage =
  | 'new_lead'
  | 'qualification'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost'

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  new_lead: 'Новый лид',
  qualification: 'Квалификация',
  meeting_scheduled: 'Встреча назначена',
  proposal_sent: 'КП отправлено',
  negotiation: 'Переговоры',
  won: 'Закрыта (успех)',
  lost: 'Отказ',
}

/** Открытые (не терминальные) стадии в порядке движения по воронке — основа для графика воронки. */
export const OPEN_FUNNEL_STAGES: FunnelStage[] = [
  'new_lead',
  'qualification',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
]

/** Полный путь сделки от лида до победы (без учёта «Отказ» — это боковой выход из любой стадии). */
export const WON_FUNNEL_PATH: FunnelStage[] = [...OPEN_FUNNEL_STAGES, 'won']

export type DealOutcome = 'open' | 'won' | 'lost'

/** Причина отказа — обязательна для сделок с outcome === 'lost'. */
export type LostReason = 'price' | 'no_budget' | 'chose_competitor' | 'no_response' | 'not_relevant' | 'timing'

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: 'Дорого',
  no_budget: 'Нет бюджета',
  chose_competitor: 'Выбрали конкурента',
  no_response: 'Пропал на связи',
  not_relevant: 'Не актуально',
  timing: 'Не время',
}

/** Источник данных сделки — визуально продаёт идею «надстройки над CRM» в демо. */
export type DealSource = 'amocrm' | 'bitrix24' | 'csv'

export const DEAL_SOURCE_LABELS: Record<DealSource, string> = {
  amocrm: 'amoCRM',
  bitrix24: 'Битрикс24',
  csv: 'CSV',
}

export interface Manager {
  id: string
  name: string
  initials: string
}

/** Запись истории стадий — момент входа сделки в конкретную стадию. */
export interface StageHistoryEntry {
  stage: FunnelStage
  enteredAt: string
}

export interface Deal {
  id: string
  title: string
  managerId: string
  stage: FunnelStage
  value: number
  source: DealSource
  createdAt: string
  /** Момент входа в текущую стадию — основа для расчёта «дней в стадии». */
  stageEnteredAt: string
  /** Полная история прохождения стадий, включая текущую — первая запись всегда открывающая стадия. */
  stageHistory: StageHistoryEntry[]
  closedAt: string | null
  outcome: DealOutcome
  lostReason: LostReason | null
}

/** Дневная активность менеджера — основа для расчёта конверсии «звонок → встреча». */
export interface ActivityLogEntry {
  id: string
  managerId: string
  /** YYYY-MM-DD */
  date: string
  calls: number
  meetings: number
}

export type CrmChoice = 'amocrm' | 'bitrix24' | 'none'

export const CRM_LABELS: Record<CrmChoice, string> = {
  amocrm: 'amoCRM',
  bitrix24: 'Битрикс24',
  none: 'Без CRM',
}

export interface SalesProfile {
  id: string
  companyName: string
  niche: string
  /** Плановая выручка на текущий месяц, ₽. */
  monthlyPlan: number
  crm: CrmChoice
  createdAt: string
}

/** История план/факт по прошлым месяцам — для графика на странице «Прогноз». */
export interface MonthlyPlanFact {
  /** YYYY-MM */
  month: string
  plan: number
  fact: number
}

export type DataConnectorId = 'amocrm' | 'bitrix24'

export interface DataConnector {
  id: DataConnectorId
  name: string
  description: string
}

export const DATA_CONNECTORS: DataConnector[] = [
  { id: 'amocrm', name: 'amoCRM', description: 'Прямая синхронизация сделок, стадий и звонков из amoCRM в реальном времени.' },
  { id: 'bitrix24', name: 'Битрикс24', description: 'Импорт воронки, сделок и активности менеджеров из Битрикс24.' },
]
