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