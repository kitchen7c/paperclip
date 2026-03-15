# 项目概述

Paperclip 是一个开源的编排平台，专为“零人工公司（zero-human companies）”设计。它充当公司级别的任务管理器和各种 AI 代理（例如 OpenClaw、Claude Code、Codex、Cursor 等）的协调者。它提供了一个 Node.js API 服务器和一个 React 用户界面，用于管理目标、预算、组织架构图、治理以及自主代理的心跳（heartbeats）。

该代码库是一个使用 `pnpm` workspaces 的 TypeScript Monorepo，主要结构如下：
- `cli/`: 用于设置、管理和与 Paperclip 实例交互的命令行工具。
- `server/`: 核心 Node.js 后端，处理 API 请求、代理编排和状态管理。
- `ui/`: 基于 React 的前端仪表板，用于监控和管理代理。
- `packages/`: 共享库、数据库逻辑和代理适配器。

# 构建与运行

**环境要求:**
- Node.js 20+
- pnpm 9.15+

**常用命令:**
- **安装依赖**: `pnpm install`
- **启动完整的开发环境 (API + UI，监听模式)**: `pnpm dev`
  - *这将在 `http://localhost:3100` 启动 API 服务器，同时在开发中间件模式下提供 UI 服务。*
- **构建所有包**: `pnpm build`
- **运行类型检查**: `pnpm typecheck`
- **运行单元测试**: `pnpm test` (监听模式) 或 `pnpm test:run` (单次运行)
- **运行端到端 (E2E) 测试**: `pnpm test:e2e`
- **数据库迁移**: `pnpm db:generate` 和 `pnpm db:migrate`

*注：在本地开发时，无需手动设置数据库。如果未设置 `DATABASE_URL`，服务器会自动使用嵌入式的 PostgreSQL 数据库（存储在 `~/.paperclip/instances/...` 中）。*

# 开发规范

- **依赖锁定文件策略:** 请**不要**在拉取请求 (PR) 中提交 `pnpm-lock.yaml`。GitHub Actions 会负责锁定文件的生成和验证。
- **Git Worktrees:** 该项目内置了支持每个 Git Worktree 使用隔离的数据库实例的功能，以避免在开发多个功能时发生数据冲突。跨分支工作时，请使用 `pnpm paperclipai worktree:make <branch>` 或 `pnpm paperclipai worktree init`。
- **版本控制与发布:** 该项目使用 Changesets。运行 `pnpm changeset` 来生成修改的发布意图日志。
- **机密信息管理:** 代理环境变量支持机密信息引用。默认情况下，机密信息使用本地加密存储（`~/.paperclip/instances/default/secrets/master.key`）。
- **测试:** `vitest` 是单元测试的标准，而 Playwright 用于端到端 (E2E) 测试。在请求代码审查之前，请务必确保所有测试通 过 (`pnpm test:run`)。

# AI (Gemini) 错误记录与反思

在参与本项目开发（特别是添加新的 Adapter 插件如 `remote-cli`）的过程中，AI 曾经犯下一些严重的系统性失误。为了避免重蹈覆辙，特此记录：

1. **没有全局视野 (Monorepo 盲区)**
   - **错误:** 在给前端 UI 添加新的 Adapter 配置时，只修改了 `ui/src/pages/NewAgent.tsx` 页面表层的硬编码逻辑，没有去 `packages/shared/src/constants.ts` (底层数据结构) 和 `ui/src/components/AgentConfigForm.tsx` (实际控制显示的白名单) 中同步注册。导致虽然代码看似跑通，但前端根本渲染不出新选项。
   - **教训:** 对于像 Paperclip 这样高度解耦的 Monorepo，任何一个“枚举”、“类型”或者“注册表”的添加，都必须自底向上地排查全链路（从 `@paperclipai/shared` -> `server` -> `ui` 的所有常量与白名单）。动手前必须通过全局 `grep` 理清数据流向。
2. **偷懒使用 `() => null` 糊弄前端渲染 (User-Hostile Design)**
   - **错误:** 在注册 UI Adapter 时，直接把 `ConfigFields` 属性赋值为 `() => null`，妄图让用户直接去写底层的 Advanced JSON 配置。
   - **教训:** 绝不能为了“能编译通过”就牺牲产品体验和代码的完整性。前端组件的目的是为用户提供直观交互。任何新增的特性，其前端部分必须包含完备的可视化表单组件（例如 `DraftInput`、`Field` 等），不能偷工减料。
3. **安全注入与环境脱节 (Security & Context Loss)**
   - **错误:** 在拼接 SSH 执行命令时，直接使用 `command += "..."` 将用户的输入拼接到 Bash 字符串里，造成极其危险的命令注入（Command Injection）漏洞；并且遗漏了把 `process.env`（特别是 `PAPERCLIP_API_KEY` 等关键 Token）传给远程执行环境。
   - **教训:** 当跨系统、跨进程调用时，**安全转义**和**环境变量透传**是生死攸关的事情。涉及复杂字符串（如 `prompt`）传递给 Shell 必须使用 Base64 编解码或者通过 `stdin` 数据流进行传输；必须显式注入运行所需的 Context。