import { describe, expect, it } from 'vitest'
import { generateDealCsvTemplate, parseDealCsv } from './csvDealImport'

describe('parseDealCsv', () => {
  it('parses a well-formed CSV into deal rows', () => {
    const csv = ['Менеджер,Название,Стадия,Сумма,Дата создания,Исход,Причина отказа', 'Иван Соколов,ООО Ромашка,КП отправлено,350000,2026-09-10,В работе,'].join('\n')
    const result = parseDealCsv(csv)
    expect(result.warnings).toEqual([])
    expect(result.rows).toEqual([
      {
        managerName: 'Иван Соколов',
        title: 'ООО Ромашка',
        stage: 'proposal_sent',
        value: 350000,
        createdAt: '2026-09-10',
        outcome: 'open',
        lostReason: null,
      },
    ])
  })

  it('recognizes won/lost outcomes and lost reasons', () => {
    const csv = [
      'Менеджер,Название,Стадия,Сумма,Дата создания,Исход,Причина отказа',
      'Ольга Титова,Сделка A,Закрыта (успех),500000,2026-09-01,Успех,',
      'Ольга Титова,Сделка B,Отказ,100000,2026-09-01,Отказ,Дорого',
    ].join('\n')
    const result = parseDealCsv(csv)
    expect(result.rows[0].outcome).toBe('won')
    expect(result.rows[1].outcome).toBe('lost')
    expect(result.rows[1].lostReason).toBe('price')
  })

  it('skips rows with an unrecognized stage and warns', () => {
    const csv = ['Менеджер,Название,Стадия,Сумма', 'Иван,Сделка,Непонятная стадия,1000'].join('\n')
    const result = parseDealCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.warnings[0]).toContain('не распознана')
  })

  it('requires manager and title columns', () => {
    const csv = ['Стадия,Сумма', 'Новый лид,1000'].join('\n')
    const result = parseDealCsv(csv)
    expect(result.rows).toEqual([])
    expect(result.warnings[0]).toContain('обязательные колонки')
  })

  it('rejects a file with no data rows', () => {
    const result = parseDealCsv('Менеджер,Название')
    expect(result.rows).toEqual([])
    expect(result.warnings[0]).toContain('нет строк с данными')
  })
})

describe('generateDealCsvTemplate', () => {
  it('produces a header row and one example row', () => {
    const template = generateDealCsvTemplate()
    const lines = template.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Менеджер')
  })
})
