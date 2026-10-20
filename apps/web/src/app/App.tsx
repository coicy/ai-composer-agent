import {useState} from 'react';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
const initial:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'主旋律',locked:false,notes:[]}]};
export function App(){
 const [project,setProject]=useState<MusicProject>(initial);
 const notes=project.tracks[0]?.notes??[];
 function addNote(){const result=applyChangeSet(project,{baseRevision:project.revision,operations:[{type:'add_note',trackId:'melody',note:{noteId:crypto.randomUUID(),pitch:60+(notes.length%12),startTick:notes.length*480,durationTicks:480,velocity:90}}]});if(result.ok)setProject(result.project);}
 return <main><header><h1>AI Composer Agent</h1><p>钢琴卷帘 · 工程骨架验证（尚未接入作曲 Agent 或音频播放）</p></header><section className="toolbar"><button onClick={addNote}>+ 添加测试音符</button><span>revision {project.revision} · {notes.length} notes</span></section><section className="roll"><div className="keys">{Array.from({length:24},(_,i)=><div key={i} className="key">{83-i}</div>)}</div><div className="grid">{Array.from({length:24},(_,i)=><div className="lane" key={i}/>) }{notes.map(n=><div key={n.noteId} className="note" style={{left:`${n.startTick/480*58}px`,top:`${(83-n.pitch)*24}px`,width:`${n.durationTicks/480*58-2}px`}} title={`pitch ${n.pitch}, start ${n.startTick}`}/>)}</div></section><p className="hint">当前仅验证工程数据、基础显示和新增音符命令；拖拽、音源、Agent 与撤销功能尚未实现。</p></main>;
}
