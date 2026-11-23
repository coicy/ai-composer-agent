# 声部关系规划 PoC

状态：可选 Composition / API 功能原型；没有浏览器关系编辑器、计划持久化或关系驱动的确定性作曲器。现有三轨输出合同和审批流程不变。

## 分层

- Track（音轨）：已有 MusicTrack，存储真实可编辑 MIDI。
- Voice（声部）：音乐职责与乐器提示，不等同于 MIDI 音轨。v1 暂时一对一映射 source / harmony / bass / accompaniment。
- Relation（交互）：两个声部在绝对 Tick 范围内的创作意图。所有关系均为软指导，不能赋予 Agent 修改原音符的权限。

| 关系 | 生成指导 | 诊断 |
| --- | --- | --- |
| call_response | 在主奏的停句中引用或变化动机 | 统计参考声部的休止区间与目标轨道起音；不检验动机同一性 |
| lead_follow | 主奏时减少其他声部的活动或力度 | 统计同时发声且 MIDI 力度接近的音符；不代表声学响度 |
| rhythmic_interlock | 错开两个声部的节奏重音 | 统计相近起音；刻意齐奏可能产生提示 |

## 古风店铺经营示例

目标：茶肆日间 BGM，古筝主奏，竹笛呼应，扬琴在弱拍填充，低音让位。
下面是一个 4 小节、PPQ=480、编配区间 0..7680 的实验性 ensemblePlan 对象。应作为现有初始三轨 /api/arrange 请求的可选字段提供，其他字段仍需要 project、sourceTrackId、startTick、endTick、instruction。

~~~json
{
  "version": 1,
  "voices": [
    {"id":"guzheng","trackRole":"source","purpose":"lead","instrumentHint":"古筝"},
    {"id":"dizi","trackRole":"harmony","purpose":"answer","instrumentHint":"竹笛"},
    {"id":"bass","trackRole":"bass","purpose":"foundation","instrumentHint":"低音拨弦"},
    {"id":"yangqin","trackRole":"accompaniment","purpose":"rhythmic","instrumentHint":"扬琴"}
  ],
  "relations": [
    {"id":"reply","fromVoiceId":"guzheng","toVoiceId":"dizi","kind":"call_response","startTick":0,"endTick":7680},
    {"id":"duck","fromVoiceId":"guzheng","toVoiceId":"bass","kind":"lead_follow","startTick":0,"endTick":7680},
    {"id":"interlock","fromVoiceId":"guzheng","toVoiceId":"yangqin","kind":"rhythmic_interlock","startTick":0,"endTick":7680}
  ]
}
~~~

## API 工作流与可信边界

1. prepareArrangementContext 严格验证声部 IDs、trackRole 唯一性、关系范围和允许字段。无效计划在 Provider 调用前拒绝。
2. buildEnsembleCues 从只读源旋律抽取真实停句窗口，连同关系指导送给 OpenAI Arranger。
3. Provider 保持原三轨结构化 MIDI 输出，不得编辑主旋律或返回工程命令。
4. proposeArrangement 继续执行 MIDI、HarmonyPlan 校验与 ChangeSet dry-run，并附加 ensembleAssessment 的证据统计。
5. 必须经原 UI 显式批准后才应用生成轨道；关系诊断绝不自动修复或改变项目 revision。

竹笛暂借现有 harmony 生成角色用于回应，instrumentHint 仅作为音乐文字意图，目前不会改变播放音色。

## 当前明确不支持

- 普通 Web UI 尚未提供声部关系设置面板，MusicProject 不持久化该计划。
- 既有单轨局部重编暂不接收整个 ensemblePlan；服务端和 Composition 显式返回 ensemble_plan_scoped_not_supported。
- SeededArranger 尚不根据关系创作，只能用于结构链路演示。实际 LLM 是否遵循关系未经人工听评。
- 不能凭 MIDI 起音或力度指标宣称作曲质量；下一阶段需要同旋律/同音色的盲听对照和时间轴关系编辑器。

实现：packages/composition/src/orchestration/ensemble.ts
集成：packages/composition/src/arrangement/arrange.ts
模型：services/agent-api/src/providers/openai-arranger.ts
测试：packages/composition/src/orchestration/ensemble.test.ts 和 arrange.test.ts
