import { createContext, useContext } from 'react'

/**
 * One submit action for both modes. Guided steps and the full workbook both call `request`,
 * which opens the single confirmation dialog owned by the forecast flow. `after` runs only
 * once the user confirms (the workbook uses it to press the embedded model's own submit).
 */
export type SubmitGate = { request: (after?: () => void) => void; submitted: string | null; sub: string }
export const SubmitGateCtx = createContext<SubmitGate | null>(null)
export const useSubmitGate = () => useContext(SubmitGateCtx)
