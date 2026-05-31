const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopAPI', {
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),

  getVersion: () => ipcRenderer.invoke('app:version'),
  getBackendPort: () => ipcRenderer.invoke('app:backendPort'),
  getPaths: () => ipcRenderer.invoke('app:paths'),
  quit: () => ipcRenderer.invoke('app:quit'),

  testDb: (cfg) => ipcRenderer.invoke('db:test', cfg),
  completeSetup: (cfg) => ipcRenderer.send('setup:complete', cfg),

  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),

  openLogs: () => ipcRenderer.invoke('logs:open'),
  reportCrash: (payload) => ipcRenderer.send('crash:report', payload),

  // App lock — main process tells the renderer to re-show the LockScreen.
  // Fired when the user hides the window (close-to-tray) or chooses
  // "Lock now" from the tray menu.
  onAppLock: (cb) => {
    const handler = () => cb && cb()
    ipcRenderer.on('app:lock', handler)
    return () => ipcRenderer.removeListener('app:lock', handler)
  },

  onSyncTrigger: (cb) => {
    const handler = () => cb && cb()
    ipcRenderer.on('sync:trigger', handler)
    return () => ipcRenderer.removeListener('sync:trigger', handler)
  },

  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  manualUpdate: () => ipcRenderer.invoke('updates:manual'),
  runManualUpdate: (path) => ipcRenderer.invoke('updates:run-manual', path),
  getUpdateConfig: () => ipcRenderer.invoke('updates:get-config'),
  configureUpdates: (url) => ipcRenderer.invoke('updates:configure', url),
  onUpdateEvent: (cb) => {
    const handler = (_, payload) => cb && cb(payload)
    ipcRenderer.on('updates:event', handler)
    return () => ipcRenderer.removeListener('updates:event', handler)
  },
})
