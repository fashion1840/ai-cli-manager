# GitHub 部署指南

## 📦 上传到 GitHub

### 1. 初始化 Git 仓库（如果还没有）

```bash
git init
git add .
git commit -m "Initial commit: AI CLI Manager"
```

### 2. 创建 GitHub 仓库

在 GitHub 上创建一个新的仓库（例如：`your-username/ai-cli-manager`）

### 3. 关联并推送

```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-cli-manager.git
git branch -M main
git push -u origin main
```

### 4. 上传内容说明

✅ **会上传的文件：**
- `src/` - 所有源代码
- `resources/` - 图标等资源
- `package.json` - 项目配置
- `package-lock.json` - 依赖锁定
- `README.md` - 项目说明
- `.gitignore` - Git 忽略规则
- `.github/workflows/release.yml` - 自动打包工作流

❌ **不会上传的文件：**
- `dist/` - 打包输出（自动生成）
- `node_modules/` - 依赖包（通过 npm install 安装）

---

## 🚀 配置自动打包发布 Release

### 工作流程

1. **推送标签触发** - 当你推送 `v*` 格式的标签时（如 `v1.0.0`），GitHub Actions 会自动开始打包
2. **多平台构建** - 同时在 Windows、macOS、Linux 上构建
3. **自动发布** - 构建完成后自动创建 GitHub Release 并上传安装包

### 使用步骤

#### 1. 本地打标签

```bash
# 查看当前版本
npm run version  # 或直接查看 package.json

# 打上新版本标签（例如 v0.1.0）
git tag v0.1.0
```

#### 2. 推送标签到 GitHub

```bash
git push origin v0.1.0
```

或者推送所有标签：

```bash
git push --tags
```

#### 3. 等待自动构建

推送标签后，GitHub Actions 会自动：
- ✅ 检出代码
- ✅ 安装 Node.js 18
- ✅ 安装依赖 (`npm ci`)
- ✅ 执行打包 (`npm run build`)
- ✅ 创建 Release 并上传安装包

#### 4. 查看构建进度

访问：`https://github.com/YOUR_USERNAME/ai-cli-manager/actions`

#### 5. 下载 Release

构建完成后，访问：`https://github.com/YOUR_USERNAME/ai-cli-manager/releases`

下载对应平台的安装包：
- **Windows**: `.exe` 安装文件
- **macOS**: `.dmg` 镜像文件
- **Linux**: `.AppImage` 或 `.deb` 包

---

## 📝 发布新版本流程

### 标准流程

```bash
# 1. 更新版本号（手动编辑 package.json）
# 将 "version": "0.1.0" 改为 "version": "0.2.0"

# 2. 提交更改
git add package.json
git commit -m "chore: bump version to 0.2.0"
git push

# 3. 打标签
git tag v0.2.0

# 4. 推送标签（触发自动打包）
git push origin v0.2.0
```

### 自动化脚本（可选）

创建 `scripts/release.sh`：

```bash
#!/bin/bash

# 检查是否提供了版本号
if [ -z "$1" ]; then
  echo "用法：./release.sh <版本号>"
  echo "例如：./release.sh 0.2.0"
  exit 1
fi

VERSION=$1

# 更新 package.json 版本号
# 注意：需要安装 jq 工具
jq ".version = \"$VERSION\"" package.json > package.json.tmp
mv package.json.tmp package.json

# 提交并打标签
git add package.json
git commit -m "chore: bump version to $VERSION"
git tag v$VERSION

# 推送
git push
git push origin v$VERSION

echo "✓ 已推送 v$VERSION，GitHub Actions 将自动打包"
```

---

## 🔧 自定义构建配置

### 修改 `.github/workflows/release.yml`

- **添加更多平台**：在 `matrix.os` 中添加
- **更改 Node.js 版本**：修改 `node-version`
- **自定义发布内容**：修改 `softprops/action-gh-release` 的配置

### 修改 `package.json` 的 `build` 字段

- **更改输出格式**：修改 `mac.target`、`win.target`、`linux.target`
- **添加/删除文件**：修改 `files` 数组
- **配置代码签名**：添加证书相关配置

---

## ⚠️ 注意事项

1. **首次发布前** 确保 GitHub 仓库已创建
2. **macOS 签名** - 正式发布的 macOS 应用需要 Apple 开发者证书签名
3. **Windows 签名** - Windows SmartScreen 可能需要代码签名证书
4. **构建时间** - 首次构建可能需要 10-20 分钟
5. **存储空间** - GitHub Actions 提供 6GB 存储空间，足够使用

---

## 📚 相关资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [electron-builder 文档](https://www.electron.build/)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
- [GitHub Releases 指南](https://docs.github.com/en/repositories/releasing-projects-on-github)
