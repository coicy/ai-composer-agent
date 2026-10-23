# 基于合法 MIDI 参考的通用 LLM 创作闭环：当前实现与待验证项

> 2026-10-24 · 分支实验性接口。本文不修改 `docs/DECISIONS.md` 的用户裁决；**不是**“音乐风格已经学会”的证明。

## 目的与已接通的阶段

PR #18 提供外部 Agent 的 MCP stdio 快照；PR #19 将 44 个带许可证的原始 MIDI 放入版本库；PR #20 为 Agent 提供按来源/拍号/游戏用途检索的只读信息；本 PR #21 进一步提供两个 MCP 工具：

- `music.prepare_composition_brief`：基于**当前授权快照**、用户声明的调式/拍号/律动要求和许可可追溯的 MIDI 参考，返回结构化创作任务说明。**不调用 LLM、不修改音符**。
- `music.evaluate_composition_candidate`：对**外部通用 LLM 提交的 MIDI 音符**运行音符合法性、指定调式音级、Tick 时间范围、可观测的八分音符后半拍位置检查；若硬约束通过，交由 Music Core dry-run。**不提交浏览器工程**。

后续仍需要授权的实时浏览器工程桥接、用户可视化候选、显式批准、撤销，以及真正的 Codex 等客户端使用闭环；本 PR 的真实 MCP stdio 测试不能代替这些能力。

## 标注证据分层

| 层级 | 可以说明 | 不能说明 | 当前进展 |
|---|---|---|---|
| MIDI 事件事实 | 拍号、音符 Tick、velocity、原始 hash | 音乐风格的主观类别、完整律动感 | 对 44 MIDI 提取、SHA 验证 |
| 来源声明 `source_declared` | Groove 官方 `blues/shuffle` 两条作品具有 Shuffle 来源标签 | 已由独立专家确认、适用于所有 Shuffle 情境 | 两条被明确以原标注和 URL 呈现 |
| 音符约束检验 | 生成片段的音级是否属于指定音阶、offbeat 是否靠近目标 Tick | 已确立调式中心、存在正确的和声功能、表现出音乐性 | 支持 Ionian、Aeolian、Dorian、Mixolydian 等九类音级集合 |
| 独立专家复核 `expert_reviewed` | 可审核的调式或细分 Swing/Shuffle 标签 | 算法测量必然正确 | **目前 0 条**，未伪造审稿人或审听结果 |

### 未来审核者需提交的证据（目前是候选质量准则）

1. 与所审 MIDI 的 SHA-256 精确绑定，记录来源作品、具体段落 Tick 范围、版权与是否允许发布复核片段。
2. **调式**：给出主音/终止点的可核验证据、关键区别音级（例如 D Dorian 中 B 自然，而 D Aeolian 中通常为降 B）及调式内外音的解释。仅凭 Key Signature 或十二音级柱状图不能通过。
3. **Swing**：同时记录相邻八分时值比例、演奏者/速度差异、重音/乐句语境与听评；固定 2:1 比率不能单独通过。
4. **Shuffle**：核实成组重复的长短音构型、打击乐器声部关系与风格来源，并与仅采用三连音量化但缺乏 Shuffle 律动的负例比较。
5. 至少两份独立标注和争议记录才可拟议升级为专家复核标签；不同意见保留，不把未知标记为否定。该验收门槛仍待产品确认。

当前没有实际专家复核来源，因此 MCP 的 `verifiedMode`、`verifiedGroove` 检索会返回零条。请勿把 `sourceGrooveClaim: source_declared` 解释为 `verifiedGroove`。

## 真实外部 Agent MCP 使用流程

当前前提：PR #18、#20、#21 的功能需处于同一工程 checkout；PR #19 的 `references/` 数据可以通过环境变量以**本地路径**提供，不允许客户端传任意下载 URL。

```sh
AI_COMPOSER_MIDI_CATALOG_PATH=/path/to/reference-checkout/references/catalog/manifest.json pnpm --filter @ai-composer/agent-api start:mcp
```

1. 用户从本地工程明确提供 `MusicProject` 快照，Agent 使用 `music.open_snapshot` 取得独立、短期 `sessionId`；目前**不代表自动读取网页编辑器**。
2. 用户指定如 `tonic=2 (D)`、`mode=dorian`、`meter=4/4`、`groove=shuffle`、`startTick=0`、`endTick=1920`、`sourceStyle=blues/shuffle`、`pitched=false`、`strictGroove=true`。Agent 调用 `music.prepare_composition_brief`。
3. 返回包含模式音级列表、拍号下小节 Tick、节奏后半拍目标、原始工程音符、带许可的参考及 `source_declared`/`not_verified` 证据。外部通用 LLM 负责**自己创作** 1–64 个音符；服务端不生成音符。
4. 用与 briefing **相同** 的 `sessionId`、`trackId`、`baseRevision`、作用域及约束调用 `music.evaluate_composition_candidate`。失败给出 `out_of_scale_pitch`、`note_outside_requested_scope`、`groove_timing_deviation`、`groove_not_observable` 或 Music Core 错误。
5. 返回始终是 `approved:false`、`applied:false`。有效结果仍只是 dry-run；不可声称已在网页里批准或播放。

### 简化协议调用（`tools/call` 参数内的 name / arguments）

```json
{
  "name": "music.prepare_composition_brief",
  "arguments": {
    "sessionId": "<returned-from-music.open_snapshot>",
    "trackId": "melody",
    "startTick": 0, "endTick": 1920,
    "tonic": 2, "mode": "dorian", "meter": "4/4",
    "groove": "shuffle", "strictGroove": true,
    "sourceStyle": "blues/shuffle", "pitched": false,
    "instruction": "Compose a new D Dorian melody with a distinctive natural sixth and shuffle offbeats"
  }
}
```

将得到的 `candidateSubmission` 约束传递给当前通用 LLM；不要把 MIDI 文件直接当作无许可的模型训练材料。候选示例音符：

```json
[
  {"pitch":62,"startTick":0,"durationTicks":320,"velocity":88},
  {"pitch":65,"startTick":320,"durationTicks":160,"velocity":73},
  {"pitch":71,"startTick":480,"durationTicks":320,"velocity":90},
  {"pitch":69,"startTick":800,"durationTicks":160,"velocity":77}
]
```

以上是由通用语言模型准备的**测试候选**，不是模型经 MCP 在线自动生成的结果，更不是音乐质量达标证明。

## 约束的边界

- `tonic` 使用 MIDI 音高类别 C=0、D=2 …… B=11；`mode` 规定可检查的音级集合。和弦外音、借用和弦等可以用 `allowChromatic=true` 保留为 warning，否则非调式内音阻止通过。
- `meter` 只建立用户目标拍号和 Tick 刻度；MusicProject 当前没有完整持久化 tempo/meter map，不能据此保证试听时的节拍与速度完整还原。
- 对 `straight` 的八分 offbeat 目标是 `ppq/2`；`swing` 与 `shuffle` 的示意性八分 offbeat 目标都是 `2*ppq/3`。它们的**区别不可能仅从这个数字判断**。
- `strictGroove=false`（默认）：后半拍不匹配或无证据时发 warning；`strictGroove=true`：至少需要两个符合时值目标的八分后半拍观察，否则给 error。它只严格执行这个显式 Tick 规则，而不是“自动判定 Swing/Shuffle 音乐性”。
- 若某种风格的授权参考尚无可信证据，直接返回零匹配，不能拿其他风格补足并伪称有证据。

## 下阶段真正的质量评测（尚未执行）

基于实际外部 MCP 客户端和用户可听的完整多轨工程，比较 **A：无参考**、**B：只有来源风格标签**、**C：有参考证据+结构化约束** 三组；固定 prompt、随机种子（如模型支持）、LLM 版本及计费。将音符级约束符合率与盲听的律动、调式、结构评分分开记录。严格禁止把能通过 MIDI Schema 或 dry-run 作为“音乐质量提高”的结论。

## 仓库依赖关系

- PR #18：真实 MCP stdio + 快照与 Music Core 校验。
- PR #19：带来源及许可证的 44 个原始 MIDI + 覆盖矩阵。
- PR #20：只读参考检索、SHA 与授权证据。
- PR #21：本阶段的外部 Agent 简报、用户声明调式/律动约束和候选 dry-run。

尚未合并到 `main`；不得把功能分支视为稳定发行。
