# ✅ 发布前检查清单

## 📋 必须完成的项目

### 1. 文件检查

- [ ] **`resources/icon-512.png`** - macOS 图标（512x512 像素）
- [ ] **`resources/icon.ico`** - Windows 图标
- [ ] **`resources/icon.png`** - Linux 图标
- [ ] **`package.json`** - 包含作者邮箱
- [ ] **`.github/workflows/release.yml`** - CI/CD 配置
- [ ] **`.gitignore`** - 排除 node_modules 和 dist

### 2. Package.json 检查

确认以下字段正确：

```json
{
  "author": {
    "name": "fashion1840",
    "email": "fashion1840@126.com"
  },
  "maintainers": [
    {
      "name": "fashion1840",
      "email": "fashion1840@126.com"
    }
  ],
  "build": {
    "mac": {
      "icon": "resources/icon-512.png"
    },
    "linux": {
      "maintainer": "fashion1840@126.com"
    }
  }
}
```

### 3. Git 检查

```bash
# 检查文件是否都已提交
git status

# 确保以下文件在暂存区：
# - resources/icon-512.png
# - resources/icon.ico
# - resources/icon.png
# - package.json
# - .github/workflows/release.yml
```

### 4. 本地测试（可选但推荐）

```bash
# Windows 用户测试 Windows 构建
npm run build:win

# 检查输出
ls dist/
```

---

## 🚀 发布步骤

### 步骤 1：提交所有更改

```bash
git add .
git commit -m "chore: prepare for release v0.1.0"
git push
```

### 步骤 2：创建并推送标签

```bash
# 创建标签
git tag v0.1.0

# 推送标签（触发自动构建）
git push origin v0.1.0
```

### 步骤 3：监控构建过程

1. 访问：https://github.com/fashion1840/ai-cli-manager/actions
2. 点击最近的 "Build and Release" 运行记录
3. 查看每个 Job 的日志：
   - ✅ build (windows-latest)
   - ✅ build (macos-latest)
   - ✅ build (ubuntu-latest)
   - ✅ release

### 步骤 4：验证 Release

构建完成后，访问：https://github.com/fashion1840/ai-cli-manager/releases

应该看到以下文件：

**Windows:**
- ✅ `AI CLI Manager Setup 0.1.0.exe`
- ✅ `AI CLI Manager Setup 0.1.0.exe.blockmap`
- ✅ `builder-effective-config.yaml` 或 `builder-debug.yml`

**macOS:**
- ✅ `AI CLI Manager-0.1.0.dmg`
- ✅ `AI CLI Manager-0.1.0.zip`

**Linux:**
- ✅ `AI CLI Manager-0.1.0.AppImage`
- ✅ `ai-cli-manager_0.1.0_amd64.deb`

---

## ❌ 常见问题排查

### 问题 1：构建失败 "Please specify author 'email'"

**原因**: package.json 缺少作者邮箱

**解决**:
```json
{
  "author": {
    "name": "Your Name",
    "email": "your-email@example.com"
  }
}
```

### 问题 2：macOS 构建失败 "image must be at least 512x512"

**原因**: 图标尺寸不足

**解决**: 确保 `resources/icon-512.png` 存在且尺寸为 512x512

```bash
# 检查图标尺寸（需要 ImageMagick 或其他工具）
identify resources/icon-512.png
```

### 问题 3：Artifacts 上传失败 "if-no-files-found: error"

**原因**: dist 目录为空或文件名不匹配

**解决**: 
1. 查看 "List dist directory contents" 步骤输出
2. 确认构建成功生成了文件
3. 检查文件扩展名是否匹配

### 问题 4：Release 创建失败

**原因**: artifacts 下载失败或文件不存在

**解决**:
1. 检查 build job 是否全部成功
2. 确认 artifacts 名称正确（windows-build, macos-build, linux-build）
3. 查看 "List downloaded artifacts" 步骤输出

---

## 🔧 Workflow 配置说明

### 关键修改点

1. **使用 `npm install` 而非 `npm ci`**
   - 更稳定，不会因为 lock 文件版本不匹配而失败

2. **上传整个 dist 目录**
   - 使用 `path: dist/` 而非通配符
   - 确保所有文件都被上传

3. **使用 `if-no-files-found: error`**
   - 构建失败时立即报错，而非警告

4. **跨平台目录列表**
   - Windows 使用 `cmd //c dir dist`
   - Linux/macOS 使用 `ls -lah dist/`

5. **明确指定 Release 文件**
   - 使用具体扩展名而非 `**/*`
   - 避免上传不需要的文件

---

## 📊 预期构建时间

- **首次构建**: 10-20 分钟（需要下载 Electron 和依赖）
- **后续构建**: 5-10 分钟（有缓存）

---

## 📞 获取帮助

如果遇到问题：

1. 查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. 查看 GitHub Actions 完整日志
3. 检查 electron-builder 文档：https://www.electron.build/

---

## ✨ 成功标志

看到以下内容表示成功：

```
✓ Build completed successfully
✓ Uploaded artifact: windows-build
✓ Uploaded artifact: macos-build
✓ Uploaded artifact: linux-build
✓ Released v0.1.0
```

Release 页面显示所有 6-7 个安装包文件。
