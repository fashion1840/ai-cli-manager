# AI CLI Manager

一个桌面应用，用于管理所有 AI Coding CLI 工具。支持一键启动、更新、安装、删除，自动检测 PATH 中已安装的工具。

## 功能

- **自动扫描** PATH，检测 15 个主流 AI Coding CLI 是否已安装及版本号
- **一键启动** — 在新终端窗口中运行工具
- **一键安装** — 对未安装工具，自动使用正确的包管理器（pip / npm / gh）
- **一键更新** — 升级到最新版本，实时输出日志
- **一键删除** — 带确认对话框，防止误操作
- **执行日志** — 实时流式显示命令输出
- **搜索 & 过滤** — 按名称/命令搜索，按状态过滤

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm start
# 或带 DevTools:
npm run dev
```

### 打包发布

```bash
# macOS (dmg + zip)
npm run build:mac

# Windows (NSIS installer)
npm run build:win

# Linux (AppImage + deb)
npm run build:linux

# 全平台
npm run build
```

打包文件输出在 `dist/` 目录。

## 项目结构

```
ai-cli-manager/
├── package.json
├── resources/
│   ├── icon.icns        # macOS 图标
│   ├── icon.ico         # Windows 图标
│   └── icon.png         # Linux 图标 (256×256)
└── src/
    ├── main/
    │   ├── main.js      # Electron 主进程（窗口、IPC、shell 命令）
    │   └── preload.js   # 上下文隔离桥接
    └── renderer/
        ├── index.html
        └── assets/
            ├── style.css
            └── app.js
```

## 添加新工具

在 `src/main/main.js` 的 `TOOL_DEFS` 数组中新增一条：

```js
{
  id:         'mytool',           // 唯一 ID
  name:       'My Tool',          // 显示名称
  cmd:        'mytool',           // PATH 中的命令名
  pkg:        'my-tool-package',  // 包名（npm/pip/brew）
  mgr:        'npm',              // 包管理器: npm | pip | brew | gh
  color:      '#e11d48',          // 图标背景色（Hex）
  letter:     'MT',               // 图标文字（2字符）
  launchArgs: [],                 // 启动时额外参数，如 ['--help']
}
```

## 图标制作

应用图标放在 `resources/` 目录：

- `icon.png`  — 256×256 PNG（Linux 必需，其他平台也可用）
- `icon.icns` — macOS 格式（用 `iconutil` 或 `electron-icon-maker` 生成）
- `icon.ico`  — Windows 格式（用 `electron-icon-maker` 生成）

可以用这个工具快速生成：
```bash
npx electron-icon-maker --input=icon.png --output=resources/
```

## 技术栈

- **Electron 28** — 跨平台桌面框架
- **原生 JS + CSS** — 无前端框架依赖，轻量快速
- **JetBrains Mono** — 终端风格字体
- **IPC + contextBridge** — 安全的主进程/渲染进程通信

## 注意事项

1. 工具的安装/更新/删除需要相应的包管理器已安装（npm、pip、gh CLI）
2. 部分工具可能需要 sudo 权限（pip 全局安装），可在终端中手动执行
3. 首次打开时会自动扫描，扫描时间取决于已安装工具数量（约 2-5 秒）
