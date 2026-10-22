# 双入口调用与密钥安全设计（D-006，2026-10-22）

> **产品边界：Accepted**：工具必须提供两种调用方式：① 外部 Agent 通过 MCP 调用工具；② 用户在工具内配置通用 LLM 的 API endpoint / key，由工具内部发起生成。两者共享 Music Core 和相同的候选验证/审批机制。**安全实施细节属于工程方案，尚未完成实现/安全审计。**
> 与 D-005 一致：只使用通用 LLM 创作音乐，不引入专用音乐生成模型。

## 1. 两条互斥凭据流（可同时提供入口，但不混用密钥）

| 入口 | 生成模型由谁调用 | 凭据归属 | 工具责任 |
| --- | --- | --- | --- |
| Agent + MCP | 外部 Agent 持有其自己的 LLM 凭据、执行模型推理 | 外部 Agent 的密钥不进入本工具 | MCP 服务提供只读上下文、音乐分析、受控候选提交/校验等工具；不得替 Agent 私自调用内部 BYOK 密钥 |
| 内置 API + Key（BYOK） | 本工具受控后端调用用户指定的通用 LLM | 用户提供 API key，仅在受控服务端使用 | 用户显式配置 provider、endpoint、key；后端以临时授权调用 LLM，结果仍是待批准 MIDI 候选 |

MCP 不是“直接授权 Agent 修改工程”的后门。MCP 客户端提出的编辑也须绑定 projectId、session、baseRevision、允许的轨道/区间与锁状态；生成候选后必须通过与 UI 相同的验证、dry-run、预览及显式批准。外部 Agent 的文本声明不是可信授权。MCP 工具的只读、候选提议和最终应用权限须分离；默认只读/提议。MCP 的“apply”仅在具备用户授权的可信交互通道、明确审批凭证及过期/重放保护时开放，否则仅返回待批准候选，由本工具 UI 执行最终确认。

## 2. BYOK 凭据保护：加密与存储的实际边界

- **默认不持久化 API key**：首版仅内存会话保存，服务端进程重启即丢失；浏览器不写 localStorage、sessionStorage、IndexedDB、cookie、工程 JSON、MIDI、历史、URL、埋点或异常日志。密钥输入用 password 类型且不回显。
- Web 页面只能向受信任的同源 HTTPS 后端提交密钥；**不能直接从浏览器调用模型供应商**。开发期 loopback HTTP 仅限本机原型，不能作为公网方案。禁用混合内容，生产设置 TLS 与安全响应头。
- 若用户明确启用“记住密钥”，后续另做批准：服务器使用随机 256-bit DEK + **AES-256-GCM**（每次加密独立 96-bit nonce，校验 tag），DEK 由 KMS/密钥管理系统封装；记录 keyId/版本/密文/nonce/tag，绝不存明文或把主密钥与密文放在同一数据库/代码仓库。服务端解密仅在真正调用供应商时短暂发生，支持密钥轮换/删除。**不要声称浏览器端加密即可解决同源 XSS 或恶意扩展风险。**
- 对个人纯本地部署，如未来选择系统凭据保险库（Windows Credential Manager/macOS Keychain/Linux Secret Service），需要单独跨平台设计；**不得**把 key 写入浏览器持久存储再以硬编码前端密钥“加密”。
- 供应商 key 必须按用户/工作区/会话隔离，绝不跨账户共享；凭据引用只能是不可猜测的 opaque ID，不能把密文或明文作为模型请求参数在 UI/MCP 中流转。
- **出站防 SSRF**：provider endpoint 默认采用服务端白名单的 HTTPS 官方域名；自定义 URL 需要独立明确授权与验证，拒绝 localhost、私有/链路本地/元数据 IP、非 HTTPS、用户信息字段和重定向到禁用目标；每次 DNS 解析/连接均执行检查。不要把用户 key 发送到未经信任的代理 endpoint。
- 模型供应商请求使用 Authorization header，不通过 URL query；日志/trace/异常/遥测严格删去 Authorization、API key、敏感 prompt、曲谱内容；响应错误对外脱敏。配置 API 额度、最大 tokens、超时、并发和成本上限，用户可撤销会话凭据。

## 3. MCP 认证、加密传输与最小权限

- **本地 stdio MCP**：优先用于本机 Agent，依赖本机进程/用户边界；不应假定 stdio 自带加密。凭据通过安全进程环境注入（如需），不写命令行参数、调试输出或 MCP tool 结果；stdout 保持协议专用，日志写 stderr 且脱敏。
- **远程 Streamable HTTP MCP**：仅在明确部署时启用；强制 TLS，鉴权使用符合 MCP 授权规范的 OAuth 2.1/OIDC 或等效可信访问控制（具体适配需独立设计），验证 token audience、issuer、expiry、scope，并绑定用户与工程权限；防止 token 透传给下游 LLM 或其他服务。服务端校验 Origin，设置速率/请求体上限和并发限额。
- 每个 MCP tool 显式声明权限：`project:read`、`candidate:propose`、`candidate:review`、`project:apply`。只读分析工具不得返回 API key 或服务器机密；默认不授予 apply。
- tool 参数、模型输出、外部 MIDI/项目文件、MCP 返回内容均按不可信输入处理，验证 JSON Schema、长度、数值、轨道、范围、revision、锁和权限；防止 prompt injection 将工具返回内容变成授权指令。
- 审计日志仅保留 actor、projectId 的最小标识、tool 名称、时间、结果/错误码、批准记录；不包含密钥、原始曲谱和完整提示词。对写操作使用请求 ID、短时审批票据、重放拒绝与幂等处理。

## 4. 共享调用契约与数据流

```text
External Agent + MCP --> MCP Adapter ---+
                                        |
Web UI + BYOK --------> API Gateway ----+--> Composition Intent
                  (key in server RAM)         -> MusicProject read-only snapshot
                                               -> LLM (BYOK route only) OR Agent-proposed notes (MCP)
                                               -> schema/limits/locks/revision validation
                                               -> dry-run + diff + Candidate
                                               -> user approval in trusted UI
                                               -> Music Core atomic commit / undo
```

必须区分 **Agent 生成的候选** 与 **内部 LLM 生成的候选**，在 generationHistory 中只存不含秘密的来源类型、模型名称（如用户允许）、生成时间、结构验证结果及批准人/批准动作，不保存 API key、Authorization header、完整请求体或未经授权的上下文。

## 5. 逐阶段实现建议（非已完成）

1. **PR-S1（协议/威胁模型）**：在 `docs/DATA_AND_TOOLS.md` 和 schemas 中明确 MCP tool contract、BYOK 会话凭据 ID、授权 scope、候选/审批边界；做威胁模型（XSS、SSRF、token 泄露、越权 apply、重放、日志、跨用户访问）。
2. **PR-S2（BYOK 会话）**：服务端内存 secret store（带 TTL、显式删除、进程重启丢失）、同源 TLS API、CSRF/Origin 防护、会话绑定、provider allowlist、secret redaction；使用真实供应商的沙盒 key 做端到端验证但绝不提交 key。
3. **PR-S3（stdio MCP）**：只读 project tools、音符/和声上下文工具、受控候选提议和验证；Agent 侧 LLM 自行推理；不要求用户在本工具内配置 API key。
4. **PR-S4（远程 MCP，可选）**：TLS + 令牌鉴权/权限映射 + 防重放/速率限制；默认关闭远程监听；确认 OAuth 具体规范与宿主兼容性后实施。
5. **PR-S5（可选持久凭据）**：只有在用户另行批准“记住 key”后才实施 AES-GCM + KMS / OS keychain；轮换、吊销、密钥版本与删除可验证。

## 6. 强制验收与禁止事项

- 两条入口在相同项目快照下生成的候选，都必须经过同一验证/审批/撤销路径；MCP 不可绕过用户确认。
- 使用测试用假密钥，断言浏览器存储、URL、日志、工程 JSON、MIDI、MCP tool 响应和错误文本中**没有密钥**；抓包验证密钥只到受信任后端及被用户认可的模型供应商。
- 未授权的 MCP `project:apply`、跨项目 token、陈旧 revision、锁定区间编辑、重复审批票据、恶意 URL/重定向、超大 MIDI、恶意 prompt 均应失败且不改 MusicProject。
- 测试密钥撤销、TTL 到期、进程重启、并发用户隔离、供应商超时/限流、失败重试上限、日志脱敏。
- 不使用“base64=加密”、前端硬编码 AES 密钥、固定 nonce、自签名公网 HTTP、把 API key 存 localStorage、在日志打印 secrets、仅依赖客户端权限校验或在 MCP 工具调用中自动执行未经批准的编辑。
- CI 只能证明相应自动化测试；在没有独立渗透测试、真实 HTTPS 部署验证与供应商密钥轮换演练前，**不得宣称生产安全已验证**。
