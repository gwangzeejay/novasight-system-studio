import {Engine} from './engine.mjs';
import {normalizeObjects,replayRecording,rawExample} from './recording.mjs';
import {runFaultSuite,reportCSV} from './experiments.mjs';
const $=id=>document.getElementById(id),fmt=(x,n=2)=>Number.isFinite(x)?x.toLocaleString('vi-VN',{maximumFractionDigits:n,minimumFractionDigits:n}):'—';
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function mountWorkbench(ctx){
 const {getEngine,replaceEngine,pause,play,scene,refresh:refreshApp,toast,setTab}=ctx;
 let work='trace',selectedEvent=null,selectedCell=0,lastFrame=-1,lastEventCount=-1,lastReportTime=-1,draft=[],selectedObject=0,videoURL=null;
 try{draft=normalizeObjects(JSON.parse(localStorage.getItem('novasight-world-v2')||'[]'));}catch{}
 if(!draft.length)draft=[{id:'custom-0',kind:'grounded',x:1.8,y:0,width:.4,depth:.5,height:.25,speed:0}];
 const custom=document.createElement('option');custom.value='custom';custom.textContent='Cảnh tự dựng · nhiều vật';$('scenario').append(custom);
 getEngine().customObjects=draft;
 const open=name=>{work=name||'trace';document.querySelectorAll('[data-work]').forEach(b=>b.classList.toggle('active',b.dataset.work===work));for(const id of ['trace','builder','replay','report'])$('work-'+id).hidden=id!==work;if(!$('labDialog').open)$('labDialog').showModal();lastEventCount=-1;lastReportTime=-1;if(work==='builder')drawEditor();refresh();};
 $('openWorkbench').onclick=()=>open('trace');$('traceOpen').onclick=()=>open('trace');$('builderOpen').onclick=()=>open('builder');$('replayOpen').onclick=()=>open('replay');$('reportOpen').onclick=()=>open('report');
 $('closeLab').onclick=()=>$('labDialog').close();document.querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>open(b.dataset.work));
 for(const [id,key]of [['showTruth','showTruth'],['showObserved','showObserved'],['showPrediction','predict']])$(id).onchange=e=>{getEngine().config[key]=e.target.checked;};
 $('recordTime').oninput=e=>{pause();getEngine().seek(+e.target.value);syncVideo();refreshApp();};
 $('stepBack').onclick=()=>{pause();getEngine().stepFrame(-1);syncVideo();refreshApp();};
 $('stepNext').onclick=()=>{pause();getEngine().stepFrame(1);syncVideo();refreshApp();};
 $('returnLive').onclick=()=>{if(getEngine().imported){const e=new Engine();e.customObjects=draft;replaceEngine(e);lastFrame=-1;toast('Đã trở về mô phỏng.');}else getEngine().live();refreshApp();};
 const fields=[['noise','Nhiễu ToF (mm)',0,60,1],['dropout','Xác suất ô lỗi',0,.9,.05],['range','Giới hạn đo giả lập (m)',.5,4,.1],['pitch','Pitch ngực (°)',-15,15,1],['tiltError','Sai số bù nghiêng (°)',-6,6,.5],['yawNoise','Nhiễu yaw (°)',0,3,.1],['yawDrift','Trôi yaw (°/s)',0,2,.05],['bleDelay','Trễ BLE (ms)',0,500,10],['bleJitter','Biến động trễ (ms)',0,100,5],['bleLoss','Xác suất mất gói BLE',0,1,.05],['motorDelay','Trễ motor giả lập (ms)',0,100,5],['seed','Seed để tái hiện',1,999999,1]];
 $('sensorSettings').innerHTML='<label class="field">Lưới ToF<select id="resolution"><option value="8">8×8 · 15 Hz</option><option value="4">4×4 · 20 Hz</option></select></label>';
 fields.forEach(([key,label,min,max,step])=>{const el=document.createElement('label');el.className='field';el.textContent=label;const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=getEngine().config[key];input.id='sensor-'+key;el.append(input);$('sensorSettings').append(el);input.onchange=()=>{const v=+input.value;if(!Number.isFinite(v)||v<min||v>max){input.value=getEngine().config[key];return;}getEngine().live();getEngine().config[key]=v;getEngine().reset();play();lastFrame=-1;refreshApp();};});
 $('resolution').onchange=e=>{getEngine().config.resolution=+e.target.value;getEngine().reset();lastFrame=-1;play();refreshApp();};
 $('runFaultScript').onclick=()=>{const engine=getEngine();if(engine.imported){toast('Về mô phỏng trước khi chạy thử lỗi.');return;}Object.assign(engine.config,{lost:false,blind:false,stopped:false});const key=$('faultScript').value;
 engine.faultPlan=key==='ble'?[{at:3.5,patch:{lost:true},label:'Ngắt BLE'},{at:5,patch:{lost:false},label:'Khôi phục BLE'}]:key==='sun'?[{at:4,patch:{blind:true},label:'ToF mất độ sâu'},{at:6,patch:{blind:false},label:'ToF hồi phục'}]:[{at:3.5,patch:{stopped:true},label:'Dừng quét'},{at:5,patch:{stopped:false},label:'Quét lại'}];engine.reset();lastFrame=-1;play();refreshApp();toast('Đang ghi chuỗi lỗi theo lịch; xem FAULT và DECISION trong Truy vết.');};
 function updateGrid(e){
  const f=e.frame;if(!f){$('sensorSummary').textContent='Chưa có frame ToF';$('tofGrid').replaceChildren();$('cellDetail').textContent='';return;}
  $('sensorSummary').textContent=fmt(e.time,2)+' s · '+f.valid+'/'+f.cells.length+' ô hợp lệ · '+(e.hazards||[]).length+' Hazard ToF\nFrame: '+fmt(f.t,3)+' s · tuổi '+fmt((e.time-f.t)*1000,0)+' ms';
  if(lastFrame!==f||$('tofGrid').children.length!==f.cells.length){
   lastFrame=f;$('tofGrid').style.gridTemplateColumns='repeat('+f.cols+',1fr)';$('tofGrid').replaceChildren();
   f.cells.forEach((c,i)=>{const b=document.createElement('button');b.className=c.status!==5?'invalid':c.point?.[2]>.075?'high':c.point?.[2]<-.075?'low':'';b.textContent=c.range===null?'×':fmt(c.range,1);b.title='Ô '+i+' · '+(c.range===null?'không hợp lệ':fmt(c.range)+' m');b.setAttribute('aria-label',b.title);b.onclick=()=>{selectedCell=i;getEngine().selectedCell=i;scene?.focus('sensor');updateCell(getEngine().view());};$('tofGrid').append(b);});
  }updateCell(e);
 }
 function updateCell(e){const c=e.frame?.cells[selectedCell];if(!c)return;[...$('tofGrid').children].forEach((b,i)=>b.classList.toggle('selected',i===selectedCell));$('cellDetail').textContent='Ô '+selectedCell+' · hàng '+c.row+' / cột '+c.col+'\nstatus: '+c.status+' · sigma: '+fmt(c.sigma,1)+' mm\nrange: '+fmt(c.range,3)+' m\nđiểm [x, y, z]: '+(c.point?c.point.map(x=>fmt(x,3)).join(' / '):'không có bằng chứng');}
 $('eventFilter').onchange=()=>{lastEventCount=-1;refresh();};
 function selectEvent(id){
  const engine=getEngine(),event=engine.events.find(e=>e.id===id);if(!event)return;selectedEvent=id;pause();engine.seek(event.t);
  $('eventDetail').textContent=JSON.stringify(event,null,2);$('eventParents').replaceChildren();
  for(const parent of event.parents){const p=engine.events.find(e=>e.id===parent),b=document.createElement('button');b.textContent='← '+parent+' '+(p?.type||'ngoài cửa sổ');b.disabled=!p;b.onclick=()=>selectEvent(parent);$('eventParents').append(b);}
  scene?.focus(event.type==='TOF'||event.type==='HAZARD'?'sensor':event.type==='IMU'?'clip':event.type.startsWith('BLE')?'link':['MOTOR','MOTOR_START','PWM'].includes(event.type)?'haptic':'compute');
  lastEventCount=-1;syncVideo();refreshApp();
 }
 function updateEvents(engine){
  if(lastEventCount===engine.events.length)return;lastEventCount=engine.events.length;const filter=$('eventFilter').value;
  const rows=engine.events.filter(e=>filter==='ALL'||filter==='BLE'&&e.type.startsWith('BLE')||filter==='important'&&['HAZARD','DECISION','PWM','MOTOR_START','MOTOR','FAULT','CONTACT','BODY_REACHED'].includes(e.type)||filter===e.type).slice(-180).reverse();
  $('eventList').replaceChildren();for(const e of rows){const b=document.createElement('button');b.classList.toggle('selected',e.id===selectedEvent);b.innerHTML='<span>'+fmt(e.t,3)+' s</span><b>'+e.type+'</b><span>'+e.id+(e.type==='DECISION'?' · '+safe(e.data.code):'')+'</span>';b.onclick=()=>selectEvent(e.id);$('eventList').append(b);}
  if(!rows.length)$('eventList').textContent='Chưa có sự kiện loại này.';
 }
 const canvas=$('editorCanvas'),g=canvas.getContext('2d');
 const xy=o=>[260-o.y/4*460,370-(o.x+o.depth/2)/8*340];
 function drawEditor(){
  g.fillStyle='#101a13';g.fillRect(0,0,520,400);g.strokeStyle='#2d4031';g.lineWidth=1;
  for(let i=0;i<=8;i++){const y=370-i/8*340;g.beginPath();g.moveTo(30,y);g.lineTo(490,y);g.stroke();g.fillStyle='#8d9f88';g.font='11px sans-serif';g.fillText(i+' m',3,y+4);}
  for(let i=0;i<=8;i++){const x=30+i*57.5;g.beginPath();g.moveTo(x,30);g.lineTo(x,370);g.stroke();}
  g.fillStyle='#4b65373a';g.fillRect(225,30,70,340);g.fillStyle='#d2ed9b';g.beginPath();g.arc(260,378,9,0,Math.PI*2);g.fill();g.fillText('NGƯỜI',282,382);
  draft.forEach((o,i)=>{const [x,y]=xy(o),w=o.width/4*460,h=o.depth/8*340;g.fillStyle=o.kind==='drop'?'#8066a1':o.kind==='water'?'#467d91':o.kind==='upper'?'#d69c65':'#84a762';g.fillRect(x-w/2,y-h/2,w,h);g.strokeStyle=i===selectedObject?'#f5f5dc':'#a7bc93';g.lineWidth=i===selectedObject?3:1;g.strokeRect(x-w/2,y-h/2,w,h);g.fillStyle='#eef3df';g.fillText(String(i+1),x-3,y+4);});
  updateObjectSelect();
 }
 const objFields=[['x','Phía trước (m)',.3,8],['y','Lệch trái (m)',-2,2],['width','Bề rộng (m)',.05,3],['depth','Chiều sâu (m)',.05,5],['height','Cao / độ hụt (m)',-.5,2],['speed','Tiến tới (m/s)',0,2]];
 objFields.forEach(([key,label,min,max])=>{const el=document.createElement('label');el.textContent=label;const input=document.createElement('input');input.type='number';input.step=.05;input.min=min;input.max=max;input.id='object-'+key;input.onchange=()=>{if(!draft[selectedObject])return;const value=+input.value;if(!Number.isFinite(value))return;draft[selectedObject][key]=Math.max(min,Math.min(max,value));drawEditor();};el.append(input);$('objectFields').append(el);});
 function updateObjectSelect(){$('objectSelect').replaceChildren();draft.forEach((o,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=(i+1)+' · '+o.kind;$('objectSelect').append(opt);});$('objectSelect').value=selectedObject;objFields.forEach(([key])=>{$('object-'+key).value=draft[selectedObject]?.[key]??'';$('object-'+key).disabled=!draft[selectedObject];});}
 $('objectSelect').onchange=e=>{selectedObject=+e.target.value;drawEditor();};
 $('addObject').onclick=()=>{if(draft.length>=8){toast('Tối đa 8 vật trong một cảnh.');return;}const kind=$('addKind').value;draft.push({id:'custom-'+draft.length,kind,x:2.5,y:0,width:.4,depth:.6,height:kind==='upper'?1.4:kind==='moving'?1.65:kind==='drop'?-.18:kind==='water'?0:.25,speed:kind==='moving'?.8:0});selectedObject=draft.length-1;drawEditor();};
 $('removeObject').onclick=()=>{draft.splice(selectedObject,1);selectedObject=Math.max(0,selectedObject-1);drawEditor();};
 let dragging=false;
 const canvasPoint=e=>{const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*520/r.width,(e.clientY-r.top)*400/r.height];};
 canvas.onpointerdown=e=>{const [x,y]=canvasPoint(e);const idx=draft.findLastIndex(o=>{const p=xy(o);return Math.abs(p[0]-x)<Math.max(12,o.width/4*230)&&Math.abs(p[1]-y)<Math.max(12,o.depth/8*170);});if(idx<0)return;selectedObject=idx;dragging=true;canvas.setPointerCapture(e.pointerId);drawEditor();};
 canvas.onpointermove=e=>{if(!dragging)return;const [x,y]=canvasPoint(e),o=draft[selectedObject];o.y=Math.round(Math.max(-2,Math.min(2,(260-x)/460*4))*100)/100;o.x=Math.round(Math.max(.3,Math.min(8,(370-y)/340*8-o.depth/2))*100)/100;drawEditor();};
 canvas.onpointerup=()=>dragging=false;canvas.onpointercancel=()=>dragging=false;
 function applyWorld(){try{draft=normalizeObjects(draft);const engine=getEngine().imported?new Engine():getEngine();engine.customObjects=draft.map(o=>({...o}));engine.select('custom');if(engine!==getEngine())replaceEngine(engine);try{localStorage.setItem('novasight-world-v2',JSON.stringify(draft));}catch{}lastFrame=-1;$('labDialog').close();scene?.focus('overview');setTab('sensors');play();refreshApp();}catch(e){toast(e.message);}}
 $('applyWorld').onclick=applyWorld;$('saveWorld').onclick=()=>{try{download('CaneSync-world.json',{schema:'novasight-world-v1',objects:normalizeObjects(draft)});}catch(e){toast(e.message);}};
 $('loadWorld').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error('Tệp cảnh tối đa 100 KB');const doc=JSON.parse(await file.text());if(doc.schema!=='novasight-world-v1')throw new Error('Sai định dạng cảnh');draft=normalizeObjects(doc.objects);selectedObject=0;drawEditor();}catch(err){toast(err.message);}finally{e.target.value='';}};
 const schema={schema:'novasight-sensors-v1',origin:'device-unverified',config:{speed:.7,length:1.26,handHeight:.78},records:[{t_ms:0,type:'IMU',data:{yaw_deg:0,saturated:false}},{t_ms:50,type:'BLE_RX',data:{sent_ms:20,seq:1,yaw_deg:0,half_period_s:.55}},{t_ms:70,type:'TOF',data:{rows:4,origin:[.18,0,1.28],cells:Array.from({length:16},()=>({range:1.5,status:5,sigma:10}))}},{t_ms:100,type:'ULTRASOUND',data:{echo:[{valid:true,range:1.8},{valid:false,range:null}]}},{t_ms:150,type:'MOTOR',data:{L:.7,R:0}}]};
 $('schemaPreview').textContent=JSON.stringify({...schema,records:schema.records.slice(0,2)},null,2)+'\nToF: đúng 16 hoặc 64 ô; range (m), sigma (mm), status 5 = dùng được.\nTimestamp tăng dần, dùng cùng một đồng hồ trước khi nhập.';
 $('schemaDoc').onclick=()=>download('novasight-sensors-v1-format.json',schema);
 $('exampleLog').onclick=()=>{const e=new Engine();e.tick(6);download('CaneSync-simulated-sensors.json',rawExample(e));};
 $('importLog').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>32*1024*1024)throw new Error('Log tối đa 32 MB');$('importStatus').textContent='Đang kiểm tra và dựng lại quyết định…';await new Promise(r=>setTimeout(r,20));const e=replayRecording(await file.text());replaceEngine(e);lastFrame=-1;lastEventCount=-1;$('importStatus').textContent='Đã nhập '+e.snapshots.length+' mốc. '+(e.origin==='simulation-recording'?'Nguồn: bản ghi mô phỏng.':'Nguồn do tệp khai báo, chưa xác minh bằng thiết bị.');refreshApp();toast('Đã dựng lại quyết định từ dữ liệu cảm biến. Dùng dòng thời gian để phát lại.');}catch(err){$('importStatus').textContent='Không nhập: '+err.message;}finally{event.target.value='';}};
 $('videoFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(f);$('referenceVideo').src=videoURL;$('referenceVideo').hidden=false;};
 function syncVideo(){const v=$('referenceVideo'),e=getEngine().view(),offset=+$('videoOffset').value||0;if(!v.hidden&&Number.isFinite(v.duration))v.currentTime=Math.max(0,Math.min(v.duration,e.time+offset));}
 $('syncVideo').onclick=syncVideo;$('referenceVideo').addEventListener('seeked',()=>{const v=$('referenceVideo'),e=getEngine();if(!e.snapshots.length)return;pause();e.seek(Math.max(0,v.currentTime-(+$('videoOffset').value||0)));refreshApp();});
 $('exportReport').onclick=()=>download('CaneSync-policy-comparison.csv',reportCSV(getEngine()),'text/csv;charset=utf-8');
 $('runSuite').onclick=async()=>{$('runSuite').disabled=true;$('suiteResults').textContent='Đang chạy các ca xác định với seed 42…';await new Promise(r=>setTimeout(r,30));try{const results=runFaultSuite();$('suiteResults').innerHTML=results.map(r=>'<div class="suite-row '+(r.pass?'':'fail')+'"><b>'+(r.pass?'ĐẠT':'CHƯA ĐẠT')+'</b><div>'+safe(r.name)+'<p class="micro">'+r.code+' · '+r.mode+' · '+fmt(r.t)+' s</p></div></div>').join('');}catch(err){$('suiteResults').textContent=err.message;}finally{$('runSuite').disabled=false;}};
 function updateReport(engine){if(lastReportTime===engine.time)return;lastReportTime=engine.time;const r=engine.report();$('reportStats').innerHTML='<table><tr><th>Chính sách</th><th>Hoãn A</th><th>B</th><th>C</th><th>D</th><th>Đợt cảnh báo</th></tr>'+['cane','tunnel'].map(k=>'<tr><td>'+k+'</td>'+['A','B','C','D'].map(c=>'<td>'+fmt(r[k].durations[c],1)+' s</td>').join('')+'<td>'+r[k].alertEpisodes+'</td></tr>').join('')+'</table><p class="micro">'+safe(r.limitations)+'</p>';
  const chart=$('decisionChart'),g=chart.getContext('2d');g.fillStyle='#111914';g.fillRect(0,0,860,170);const col={A:'#d2ed9b',B:'#f5b76d',C:'#f4776b',D:'#b9a1db','—':'#52634f'};
  ['cane','tunnel'].forEach((key,row)=>{const y=38+row*52;g.fillStyle='#dce7cf';g.font='12px sans-serif';g.fillText(key,12,y+15);engine.samples.forEach((s,i)=>{const x=95+s.t/Math.max(.05,engine.time)*740,next=engine.samples[i+1]?.t??engine.time;g.fillStyle=col[s[key]]||col['—'];g.fillRect(x,y,Math.max(1,(next-s.t)/Math.max(.05,engine.time)*740),23);});});g.fillStyle='#9cae98';g.fillText('0 s',95,150);g.fillText(fmt(engine.time)+' s',780,150);
 }
 function refresh(){const engine=getEngine(),e=engine.view();$('recordTime').max=Math.max(.05,engine.snapshots.at(-1)?.time||0);$('recordTime').min=engine.snapshots[0]?.time||0;$('recordTime').value=engine.cursor??engine.time;$('recordClock').textContent=fmt(e.time)+' s';$('recordOrigin').textContent=engine.origin==='simulation'?(engine.cursor===null?'ĐANG GHI · GIẢ LẬP':'XEM LẠI · GIẢ LẬP'):engine.origin==='simulation-recording'?'LOG MÔ PHỎNG':'LOG NHẬP · CHƯA XÁC MINH';$('returnLive').textContent=engine.imported?'Về mô phỏng':'Về hiện tại';document.querySelector('.demo-indicator').textContent=engine.imported?'Đang phát lại log':'Cảm biến giả lập';if(!$('sensorsPanel').hidden)updateGrid(e);if($('labDialog').open){if(work==='trace')updateEvents(engine);if(work==='report')updateReport(engine);}}
 return {refresh,open,selectEvent,applyWorld,download,runFaultSuite,readEngine:()=>getEngine().view()};
}
