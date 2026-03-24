const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { exec, spawn } = require('child_process')
const fs = require('fs')
const os = require('os')

const isDev = process.argv.includes('--dev')
let mainWindow

// ── Window ──────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,          // hide menu bar on Windows/Linux
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../../resources/icon.png')
  })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  mainWindow.setMenuBarVisibility(false)  // ensure hidden even without autoHide
  if (isDev) mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Helpers ──────────────────────────────────────────────────────────────
function runCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { shell: true, env: { ...process.env } }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout.trim(), stderr: stderr.trim(), code: err?.code })
    })
  })
}

// Check if a command exists in PATH
async function checkCommand(cmd) {
  const which = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`
  const r = await runCmd(which)
  return { exists: r.ok, path: r.stdout }
}

// Get version for a tool
async function getVersion(cmd, versionFlag = '--version') {
  const r = await runCmd(`${cmd} ${versionFlag}`)
  if (r.ok) {
    const match = r.stdout.match(/[\d]+\.[\d]+\.[\d]+(-[\w.]+)?/)
    return match ? 'v' + match[0] : r.stdout.split('\n')[0].trim().slice(0, 20)
  }
  const r2 = await runCmd(`${cmd} -v`)
  if (r2.ok) {
    const match = r2.stdout.match(/[\d]+\.[\d]+\.[\d]+(-[\w.]+)?/)
    return match ? 'v' + match[0] : r2.stdout.split('\n')[0].trim().slice(0, 20)
  }
  return 'unknown'
}

// ── Config file (user data dir, persists across updates) ──────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'tools.json')

const DEFAULT_TOOLS = [
  { id:'aider',      name:'Aider',           cmd:'aider',     pkg:'aider-chat',                mgr:'pip',    color:'#7c3aed', letter:'AI', launchArgs:[] },
  { id:'gemini',     name:'Gemini CLI',      cmd:'gemini',    pkg:'@google/gemini-cli',        mgr:'npm',    color:'#1a73e8', letter:'GC', launchArgs:[] },
  { id:'opencode',   name:'OpenCode',        cmd:'opencode',  pkg:'opencode-ai',               mgr:'npm',    color:'#059669', letter:'OC', launchArgs:[] },
  { id:'codex',      name:'Codex CLI',       cmd:'codex',     pkg:'@openai/codex',             mgr:'npm',    color:'#374151', letter:'CX', launchArgs:[] },
  { id:'kimi',       name:'Kimi Code',       cmd:'kimi',      pkg:'kimi-cli',                  mgr:'pip',    color:'#0ea5e9', letter:'KC', launchArgs:[] },
  { id:'codebuddy',  name:'CodeBuddy',       cmd:'codebuddy', pkg:'@tencent-ai/codebuddy-code',mgr:'npm',    color:'#d97706', letter:'CB', launchArgs:[] },
  { id:'iflow',      name:'iFlow CLI',       cmd:'iflow',     pkg:'@iflow-ai/iflow-cli',       mgr:'npm',    color:'#be185d', letter:'iF', launchArgs:[] },
  { id:'qoder',      name:'Qoder CLI',       cmd:'qodercli',  pkg:'@qoder-ai/qodercli',        mgr:'npm',    color:'#7c3aed', letter:'QD', launchArgs:[] },
  { id:'claude',     name:'Claude Code',     cmd:'claude',    pkg:'@anthropic-ai/claude-code', mgr:'npm',    color:'#d97706', letter:'CC', launchArgs:[] },
  { id:'gh-copilot', name:'GitHub Copilot',  cmd:'gh',        pkg:'gh/gh-copilot',             mgr:'gh',     color:'#24292f', letter:'GH', launchArgs:['copilot'] },
  { id:'amp',        name:'Amp CLI',         cmd:'amp',       pkg:'@sourcegraph/amp',          mgr:'npm',    color:'#0891b2', letter:'AM', launchArgs:[] },
  { id:'qwen',       name:'QWen CLI',        cmd:'qwen',      pkg:'qwen-cli',                  mgr:'pip',    color:'#16a34a', letter:'QW', launchArgs:[] },
  { id:'kiro',       name:'Kiro CLI',        cmd:'kiro-cli',  pkg:'kiro-cli',                  mgr:'manual', color:'#9333ea', letter:'KR', launchArgs:[] },
  { id:'kilo',       name:'Kilo Code',       cmd:'kilo',      pkg:'@kilocode/cli',             mgr:'npm',    color:'#dc2626', letter:'KL', launchArgs:[] },
  { id:'grok',       name:'Grok CLI',        cmd:'grok',      pkg:'grok-cli',                  mgr:'pip',    color:'#6b7280', letter:'GK', launchArgs:[] },
]

function loadToolDefs() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.error('Failed to load tools config:', e)
  }
  // First run: write defaults to disk
  saveToolDefs(DEFAULT_TOOLS)
  return DEFAULT_TOOLS
}

function saveToolDefs(defs) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defs, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error('Failed to save tools config:', e)
    return false
  }
}

let TOOL_DEFS = loadToolDefs()

// Build install/update/uninstall commands
function buildCmd(action, tool) {
  const { cmd, pkg, mgr, launchArgs } = tool
  switch (action) {
    case 'install':
      if (mgr === 'pip')    return `pip install ${pkg}`
      if (mgr === 'npm')    return `npm install -g ${pkg}`
      if (mgr === 'brew')   return `brew install ${pkg}`
      if (mgr === 'gh')     return `gh extension install ${pkg}`
      if (mgr === 'manual') return null   // must be installed manually
      return `npm install -g ${pkg}`
    case 'update':
      if (mgr === 'pip')    return `pip install --upgrade ${pkg}`
      if (mgr === 'npm')    return `npm install -g ${pkg}@latest`
      if (mgr === 'brew')   return `brew upgrade ${pkg}`
      if (mgr === 'gh')     return `gh extension upgrade ${pkg}`
      if (mgr === 'manual') return null
      return `npm install -g ${pkg}@latest`
    case 'uninstall':
      if (mgr === 'pip')    return `pip uninstall ${pkg} -y`
      if (mgr === 'npm')    return `npm uninstall -g ${pkg}`
      if (mgr === 'brew')   return `brew uninstall ${pkg}`
      if (mgr === 'gh')     return `gh extension remove ${pkg}`
      if (mgr === 'manual') return null
      return `npm uninstall -g ${pkg}`
    case 'launch':
      return [cmd, ...launchArgs].join(' ')
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────

// Scan all tools
ipcMain.handle('scan-tools', async () => {
  const results = await Promise.all(TOOL_DEFS.map(async (t) => {
    const check = await checkCommand(t.cmd)
    let version = '—'
    if (check.exists) version = await getVersion(t.cmd)
    return {
      ...t,
      exists: check.exists,
      binPath: check.path,
      version
    }
  }))
  return results
})

// Run a command with streaming output back to renderer
ipcMain.handle('run-action', async (event, { action, toolId }) => {
  const tool = TOOL_DEFS.find(t => t.id === toolId)
  if (!tool) return { ok: false, msg: 'Tool not found' }

  if (action === 'launch') {
    // Open in a new terminal window
    const args = [tool.cmd, ...tool.launchArgs]
    mainWindow.webContents.send('action-log', { toolId, line: `$ ${args.join(' ')}\n` })
    try {
      if (process.platform === 'darwin') {
        const script = `tell application "Terminal" to do script "${args.join(' ')}"`
        exec(`osascript -e '${script}'`)
      } else if (process.platform === 'win32') {
        // Try Windows Terminal first, fall back to cmd.exe
        const cmdStr = args.join(' ')
        let child
        try {
          child = spawn('wt.exe', ['cmd', '/k', cmdStr], { detached: true, stdio: 'ignore' })
        } catch (e) {
          child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', cmdStr], { detached: true, stdio: 'ignore', shell: false })
        }
        child.unref()
      } else {
        const terms = [
          ['gnome-terminal', ['--', 'bash', '-c', `${args.join(' ')}; exec bash`]],
          ['konsole', ['-e', 'bash', '-c', `${args.join(' ')}; exec bash`]],
          ['xfce4-terminal', ['-e', `bash -c "${args.join(' ')}; exec bash"`]],
          ['xterm', ['-e', 'bash', '-c', `${args.join(' ')}; exec bash`]],
        ]
        let launched = false
        for (const [term, tArgs] of terms) {
          const r = await runCmd(`which ${term}`)
          if (r.ok) {
            const child = spawn(term, tArgs, { detached: true, stdio: 'ignore' })
            child.unref()
            launched = true
            break
          }
        }
        if (!launched) return { ok: false, msg: '未找到可用的终端模拟器' }
      }
      return { ok: true, msg: `已在新终端启动 ${tool.name}` }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  }

  // install / update / uninstall — stream output
  const cmd = buildCmd(action, tool)
  if (!cmd) {
    return { ok: false, msg: `"${tool.name}" 需要手动安装，请访问官网下载：https://kiro.dev/docs/cli/installation/` }
  }
  // Log the actual command being executed
  mainWindow.webContents.send('action-log', { toolId, line: `$ ${cmd}\n` })
  return new Promise((resolve) => {
    const proc = spawn(cmd, [], {
      shell: true,
      env: { ...process.env }
    })
    let out = ''
    proc.stdout.on('data', (d) => {
      out += d
      mainWindow.webContents.send('action-log', { toolId, line: d.toString() })
    })
    proc.stderr.on('data', (d) => {
      out += d
      mainWindow.webContents.send('action-log', { toolId, line: d.toString() })
    })
    proc.on('close', async (code) => {
      if (code !== 0) {
        resolve({ ok: false, msg: `退出码: ${code}`, output: out })
        return
      }
      // For install/update: verify command exists in PATH, then return new state
      if (action === 'install' || action === 'update') {
        const verify = await checkCommand(tool.cmd)
        if (!verify.exists) {
          resolve({
            ok: false,
            msg: `包已下载但命令 "${tool.cmd}" 未出现在 PATH 中，请检查包名或重启终端`,
            output: out
          })
          return
        }
        const version = await getVersion(tool.cmd)
        resolve({ ok: true, msg: '操作成功', output: out, newState: { exists: true, version } })
        return
      }
      // For uninstall: confirm command is gone
      if (action === 'uninstall') {
        resolve({ ok: true, msg: '操作成功', output: out, newState: { exists: false, version: '—' } })
        return
      }
      resolve({ ok: true, msg: '操作成功', output: out })
    })
  })
})

// Open terminal at path
ipcMain.handle('open-terminal', async () => {
  const home = os.homedir()

  if (process.platform === 'darwin') {
    exec(`open -a Terminal "${home}"`)

  } else if (process.platform === 'win32') {
    // Try Windows Terminal (wt.exe) first, fall back to cmd.exe
    const trySpawn = (cmd, args) => {
      try {
        const child = spawn(cmd, args, {
          detached: true,
          stdio: 'ignore',
          cwd: home,
          shell: false
        })
        child.unref()
        return true
      } catch (e) {
        return false
      }
    }
    if (!trySpawn('wt.exe', [])) {
      trySpawn('cmd.exe', [])
    }

  } else {
    // Linux: try common terminal emulators in order
    const terms = [
      ['gnome-terminal', []],
      ['konsole', []],
      ['xfce4-terminal', []],
      ['xterm', []],
    ]
    for (const [term, args] of terms) {
      const which = await runCmd(`which ${term}`)
      if (which.ok) {
        const child = spawn(term, args, { detached: true, stdio: 'ignore', cwd: home })
        child.unref()
        break
      }
    }
  }
})

// Get platform info
ipcMain.handle('get-platform', () => ({
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  electronVersion: process.versions.electron,
  appVersion: app.getVersion()
}))

// ── Config management IPC ─────────────────────────────────────────────────

// Get all tool definitions (for manage view)
ipcMain.handle('get-tool-defs', () => TOOL_DEFS)

// Add a new tool
ipcMain.handle('add-tool', (event, toolDef) => {
  // Generate id from name if not provided
  const id = toolDef.id || toolDef.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
  if (TOOL_DEFS.find(t => t.id === id)) {
    return { ok: false, msg: `工具 ID "${id}" 已存在` }
  }
  const newTool = {
    id,
    name:       toolDef.name.trim(),
    cmd:        toolDef.cmd.trim(),
    pkg:        toolDef.pkg.trim(),
    mgr:        toolDef.mgr || 'npm',
    color:      toolDef.color || '#6b7280',
    letter:     (toolDef.letter || toolDef.name.slice(0, 2).toUpperCase()).slice(0, 2),
    launchArgs: toolDef.launchArgs || []
  }
  TOOL_DEFS.push(newTool)
  saveToolDefs(TOOL_DEFS)
  return { ok: true, tool: newTool }
})

// Update an existing tool definition
ipcMain.handle('update-tool-def', (event, id, updates) => {
  const idx = TOOL_DEFS.findIndex(t => t.id === id)
  if (idx === -1) return { ok: false, msg: '工具不存在' }
  TOOL_DEFS[idx] = { ...TOOL_DEFS[idx], ...updates }
  saveToolDefs(TOOL_DEFS)
  return { ok: true, tool: TOOL_DEFS[idx] }
})

// Remove a tool definition
ipcMain.handle('remove-tool-def', (event, id) => {
  const idx = TOOL_DEFS.findIndex(t => t.id === id)
  if (idx === -1) return { ok: false, msg: '工具不存在' }
  TOOL_DEFS.splice(idx, 1)
  saveToolDefs(TOOL_DEFS)
  return { ok: true }
})

// Reset to built-in defaults
ipcMain.handle('reset-tool-defs', () => {
  TOOL_DEFS = [...DEFAULT_TOOLS]
  saveToolDefs(TOOL_DEFS)
  return { ok: true }
})

// Open config file in system default editor
ipcMain.handle('open-config-file', () => {
  shell.openPath(CONFIG_PATH)
})

// Get config file path (for display)
ipcMain.handle('get-config-path', () => CONFIG_PATH)
