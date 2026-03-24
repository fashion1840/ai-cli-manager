'use strict'

// ── State ─────────────────────────────────────────────────────────────────
let tools = []
let currentFilter = 'all'
let busyTools = new Set()
let pendingDelete = null
let isScanning = false       // guard: prevent concurrent rescans

// ── Bootstrap ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  bindStaticEvents()
  initApp()
})

async function initApp() {
  const info = await window.api.getPlatform()
  document.getElementById('electronVer').textContent = `v${info.appVersion}`
  document.getElementById('statPlatform').textContent = platformLabel(info.platform)
  window.api.onActionLog(({ line }) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const type = trimmed.startsWith('$ ') ? 'cmd' : 'log'
    appendLog(trimmed, type)
  })
  await rescan()
}

function platformLabel(p) {
  if (p === 'darwin') return 'macOS'
  if (p === 'win32')  return 'Windows'
  return 'Linux'
}

// ── Bind all static UI events (zero inline onclick in HTML) ────────────────
function bindStaticEvents() {
  // Nav
  document.getElementById('navDashboard').addEventListener('click', function () { switchView('dashboard', this) })
  document.getElementById('navLogs').addEventListener('click', function () { switchView('logs', this) })

  // Sidebar buttons
  document.getElementById('btnRescan').addEventListener('click', () => rescan())
  document.getElementById('btnTerminal').addEventListener('click', () => window.api.openTerminal())

  // Search
  document.getElementById('searchInput').addEventListener('input', () => renderList())

  // Filter buttons
  document.querySelectorAll('.fbtn[data-filter]').forEach(btn => {
    btn.addEventListener('click', function () {
      currentFilter = this.dataset.filter
      document.querySelectorAll('.fbtn[data-filter]').forEach(b => b.classList.remove('active'))
      this.classList.add('active')
      renderList()
    })
  })

  // Log clear
  document.getElementById('btnClearLogs').addEventListener('click', () => clearLogs())

  // Modal overlay click-outside to close
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal()
  })
  document.getElementById('modalCancelBtn').addEventListener('click', () => closeModal())

  // Manage view events
  bindManageEvents()

  // Tool list — event delegation for dynamically rendered rows
  document.getElementById('toolList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn || btn.disabled) return
    const { action, toolid, url } = btn.dataset
    if (action === 'delete') askDelete(toolid)
    else if (action === 'open-url') { if (url) window.open(url) }
    else doAction(action, toolid)
  })
}

// ── Scan ──────────────────────────────────────────────────────────────────
async function rescan() {
  if (isScanning) return          // throttle: ignore if already scanning
  isScanning = true

  const btn = document.getElementById('btnRescan')
  const origText = btn.textContent
  btn.textContent = '扫描中…'
  btn.disabled = true

  document.getElementById('toolList').innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">正在扫描 PATH，检测已安装工具…</div>
    </div>`
  appendLog('开始扫描所有工具…', 'info')

  try {
    tools = await window.api.scanTools()
    renderList()
    updateStats()
    appendLog(`扫描完成：共 ${tools.length} 个，${tools.filter(t => t.exists).length} 个已安装`, 'success')
  } finally {
    isScanning = false
    btn.textContent = origText
    btn.disabled = false
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function renderList() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase()
  const list = document.getElementById('toolList')

  const filtered = tools.filter(t => {
    const mf = currentFilter === 'all'
      || (currentFilter === 'installed' && t.exists)
      || (currentFilter === 'missing'   && !t.exists)
    const mq = t.name.toLowerCase().includes(q) || t.cmd.toLowerCase().includes(q)
    return mf && mq
  })

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">没有匹配的工具</div>'
    return
  }
  list.innerHTML = filtered.map(toolRowHTML).join('')
}

function toolRowHTML(t) {
  const busy = busyTools.has(t.id)
  const dis  = busy ? 'disabled' : ''
  const bc   = busy ? 'busy' : ''

  const badge = t.exists
    ? `<span class="badge installed"><span class="badge-dot" style="background:var(--accent)"></span>已安装</span>`
    : `<span class="badge missing"><span class="badge-dot" style="background:var(--danger)"></span>未安装</span>`

  let actions
  if (t.exists) {
    actions = `<button class="abtn run ${bc}" data-action="launch"  data-toolid="${t.id}" ${dis}>启 动</button>
               <button class="abtn     ${bc}" data-action="update"  data-toolid="${t.id}" ${dis}>更 新</button>
               <button class="abtn del ${bc}" data-action="delete"  data-toolid="${t.id}" ${dis}>删 除</button>`
  } else if (t.mgr === 'manual') {
    actions = `<button class="abtn inst" data-action="open-url" data-url="https://kiro.dev/docs/cli/installation/" data-toolid="${t.id}">官网安装</button>`
  } else {
    actions = `<button class="abtn inst ${bc}" data-action="install" data-toolid="${t.id}" ${dis}>安 装</button>`
  }

  return `
  <div class="tool-row" id="row-${t.id}">
    <div class="tool-icon" style="background:${t.color}22;color:${t.color}">${t.letter}</div>
    <div class="tool-info-cell">
      <div class="tool-name">${esc(t.name)}</div>
      <div class="tool-cmd">${esc(t.cmd)}</div>
    </div>
    <div>${badge}</div>
    <div class="version-text">${esc(t.version)}</div>
    <div><span class="mgr-text">${esc(t.mgr)}</span></div>
    <div class="action-btns">${actions}</div>
  </div>`
}

function updateStats() {
  document.getElementById('statTotal').textContent     = tools.length
  document.getElementById('statInstalled').textContent = tools.filter(t => t.exists).length
  document.getElementById('statMissing').textContent   = tools.filter(t => !t.exists).length
}

// ── Actions ───────────────────────────────────────────────────────────────
async function doAction(action, toolId) {
  const tool = tools.find(t => t.id === toolId)
  if (!tool) return
  // Prevent duplicate action on the same tool while it's busy
  if (busyTools.has(toolId)) return
  const label = { launch:'启动', install:'安装', update:'更新', uninstall:'卸载' }[action] || action

  appendLog(`[${tool.name}] 执行: ${label}`, 'info')
  busyTools.add(toolId)
  renderList()

  const result = await window.api.runAction(action, toolId)
  busyTools.delete(toolId)

  if (result.ok) {
    appendLog(`[${tool.name}] ${label}成功 ✓`, 'success')
    // Apply newState directly — no full rescan needed
    if (result.newState) {
      tool.exists  = result.newState.exists
      tool.version = result.newState.version
    }
  } else {
    appendLog(`[${tool.name}] ${label}失败: ${result.msg}`, 'danger')
  }
  renderList()
  updateStats()
}

// ── Delete confirm ────────────────────────────────────────────────────────
function askDelete(toolId) {
  const tool = tools.find(t => t.id === toolId)
  if (!tool) return
  pendingDelete = toolId
  document.getElementById('modalBody').textContent =
    `确认卸载 "${tool.name}"（${tool.cmd}）？将通过 ${tool.mgr} 执行卸载命令。`

  // Replace button to clear any prior listener
  const old = document.getElementById('modalConfirmBtn')
  const fresh = old.cloneNode(true)
  old.parentNode.replaceChild(fresh, old)
  fresh.addEventListener('click', () => {
    const toolIdToDelete = pendingDelete   // capture before closeModal clears it
    closeModal()
    if (toolIdToDelete) doAction('uninstall', toolIdToDelete)
  })

  document.getElementById('modalOverlay').classList.add('show')
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show')
  pendingDelete = null
}

// ── View switch ───────────────────────────────────────────────────────────
function switchView(view, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  document.getElementById(`view-${view}`).classList.add('active')
  btn.classList.add('active')
}

// ── Log console ───────────────────────────────────────────────────────────
function appendLog(msg, type) {
  const panel = document.getElementById('logConsole')
  if (!panel) return
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const div = document.createElement('div')
  div.className = `log-line ${type || ''}`
  const span = document.createElement('span')
  span.className = 'log-ts'
  span.textContent = ts + ' '
  div.appendChild(span)
  div.appendChild(document.createTextNode(msg))
  panel.appendChild(div)
  panel.scrollTop = panel.scrollHeight
}

function clearLogs() {
  document.getElementById('logConsole').innerHTML = '<div class="log-line muted">// 日志已清除</div>'
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Manage view ───────────────────────────────────────────────────────────

// Register nav + buttons for manage view
function bindManageEvents() {
  document.getElementById('navManage').addEventListener('click', function () {
    switchView('manage', this)
    renderManageList()
  })
  document.getElementById('btnAddTool').addEventListener('click', () => openEditModal(null))
  document.getElementById('btnOpenConfig').addEventListener('click', () => window.api.openConfigFile())
  document.getElementById('btnResetTools').addEventListener('click', async () => {
    if (!confirm('确认恢复为默认工具列表？自定义的工具将被清除。')) return
    await window.api.resetToolDefs()
    appendLog('已恢复默认工具配置', 'warn')
    renderManageList()
    await rescan()
  })
  document.getElementById('btnConfigPath').addEventListener('click', async () => {
    const bar = document.getElementById('configPathBar')
    if (bar.style.display === 'none') {
      const p = await window.api.getConfigPath()
      document.getElementById('configPathText').textContent = p
      bar.style.display = 'flex'
    } else {
      bar.style.display = 'none'
    }
  })

  // Manage list delegation
  document.getElementById('manageList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-maction]')
    if (!btn) return
    const { maction, toolid } = btn.dataset
    if (maction === 'edit') {
      const defs = await window.api.getToolDefs()
      const def = defs.find(t => t.id === toolid)
      if (def) openEditModal(def)
    } else if (maction === 'remove') {
      const defs = await window.api.getToolDefs()
      const def = defs.find(t => t.id === toolid)
      if (!def) return
      if (!confirm(`确认从列表中移除 "${def.name}"？\n这只删除配置，不会卸载已安装的程序。`)) return
      const r = await window.api.removeToolDef(toolid)
      if (r.ok) {
        appendLog(`已移除工具配置: ${def.name}`, 'warn')
        renderManageList()
        await rescan()
      }
    }
  })

  // Edit modal events
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal)
  document.getElementById('editModalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModalOverlay')) closeEditModal()
  })
  document.getElementById('editSaveBtn').addEventListener('click', saveToolEdit)

  // Color preset chips
  document.querySelectorAll('.cp').forEach(chip => {
    chip.addEventListener('click', function () {
      document.getElementById('fColor').value = this.dataset.color
    })
  })

  // Auto-fill letter from name
  document.getElementById('fName').addEventListener('input', function () {
    const letterField = document.getElementById('fLetter')
    if (!letterField._userEdited) {
      const words = this.value.trim().split(/\s+/)
      letterField.value = words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : this.value.slice(0, 2).toUpperCase()
    }
  })
  document.getElementById('fLetter').addEventListener('input', function () {
    this._userEdited = this.value.length > 0
  })
}

async function renderManageList() {
  const defs = await window.api.getToolDefs()
  const list = document.getElementById('manageList')
  if (!defs.length) {
    list.innerHTML = '<div class="empty-state">暂无工具配置</div>'
    return
  }
  list.innerHTML = defs.map(t => `
    <div class="manage-row">
      <div class="manage-tool-icon" style="background:${t.color}22;color:${t.color}">${t.letter}</div>
      <div>
        <div class="manage-tool-name">${esc(t.name)}</div>
      </div>
      <div class="manage-tool-cmd">${esc(t.cmd)}</div>
      <div class="manage-tool-pkg" title="${esc(t.pkg)}">${esc(t.pkg)}</div>
      <div><span class="manage-tool-mgr">${esc(t.mgr)}</span></div>
      <div class="manage-actions">
        <button class="mbtn edit" data-maction="edit"   data-toolid="${t.id}">编辑</button>
        <button class="mbtn del"  data-maction="remove" data-toolid="${t.id}">移除</button>
      </div>
    </div>`).join('')
}

// ── Edit modal ────────────────────────────────────────────────────────────
let editingToolId = null   // null = add mode, string = edit mode

function openEditModal(def) {
  editingToolId = def ? def.id : null
  document.getElementById('editModalTitle').textContent = def ? `编辑工具：${def.name}` : '新增工具'
  document.getElementById('fName').value   = def?.name       || ''
  document.getElementById('fCmd').value    = def?.cmd        || ''
  document.getElementById('fPkg').value    = def?.pkg        || ''
  document.getElementById('fMgr').value    = def?.mgr        || 'npm'
  document.getElementById('fLetter').value = def?.letter     || ''
  document.getElementById('fColor').value  = def?.color      || '#6b7280'
  document.getElementById('fLetter')._userEdited = !!def
  document.getElementById('formError').textContent = ''
  document.getElementById('editModalOverlay').classList.add('show')
  document.getElementById('fName').focus()
}

function closeEditModal() {
  document.getElementById('editModalOverlay').classList.remove('show')
  editingToolId = null
}

async function saveToolEdit() {
  const name   = document.getElementById('fName').value.trim()
  const cmd    = document.getElementById('fCmd').value.trim()
  const pkg    = document.getElementById('fPkg').value.trim()
  const mgr    = document.getElementById('fMgr').value
  const letter = (document.getElementById('fLetter').value.trim() || name.slice(0,2)).toUpperCase().slice(0,2)
  const color  = document.getElementById('fColor').value
  const errEl  = document.getElementById('formError')

  if (!name) { errEl.textContent = '请填写工具名称'; return }
  if (!cmd)  { errEl.textContent = '请填写启动命令'; return }
  if (!pkg)  { errEl.textContent = '请填写包名';     return }
  errEl.textContent = ''

  const def = { name, cmd, pkg, mgr, letter, color, launchArgs: [] }
  let result
  if (editingToolId) {
    result = await window.api.updateToolDef(editingToolId, def)
  } else {
    result = await window.api.addTool(def)
  }

  if (!result.ok) {
    errEl.textContent = result.msg
    return
  }

  appendLog(`${editingToolId ? '更新' : '新增'}工具配置: ${name}`, 'success')
  closeEditModal()
  renderManageList()
  await rescan()
}
