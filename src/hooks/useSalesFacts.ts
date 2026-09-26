import { useMemo } from 'react'
import { useSalesStore } from '@/store/salesStore'
import {
  buildLostReasonBreakdown,
  calculateAdjacentStageConversions,
  calculateAverageCycleLengthDays,
  calculateOverallFunnelConversion,
  calculateStageMedianDwellDays,
  calculateWeightedPipelineValue,
  calibrateStageWinProbabilities,
  flagStuckDeals,
} from '@/lib/sales/formulas'
import { OPEN_FUNNEL_STAGES } from '@/types/sales'

/** Единая точка расчёта фактов из доменного слоя поверх текущего состояния стора — как
 * useMarketingFacts у AI CMO. Используется дашбордом, воронкой, менеджерами и прогнозом. */
export function useSalesFacts(referenceISO: string = new Date().toISOString()) {
  const deals = useSalesStore((s) => s.deals)

  return useMemo(() => {
    const stuckFlags = flagStuckDeals(deals, referenceISO)
    const stageMedianDwellDays = calculateStageMedianDwellDays(deals)
    const adjacentConversions = calculateAdjacentStageConversions(deals)
    const overallConversion = calculateOverallFunnelConversion(deals)
    const avgCycleLengthDays = calculateAverageCycleLengthDays(deals)
    const lostReasonBreakdown = buildLostReasonBreakdown(deals)
    const winProbByStage = calibrateStageWinProbabilities(deals)
    const openDeals = deals.filter((d) => d.outcome === 'open')
    const weightedPipelineValue = calculateWeightedPipelineValue(openDeals, winProbByStage)
    const openPipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0)

    const stageCounts: Record<string, number> = {}
    const stageValues: Record<string, number> = {}
    for (const stage of OPEN_FUNNEL_STAGES) {
      stageCounts[stage] = openDeals.filter((d) => d.stage === stage).length
      stageValues[stage] = openDeals.filter((d) => d.stage === stage).reduce((sum, d) => sum + d.value, 0)
    }

    return {
      stuckFlags,
      stageMedianDwellDays,
      adjacentConversions,
      overallConversion,
      avgCycleLengthDays,
      lostReasonBreakdown,
      winProbByStage,
      openDeals,
      weightedPipelineValue,
      openPipelineValue,
      stageCounts,
      stageValues,
    }
  }, [deals, referenceISO])
}
