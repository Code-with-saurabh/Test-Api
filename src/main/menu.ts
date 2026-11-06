import { app, dialog, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { APP_NAME, AUTHOR, GITHUB_ISSUES_URL, GITHUB_RELEASES_URL, GITHUB_URL } from '@shared/branding'
import { resetAppZoom, stepAppZoom } from './services/zoom/controller'
import { checkForUpdates } from './services/updater'

export function buildAppMenu(getWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'

  const zoomIn = (): void => void stepAppZoom(getWindow(), 1)
  const zoomOut = (): void => void stepAppZoom(getWindow(), -1)
  const resetZoom = (): void => void resetAppZoom(getWindow())

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              {
                label: `About ${APP_NAME}`,
                click: (): void => showAbout(getWindow)
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close', accelerator: 'Command+Shift+W' } : { role: 'quit', accelerator: 'Alt+F4' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CommandOrControl+=', click: zoomIn },
        { label: 'Zoom Out', accelerator: 'CommandOrControl+-', click: zoomOut },
        { label: 'Actual Size (100%)', accelerator: 'CommandOrControl+0', click: resetZoom },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click: (): void => void checkForUpdates(true)
        },
        {
          label: 'Download installers (all platforms)',
          click: (): void => void shell.openExternal(GITHUB_RELEASES_URL)
        },
        {
          label: 'GitHub repository',
          click: (): void => void shell.openExternal(GITHUB_URL)
        },
        {
          label: 'Report an issue',
          click: (): void => void shell.openExternal(GITHUB_ISSUES_URL)
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ label: `About ${APP_NAME}`, click: (): void => showAbout(getWindow) }])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function showAbout(getWindow: () => BrowserWindow | null): void {
  const win = getWindow()
  const options = {
    type: 'info' as const,
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail: `Free, offline-first desktop API client.\n\nBuilt by ${AUTHOR.name} (${AUTHOR.role}).\n${AUTHOR.website}\n\nMIT License. No accounts, no telemetry.`,
    buttons: ['OK', 'GitHub', 'Website'],
    defaultId: 0,
    cancelId: 0
  }
  const show = win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
  void show.then((result) => {
    if (result.response === 1) void shell.openExternal(GITHUB_URL)
    if (result.response === 2) void shell.openExternal(AUTHOR.website)
  })
}
