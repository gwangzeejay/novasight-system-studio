import {Engine} from './engine.mjs';
export function runFaultSuite(){
 const cases=[
  ['Khởi động chưa có CaneState',e=>{},e=>e.decision.mode==='tunnel'],
  ['ToF đủ ba frame → phát hiện vật',e=>e.tick(1),e=>e.hazards.length>0&&e.hazards[0].count>=3],
  ['Gậy đủ vùng phủ → A',e=>e.tick(3.5),e=>e.decision.code==='A'],
  ['Mất BLE → Tunnel',e=>{e.tick(3.5);e.config.lost=true;e.tick(.5);},e=>e.decision.mode==='tunnel'&&e.decision.code!=='A'],
  ['BLE phục hồi',e=>{e.tick(3.5);e.config.lost=true;e.tick(.5);e.config.lost=false;e.tick(.2);},e=>e.decision.mode==='canesync'],
  ['Mất độ sâu → D',e=>{e.config.blind=true;e.tick(.5);},e=>e.decision.code==='D'],
  ['Vật tầm đầu được bảo vệ',e=>{e.select('head');e.tick(3.5);},e=>e.decision.code==='B'],
  ['Xuất hiện muộn → C',e=>{e.select('late');e.tick(.5);},e=>e.decision.code==='C'],
  ['Mép thấp có bằng chứng → B',e=>{e.select('drop');e.tick(3.5);},e=>e.decision.code==='B'&&e.hazard.kind==='drop'],
  ['Ngắt điện thoại không đổi nhánh',e=>{e.tick(3.5);e.config.phone=false;e.tick(.1);},e=>e.decision.code==='A'],
  ['Cảnh báo khẩn vẫn giữ khi ToF mất',e=>{e.select('late');e.config.blind=true;e.tick(.5);},e=>e.decision.code==='C']
 ];
 return cases.map(([name,setup,check])=>{const e=new Engine();setup(e);return{name,pass:!!check(e),code:e.decision.code,mode:e.decision.mode,t:e.time,reason:e.decision.reason};});
}
export function reportCSV(engine){
 const r=engine.report(),rows=[['origin',r.origin],['recorded_seconds',r.recordedSeconds],['policy','A_seconds','B_seconds','C_seconds','D_seconds','quiet_seconds','warning_episodes','first_warning_seconds']];
 for(const key of ['cane','tunnel']){const s=r[key];rows.push([key,...['A','B','C','D','—'].map(c=>s.durations[c].toFixed(3)),s.alertEpisodes,s.firstWarning??'']);}
 rows.push(['limitation',r.limitations]);return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
