export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/** UUID для стабильного идентификатора рабочего пространства. */
export function generateBusinessId(): string {
  return crypto.randomUUID()
}
