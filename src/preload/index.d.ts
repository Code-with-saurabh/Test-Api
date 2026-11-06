import type { ApiClient } from '@shared/ipc'

declare global {
  interface Window {
    api: ApiClient
  }
}

export {}
