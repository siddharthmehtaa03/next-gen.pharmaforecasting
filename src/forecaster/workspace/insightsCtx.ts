import { createContext, useContext } from 'react'
import type { ChartSeries } from './ui'

export type Snap = { series: ChartSeries; unit: string; dp: number; fmt: (v: number) => string; grain: 'month' | 'quarter' | 'year' }
export type SaveReq = { title: string; snap: Snap; scenario?: string }
export const InsightsCtx = createContext<{ save: (r: SaveReq) => void } | null>(null)
export const useInsights = () => useContext(InsightsCtx)
