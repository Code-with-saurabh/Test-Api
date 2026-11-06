/** Auto-update state shared by the main process, preload and renderer. */
export type UpdateState =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  /** Version currently installed. */
  currentVersion: string
  /** Version available/downloaded (when known). */
  version?: string
  /** Download progress 0–100. */
  percent?: number
  message?: string
  /** Epoch milliseconds of the last completed check. */
  checkedAt?: number
}

export const IDLE_UPDATE_STATUS: UpdateStatus = {
  state: 'idle',
  currentVersion: ''
}
