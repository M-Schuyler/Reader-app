# 微信 `__biz` 子来源注册表设计

## 背景

当前 Reader 的微信来源归属主要依赖文档上的 `contentOriginKey` / `contentOriginLabel`。

这套方案已经比单纯依赖 `author` 稳定，但还存在一个结构性问题：

- `__biz` 已知时，文档身份其实已经明确
- 但只要回填抓取连续失败，文档仍可能被打成 `wechat:unknown`
- `抓取失败` 和 `来源未知` 被混成了一件事

这会直接导致产品层的错误表现：

- 明明属于同一个公众号的文章，被扔进“未知来源”
- 几篇 `请辩的文字分享` 这类 URL 已带 `__biz` 的文章，仍不能稳定归到 `请辩`
- “身份已知但名字未知”和“身份未知”无法区分

这类问题不该用 AI 去补。它本质上是来源身份识别问题，不是语义分类问题。

## 目标

- 只为微信公众号引入稳定的子来源注册表
- 以 `__biz` 作为公众号 identity 主键
- 把“身份已知但暂时没有名字”和“真正未知来源”分开
- 让 `mp.weixin.qq.com` 二级来源页的“创作来源”筛选优先基于注册表显示
- 让 Reader 页面里的 `公众号 · xxx` 优先显示注册表名称
- 修复历史微信文档中“URL 已带 `__biz` 却被打成 unknown”的数据

## 非目标

- 不为普通网站引入统一来源身份系统
- 不做 AI 自动分类或 AI 自动新建来源
- 不把微信子来源直接升级成一级来源卡片
- 不新增新的子来源卡片界面，本次只影响筛选与展示
- 不引入后台管理页面

## 已比较的方案

### 方案 A：继续修补文档上的 `contentOriginLabel`

优点：

- 改动最小

缺点：

- 标签仍然是每篇文档各自携带
- 公众号改名、占位名转正、历史修复都会很脏
- 不能把“身份”和“显示名”分层

结论：

- 不采用

### 方案 B：微信 `__biz` 子来源注册表

优点：

- `__biz` 是稳定 identity，显示名只是 identity 的属性
- 可以区分“已知 identity / 未知名字”和“identity 真未知”
- 后续修复与展示逻辑会稳定很多

缺点：

- 需要新增一张表和一次数据迁移

结论：

- 采用

### 方案 C：通用来源身份中心

优点：

- 以后普通网站、作者页、专栏也都能纳入统一体系

缺点：

- 范围明显过大
- 会把当前问题从“修微信来源归属”膨胀成“重做来源系统”

结论：

- 暂不采用

## 核心决策

### 1. 只先覆盖微信公众号

本次只处理 `mp.weixin.qq.com`。

普通网站继续沿用当前 domain / source 逻辑，不顺手扩成全来源身份系统。

### 2. `__biz` 是微信子来源的 identity

只要微信 URL 中存在 `__biz`，系统就认为来源 identity 已知。

这时不允许再因为 metadata 抓取失败而把它归到 `wechat:unknown`。

### 3. 微信子来源先只作为筛选项存在

本次不新增新的子来源列表或卡片结构。

微信子来源只影响：

- `mp.weixin.qq.com` 二级页里的“创作来源”筛选项
- Reader 标题下的 `公众号 · xxx`
- 文档信息里的 `公众号`

## 数据模型

新增一张微信子来源注册表。

建议模型：

```prisma
model WechatSubsource {
  biz           String   @id
  displayName   String
  isPlaceholder Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

说明：

- `biz` 是稳定 identity
- `displayName` 是当前展示名
- `isPlaceholder` 用来区分“真实公众号名”与“占位名”

本次不要求在 `Document` 上新增 relation 字段。

原因：

- 文档已经有 `contentOriginKey`
- 对微信 `wechat:biz:*` 来说，已经能从 key 解析出 `biz`
- 当前页面规模下，应用层按 `biz` 批量查注册表足够
- 先避免给 `Document` 再加一套并行 identity 字段

## 命名规则

### 已知名字

当抓取链路拿到了公众号名时：

- `displayName = 真实公众号名`
- `isPlaceholder = false`

### 未知名字但 identity 已知

当只知道 `__biz`，拿不到公众号名时：

- 立即创建注册表记录
- `displayName = 未命名公众号 <biz前缀>…`
- `isPlaceholder = true`

这类记录不再进入 `未知来源`。

### 真未知来源

只有在以下条件同时满足时，才允许落到 `wechat:unknown`：

- 没有 `__biz`
- 没有可用公众号名
- 没有可靠的已知子来源映射

## 归属规则

### 抓取 / 导入阶段

当文档来自微信：

1. 解析 URL
2. 如果有 `__biz`
   - 生成 `contentOriginKey = wechat:biz:<biz>`
   - 确保 `WechatSubsource` 中存在该 `biz`
   - 如果当前拿到了公众号名，则更新注册表名称
   - 如果没拿到名称，则用占位名
3. 如果没有 `__biz`，但拿到公众号名
   - 继续走当前 `wechat:nickname:*` 过渡路径
4. 如果两者都没有
   - 才落到 `wechat:unknown`

### 回填阶段

回填要修两类旧数据：

1. `contentOriginKey` 为空的微信旧文档
2. 已被错误打成 `wechat:unknown`，但 URL 里其实带 `__biz` 的文档

回填修正规则：

- 只要 URL 中能读到 `__biz`
  - 即便 metadata 抓取失败，也要先把文档改成 `wechat:biz:<biz>`
  - 并创建对应占位子来源
- 只有在 URL 里没有 `__biz` 的前提下，连续抓取失败超过阈值，才允许打成 `wechat:unknown`

这条规则是本设计最关键的变化。

它把：

- `identity 已知但名称暂缺`
- `identity 真未知`

从数据层明确分开。

## 展示规则

### `mp.weixin.qq.com` 二级页

“创作来源”筛选项的显示名优先级：

1. `WechatSubsource.displayName`
2. 文档上的 `contentOriginLabel` 过渡兜底
3. `未识别公众号`

计数与筛选命中仍然基于当前 `origin` query 参数，不改变交互结构。

### Reader 页面

当文档 `contentOriginKey` 是 `wechat:biz:*` 时：

- 标题下展示 `公众号 · <WechatSubsource.displayName>`
- 文档信息区展示 `公众号`

只有注册表里查不到 `biz` 时，才回退到文档上的旧 label。

## 迁移策略

### Schema migration

新增 `WechatSubsource` 表。

### 数据回填

新增一轮微信子来源注册回填：

- 扫描所有微信文档
- 找出 URL 中带 `__biz` 的文档
- 为每个 `biz` 建立或更新注册表
- 修正错误的 `wechat:unknown`
- 修正错误的展示名

### 过渡兼容

在注册表完成铺开前：

- 页面层允许继续回退到文档上的 `contentOriginLabel`
- 但这条兜底要明确视为过渡逻辑

等注册表与回填稳定后，再考虑移除文档级 label 对微信展示的主导权。

## 风险

### 1. 公众号改名

注册表采用“当前名字是最新视图”的策略，不保存历史名。

这是可接受的，因为本次目标是来源归属稳定，不是做公众号更名史。

### 2. 历史残缺短链

没有 `__biz`、没有 `rawHtml`、没有名称的旧文章，仍可能落到 `unknown`。

这类才是真正值得保留在“未知来源”的数据。

### 3. 注册表和文档标签短期并存

短期内：

- `WechatSubsource.displayName`
- `Document.contentOriginLabel`

会并存。

这有重复，但属于有意的过渡重复，不是最终状态。

## 影响文件

预期会影响：

- `prisma/schema.prisma`
- `src/lib/documents/content-origin.ts`
- `src/server/modules/capture/capture.service.ts`
- `src/server/modules/imports/cubox.ts`
- `src/server/modules/documents/document.repository.ts`
- `src/server/modules/documents/document.service.ts`
- `src/server/modules/documents/document.mapper.ts`
- `src/server/modules/documents/document-content-origin-backfill.service.ts`
- `src/components/library/source-library-detail.tsx`
- `src/components/reader/document-reader.tsx`

## 测试重点

- URL 带 `__biz` 时，即使抓 metadata 失败，也不会落到 `wechat:unknown`
- 首次看到新 `biz` 时会创建占位子来源
- 后续抓到真实公众号名时会把占位子来源转正
- `mp.weixin.qq.com` 二级页筛选项优先显示注册表名字
- Reader 标题下优先显示注册表名字
- 没有 `__biz` 的残缺旧短链仍会进入 `unknown`

## 明确结论

本次不做 AI 自动分类。

Reader 当前需要的是：

- 稳定 identity
- 明确 unknown 边界
- 可修复的显示名体系

而不是让 AI 继续猜谁是谁。
