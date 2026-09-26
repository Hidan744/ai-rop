import { useMemo } from 'react'
import { buildRecommendations } from '@/lib/sales/recommendations'
import { useSalesStore } from '@/store/salesStore'

export function useRecommendations(referenceISO: string = new Date().toISOString()) {
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const activityLog = useSalesStore((s) => s.activityLog)
  return useMemo(() => buildRecommendations(deals, managers, activityLog, referenceISO), [deals, managers, activityLog, referenceISO])
}
