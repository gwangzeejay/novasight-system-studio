import {Engine,SENSOR_DEFAULT} from './engine.mjs';
import {DEFAULT} from './catalog.mjs';
import {direction,pointAt,RAD,clamp} from './sensors.mjs';
const num=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Giá trị không hợp lệ: '+label);return v;};
const vec=(v,fallback)=>{if(!v)return fallback;if(!Array.isArray(v)||v.length!==3)throw new Error('Vector phải có 3 phần tử');return v.map(x=>num(x,-20,20,'vector'));};
export function normalizeObjects(list){
 if(!Array.isArray(list)||list.length>8)throw new Error('Tối đa 8 vật trong một cảnh.');
 return list.map((o,i)=>{if(!['grounded','upper','moving','drop','water'].includes(o.kind))throw new Error('Loại vật chưa hỗ trợ');return {id:'custom-'+i,kind:o.kind,x:num(o.x,.3,8,'x'),y:num(o.y,-2,2,'y'),width:num(o.width,.05,3,'rộng'),depth:num(o.depth,.05,5,'sâu'),height:num(o.height,o.kind==='drop'?-.5:0,2,'cao'),speed:num(o.speed||0,0,2,'vận tốc')};});
}
function normalizeFrame(data,t){
 const n=data.rows||data.resolution;if(![4,8].includes(n)||!Array.isArray(data.cells)||data.cells.length!==n*n)throw new Error('ToF cần đúng 16 hoặc 64 ô.');
 const origin=vec(data.origin,[.18,0,1.28]);
 const cells=data.cells.map((c,i)=>{
  const row=Math.floor(i/n),col=i%n,dir=vec(c.dir,direction((-35+(row+.5-n/2)*45/n)*RAD,(col+.5-n/2)*45/n*RAD));
  const norm=Math.hypot(...dir);if(norm<.99||norm>1.01)throw new Error('Hướng tia phải có độ dài 1');
  const range=c.range===null?null:num(c.range,.02,10,'ToF range (m)'),sigma=num(c.sigma??10,0,1000,'sigma (mm)'),status=c.status===5&&range!==null?5:0;
  const point=range===null?null:pointAt(origin,dir,range);
  return {row,col,range,sigma,status,origin,dir,point,rayEnd:point||pointAt(origin,dir,4)};
 });
 return {t,rows:n,cols:n,origin,cells,valid:cells.filter(c=>c.status===5).length};
}
export function readRecording(text){
 if(text.length>32*1024*1024)throw new Error('Log vượt giới hạn 32 MB. Hãy cắt một đoạn tối đa 120 giây.');
 const doc=JSON.parse(text);let records,origin;
 if(doc.schema==='novasight-studio-v2'){
  if(!Array.isArray(doc.events))throw new Error('Thiếu events.');
  records=doc.events.filter(e=>['TOF','ULTRASOUND','IMU','BLE_RX','MOTOR'].includes(e.type)).map(e=>({t_ms:e.t*1000,type:e.type,data:e.data}));
  origin=doc.origin==='simulation'?'simulation-recording':'imported-unverified';
 }else if(doc.schema==='novasight-sensors-v1'){records=doc.records;origin=doc.origin==='simulation'?'simulation-recording':'imported-unverified';}
 else throw new Error('Dùng schema novasight-sensors-v1 hoặc novasight-studio-v2.');
 if(!Array.isArray(records)||!records.length||records.length>25000)throw new Error('Log cần 1–25.000 bản ghi.');
 let last=-1;
 records=records.map(r=>{
  const t=num(r.t_ms,0,120000,'t_ms');if(t<last)throw new Error('Timestamp phải tăng dần. Hãy đồng bộ đồng hồ trước khi nhập.');last=t;
  const type=String(r.type).toUpperCase(),d=r.data||{};
  if(type==='TOF')return {t,type,data:normalizeFrame(d,t/1000)};
  if(type==='IMU')return {t,type,data:{yaw:d.yaw_deg!==undefined?num(d.yaw_deg,-720,720,'yaw_deg')*RAD:num(d.yaw,-13,13,'yaw'),saturated:!!d.saturated}};
  if(type==='BLE_RX'){
   const sent=d.sent_ms!==undefined?num(d.sent_ms,0,t,'sent_ms')/1000:num(d.sent,0,t/1000,'sent');
   return {t,type,data:{sent,seq:num(d.seq??0,0,1e9,'seq'),yaw:d.yaw_deg!==undefined?num(d.yaw_deg,-720,720,'yaw_deg')*RAD:num(d.yaw??0,-13,13,'yaw'),halfPeriod:num(d.half_period_s??d.halfPeriod??.55,.15,2,'half_period_s')}};
  }
  if(type==='ULTRASOUND'){
   if(!Array.isArray(d.echo)||d.echo.length>2)throw new Error('Siêu âm cần 0–2 kênh.');
   return {t,type,data:d.echo.map((e,i)=>({t:t/1000,channel:i,valid:!!e.valid,range:e.valid?num(e.range,.02,10,'echo range'):null,origin:vec(e.origin,[.18,i===0?-.055:.055,1.3]),heading:(i===0?-15:15)*RAD,pitch:15*RAD}))};
  }
  if(type==='MOTOR')return {t,type,data:{L:num(d.L,0,1,'motor L'),R:num(d.R,0,1,'motor R')}};
  throw new Error('Loại bản ghi chưa hỗ trợ: '+type.slice(0,30));
 });
 if(!records.some(r=>r.type==='TOF'))throw new Error('Cần ít nhất một frame ToF để phát lại nhận thức môi trường.');
 // Only numeric configuration from the documented whitelist is accepted.
 const config={...DEFAULT,...SENSOR_DEFAULT};
 for(const [key,min,max]of [['speed',0,1.5],['length',1,1.5],['handHeight',.6,.95],['handX',0,.5],['halfPeriod',.25,1.2],['arc',.1,.7],['bias',-35,35]])if(doc.config?.[key]!==undefined)config[key]=num(doc.config[key],min,max,key);
 return {records,origin,config};
}
export function replayRecording(text){
 const {records,origin,config}=readRecording(text),e=new Engine();e.config=config;e.reset();e.world=[];e.events=[];e.snapshots=[];e.samples=[];e.logs=[];e.tracks=[];e.frame=null;e.hazards=[];e.echo=[];e.echoHazards=[];e.eventRefs={};e.time=0;e.origin=origin;
 let index=0;const end=records.at(-1).t/1000;
 for(let step=0;step<=Math.ceil(end*20);step++){
  const t=step/20;
  while(index<records.length&&records[index].t/1000<=t+1e-9){
   const r=records[index++];e.time=r.t/1000;
   if(r.type==='TOF')e.acceptFrame(r.data);
   if(r.type==='ULTRASOUND')e.acceptEcho(r.data);
   if(r.type==='IMU'){e.yaw=r.data.yaw;e.truthYaw=e.yaw;e.history.add(r.t,e.yaw);e.config.saturated=r.data.saturated;e.eventRefs.imu=e.event('IMU',r.data);}
   if(r.type==='BLE_RX'){const at=r.data.sent*1000,halves=e.history.halves.filter(h=>h.time<=at&&at-h.time<=3000),cycles=e.history.cycles.filter(c=>c.time<=at).slice(-8),q={halfCount:halves.length,cycles,halfPeriod:r.data.halfPeriod,valid:halves.length>=4};e.received={...r.data,phase:r.data.sent/e.config.halfPeriod,quality:{...q,sweepValid:q.valid,saturated:e.config.saturated,turning:false}};e.lastPacket=r.data.sent*1000;e.eventRefs.ble=e.event('BLE_RX',e.received,[e.eventRefs.imu]);}
   if(r.type==='MOTOR'){e.motorState=r.data;e.eventRefs.motor=e.event('MOTOR',r.data);}
  }
  e.time=t;e.evaluate();
 }
 e.imported=true;e.cursor=0;e.finished=true;return e;
}
export function rawExample(engine){
 return {schema:'novasight-sensors-v1',origin:'simulation',config:engine.config,records:engine.export().events.filter(e=>['TOF','IMU','BLE_RX','ULTRASOUND','MOTOR'].includes(e.type)).map(e=>({t_ms:Math.round(e.t*1000),type:e.type,data:e.data}))};
}
