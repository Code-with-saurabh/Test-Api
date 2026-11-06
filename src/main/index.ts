import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { APP_ID, APP_NAME } from '@shared/branding'
import { initDb, flushOnExit, persistNow } from './services/db/store'
import { registerIpcHandlers } from './ipc'
import { wsManager } from './services/ws/client'
import { applyStoredZoom, resetAppZoom, stepAppZoom } from './services/zoom/controller'
import { initAutoUpdater, stopAutoUpdater } from './services/updater'
import { buildAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#17191F',
    title: APP_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  // Restore the user's last zoom before the first paint.
  applyStoredZoom(mainWindow)

  // Chrome-style keyboard zoom. Handled in the main process so it works even
  // while focus is inside Monaco, inputs or the response viewer.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return
    const add = input.key === '+' || input.key === '=' || input.code === 'NumpadAdd'
    const sub = input.key === '-' || input.key === '_' || input.code === 'NumpadSubtract'
    const reset = input.key === '0' || input.code === 'Numpad0'
    if (!add && !sub && !reset) return
    event.preventDefault()
    if (add) stepAppZoom(mainWindow, 1)
    else if (sub) stepAppZoom(mainWindow, -1)
    else if (reset) resetAppZoom(mainWindow)
  })

  // Show window reliably: ready-to-show OR 1.5s fallback (ready-to-show can miss in dev)
  const showWindow = (): void => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }
  mainWindow.once('ready-to-show', showWindow)
  setTimeout(showWindow, 1500)

  // Surface renderer errors in dev terminal (helps debug blank-window issues)
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.webContents.on('console-message', (_e, level, message) => {
      if (level >= 3) console.error(`[renderer] ${message}`)
    })
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error(`[renderer] did-fail-load: ${code} ${desc}`)
      showWindow()
    })
  }

  // Smoke test mode: verify IPC chain then auto-quit (used by CI/dev verification)
  if (process.env.TESTAPI_SMOKE === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow?.webContents.executeJavaScript(
            `window.api && window.api.ping ? window.api.ping() : { ok: false, error: { code: 'NO_API', message: 'window.api missing' } }`
          )
          console.log('[SMOKE] ping result:', JSON.stringify(result))
          const settings = await mainWindow?.webContents.executeJavaScript(`window.api.getSettings()`)
          console.log('[SMOKE] settings result:', JSON.stringify(settings))
          const zoom = await mainWindow?.webContents.executeJavaScript(`window.api.appZoomGet()`)
          console.log('[SMOKE] zoom result:', JSON.stringify(zoom))
          const ok = result?.ok === true && settings?.ok === true && zoom?.ok === true
          console.log(ok ? '[SMOKE] PASS' : '[SMOKE] FAIL')
          app.exit(ok ? 0 : 1)
        } catch (e) {
          console.error('[SMOKE] ERROR', e)
          app.exit(1)
        }
      }, 2500)
    })
  }

  // Security: block all window.open / navigation; allow https + mailto external via shell
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  initDb()
  registerIpcHandlers()
  buildAppMenu(() => mainWindow)
  createWindow()
  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopAutoUpdater()
  wsManager.closeAll()
  flushOnExit()
})

process.on('exit', () => {
  persistNow()
})
