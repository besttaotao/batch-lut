# 项目协作规范

## 语言与编码

- 默认使用简体中文沟通与编写项目说明文档。
- 读取或写入中文 Markdown、规则文档、说明文档时，必须显式使用 UTF-8 编码。
- PowerShell 中读取中文文档优先使用 `Get-Content <file> -Encoding utf8`。

## 提交前检查

提交代码前必须至少执行并通过：

```bash
npm run lint
npm run typecheck
npm run build
```

发布 Windows 安装包前还必须执行并通过：

```bash
npm run build:win
```

说明：

- `npm run lint` 用于保证 ESLint 与 Prettier 规则通过，避免后续 CI 阻塞。
- `npm run typecheck` 用于保证主进程、预加载脚本和渲染端 TypeScript 类型检查通过。
- `npm run build` 用于验证 Electron/Vite 生产构建可以成功。
- `npm run build:win` 会生成 Windows 安装包和自动更新相关文件。

## 版本与提交规范

- 有功能更新并发布 Release 时，先更新 `package.json` 和 `package-lock.json` 版本号。
- 推荐使用：

```bash
npm version <version> --no-git-tag-version
```

- 提交信息使用简短中文 Conventional Commit 风格，例如：

```bash
feat: 自动选择硬件加速并修复导出问题
fix: 修复导出文件覆盖问题
docs: 更新发布说明
```

- 不提交本地 IDE 配置目录，例如 `.idea/`，除非用户明确要求。
- `dist/`、`out/`、`node_modules/` 是构建或依赖产物，不纳入代码提交。

## Release 发布流程

发布 GitHub Release 时按以下顺序执行：

1. 确认本地检查通过：

```bash
npm run lint
npm run typecheck
npm run build
npm run build:win
```

2. 提交并推送代码：

```bash
git add -u
git commit -m "<提交信息>"
git push origin main
```

3. 创建并推送版本标签：

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

4. 先创建空 Release，再上传附件。不要在 `gh release create` 时一次性上传大安装包。

```bash
gh release create v<version> --repo besttaotao/batch-lut --title "<标题>" --notes "<更新说明>"
gh release upload v<version> ".\dist\batch-lut-app-<version>-setup.exe.blockmap" --repo besttaotao/batch-lut --clobber
gh release upload v<version> ".\dist\latest.yml" --repo besttaotao/batch-lut --clobber
gh release upload v<version> ".\dist\batch-lut-app-<version>-setup.exe" --repo besttaotao/batch-lut --clobber
```

原因：

- Windows 安装包通常体积较大，和 Release 创建命令一起上传容易因网络波动或超时失败。
- 更稳妥的方式是先创建 Release，再分别上传小文件和大安装包。

## Release 附件说明

- `batch-lut-app-<version>-setup.exe`：普通用户下载和安装使用的 Windows 安装包。
- `batch-lut-app-<version>-setup.exe.blockmap`：Electron 自动更新使用的增量更新映射文件。
- `latest.yml`：Electron 自动更新使用的最新版本清单。
- `Source code (zip)` 和 `Source code (tar.gz)`：GitHub 根据 tag 自动生成的源码包，不是普通用户安装包。

## dist 目录清理

- `dist/` 是本地构建产物目录，可以删除后重新构建。
- `electron-builder` 默认不会删除历史安装包，所以 `dist/` 中可能同时存在多个版本的安装包。
- 删除本地 `dist/` 不会影响已经上传到 GitHub Release 的文件。
- `win-unpacked/` 是未打包安装器的 Windows 应用目录，可用于本地直接运行测试，也可以删除后重新构建。

## 本次 v1.1.0 发布经验

- 第一次上传 Release 附件时，大体积 `.exe` 安装包上传超时，导致小文件部分上传但正式 Release 未完整创建。
- 后续采用“先创建 Release，再单独上传附件”的方式成功发布。
- 以后发布大文件时应沿用该流程，并给安装包上传命令设置更长超时时间。
