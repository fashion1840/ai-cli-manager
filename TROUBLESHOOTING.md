# GitHub Actions 故障排查指南

## 🔍 查看构建日志

### 1. 访问 Actions 页面

打开：https://github.com/fashion1840/ai-cli-manager/actions

### 2. 找到对应的构建

- 点击左侧 **Build and Release** 工作流
- 找到最近的运行记录（通常显示在顶部）
- 点击运行记录查看详情

### 3. 查看每个 Job 的输出

- 点击具体的 Job（如 `build (windows-latest)`）
- 展开每个步骤查看详细日志
- 重点关注：
  - `Build for windows-latest` - 构建输出
  - `List dist directory contents` - 查看生成了什么文件
  - `Upload Windows artifacts` - 确认 artifacts 上传成功

---

## ❌ 常见问题及解决方案

### 问题 1：构建失败（Build Failed）

**症状**：
- `Build for ...` 步骤显示红色 ❌
- 错误信息包含 `electron-builder` 相关错误

**解决方案**：

a) **缺少图标文件**：
```bash
# macOS 需要 icon.icns 或使用 .png
# 已修改为使用 icon.png，无需额外转换
```

b) **依赖安装失败**：
```yaml
# 检查 "Install dependencies" 步骤
# 确保 package-lock.json 存在且正确
```

c) **内存不足**：
```yaml
# 在 build 步骤前添加
- name: Increase Node.js memory
  run: export NODE_OPTIONS="--max-old-space-size=4096"
```

---

### 问题 2：Artifacts 上传失败

**症状**：
- 构建成功，但 Release 中没有文件
- `Upload ... artifacts` 步骤警告 `if-no-files-found: warn`

**解决方案**：

1. **检查 `List dist directory contents` 输出**
   ```bash
   # 查看 dist/ 目录实际生成了什么文件
   # 确认文件名匹配 artifacts 路径模式
   ```

2. **确认文件名匹配**
   ```yaml
   # Windows 应该生成：
   # - AI CLI Manager Setup 0.1.0.exe
   # - AI CLI Manager Setup 0.1.0.exe.blockmap
   # - builder-debug.yml
   
   # macOS 应该生成：
   # - AI CLI Manager-0.1.0.dmg
   # - AI CLI Manager-0.1.0.zip
   
   # Linux 应该生成：
   # - AI CLI Manager-0.1.0.AppImage
   # - ai-cli-manager_0.1.0_amd64.deb
   ```

3. **检查路径模式**
   ```yaml
   # 当前配置使用通配符匹配所有文件
   path: |
     dist/*.exe
     dist/*.blockmap
     dist/*.yml
   ```

---

### 问题 3：Release Job 失败

**症状**：
- Build Job 成功
- Release Job 失败或没有文件

**解决方案**：

1. **检查 artifacts 下载**
   ```yaml
   # 查看 "Download Windows artifacts" 等步骤
   # 确认 artifacts 名称匹配
   ```

2. **查看 "List downloaded artifacts" 输出**
   ```bash
   # 这个步骤会列出所有下载的文件
   # 确认文件确实存在
   ```

3. **检查文件路径**
   ```yaml
   # 当前配置使用递归匹配
   files: |
     dist/windows/**/*
     dist/macos/**/*
     dist/linux/**/*
   ```

---

### 问题 4：只有部分平台成功

**症状**：
- Windows 成功，macOS 失败
- 或某个平台失败

**解决方案**：

1. **检查平台特定错误**
   - macOS：可能需要签名证书
   - Linux：可能需要额外依赖

2. **允许部分失败**
   ```yaml
   # 如果某个平台持续失败，可以暂时移除
   matrix:
     os: [windows-latest, ubuntu-latest]  # 移除 macos-latest
   ```

3. **使用 continue-on-error**
   ```yaml
   - name: Build for macOS
     run: npm run build:mac
     continue-on-error: true  # 失败也不阻止后续步骤
   ```

---

## 🛠️ 本地测试构建

在推送标签前，可以先在本地测试构建：

### Windows

```bash
# 测试 Windows 构建
npm run build:win

# 查看输出
ls dist/
```

### macOS

```bash
# 测试 macOS 构建
npm run build:mac

# 查看输出
ls dist/
```

### Linux

```bash
# 测试 Linux 构建（需要 Linux 环境）
npm run build:linux

# 或使用 Docker
docker run --rm -ti \
  -v ${PWD}:/project \
  -v ${PWD}/node_modules:/project/node_modules \
  node:18 bash
# 然后在容器内执行
npm run build:linux
```

---

## 📊 成功构建的标志

### ✅ 构建成功

```
✓ Build completed successfully
✓ Uploaded artifact: windows-build (XX MB)
✓ Released v0.1.0
```

### ✅ Release 包含文件

访问：https://github.com/fashion1840/ai-cli-manager/releases

应该看到：
- ✅ `AI.CLI.Manager.Setup.0.1.0.exe` (Windows)
- ✅ `AI.CLI.Manager-0.1.0.dmg` (macOS)
- ✅ `AI.CLI.Manager-0.1.0.AppImage` (Linux)
- ✅ `ai-cli-manager_0.1.0_amd64.deb` (Linux)

---

## 🔧 手动触发构建

如果想测试工作流但不想打标签：

### 方法 1：临时修改工作流

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:  # 添加手动触发
```

然后在 GitHub Actions 页面点击 **Run workflow** 按钮。

### 方法 2：创建测试标签

```bash
# 创建测试标签
git tag v0.1.0-test

# 推送标签
git push origin v0.1.0-test

# 测试完成后删除标签
git tag -d v0.1.0-test
git push origin --delete v0.1.0-test
```

---

## 📞 获取帮助

如果问题仍未解决：

1. **查看 GitHub Actions 文档**
   - https://docs.github.com/en/actions

2. **查看 electron-builder 文档**
   - https://www.electron.build/

3. **查看工作流运行日志**
   - 下载完整日志文件分析

4. **检查 package.json 配置**
   - 确保 `build` 字段正确
   - 确认图标文件存在

---

## 📝 检查清单

推送标签前确认：

- [ ] `package.json` 版本号正确
- [ ] `resources/` 目录包含所有图标文件
- [ ] `.github/workflows/release.yml` 配置正确
- [ ] 本地测试构建成功（可选）
- [ ] GitHub Token 有 `workflow` 权限

推送标签后检查：

- [ ] Actions 页面显示新的运行记录
- [ ] Build Job 全部成功（绿色 ✓）
- [ ] Release Job 成功
- [ ] Release 页面包含所有安装包
