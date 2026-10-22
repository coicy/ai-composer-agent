# agent-api — 可选服务器
```text
src/
  routes/       # 请求/响应与状态码
  auth/         # 鉴权、配额、滥用防护
  providers/    # LLM API 适配与密钥注入
  orchestration/# 请求转作曲候选，超时、取消与重试
  validation/   # Schema、负载及权限上下文检查
  telemetry/    # 脱敏日志与性能监测
  index.ts
```
服务端只返回候选，不伪造用户批准。密钥仅从运行时环境或安全密钥管理获取；禁止记录曲谱原文、鉴权头及模型密钥。限流/超时/大小上限要配置；不信任客户端声称的授权与锁范围。

## 正式双入口要求 D-006（实现仍待开发）
- 当前仅支持环境变量 OpenAI Key；未来由用户在工具中输入 API 地址/Key 并通过受控凭据会话请求通用 LLM。需要会话归属、过期/撤销、协议适配、主机/重定向/SSRF 检查和脱敏错误；切勿将浏览器配置直接视为可对任意端点发起网络请求。
- 独立 MCP 接入层面向外部 Agent，默认不继承内部 Key；用户授权工程会话、锁与 revision 等要求仍须在权威执行端重验，不提供未经用户批准的直接提交。
- MCP tool schema/transport 和凭据保存策略尚未决定，不能新增未获审议的正式契约或宣称完成。详见 docs/LLM_ACCESS_MODES.md。
