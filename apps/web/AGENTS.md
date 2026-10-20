# apps/web/AGENTS.md — Web 组合层
```text
src/
  app/          # 启动、providers、路由及全局错误处理
  features/
    project/    # 工程文件、打开/保存、版本操作入口
    editor/     # Piano Roll 工作区组合、编辑工具栏
    tracks/     # 轨道列表、静音/独奏/切换
    playback/   # Transport UI
    agent/      # 输入、选区上下文、候选与审批准入 UI
  components/   # 无业务规则的跨 feature 通用视觉组件
  state/        # UI 状态适配器（领域状态只由 core 管理）
  adapters/     # 包/服务接线、命令派发
  styles/       # 主题和基础样式
  main.tsx
```
规则：features 不互相读取私有 store；跨 feature 协调由 app/adapters 进行。组件不得直接改 MusicProject、访问模型密钥、实现 MIDI 解析或乐理算法。Agent 的 Apply 按钮只能提交经验证的批准令牌。视觉测试覆盖缩放、选择、锁与 diff；禁将画布状态当工程真实状态。