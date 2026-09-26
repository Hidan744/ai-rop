/**
 * Импорт сделок из CSV — тот же приём, что и у csvCampaignImport.ts в AI CMO / csvFinancialImport.ts
 * в Business Financial OS (синонимы заголовков колонок, устойчивый разбор чисел и дат), но по
 * одной строке на сделку. Это ручной, но реальный (не заглушка) канал получения данных в эту
 * фазу — то же место, куда позже подключится живой коннектор amoCRM/Битрикс24.
 */
import type { DealOutcome, FunnelStage, LostReason } from '@/types/sales'
import { FUNNEL_STAGE_LABELS, LOST_REASON_LABELS } from '@/types/sales'

export interface CsvDealRow {
  managerName: string
  title: string
  stage: FunnelStage
  value: number
  createdAt: string
  outcome: DealOutcome
  lostReason: LostReason | null
}

export interface DealImportResult {
  rows: CsvDealRow[]
  warnings: string[]
}

const HEADER_ALIASES = {
  managerName: ['менеджер', 'manager'],
  title: ['название', 'сделка', 'title', 'deal', 'название сделки'],
  stage: ['стадия', 'этап', 'stage'],
  value: ['сумма', 'value', 'бюджет', 'сумма сделки'],
  createdAt: ['дата создания', 'создана', 'created', 'created at'],
  outcome: ['исход', 'статус', 'outcome', 'status'],
  lostReason: ['причина отказа', 'причина', 'lost reason'],
} as const

type Field = keyof typeof HEADER_ALIASES

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseNumericCell(raw: string): number | null {
  const cleaned = (raw ?? '').replace(/[\s ]/g, '').replace(',', '.').replace(/[₽$€]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const STAGE_BY_LABEL = new Map<string, FunnelStage>(
  (Object.entries(FUNNEL_STAGE_LABELS) as [FunnelStage, string][]).map(([stage, label]) => [label.toLowerCase(), stage]),
)

function parseStage(raw: string): FunnelStage | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (STAGE_BY_LABEL.has(v)) return STAGE_BY_LABEL.get(v) as FunnelStage
  // Допускаем английские ключи стадии напрямую (напр. экспорт из другой системы).
  if ((Object.keys(FUNNEL_STAGE_LABELS) as string[]).includes(v)) return v as FunnelStage
  return null
}

function parseOutcome(raw: string, stage: FunnelStage): DealOutcome {
  const v = raw.trim().toLowerCase()
  if (v.includes('успех') || v.includes('won') || v.includes('закрыт') && !v.includes('отказ')) return 'won'
  if (v.includes('отказ') || v.includes('lost')) return 'lost'
  if (stage === 'won') return 'won'
  if (stage === 'lost') return 'lost'
  return 'open'
}

const LOST_REASON_BY_LABEL = new Map<string, LostReason>(
  (Object.entries(LOST_REASON_LABELS) as [LostReason, string][]).map(([reason, label]) => [label.toLowerCase(), reason]),
)

function parseLostReason(raw: string | undefined): LostReason | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  return LOST_REASON_BY_LABEL.get(v) ?? null
}

/** Наивный CSV-парсер: одна ячейка = значение между запятыми, кавычки не поддерживаются
 *  (данные сделок — числа и короткие названия, без запятых внутри значений). */
function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim())
}

export function parseDealCsv(csvText: string): DealImportResult {
  const warnings: string[] = []
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)

  if (lines.length < 2) {
    return { rows: [], warnings: ['В файле нет строк с данными (нужны заголовок + хотя бы одна строка сделки).'] }
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader)
  const columnIndex: Partial<Record<Field, number>> = {}
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const idx = headerCells.findIndex((h) => (HEADER_ALIASES[field] as readonly string[]).includes(h))
    if (idx !== -1) columnIndex[field] = idx
  }

  if (columnIndex.managerName === undefined || columnIndex.title === undefined) {
    return { rows: [], warnings: ['Не найдены обязательные колонки «Менеджер» и «Название».'] }
  }

  const rows: CsvDealRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const get = (field: Field) => (columnIndex[field] !== undefined ? cells[columnIndex[field] as number] : undefined)

    const managerName = (get('managerName') ?? '').trim()
    const title = (get('title') ?? '').trim()
    if (!managerName || !title) {
      warnings.push(`Строка ${i + 1}: пропущена — не заполнены менеджер или название сделки.`)
      continue
    }

    const rawStage = get('stage') ?? ''
    const stage = parseStage(rawStage)
    if (!stage) {
      warnings.push(`Строка ${i + 1}: стадия «${rawStage}» не распознана — строка пропущена.`)
      continue
    }

    const rawValue = get('value')
    let value = 0
    if (rawValue !== undefined && rawValue !== '') {
      const parsed = parseNumericCell(rawValue)
      if (parsed === null) {
        warnings.push(`Строка ${i + 1}: сумма «${rawValue}» не распознана как число — заменена на 0.`)
      } else {
        value = Math.max(0, parsed)
      }
    }

    rows.push({
      managerName,
      title,
      stage,
      value,
      createdAt: (get('createdAt') ?? '').trim() || new Date().toISOString().slice(0, 10),
      outcome: parseOutcome(get('outcome') ?? '', stage),
      lostReason: parseLostReason(get('lostReason')),
    })
  }

  return { rows, warnings }
}

export function generateDealCsvTemplate(): string {
  const headers = ['Менеджер', 'Название', 'Стадия', 'Сумма', 'Дата создания', 'Исход', 'Причина отказа']
  const example = ['Иван Соколов', 'Пример сделки', 'КП отправлено', 350000, '2026-09-10', 'В работе', '']
  return [headers.join(','), example.join(',')].join('\n')
}
