# 多轨 AI 编配：只读主旋律 + 原子新增轨道

## 目标与当前实现

用户选择一条具有音符的主旋律轨道和连续 1–4 小节，输入编配描述。作曲 Provider 将原始旋律**作为只读参考**，只返回三类编配建议：

1. **Harmony（和声）**：为主旋律增加和声声部。
2. **Bass（低音）**：创建独立低音声部。
3. **Accompaniment（伴奏）**：创建节奏性伴奏音符。

这三类声部被组织成三个新的 `MusicTrack`；**不会修改主旋律或现有其他轨道，也不会复用它们的 Note ID**。即使源轨道已锁定，也可以作为只读参考。音乐创作质量尚未通过真实模型听觉验证。

## 安全的数据与审批链

`POST /api/arrange` 接收 `{project,sourceTrackId,startTick,endTick,instruction}`，在本地 Agent API 服务端校验并调用可替换的 `ArrangementProvider`。

Provider 仅返回：
```json
{"tracks":[
 {"role":"harmony","notes":[{"pitch":67,"startTick":0,"durationTicks":480,"velocity":80}]},
 {"role":"bass","notes":[{"pitch":40,"startTick":0,"durationTicks":480,"velocity":80}]},
 {"role":"accompaniment","notes":[{"pitch":55,"startTick":0,"durationTicks":480,"velocity":80}]}
]}
```

确定性 validator 检查源轨道、范围、唯一角色、额外字段、MIDI 音符的音高/力度/整数 Tick、每个角色 1–64 音符、总计不超过 128 音符。超出源选定范围的输出会被拒绝。服务端只返回经过一次验证的角色与音符；**浏览器收到数据后再次独立调用 `proposeArrangement` 校验**。

验证通过后，构造三个 `add_track` 操作，作为**单一 ChangeSet**进行 dry run。Piano Roll 支持切换候选角色覆盖预览，还可将当前主旋律与候选临时混合试听（不保存）。用户点击“确认新增 3 轨”才会提交；修订版本不匹配时必须重新生成。撤销会同时撤销三个新增轨道。

## 离线调试与模型适配

可选 `SeededArranger` 生成确定性示例，开发时不需要 API 密钥；它只是验证数据与 UI 闭环，不代表高质量和声。

`services/agent-api/src/providers/openai-arranger.ts` 通过 Responses API、`store:false`、JSON Schema 结构化输出调用 OpenAI，Key 仅留在服务端。开发者在项目根目录分别启动 `pnpm dev` 与配置密钥后的 `pnpm dev:agent`。

浏览器测试通过离线 Provider 验证主旋律保持不变、三个新轨道作为单事务提交和撤销；并拦截 API 返回恶意越界数据，验证客户端拒绝。CI 不会进行真实模型调用。

## 目前不支持

- 由 Agent 对既有和声/伴奏轨道进行精细更新，或一轮多步的主动结构分析。
- 专业和声/配器质量评估、自动音色选择、力度混音、声部交叉检测和和弦理论硬约束。
- 拍号、调式、乐曲速度地图或乐器演奏法约束。当前 4/4 小节范围只是原型。
- 在公开服务器部署：当前 agent-api 仅支持本地 loopback，不具备生产多用户认证与安全隔离。
