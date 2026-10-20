# Repository Architecture — 目录与依赖基线

本文件是目标代码布局（目前主要为 AGENTS 协议，模块源码尚未实现）。根目录 AGENTS.md 提供跨域规范，任一文件夹的 AGENTS.md 提供局部规范。新增二级文件夹先明确单一职责，不因为“方便”跨目录访问 private 实现。

```text
apps/web/src/{app,features/{project,editor,tracks,playback,agent},components,state,adapters,styles}
packages/music-core/src/{model,commands,validation,transactions,history,selection,serialization}
packages/piano-roll/src/{viewport,rendering,hit-test,gestures,selection}
packages/audio-engine/src/{transport,scheduler,instruments,playback,adapters}
packages/midi-io/src/{import,export,mapping,validation}
packages/composition/src/{contracts,planning,generators,harmony,variations,evaluation,orchestration}
services/agent-api/src/{routes,auth,providers,orchestration,validation,telemetry}
schemas/
docs/
tests/{contract,integration,e2e,fixtures}
```

## 调用链
```text
用户/Agent -> apps/web (composition UI)
  -> music-core.execute (同一权限/事务执行器)
  -> 新 revision -> piano-roll render + audio-engine schedule
Agent 请求 -> agent-api (若启用) -> composition generator
  -> Candidate Operations -> core validate + preview -> user approve -> core commit
MIDI import -> midi-io decode -> core validate/create project
core project -> midi-io export -> MIDI file
```
核心数据无 React/DOM/音频/网络依赖，其他包围绕核心契约单向组合，不允许循环。packages 的公共导出入口为 src/index.ts。

## 为什么这样划分
music-core 保证人工与 Agent 变更一致，piano-roll 只渲染并发出意图，composition 返回候选，audio-engine 只消费快照，midi-io 专注交换，web 是组合根，agent-api 托管外部模型。这使作曲算法、UI 渲染和播放引擎能够独立替换。

## 开工顺序
先搭 workspace 与 core 契约，编写核心测试；随后接 Piano Roll；再试听/MIDI；最后接候选生成和审批。尚未验证脚手架、依赖版本和性能。