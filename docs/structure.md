# 项目与发布规范

| 路径 | 用途 | 进入插件安装包 |
| --- | --- | --- |
| `src/` | React 工厂、状态逻辑与 CSS 源码 | 否 |
| `lib/` | DSH 宿主入口、余额服务、生成的客户端和资源清单 | 是 |
| `assets/` | 桌宠、拼图及摸鱼钟 PNG 与生成提示词 | 是 |
| `wallpapers/` | 八幅馆藏壁纸及提示词、来源说明 | 是 |
| `media/` | 原始表情副本、动画图集、音视频及元数据 | 是 |
| `scripts/` | 客户端构建、发布审计及可选素材处理工具 | 否 |
| `tests/` | Node 内置测试，无 npm 测试依赖 | 否 |
| `docs/` | 目录规范与验证记录 | 否 |
| `.github/workflows/` | Node.js 22／24 持续集成 | 否 |
| `dist/` | 本机生成的安装包，作为 GitHub Release 附件分发 | 否 |

`lib/index.js` 与 `lib/balance.mjs` 是直接维护的宿主入口；`lib/client.js` 与 `lib/manifest.json` 由 `npm run build` 生成，禁止手工修改。构建输出保留在 Git 中，便于 DSH 从克隆目录直接安装。

JavaScript 使用 ESM；源码和脚本使用 `.mjs`，宿主主入口按 `package.json` 使用 `.js`。文件名采用小写英文与连字符，文档入口 `README.md`、`NOTICE.md`、`LICENSE` 保留通用命名。文本统一 UTF-8、LF、末尾换行，JavaScript／JSON／CSS 使用两空格缩进，Python 使用四空格。二进制资源由 `.gitattributes` 标记，避免换行转换。

运行时没有第三方 npm 依赖，复用 DSH 的 React 与插件服务；因此无需 `npm install` 或锁文件。Python／Pillow 与 macOS Swift 只用于重新制作已有素材，不参与日常构建、测试或插件运行。

`.cache/`、`.dev-dsh/`、`reference-media/`、`docs/screenshots/`、历史 ZIP、`dist/`、日志及本机环境文件留在本地，由 `.gitignore` 排除。它们不进入 Git 或安装包。实机截图可能包含工作区内容，验证记录中的截图路径仅用于本机回溯。

正式发布使用 `v<package.json version>` 标签，安装包为 `dsh-plugin-naiwa-theme-<version>.tgz`，附 `SHA256SUMS.txt`。`npm pack --pack-destination dist` 自动执行构建、一致性检查、全部测试和发布文件审计。发布前再次核对安装包内客户端及全部资源与资源清单一致；GitHub Release 保持正式版状态，不标记预发布。
