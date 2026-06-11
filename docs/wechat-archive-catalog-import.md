# 任务：公众号备份库「目录索引 + 按需导入」

## 目标

让用户在 Reader 里**浏览**文件系统备份库(`~/projects/信息源/公众号/<号>/md/*.md`,约 1469 篇)的目录,
但**不预先导入正文、不预先跑 AI 摘要**。用户在目录里勾选某篇 → 点「导入」→ 才读取正文、转入正常阅读+摘要流程。

设计动机:避免一次性 1469 次 Gemini 调用的 token 成本,和存 1469 篇不会读的全文。
目录是轻量索引,导入是按需动作。

## 核心机制:新增 `CATALOG` 状态(关键)

`IngestionStatus` 现为 `PENDING | PROCESSING | READY | FAILED`。**不要复用 PENDING 当目录态** ——
现有 `summary-jobs/sweep`、`wechat-backfill` cron 及任何 stuck-PENDING 重试会把它们当"半抓取文档"自动处理,
正好触发我们要规避的正文抓取+摘要。

解法:新增一个**惰性枚举值 `CATALOG`**。代码里没有任何 job 认识它 → 没有后台任务会碰它。

- 目录条目 = `Document`(有 title/sourceUrl/author/contentOrigin/publishedAt,**无 DocumentContent**,`ingestionStatus = CATALOG`)
- 导入 = `CATALOG → PENDING` + 读归档文件写入 `DocumentContent` → 之后走现有正常管道

## 实现分层

### 1. Prisma 迁移
- `enum IngestionStatus` 增加 `CATALOG`
- `prisma migrate dev` 生成迁移

### 2. 目录导入脚本 `scripts/import/wechat-archive-catalog.ts`
- 仿 `src/server/modules/imports/cubox.ts` 的范式(复用 `generateDedupeKey`、`deriveContentOriginMetadata`、`upsertWechatSubsource`)
- 遍历 `~/projects/信息源/公众号/<号>/md/*.md`
- 从文件头部解析:标题(首个 H1)、原文 URL(「原文地址」行)、author + contentOrigin + publishedAt(「原创 蔡垒磊 请辩 2023-05-12」行)
- 用 `createWebDocumentPlaceholder({ ..., ingestionStatus: CATALOG })` 建条目
- dedupeKey 去重:已存在(任何状态)的跳过 → 幂等,可重复跑
- **不写 DocumentContent,不排摘要**
- 在 Document 上记录归档文件绝对路径(新增字段 `archivePath String?` 或复用现有 metadata),供 hydrate 时回读

### 3. 守护现有 cron
- 审计 `source-sync/run`、`summary-jobs/sweep`、`content-origin/wechat-backfill` 的查询
- 确保它们的 where 条件 `ingestionStatus != CATALOG`(或显式只取 READY/PENDING)
- `wechat-backfill`(只补 content_origin 元数据)碰 CATALOG 无害,但仍建议显式排除,语义干净

### 4. hydrate 接口 `POST /api/documents/[id]/import-from-archive`
- 校验该 Document 是 CATALOG 态且有 archivePath
- 读本地归档 `.md` → 填 `DocumentContent`(plainText 用 md 正文;contentHtml 可选,用归档 html/ 对应文件)
- `ingestionStatus → PENDING`(或直接 READY,若内容已就绪)
- 调现有 `queueAndRunAutomaticDocumentAiSummary` 触发摘要
- 返回 mapped detail,前端跳进正常阅读详情

### 5. Sources UI:备份库目录视图（**必须复用现有组件,不许新造视觉**）

**路由**:仿 `src/app/(main)/sources/import/cubox/page.tsx` 加 `src/app/(main)/sources/archive/page.tsx`。
页面骨架逐字照搬 cubox 页:`<section className="space-y-8">` + `<PageHeader eyebrow="备份库" title="公众号存档" />` + 一个 `<Panel tone="muted">` 说明块。

**列表**:复用 `src/components/library/document-list.tsx` 的 `DocumentList` / `DocumentCard`,**不要新写列表组件**。
CATALOG 条目走同一个 `DocumentCard` 渲染 —— 同样的 `<article className="group relative px-6 py-8 ... hover:bg-stone-900/[0.02]">`、同样的 eyebrow 行(`text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]`:类型 · 日期 · 账号)、同样的标题排版。`ingestionStatus=CATALOG` 会自动触发已有的 `shouldShowStatusBadge`(因为 `!== READY`),用现有 `Badge` 显示「未导入」。

**唯一的改动**:把 `DocumentCard` 右侧的 favorite/delete 操作区,在 CATALOG 态下换成
- 一个 checkbox(多选用)
- 一个「导入」按钮 —— class **逐字复制** cubox 页那个按钮:
  `inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]`

**交互**:点「导入」→ 调 §4 hydrate 接口 → `router.refresh()`(沿用 DocumentCard 现有的 `useTransition` + `router.refresh()` 范式)→ 该行 CATALOG 态消失、进入正常 Reading 流。批量:顶部工具条仿 `source-library-toolbar.tsx`,勾选多行后一个批量「导入选中」。

## 决策定稿(来自 2026-05 与陈书锴的讨论)
- ✅ 不预先导入全文,目录优先,按需 hydrate
- ✅ 导入时正文用 `md/`(纯文本,稳;图片防盗链在本地本就坏)。html/ 留作可选高保真回看
- ✅ AI 摘要**仅在用户点导入后**对该篇触发,不批量

## 设计系统锁定（防 UI 跑偏 —— 实现者不许自创视觉）

reader-app 是暖纸色调、CSS 变量主题(明/暗)、统一圆角的成熟设计系统。本特性**零新增视觉决策**,全部复用:

- **颜色只用 token**,禁止硬编码色值:`var(--text-primary|secondary|tertiary)`、`var(--border-subtle|strong)`、`var(--bg-surface|surface-soft)`。深浅色主题已由这些变量自动切换 —— 写死颜色会破坏暗色模式。
- **组件只复用**:`PageHeader`、`Panel`(`tone`/`padding` prop)、`Badge`、`DocumentList`/`DocumentCard`、`DocumentTagPills`、`source-library-toolbar`。不新建卡片/列表/按钮组件。
- **按钮/圆角**:统一 `rounded-[18px]`、`min-h-10`、`text-sm font-medium`、`transition hover:border-[color:var(--border-strong)]`。直接抄 cubox 页那一行。
- **标题字体**:`font-ui-heading` + 负字距(`tracking-[-0.03em~-0.04em]`),照 DocumentList 现有用法。
- **空状态**:复用 `DocumentList` 自带的 `emptyState`({eyebrow,title,description}),只换文案(如 "备份库 / 还没扫描存档 / 跑一次导入脚本就会出现目录")。

**验收时这一条单独 gate**:截图比对 archive 页与现有 sources 页,排版/间距/色彩必须看不出是两拨人做的。看得出 = 打回。

## 验收
- 跑导入脚本后,Sources 出现 ~1469 条 CATALOG 条目,DB 无 DocumentContent、无摘要 job
- 跑一夜 cron,CATALOG 条目数量与状态不变(证明 cron 未误碰)
- 点一篇「导入」→ 正文出现、摘要生成、可正常阅读+高亮
- 重复跑导入脚本不产生重复条目(幂等)
