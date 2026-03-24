const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Scan all CLI tools for install status + version
  scanTools: () => ipcRenderer.invoke('scan-tools'),

  // Run an action: launch | install | update | uninstall
  runAction: (action, toolId) => ipcRenderer.invoke('run-action', { action, toolId }),

  // Subscribe to streaming log lines during install/update
  onActionLog: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('action-log', handler)
    return () => ipcRenderer.removeListener('action-log', handler)
  },

  // Open system terminal
  openTerminal: () => ipcRenderer.invoke('open-terminal'),

  // Get platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // ── Config management ──
  getToolDefs:    ()           => ipcRenderer.invoke('get-tool-defs'),
  addTool:        (def)        => ipcRenderer.invoke('add-tool', def),
  updateToolDef:  (id, updates)=> ipcRenderer.invoke('update-tool-def', id, updates),
  removeToolDef:  (id)         => ipcRenderer.invoke('remove-tool-def', id),
  resetToolDefs:  ()           => ipcRenderer.invoke('reset-tool-defs'),
  openConfigFile: ()           => ipcRenderer.invoke('open-config-file'),
  getConfigPath:  ()           => ipcRenderer.invoke('get-config-path'),
})
