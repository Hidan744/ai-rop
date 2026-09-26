/**
 * Валидированная (dataviz skill) палитра для тёмной поверхности приложения — тот же набор,
 * что и в Business Financial OS / AI CMO, для единого визуального языка всей линейки
 * AI-продуктов. Категориальные цвета назначаются по фиксированному порядку слотов —
 * никогда не переставляются в зависимости от значения/ранга данных.
 */
export const CATEGORICAL = {
  slot1: '#3987e5', // blue
  slot2: '#d95926', // orange
  slot3: '#199e70', // aqua
  slot4: '#c98500', // yellow
  slot5: '#d55181', // magenta
  slot6: '#008300', // green
  slot7: '#9085e9', // violet
  slot8: '#e66767', // red
} as const

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

export const CHART_CHROME = {
  gridline: '#2a221c', // ink-700
  axis: '#5c4e42', // ink-500
  mutedInk: '#a89c8f', // ink-300
} as const
