export interface RollViewport {
 readonly ppq:number;
 readonly pixelsPerQuarter:number;
 readonly rowHeight:number;
 readonly topPitch:number;
}
export function tickToX(tick:number,v:RollViewport):number {
 if(!Number.isSafeInteger(v.ppq)||v.ppq<=0||v.pixelsPerQuarter<=0)throw new Error('invalid_viewport');
 return tick/v.ppq*v.pixelsPerQuarter;
}
export function xToQuantizedTick(x:number,v:RollViewport,divisions=4):number {
 if(!Number.isSafeInteger(divisions)||divisions<=0||!Number.isSafeInteger(v.ppq)||v.ppq<=0||v.pixelsPerQuarter<=0)throw new Error('invalid_viewport');
 const step=Math.max(1,Math.round(v.ppq/divisions));
 return Math.max(0,Math.floor((x/v.pixelsPerQuarter*v.ppq)/step)*step);
}
export function pitchToY(pitch:number,v:RollViewport):number {
 if(v.rowHeight<=0||v.topPitch<0||v.topPitch>127)throw new Error('invalid_viewport');
 return (v.topPitch-pitch)*v.rowHeight;
}
export function yToPitch(y:number,v:RollViewport):number {
 if(v.rowHeight<=0||v.topPitch<0||v.topPitch>127)throw new Error('invalid_viewport');
 return Math.max(0,Math.min(127,v.topPitch-Math.floor(y/v.rowHeight)));
}
