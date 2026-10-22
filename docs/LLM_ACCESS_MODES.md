# LLM 双接入模式：MCP 与内部 API/Key

> 产品裁决：**D-006（2026-10-22，Accepted）**。本工具必须提供外部 Agent 通过 MCP 调用本工具、用户输入 API 地址和 API Key 后在内部调用 LLM 两种模式。
>
> 与 **D-005（仅通用 LLM 创作音乐，不引入专用音乐模型）**及 Music Core 的授权、锁、预览、用户确认、撤销规则同时生效。
>
> **状态：产品能力已确定，MCP 服务与交互式 API/Key 配置尚未实现。** 具体协议、Transport、凭据存储、部署架构及下述工具名/实施切片是工程提案，不自动成为 accepted 决策。

## 1. 两条调用路径

```text
A. 外部 Agent（自带 LLM）
          |
       MCP Client
          |
   MCP 工具适配器（计划中）
          |
          +-----------+
                      |
B. 用户在工具 UI 输入 API 地址、API Key、模型等设置
          |           |
    安全凭据会话        |
          |           |
     通用 LLM API      |
          |           |
       音符候选 -------+
                      |
          composition 统一验证
                      |
          Music Core dry-run + diff
                      |
          UI/宿主展示候选并等待用户明确批准
                      |
         revision/lock/scope 重验 -> 原子提交/撤销
```

**MCP 仅是外部 Agent 的调用协议，不是第二种生成模型。** MCP 调用方应能够通过工具能力产生、提交和预览结构化 MIDI 候选；外部 Agent 的 LLM 与内部 API/Key 模式的凭据彼此隔离。具体是否允许 MCP 请求工具内已有的其他 LLM 能力需另行裁决，不得默认为 MCP 可调用内部用户的 Key。

**内部 API 模式**必须让用户在工具中输入或配置上游 API 地址、API Key 与必要模型信息，并由本工具受控地调用通用 LLM。现阶段的环境变量 OPENAI_API_KEY 仅是本地开发原型，不能充当交互式 API/Key 输入的完成证明。自定义 API 地址不意味着任意供应商协议都兼容，Provider 适配和支持范围需显式告知。

## 2. 当前实现边界（2026-10-22 核验）

- `services/agent-api/src/index.ts`：从 OPENAI_API_KEY / OPENAI_MODEL 读取凭据和型号，监听 127.0.0.1。
- `services/agent-api/src/routes/server.ts`：HTTP JSON 路由 /api/compose、/api/arrange、/api/feedback；**不是 MCP Server**。
- `services/agent-api/src/providers/openai.ts`：适配 OpenAI Responses API；虽然有被注入的 endpoint 选项，浏览器 UI 仍未提供用户输入 API 地址/Key 的设置。
- `apps/web/src/app/App.tsx`：当前浏览器 Piano Roll 拥有用户会话中的 MusicProject；**没有 MCP 项目桥接或内部凭据配置 UI**。
- `packages/composition` 和 `packages/music-core` 的校验、proposal 和事务机制应成为两条路径的共同下层，不能重复实现另一套宽松审批器。

## 3. MCP 模式的设计建议（Proposed）

建议最小工具/资源能力（名称均为占位示例，**不是已实现的正式 Tool Schema**）：

| 工具 | 功能 | 权限边界 |
| --- | --- | --- |
| `music.read_project` / `music.read_selection` | 读取用户已授权工程/选区的有限只读上下文 | 只读，禁止暴露凭据及其他项目 |
| `music.list_tracks` / `music.inspect_notes` | 读取轨道与音符 | 按项目会话、轨道及范围鉴权；大小/条数限制 |
| `music.propose_midi` / `music.propose_arrangement` | 外部 Agent 提交可编辑音乐候选 | 验证 Schema、范围、锁、revision，不接受模型自封可信 ID |
| `music.preview_candidate` / `music.get_candidate_status` | 展示或查询待审候选 | 不改变工程 revision、不自动批准 |

**项目会话前置要求**：浏览器中内存态的 MusicProject 不能被独立 MCP 服务器“自动发现”。需要由用户显式绑定活动工程会话并提供经过授权的项目快照/同步桥接；当浏览器关闭、项目切换、连接断开、revision 变化或授权撤销时，外部 Agent 不得继续沿用旧的项目写入权限。

**安全前置要求**：MCP 连接需验证客户端与会话权限（远程接入还需传输加密、鉴权与限流）；外部输入、MCP 参数及模型音符全部视为不可信。首版建议仅开放只读、候选及预览，**不开放自动批准/无条件 apply 工具**。即使外部 Agent 请求“直接执行”，也只能进入用户批准流程，不得伪造批准令牌、跳过锁或提交不属于本次会话的项目。

## 4. 内部 API / Key 模式的设计建议（Proposed）

界面建议提供 API 地址/Endpoint、API Key（密码输入框/默认遮盖）、LLM 模型名、连接测试、清除与可辨识的错误状态。支持哪些 API 协议和 Provider、是否保存多个配置文件，是待决事项。

**建议采用本地或服务端的短期凭据会话**：用户通过 UI 输入 Key，由受控后端使用上游 Key；后续生成请求仅引用会话上下文。Key 不得保存在源码、仓库、URL、MusicProject JSON、localStorage/IndexedDB、前端持久缓存或日志；MCP tool 返回值不能包含 Key。用户在浏览器输入 Key 是必要交互，但不能等同于允许前端永久保存或在构建产物硬编码 Key。

实现前需设计并测试：用户会话隔离、Key 撤销与过期、HTTPS/本机边界、上游主机/重定向验证和 SSRF 防护、无效 Key 与限额错误脱敏、取消/超时不提交、跨用户泄漏防护。**Key 持久保存方式、部署为本地后端还是远程服务端尚未经用户裁决。** 现有环境变量接入可作开发兼容路径，不能替代 UI 配置。

## 5. 共用的生成与事务合同

| 行为 | MCP 外部 Agent 模式 | 内部 API 模式 |
| --- | --- | --- |
| 来源 | 外部 Agent 经 MCP 提出编辑或候选 | 内部用配置的通用 LLM 生成候选 |
| 项目上下文 | 明确用户授权、限量、只读 | 当前应用会话、限量、只读 |
| 编辑约束 | 同一 composition 验证器和 Music Core | 同一 composition 验证器和 Music Core |
| 提案 | 带有 scope 和 revision 的 MIDI 预览候选 | 相同契约的 MIDI 预览候选 |
| 批准 | 用户明确批准，MCP 不自行确认 | 用户明确批准 |
| 提交 | 重查 revision、授权和锁，原子应用 | 同样规则 |
| 密钥 | 不读取内部 Key | 受控会话仅调用配置上游 |
| 失败 | 错误码脱敏、不修改 MusicProject | 同样规则 |

当前的 pitch_only、受保护音符、HarmonyPlan、scoped regeneration、候选部分失败等规则在两入口一致，不能“MCP 特例”放宽。两条入口不允许把模型回复本身当作批准证明。

## D-007 已批准的交付优先级（2026-10-22）

**先 MCP，后内部 API/Key**。当前阶段优先交付 MCP Server、可授权的浏览器项目会话桥接、外部 Agent MIDI 候选、UI 预览/批准/撤销及独立 MCP 客户端的真实端到端验证。用户在 UI 输入 API 地址/Key、凭据会话及通用 LLM Provider 配置全部延期；不能要求先实现它们才启动 MCP。保留现有环境变量原型，但不把它作为 MCP 成功的必要条件。

建议当前 PR 顺序：MCP 传输与工具协议 -> 授权项目会话桥接 -> 结构化 MIDI 候选与 Music Core 验证 -> UI 预览/批准闭环 -> 独立 MCP 客户端 E2E 和安全回归。内部 API 模式单独放入后续里程碑。

## 6. 原双模式实施切片（历史提案，优先级已被 D-007 覆盖）

| PR | 工作内容 | 关键验收 |
| --- | --- | --- |
| A | 威胁模型与会话/项目绑定设计 | 认定 MCP 权限与内部 Key 隔离；明示本地/远程部署约束 |
| B | 内部 API/Key 安全配置通路 | 用户可输入并撤销 Key；连接测试；Key 不落盘不泄漏；无效端点和跨会话拒绝 |
| C | UI 设置与通用 LLM Adapter | 不再必须在 shell 设置 Key；自定义地址仅在受支持协议下使用，非法地址拒绝 |
| D | MCP 最小只读、提案工具 | 独立 MCP client 可连接并读授权工程；不访问未授权项目或 Key |
| E | MCP 项目会话与预览桥接 | 关闭/切换/过期项目安全拒绝；用户不批准时 revision 不变 |
| F | 双模式一致性、安全和 E2E | 锁/选区、跨项目、注入、撤销、重试、取消、超时和凭据泄漏回归覆盖 |

最小接受条件：一个实际 MCP 客户端可以**经授权**读取当前项目并提交可预览的 MIDI 候选；内部 UI 输入 API/Key 后可发起真实通用 LLM 请求且可撤销结果；两者都保留所有原有 Music Core 不变量与用户批准。CI 绿色不等同于真实 MCP 连接成功、供应商 API 兼容或音乐审美达标，必须分别验证。

## 7. 与其他产品决策的关系

- [D-005 / D-006](DECISIONS.md)：LLM-only、MCP + 内部 API/Key 两项已批准产品规则。
- [PRODUCT.md](PRODUCT.md)：可供用户感知的双模式需求。
- [ARCHITECTURE.md](ARCHITECTURE.md)、[DATA_AND_TOOLS.md](DATA_AND_TOOLS.md)：技术边界、待批准的工具合同。
- [LLM_INTEGRATION.md](LLM_INTEGRATION.md)：当前仅环境变量 OpenAI 原型的实际运行说明。
- 仓库和模块级 `AGENTS.md`：后续 Agent 实施时遵守的安全/流程限制。

**本文不包含 MCP 服务或 UI 代码实现，不创建新协议 Schema，也不声称任何双模式 E2E 已通过。**
