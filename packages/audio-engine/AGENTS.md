# audio-engine — 可替换试听引擎
```text
src/
  transport/  # tick/tempo 到调度时间、seek、loop、stop
  scheduler/  # lookahead 事件队列及更新时取消
  instruments/# MIDI program 到音源的映射
  playback/   # mute/solo、活动音符、资源生命周期
  adapters/   # Tone.js 实现适配层
  index.ts
```
音频只读项目快照；不得写工程。AudioContext 启动须响应用户手势，停止/切换项目要释放音符与定时调度；节拍和变速统一遵循工程 tempo map。测试虚拟时钟下的调度，不能只靠人工试听宣称同步正确。