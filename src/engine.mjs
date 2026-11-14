import {SCENARIOS,DEFAULT} from './catalog.mjs';
import {SweepHistory,decide,caneGeometry,haptic} from './policy.mjs';
import {RAD,clamp,random,tofFrame,ultrasound,detectToF,detectEcho} from './sensors.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
export const SENSOR_DEFAULT={resolution:8,noise:8,dropout:0,range:4,pitch:0,tiltError:0,yawNoise:.3,yawDrift:.1,bleDelay:30,bleJitter:10,bleLoss:0,motorDelay:35,seed:42,predict:true,showTruth:true,showObserved:true,stopOnAlert:true};
export class Engine{
 constructor(){this.config={...DEFAULT,...SENSOR_DEFAULT};this.scenario='crate';this.customObjects=[];this.faultPlan=[];this.reset();}
 select(id){if(!SCENARIOS[id]&&id!=='custom')return;this.scenario=id;const h=SCENARIOS[id]||SCENARIOS.crate;this.config={...this.config,bias:h.bias||0,distance:h.distance,lost:false,saturated:false,turning:false,stopped:false,blind:false};this.faultPlan=[];this.reset();}
 reset(){
  this.time=0;this.stepIndex=0;this.remainder=0;this.history=new SweepHistory();this.random=random(this.config.seed);
  this.travel=false;this.travelStart=3;this.distance=this.config.distance;this.contact=false;this.finished=false;this.finishAt=null;
  this.sequence=0;this.lastPacket=0;this.received=null;this.pending=[];this.nextToF=0;this.frame=null;this.echo=[];this.hazards=[];this.tracks=[];
  this.events=[];this.eventSerial=0;this.eventRefs={};this.logs=[];this.samples=[];this.snapshots=[];this.cursor=null;this.imported=false;this.origin='simulation';
  this.lastKey='';this.applied=new Set();this.motorState={L:0,R:0};this.motorTarget={L:0,R:0};this.pwmQueue=[];this.lastCommand={L:0,R:0};
  this.world=this.makeWorld();this.acquireToF();this.nextToF=1/(this.config.resolution===8?15:20);this.acquireEcho();this.evaluate();
 }
 geometry(){return {...caneGeometry(this.config),handX:this.config.handX};}
 makeWorld(){
  const src=this.scenario==='custom'?this.customObjects:[{...SCENARIOS[this.scenario],x:this.config.distance,id:'target',speed:SCENARIOS[this.scenario]?.kind==='moving'?.8:0}];
  const elapsed=Math.max(0,this.time-this.travelStart),walk=this.travel?this.config.speed*elapsed:0;
  return src.map((o,i)=>({...o,id:o.id||'object-'+i,x:o.x-walk-(o.speed||0)*elapsed}));
 }
 event(type,data,parents=[]){const event={id:'e'+(++this.eventSerial),t:+this.time.toFixed(3),type,parents:parents.filter(Boolean),data};this.events.push(event);if(this.events.length>40000)this.events.shift();return event.id;}
 addLog(code,message){this.logs.unshift({t:this.time,code,message});if(this.logs.length>200)this.logs.pop();}
 acquireToF(){
  const c={...this.config,blind:this.config.blind||this.scenario==='sun'};
  this.acceptFrame(tofFrame(this.world,c,this.time,this.random));
 }
 acceptFrame(frame){
  this.frame=frame;this.eventRefs.tof=this.event('TOF',this.frame);
  const candidates=detectToF(this.frame),next=[];
  for(const h of candidates){const previous=this.tracks.find(p=>p.kind===h.kind&&Math.abs(p.y-h.y)<.45&&Math.abs(p.x-h.x)<.7);
   const track={...h,count:(previous?.count||0)+1,t:this.time,first:previous?.first??this.time,frameIds:[...(previous?.frameIds||[]).slice(-2),this.eventRefs.tof]};
   next.push(track);
  }
  this.tracks=next;
  const stable=next.filter(h=>h.count>=3);
  this.hazards=stable.map(h=>({...h,observed:true,onPath:Math.abs(h.y)-h.width/2<.3,timestamp_ms:Math.round(this.time*1000),closingSpeed:this.config.speed}));
  this.eventRefs.hazard=this.event('HAZARD',{hazards:this.hazards,pending:next.length-stable.length,valid:this.frame.valid},stable.flatMap(h=>h.frameIds));
 }
 acquireEcho(){
  this.acceptEcho(ultrasound(this.world,this.config,this.time,this.random));
 }
 acceptEcho(echo){
  const previous=this.echo;this.echo=echo;
  this.echoHazards=detectEcho(this.echo).map((h,i)=>{
   const channel=h.evidence[0],old=previous.find(p=>p.channel===channel&&p.valid),now=this.echo[channel];
   const closure=old&&this.time-old.t>.01?(old.range-now.range)/(this.time-old.t):0;
   const bodySpeed=this.travel&&this.time>=3?this.config.speed:0;
   const moving=closure>bodySpeed+.35;
   return {...h,kind:moving?'moving':'upper',closingSpeed:moving?Math.max(.2,closure):this.config.speed,observed:true,onPath:Math.abs(h.y)-h.width/2<.3,timestamp_ms:Math.round(this.time*1000)};
  });
  this.eventRefs.echo=this.event('ULTRASOUND',{echo:this.echo});
 }
 startTravel(){this.reset();this.travel=true;}
 tick(dt){
  if(this.cursor!==null){this.cursor=Math.min(this.snapshots.at(-1)?.time||0,this.cursor+dt);return this.view().decision;}
  this.remainder+=Math.max(0,dt);
  while(this.remainder>=.01-1e-9&&!this.finished){this.remainder-=.01;this.step();}
  return this.decision;
 }
 step(){
  this.time=++this.stepIndex/100;const c=this.config,g=this.geometry();
  this.faultPlan.forEach((f,i)=>{if(!this.applied.has(i)&&this.time>=f.at){Object.assign(c,f.patch);this.applied.add(i);this.event('FAULT',{label:f.label||'Lỗi theo lịch',patch:f.patch});}});
  this.world=this.makeWorld();this.distance=this.world[0]?.x??c.distance;
  this.truthYaw=c.bias*RAD+(c.stopped?0:Math.sin(this.time*Math.PI/c.halfPeriod)*Math.asin(Math.min(.95,c.arc/g.reach)));
  this.yaw=this.truthYaw+(c.yawDrift*this.time+(this.random()-.5)*c.yawNoise*2)*RAD;
  this.history.add(this.time*1000,this.yaw);
  this.eventRefs.imu=this.event('IMU',{yaw:this.yaw,trueYaw:this.truthYaw,saturated:c.saturated});
  if(this.stepIndex%5===0){
   const snapshot=this.history.snapshot(this.time*1000),data={seq:++this.sequence,sent:this.time,yaw:this.yaw,phase:this.time/c.halfPeriod,quality:{...snapshot,sweepValid:snapshot.valid&&!c.stopped,saturated:c.saturated,turning:c.turning},halfPeriod:c.halfPeriod};
   const id=this.event('BLE_TX',data,[this.eventRefs.imu]);
   if(c.lost||this.random()<c.bleLoss)this.event('BLE_DROP',{seq:data.seq},[id]);
   else this.pending.push({data,id,at:this.time+Math.max(0,c.bleDelay+(this.random()-.5)*2*c.bleJitter)/1000});
  }
  for(const p of this.pending.filter(p=>p.at<=this.time)){if(!this.received||p.data.sent>this.received.sent){this.received=p.data;this.lastPacket=p.data.sent*1000;this.eventRefs.ble=this.event('BLE_RX',{...p.data,received:this.time},[p.id]);}}
  this.pending=this.pending.filter(p=>p.at>this.time);
  if(this.time+1e-9>=this.nextToF){this.acquireToF();this.nextToF+=1/(c.resolution===8?15:20);}
  if(this.stepIndex%10===0)this.acquireEcho();
  if(this.stepIndex%5===0)this.evaluate();
  const desired=haptic(this.decision?.code||'—',this.time*1000,this.decision?.side||'both');
  if(desired.L!==this.lastCommand.L||desired.R!==this.lastCommand.R){this.lastCommand={L:desired.L,R:desired.R};const id=this.event('PWM',{L:desired.L,R:desired.R},[this.eventRefs.decision]);this.pwmQueue.push({at:this.time+c.motorDelay/1000,value:this.lastCommand,id});}
  for(const k of ['L','R'])this.motorState[k]+=(this.motorTarget[k]-this.motorState[k])*(1-Math.exp(-.01/.025));
  for(const p of this.pwmQueue.filter(p=>p.at<=this.time)){this.motorTarget=p.value;this.eventRefs.motorStart=this.event('MOTOR_START',{...p.value,modelDelayMs:c.motorDelay},[p.id]);}
  this.pwmQueue=this.pwmQueue.filter(p=>p.at>this.time);
  if(this.stepIndex%5===0){this.eventRefs.motor=this.event('MOTOR',{...this.motorState,simulated:true},[this.eventRefs.motorStart]);const s=this.snapshots.at(-1);if(s){s.motorState={...this.motorState};s.eventRefs={...this.eventRefs};}}
  if(this.travel&&this.time>=3&&!this.finishAt){
   const tip={x:c.handX+g.reach*Math.cos(this.truthYaw),y:g.reach*Math.sin(this.truthYaw)};
   if(this.scenario!=='missed'&&this.world.some(o=>o.kind==='grounded'&&Math.abs(tip.y-o.y)<o.width/2+.02&&tip.x>=o.x&&tip.x<=o.x+o.depth)){this.contact=true;this.addLog('CONTACT','Tiếp xúc gậy theo hình học thực của cảnh');this.event('CONTACT',{tip});if(c.stopOnAlert)this.finishAt=this.time+.5;}
   if(this.decision.code==='C'&&c.stopOnAlert){this.finishAt=this.time+.5;this.addLog('STOP','Cảnh báo khẩn; ghi thêm 0,5 s để quan sát motor.');}
   if(this.world.some(o=>o.x<.15&&o.x+o.depth>0)){this.finishAt=this.time+.1;this.event('BODY_REACHED',{note:'Mốc thân tới vật trong mô hình, không giả lập phản xạ tránh.'});}
  }
  if(this.finishAt&&this.time>=this.finishAt){this.finished=true;this.capture();}
  if(this.time>=120)this.finished=true;
 }
 evaluate(){
  const c=this.config,empty={cycles:[],halfCount:0,halfPeriod:null,sweepValid:false};
  this.quality={...(this.received?.quality||empty),connected:!!this.received,linkAgeMs:this.received?(this.time-this.received.sent)*1000:1e6,
   saturated:c.saturated||!!this.received?.quality.saturated,turning:c.turning||!!this.received?.quality.turning};
  const stale=!this.frame||this.time-this.frame.t>.25;
  const forwardZones=(this.frame?.cells||[]).filter(cell=>{const d=cell.dir,o=cell.origin;if(d[2]>=0)return false;const r=-o[2]/d[2],x=o[0]+r*d[0],y=o[1]+r*d[1];return x>.4&&x<2.5&&Math.abs(y)<.4;});
  const corridorGap=forwardZones.length>0&&forwardZones.filter(c=>c.status!==5||c.sigma>60).length/forwardZones.length>=.25;
  const gap=stale||this.frame.valid<this.frame.cells.length/2||corridorGap;
  const candidates=[...(!stale?this.hazards:[]),...(this.echoHazards||[]).filter(h=>this.time-h.timestamp_ms/1000<=.25)];
  const rank={C:4,B:3,D:2,A:1,'—':0};
  const choose=mode=>{
   const decisions=candidates.map(h=>decide({hazard:h,speed:c.speed,quality:this.quality,geometry:this.geometry(),observationGap:false},mode));
   decisions.sort((a,b)=>rank[b.code]-rank[a.code]||(a.tBody??999)-(b.tBody??999));let picked=decisions[0];
   if(gap&&(!picked||rank[picked.code]<3))picked=decide({hazard:null,speed:c.speed,quality:this.quality,geometry:this.geometry(),observationGap:true},mode);
   return picked||decide({hazard:null,speed:c.speed,quality:this.quality,geometry:this.geometry()},mode);
  };
  this.caneDecision=choose('canesync');this.compare=choose('tunnel');
  const selected=c.mode==='tunnel'?this.compare:this.caneDecision;
  this.hazard=selected.hazard;this.decision=selected;this.input={hazard:this.hazard,speed:c.speed,quality:this.quality,geometry:this.geometry(),observationGap:gap};
  this.eventRefs.decision=this.event('DECISION',{...selected,hazardCount:candidates.length},[this.eventRefs.hazard,this.eventRefs.echo,this.eventRefs.ble]);
  const key=selected.code+selected.mode+selected.reason;if(key!==this.lastKey){this.addLog(selected.code,selected.reason);this.lastKey=key;}
  this.samples.push({t:this.time,code:selected.code,cane:this.caneDecision.code,tunnel:this.compare.code,p:selected.p,ttc:selected.tBody,distance:this.distance,mode:selected.mode,linkAge:this.quality.linkAgeMs});
  this.capture();
 }
 capture(){this.snapshots.push({time:this.time,config:{...this.config},world:this.world,frame:this.frame,echo:this.echo,hazards:this.hazards,echoHazards:this.echoHazards,
  hazard:this.hazard,decision:this.decision,caneDecision:this.caneDecision,compare:this.compare,quality:this.quality,yaw:this.yaw||0,truthYaw:this.truthYaw||0,distance:this.distance,
  contact:this.contact,finished:this.finished,motorState:{...this.motorState},received:this.received,sequence:this.sequence,eventRefs:{...this.eventRefs}});if(this.snapshots.length>2401)this.snapshots.shift();}
 view(){
  if(this.cursor===null)return this;
  let lo=0,hi=this.snapshots.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(this.snapshots[mid].time<=this.cursor)lo=mid;else hi=mid-1;}
  const s=this.snapshots[lo]||{};return Object.assign(Object.create(this),s,{config:{...s.config,showTruth:this.config.showTruth,showObserved:this.config.showObserved,predict:this.config.predict}});
 }
 seek(t){this.cursor=clamp(t,this.snapshots[0]?.time||0,this.snapshots.at(-1)?.time||0);}
 live(){if(!this.imported)this.cursor=null;}
 stepFrame(delta=1){if(this.cursor===null&&delta>0){this.tick(.05);return;}this.seek((this.cursor??this.time)+delta*.05);}
 motors(){return {...this.motorState,C:0};}
 packet(){const r=this.received;return {schema:'CaneState · trạng thái đã nhận',seq:r?.seq||0,timestamp_ms:Math.round((r?.sent||0)*1000),yaw_deg:+((r?.yaw||0)/RAD).toFixed(1),pitch_deg:+(Math.asin(this.config.handHeight/this.config.length)/RAD).toFixed(1),half_period_s:r?.halfPeriod??this.config.halfPeriod,half_cycles:this.quality?.halfCount||0,quality_valid:!!this.quality?.sweepValid,age_ms:r?Math.round((this.time-r.sent)*1000):null};}
 prediction(){
  const g=this.geometry(),c=this.config,packet=this.received,cycles=packet?.quality?.cycles||[],age=packet?this.time-packet.sent:0,uncertainty=.02+Math.abs(c.yawDrift*this.time)*RAD*g.reach+c.yawNoise*RAD*g.reach+age*.03;
  const center=cycles.length?cycles.reduce((s,p)=>s+(p.lo+p.hi)/2,0)/cycles.length:c.bias*RAD,amplitude=cycles.length?cycles.reduce((s,p)=>s+(p.hi-p.lo)/2,0)/cycles.length:Math.asin(Math.min(.95,c.arc/g.reach));
  const points=[];for(let i=0;i<=30;i++){const t=i/10,phase=(packet?.phase||this.time/c.halfPeriod)+(age+t)/(packet?.halfPeriod||c.halfPeriod);
   const yaw=center+Math.sin(phase*Math.PI)*amplitude;points.push({t,x:c.speed*t+c.handX+g.reach*Math.cos(yaw),y:g.reach*Math.sin(yaw)});}
  return {points,uncertainty,contact:this.decision?.tCane,body:this.decision?.tBody};
 }
 report(){const summary=which=>{const durations={A:0,B:0,C:0,D:0,'—':0};let transitions=0,last=null,first=null;this.samples.forEach((s,i)=>{const code=s[which];if(durations[code]!==undefined)durations[code]+=(this.samples[i+1]?.t??s.t)-s.t;if(code!==last&&['B','C','D'].includes(code)){transitions++;if(first===null)first=s.t;}last=code;});return{durations,alertEpisodes:transitions,firstWarning:first};};
  return {origin:this.origin,recordedSeconds:this.time,cane:summary('cane'),tunnel:summary('tunnel'),tofFrames:this.events.filter(e=>e.type==='TOF').length,bleDropped:this.events.filter(e=>e.type==='BLE_DROP').length,limitations:'Thời lượng nhánh / đợt chuyển cảnh báo; không phải độ chính xác, hiệu quả người dùng hoặc độ an toàn thực địa.'};}
 export(){
  const events=this.events.map(e=>e.type==='TOF'?{...e,data:{rows:e.data.rows,origin:e.data.origin,cells:e.data.cells.map(c=>({range:c.range===null?null:+c.range.toFixed(5),sigma:c.sigma,status:c.status,dir:c.dir.map(v=>+v.toFixed(6))}))}}:e);
  return{schema:'novasight-studio-v2',simulation:this.origin==='simulation',origin:this.origin,scenario:this.scenario,config:this.config,customObjects:this.customObjects,faultPlan:this.faultPlan,events,samples:this.samples,logs:this.logs,report:this.report()};
 }
}
