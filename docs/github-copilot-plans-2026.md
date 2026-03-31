# GitHub Copilot Upgrade Plans Comparison (2026)

> Reference document for evaluating GitHub Copilot plan tiers. Pricing and features reflect 2026 policy; verify current details at [github.com/features/copilot](https://github.com/features/copilot).

---

## Plan Comparison Table

| 功能 / Feature                          | **Copilot Individual** | **Copilot Business** | **Copilot Enterprise** |
|-----------------------------------------|:----------------------:|:--------------------:|:----------------------:|
| **适用对象 / Target**                   | 个人开发者             | 团队 / 中小型组织    | 大型企业 / 合规需求组织 |
| **定价 / Pricing**                      | $10 / 月 or $100 / 年 | $19 / 用户 / 月      | $39 / 用户 / 月        |
| **最低席位 / Min seats**                | 1                      | 1                    | 1                      |
| **结账方式 / Billing**                  | 个人账单               | 集中账单（组织级）   | 集中账单（企业级）     |
| **代码补全 / Code completions**         | ✅                     | ✅                   | ✅                     |
| **IDE Chat 助手**                       | ✅                     | ✅                   | ✅                     |
| **多语言支持 / Multi-language**         | ✅                     | ✅                   | ✅                     |
| **GitHub.com Chat**                     | ✅                     | ✅                   | ✅                     |
| **Pull Request 摘要**                   | ✅                     | ✅                   | ✅                     |
| **CLI 助手 / GitHub Copilot CLI**       | ✅                     | ✅                   | ✅                     |
| **代码建议合规过滤（重复代码屏蔽）**    | ✅                     | ✅                   | ✅                     |
| **管理员分配许可 / License management** | ❌                     | ✅                   | ✅                     |
| **组织级策略控制 / Policy control**     | ❌                     | ✅                   | ✅                     |
| **审计日志 / Audit logs**               | ❌                     | ✅                   | ✅                     |
| **IP 归属保护 / IP indemnity**          | ❌                     | ✅                   | ✅                     |
| **SSO / SAML 集成**                     | ❌                     | ❌                   | ✅                     |
| **企业级策略管控（内部代码防泄露）**    | ❌                     | ❌                   | ✅                     |
| **自定义知识库 / Custom knowledge base**| ❌                     | ❌                   | ✅                     |
| **Copilot Workspace（企业级工作流）**   | ❌                     | 部分                 | ✅                     |
| **高级监控与使用报告**                  | ❌                     | 基础                 | 完整                   |
| **REST API 管理接口**                   | ❌                     | ❌                   | ✅                     |
| **Microsoft Azure 统一计费**            | ❌                     | 可选                 | ✅                     |
| **SLA / 企业级支持**                    | 社区支持               | 标准支持             | 优先级企业支持         |

---

## 各方案说明

### Copilot Individual

- **适用对象：** 个人开发者、开源贡献者、自由职业者。
- **核心价值：** 以最低成本获得 Copilot 全部基础 AI 编程辅助能力。
- **主要限制：**
  - 无团队/组织管理功能。
  - 无集中账单、无许可分配。
  - 无审计日志，不满足企业合规需求。
  - 不支持 SSO/SAML。
- **独占特性：** 无（功能为 Business / Enterprise 的子集）。

---

### Copilot Business

- **适用对象：** 中小型团队、技术部门、需要统一管控的工程组织。
- **核心价值：** 在个人版基础上增加组织级管理、账单聚合和基础合规能力。
- **主要增量功能：**
  - 管理员可为成员分配或回收许可。
  - 组织级策略：可限制哪些功能对成员开放（如禁用公开代码建议）。
  - 审计日志：记录谁在使用、使用了什么功能。
  - IP 归属保护：Copilot 生成的代码受到 GitHub 的知识产权赔偿承诺覆盖。
- **主要限制：**
  - 不支持 SSO/SAML 集成。
  - 无企业级内部代码防泄露策略。
  - 无自定义知识库。
  - 无完整 API 管理接口。

---

### Copilot Enterprise

- **适用对象：** 大型企业、受监管行业、需要深度定制和安全合规的技术组织。
- **核心价值：** 在 Business 全部功能基础上叠加企业级安全、合规、自定义和集成能力。
- **主要增量功能（Enterprise 独占）：**
  - **SSO / SAML：** 与企业身份系统（Okta、Azure AD 等）对接。
  - **自定义知识库：** 可将组织内部代码库、文档接入 Copilot 上下文。
  - **内部代码防泄露策略：** 精细控制 Copilot 建议不得包含或暴露内部敏感代码。
  - **REST API 管理接口：** 通过 API 自动化许可管理和策略配置。
  - **完整使用报告：** 详细的 seat-level 使用分析，支持导出。
  - **Microsoft Azure 统一计费：** 可通过 Azure Marketplace 统一结算。
  - **优先级企业支持：** SLA 保障和专属客户成功团队。
- **主要限制：**
  - 费用最高（$39/用户/月）。
  - 需要 GitHub Enterprise Cloud 才能使用全部功能。

---

## 选型建议

| 场景                                      | 推荐方案              |
|-------------------------------------------|-----------------------|
| 独立开发者 / 开源项目                     | Individual            |
| 5–200 人工程团队，需要统一账单和基础合规 | Business              |
| 大型企业、受监管行业、需要 SSO 和定制     | Enterprise            |
| 已在 GitHub Enterprise Cloud 上           | Enterprise（完整能力）|

---

## 注意事项

- 以上定价为 2026 年参考值，实际以 [GitHub Copilot 官方定价页](https://github.com/features/copilot#pricing) 为准。
- 学生、教师及开源维护者可申请免费的 Individual 席位（需通过 GitHub Education 验证）。
- GitHub Free / Pro 用户每月有限额的免费 Copilot 使用（约 2000 次补全 + 50 次 Chat 消息），超出后需升级。
