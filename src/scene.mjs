import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import CAD from './cad.json';
import { SCENARIOS } from './model.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const COLORS={A:0xd2ed9b,B:0xffb76a,C:0xff7468,D:0xb8a5ec,'—':0x98b4a4};
function material(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.15,...options});}
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}
function rod(a,b,r,mat){const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),12),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;}
function decode(s,type){const a=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new type(a.buffer);}
export function createScene(container,onPick){
 const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});scene.fog=new THREE.FogExp2(0x141e17,.12);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 container.appendChild(renderer.domElement);const camera=new THREE.PerspectiveCamera(35,1,.005,70);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.11;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,.9,.4);
 scene.add(new THREE.HemisphereLight(0xedffe6,0x273c2b,2.5));
 const key=new THREE.DirectionalLight(0xfff4dd,4);key.position.set(-2,4,3);scene.add(key);
 const rim=new THREE.DirectionalLight(0xbbdcac,3);rim.position.set(2,2,-2);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xc0dfe7,1.3);fill.position.set(0,1,4);scene.add(fill);
 const floor=box(100,.025,100,material(0x0e1811,{roughness:1}),0,-.025,0);scene.add(floor);
 const grid=new THREE.GridHelper(10,40,0x40533e,0x304332);grid.material.transparent=true;grid.material.opacity=.3;scene.add(grid);
 const rings=new THREE.Group();scene.add(rings);
 for(const r of [.65,1.25,2]){const m=new THREE.Mesh(new THREE.RingGeometry(r,r+.004,100),new THREE.MeshBasicMaterial({color:0x617958,transparent:true,opacity:.3,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=.002;rings.add(m);}
 const human=new THREE.Group();scene.add(human);const man=material(0x56745f,{transparent:true,opacity:.34,roughness:.8,metalness:.2,depthWrite:false});
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.205,.42,8,20),man);body.position.y=1.17;body.scale.z=.65;human.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.115,24,18),man);head.position.set(0,1.68,0);head.scale.set(.85,1.12,.9);human.add(head);
 const joints=[[[-.12,.87,0],[-.13,.5,.01]],[[.12,.87,0],[.13,.5,.01]],[[-.13,.5,.01],[-.14,.09,.05]],[[.13,.5,.01],[.15,.09,.05]],[[-.21,1.4,0],[-.29,1.1,.02]],[[-.29,1.1,.02],[-.27,.84,.13]],[[.21,1.4,0],[.29,1.08,.02]],[[.29,1.08,.02],[0,.78,.18]]];
 for(const [a,b]of joints)human.add(rod(V(...a),V(...b),a[1]<1?.065:.042,man));
 human.add(box(.12,.06,.22,man,-.14,.06,.09),box(.12,.06,.22,man,.15,.06,.09));
 const spine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,.85,-.08),V(0,1.49,-.08)]),new THREE.LineBasicMaterial({color:0x9dbb85,transparent:true,opacity:.25}));human.add(spine);
 const strap=material(0x263a2c,{roughness:.9,transparent:true});human.add(box(.035,.45,.025,strap,-.13,1.27,.126),box(.035,.45,.025,strap,.13,1.27,.126));
 const pickables=[],devices={},exploded=[];
 function device(type,position){
  const group=new THREE.Group();group.position.copy(position);scene.add(group);
  const shell=new THREE.Group();shell.rotation.x=-Math.PI/2;shell.scale.setScalar(.001);group.add(shell);
  for(const item of CAD[type]){
   if(item.name.startsWith('KO_')||/Liner_L[124]|Cane_/.test(item.name))continue;
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(decode(item.mesh.pos,Float32Array),3));geo.setAttribute('normal',new THREE.BufferAttribute(decode(item.mesh.nor,Float32Array),3));geo.setIndex(new THREE.BufferAttribute(decode(item.mesh.idx,Uint32Array),1));
   const clear=/Window|Light_Pipe/.test(item.name),m=new THREE.Mesh(geo,material(item.color,{metalness:/probe/.test(item.name)?.6:.15,roughness:clear?.15:.36,transparent:clear,opacity:clear?.65:1,side:THREE.DoubleSide}));
   m.userData.device=type;m.userData.part=item.name;pickables.push(m);shell.add(m);
   let offset=0;if(/Front_Cover|Top_Shell/.test(item.name))offset=-70;if(/Visor|Window|US_Ring/.test(item.name))offset=-95;if(/Rear_Body|Saddle|Jaw/.test(item.name))offset=45;if(/Carrier/.test(item.name))offset=-35;
   exploded.push({m,offset,type});
  }
  devices[type]=group;return group;
 }
 const chest=device('chest',V(0,1.29,.18));
 // Schematic PCB/component geometry is explicitly distinct from the reused CAD shell.
 const pcb=new THREE.Group();pcb.position.set(0,0,-.024);chest.add(pcb);pcb.add(box(.118,.041,.0016,material(0x155f46)));
 const processor=box(.018,.017,.004,material(0x899b8d,{metalness:.8}),-.018,.004,.004);pcb.add(processor);
 const trace=new THREE.Group();pcb.add(trace);const traceDots=[];
 for(const points of [[[-.05,-.01,.006],[-.018,-.01,.006],[-.018,.004,.006]],[[-.018,.004,.006],[.03,.004,.006],[.03,.014,.006]],[[-.018,.004,.006],[-.018,.017,.006],[-.052,.017,.006]]]){const coords=points.map(p=>V(...p));const curve=new THREE.CatmullRomCurve3(coords);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),new THREE.LineBasicMaterial({color:0xbfe88e}));trace.add(line);const dot=new THREE.Mesh(new THREE.SphereGeometry(.0015,10,8),new THREE.MeshBasicMaterial({color:0xedffc5}));trace.add(dot);traceDots.push({dot,curve});}
 const imu=box(.006,.006,.003,material(0x1a2420),.03,.003,.004);pcb.add(imu);
 const battery=box(.065,.03,.012,material(0x96a29a,{metalness:.65}),0,0,-.018);chest.add(battery);
 const copper=material(0xcba361,{metalness:.7});
 for(let i=0;i<13;i++){pcb.add(box(.001,.004,.001,copper,-.051+i*.008,-.014,.002));if(i%2===0)pcb.add(box(.004,.003,.002,material(0x101a14),-.05+i*.008,.014,.002));}
 const sensorToF=box(.012,.007,.003,material(0x774275),0,-.011,.004);sensorToF.rotation.x=-.61;chest.add(sensorToF);
 const cameraLens=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.004,24),material(0x34596e,{metalness:.7,roughness:.08}));cameraLens.rotation.x=Math.PI/2;cameraLens.position.set(0,.014,.002);chest.add(cameraLens);
 const clip=device('clip',V(0,.78,.18));clip.quaternion.setFromUnitVectors(V(1,0,0),V(0,-.62,.79).normalize());
 const clipBoard=box(.067,.025,.001,material(0x155f46),0,0,-.018);clip.add(clipBoard);clip.add(box(.014,.014,.003,material(0x82998b,{metalness:.7}),0,0,-.015));
 const caneMat=material(0xe9e9df,{roughness:.35}),caneRed=material(0xb6463c),cane=new THREE.Group();scene.add(cane);
 let caneRod=rod(V(0,.78,.18),V(0,0,1.17),.008,caneMat);cane.add(caneRod);
 const tip=new THREE.Mesh(new THREE.SphereGeometry(.02,12,10),material(0xd8eca9));scene.add(tip);
 const caneBand=new THREE.Mesh(new THREE.CylinderGeometry(.0085,.0085,.2,12),caneRed);cane.add(caneBand);
 const motorMat=()=>material(0x9ac67e,{emissive:0x9ac67e,emissiveIntensity:.1});
 const motors=[box(.05,.027,.018,motorMat(),-.22,1.42,.07),box(.05,.027,.018,motorMat(),.22,1.42,.07)];motors.forEach(m=>scene.add(m));
 const pulseRings=motors.map(m=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.038,.0015,8,40),new THREE.MeshBasicMaterial({color:0xcdea9f,transparent:true,opacity:0}));r.position.copy(m.position);r.position.z+=.025;scene.add(r);return r;});
 const floorMat=new THREE.MeshBasicMaterial({color:0xaad179,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});
 const sectorGeo=new THREE.BufferGeometry();sectorGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(40*9),3));const sector=new THREE.Mesh(sectorGeo,floorMat);scene.add(sector);
 const arcGeo=new THREE.BufferGeometry();arcGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(41*3),3));const arc=new THREE.Line(arcGeo,new THREE.LineBasicMaterial({color:0xc9e7a1,transparent:true,opacity:.7}));scene.add(arc);
 const hazards=new THREE.Group();scene.add(hazards);let hazardId='',hazardObj;
 function setWorld(world){
  const key=JSON.stringify(world.map(o=>[o.kind,o.width,o.depth,o.height]));if(key===hazardId)return;hazardId=key;while(hazards.children.length){const child=hazards.children[0];child.traverse(n=>{n.geometry?.dispose();if(n.material)for(const m of [n.material].flat())m.dispose();});hazards.remove(child);}
  for(const h of world){const id=h.kind,mat=material(id==='water'?0x538b9c:0x9a7956,{roughness:.65});
  if(h.kind==='grounded'){hazardObj=box(h.width,h.height,h.depth,mat);hazardObj.position.y=h.height/2;const edges=new THREE.LineSegments(new THREE.EdgesGeometry(hazardObj.geometry),new THREE.LineBasicMaterial({color:0xd4b789}));hazardObj.add(edges);}
  else if(h.kind==='upper'){hazardObj=box(h.width,.07,h.depth,mat);hazardObj.position.y=h.height;const support=rod(V(-.38,-h.height,0),V(-.38,.18,0),.025,material(0x566a46));hazardObj.add(support);}
  else if(h.kind==='moving'){hazardObj=new THREE.Group();const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.48,6,14),mat);torso.position.y=1.1;hazardObj.add(torso);const hd=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),mat);hd.position.y=1.62;hazardObj.add(hd);hazardObj.add(rod(V(-.1,.85,0),V(-.12,.05,0),.05,mat),rod(V(.1,.85,0),V(.12,.05,0),.05,mat));}
  else {hazardObj=box(h.width,.008,h.depth,material(id==='water'?0x41646a:0x070e0b,{metalness:id==='water'?.8:0,roughness:.2}));hazardObj.position.y=.008;}
  hazards.add(hazardObj);}

 }
 const beamPositions=new Float32Array(64*6),beamGeo=new THREE.BufferGeometry();beamGeo.setAttribute('position',new THREE.BufferAttribute(beamPositions,3));
 const beams=new THREE.LineSegments(beamGeo,new THREE.LineBasicMaterial({color:0xbedb8c,transparent:true,opacity:.12}));scene.add(beams);
 const cells=[];for(let i=0;i<64;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.085,.085),new THREE.MeshBasicMaterial({color:0xc6df96,transparent:true,opacity:.3,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;scene.add(m);cells.push(m);}
 const observedBoxes=Array.from({length:12},()=>{const m=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:0xffc280,transparent:true,opacity:.8}));scene.add(m);return m;});
 const futurePositions=new Float32Array(31*3),futureGeo=new THREE.BufferGeometry();futureGeo.setAttribute('position',new THREE.BufferAttribute(futurePositions,3));
 const forecast=new THREE.Line(futureGeo,new THREE.LineBasicMaterial({color:0xe0edb1,transparent:true,opacity:.9}));scene.add(forecast);
 const bodyForecast=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,.022,.15),V(0,.022,4.5)]),new THREE.LineDashedMaterial({color:0xe6a373,dashSize:.06,gapSize:.06,transparent:true,opacity:.5}));bodyForecast.computeLineDistances();scene.add(bodyForecast);
 const ghosts=Array.from({length:3},()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.2,.205,40),new THREE.MeshBasicMaterial({color:0xe8b783,transparent:true,opacity:.5,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;scene.add(m);return m;});
 const uncertaintyRing=new THREE.Mesh(new THREE.RingGeometry(.8,1,32),new THREE.MeshBasicMaterial({color:0xd2ed9b,transparent:true,opacity:.3,side:THREE.DoubleSide}));uncertaintyRing.rotation.x=-Math.PI/2;scene.add(uncertaintyRing);
 function path(a,b,lift,color){const mid=a.clone().lerp(b,.5);mid.z+=lift;const curve=new THREE.QuadraticBezierCurve3(a,mid,b),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.3}));scene.add(line);const dot=new THREE.Mesh(new THREE.SphereGeometry(.006,10,8),new THREE.MeshBasicMaterial({color}));scene.add(dot);return{curve,line,dot};}
 const paths=[path(V(0,.78,.18),V(0,1.29,.19),.28,0xcce8a1),path(V(0,1.29,.19),V(-.22,1.42,.07),.10,0xffba7c),path(V(0,1.29,.19),V(.22,1.42,.07),.10,0xffba7c),path(V(0,.78,.18),V(.8,.8,-.1),.1,0x93aec4)];
 const phone=new THREE.Group();phone.position.set(.8,.8,-.1);phone.rotation.y=-.4;phone.add(box(.085,.165,.012,material(0x0d1511)),box(.073,.143,.001,material(0x45624c,{emissive:0x1b3e28,emissiveIntensity:.3}),0,0,.007));scene.add(phone);
 const labels=[];const labelsEl=document.querySelector('#labels');
 function label(text,sub,point,views){const el=document.createElement('div');el.className='model-label';el.innerHTML=`<div><b>${text}</b><small>${sub}</small></div>`;labelsEl.append(el);const record={el,point,views};labels.push(record);return record;}
 label('NovaChest','Cảm biến → quyết định',V(-.04,1.29,.20),['overview','link']);
 label('NovaCane Clip','IMU gậy · CaneState',V(0,.78,.2),['overview','link']);
 label('VL53L8CX','Lưới ToF · nghiêng −35°',V(0,1.274,.19),['chest','sensor']);
 label('JSN-SR04T × 2','Siêu âm · chếch +15°',V(.055,1.30,.20),['chest']);
 label('ESP32-S3','Quyết định trên Chest',V(-.018,1.294,.16),['compute']);
 label('IMU gậy → ESP32-C3','100 Hz → BLE mỗi 50 ms',V(0,.8,.2),['clip']);
 label('Vai trái / phải','Rung theo hướng & mức khẩn',V(.22,1.42,.08),['haptic']);
 label('NovaApp','Tiện ích · ngoài vòng cảnh báo',V(.8,.9,-.1),['link']);
 const caneForecastLabel=label('Gậy dự kiến','',V(),['sensor']);const bodyForecastLabel=label('Thân dự kiến','',V(),['sensor']);bodyForecastLabel.el.style.transform='translate(13px,-145%)';
 const views={overview:{eye:[2.65,2.05,4.4],at:[.08,.84,.48]},chest:{eye:[.23,1.43,.63],at:[0,1.29,.17]},clip:{eye:[.65,1.02,.61],at:[0,.78,.18]},sensor:{eye:[3.4,3.1,4.6],at:[0,.35,1.3]},link:{eye:[1.3,1.6,2.1],at:[.18,1.06,.14]},compute:{eye:[.18,1.37,.48],at:[0,1.29,.17]},haptic:{eye:[.72,1.82,1.43],at:[0,1.35,.12]}};
 let current='overview',cameraMoving=false,targetEye=V(...views.overview.eye),targetAt=V(...views.overview.at),explodeTarget=0,explodeAmount=0,manualExplode=false;
 camera.position.copy(targetEye);controls.target.copy(targetAt);controls.update();
 function focus(name){if(!views[name])name='overview';current=name;const v=views[name];targetEye=V(...v.eye);targetAt=V(...v.at);cameraMoving=true;explodeTarget=name==='compute'?1:manualExplode?1:0;onPick?.(name,false);}
 controls.addEventListener('start',()=>{cameraMoving=false;});
 const pointer=new THREE.Vector2(),ray=new THREE.Raycaster();let down;
 renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(pickables,false)[0];if(hit){focus(hit.object.userData.device);onPick?.(hit.object.userData.device,true);}});
 const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(container);resize();
 function render(engine,dt){
  const c=engine.config,d=engine.decision||{},g=engine.geometry(),yaw=engine.truthYaw||0,tm=engine.time;
  if(cameraMoving){const k=1-Math.exp(-dt*3.2);camera.position.lerp(targetEye,k);controls.target.lerp(targetAt,k);if(camera.position.distanceTo(targetEye)<.0005)cameraMoving=false;}controls.update();
  const close=['chest','clip','compute'].includes(current);man.opacity=close?.025:.26;strap.opacity=close?.05:1;motors.forEach(m=>m.visible=!close);pulseRings.forEach(m=>m.visible=!close);grid.visible=!close;rings.visible=!close;floor.visible=!close;
  explodeAmount=THREE.MathUtils.lerp(explodeAmount,explodeTarget,1-Math.exp(-dt*4));for(const e of exploded){if(e.type==='chest')e.m.position.y=e.offset*explodeAmount;else e.m.position.z=e.offset*explodeAmount*.55;const xray=current==='compute'&&e.type==='chest'&&/Front_Cover|Visor|US_Ring|JSN_probe|Window/.test(e.m.userData.part);const clear=/Window|Light_Pipe/.test(e.m.userData.part);e.m.material.transparent=xray||clear;e.m.material.opacity=xray?.12:clear?.65:1;e.m.material.depthWrite=!xray;}
  trace.visible=current==='compute';traceDots.forEach((p,i)=>p.dot.position.copy(p.curve.getPoint((tm+i*.3)%1)));processor.material.emissive.setHex(COLORS[d.code]||COLORS['—']);processor.material.emissiveIntensity=current==='compute'?.35+.25*Math.sin(tm*6):0;
  pcb.position.z=-.024+explodeAmount*.035;battery.position.z=-.018-explodeAmount*.045;
  const hand=V(0,c.handHeight,c.handX),end=V(-g.reach*Math.sin(yaw),.02,c.handX+g.reach*Math.cos(yaw));
  const delta=end.clone().sub(hand);caneRod.position.copy(hand).add(end).multiplyScalar(.5);caneRod.quaternion.setFromUnitVectors(V(0,1,0),delta.clone().normalize());caneRod.scale.y=delta.length()/1.26;
  caneBand.position.copy(end).lerp(hand,.13);caneBand.quaternion.copy(caneRod.quaternion);tip.position.copy(end);
  clip.position.copy(hand);clip.quaternion.setFromUnitVectors(V(1,0,0),delta.clone().normalize());
  const amplitude=Math.asin(Math.min(.95,c.arc/g.reach)),bias=c.bias*Math.PI/180,arr=sectorGeo.attributes.position.array,arcArr=arcGeo.attributes.position.array;
  for(let i=0;i<40;i++){const a=bias-amplitude+2*amplitude*i/40,b=bias-amplitude+2*amplitude*(i+1)/40;arr.set([0,.006,c.handX,-g.reach*Math.sin(a),.006,c.handX+g.reach*Math.cos(a),-g.reach*Math.sin(b),.006,c.handX+g.reach*Math.cos(b)],i*9);}
  for(let i=0;i<=40;i++){const a=bias-amplitude+2*amplitude*i/40;arcArr.set([-g.reach*Math.sin(a),.009,c.handX+g.reach*Math.cos(a)],i*3);}sectorGeo.attributes.position.needsUpdate=true;arcGeo.attributes.position.needsUpdate=true;
  sector.visible=arc.visible=!close;tip.visible=!close;
  setWorld(engine.world||[]);hazards.children.forEach((m,i)=>{const h=engine.world[i];m.position.x=-h.y;m.position.z=h.x+h.depth/2;});hazards.visible=!close&&c.showTruth;
  const color=COLORS[d.code]||COLORS['—'];floorMat.color.setHex(color);arc.material.color.setHex(color);
  const m=engine.motors();motors.forEach((o,i)=>{const a=i===0?m.L:m.R;o.material.emissive.setHex(color);o.material.emissiveIntensity=.1+a*3;pulseRings[i].material.color.setHex(color);pulseRings[i].material.opacity=a*.8;pulseRings[i].scale.setScalar(1+a*.8);});
  const measured=engine.frame?.cells||[];
  for(let i=0;i<64;i++){const cell=measured[i];cells[i].visible=!!cell&&!close&&c.showObserved;
   if(!cell){beamPositions.fill(0,i*6,i*6+6);continue;}const p=cell.point||cell.rayEnd||[.18,0,1.28],o=cell.origin;
   cells[i].position.set(-p[1],Math.max(.01,p[2]),p[0]);cells[i].material.color.setHex(i===engine.selectedCell?0xffffff:cell.status!==5?0x927abb:p[2]>.075?0xf0b272:p[2]<-.075?0xb09ae0:0xb5cf8d);cells[i].material.opacity=cell.status===5?.7:.16;
   beamPositions.set([-o[1],o[2],o[0],-p[1],p[2],p[0]],i*6);
  }
  beamGeo.attributes.position.needsUpdate=true;beams.visible=!close&&c.showObserved;beams.material.opacity=current==='sensor'?.25:.08;
  const sensed=[...(engine.hazards||[]),...(engine.echoHazards||[])];observedBoxes.forEach((m,i)=>{const h=sensed[i];m.visible=!!h&&!close&&c.showObserved;if(h){m.position.set(-h.y,Math.max(.05,(h.zHigh+h.zLow)/2),h.x+h.depth/2);m.scale.set(h.width,Math.max(.1,h.zHigh-h.zLow),h.depth);m.material.color.setHex(h.kind==='drop'?0xbba6eb:0xf8bc73);}});
  const prediction=engine.prediction();forecast.visible=bodyForecast.visible=!!c.predict&&!close;ghosts.forEach(m=>m.visible=!!c.predict&&!close);
  prediction.points.forEach((p,i)=>futurePositions.set([-p.y,.035,p.x],i*3));forecast.geometry.attributes.position.needsUpdate=true;
  ghosts.forEach((m,i)=>{const t=i+1;m.position.set(0,.018,c.speed*t);m.scale.set(1+prediction.uncertainty*4,1,1);});
  uncertaintyRing.visible=!!c.predict&&!close;uncertaintyRing.position.set(-prediction.points[10].y,.025,prediction.points[10].x);uncertaintyRing.scale.setScalar(Math.max(.035,prediction.uncertainty));
  paths.forEach((p,i)=>{p.line.visible=p.dot.visible=!close;let alive=i===0?!c.lost:i===3?c.phone:i===1?m.L>0:m.R>0;p.dot.visible=!close&&alive;p.line.material.opacity=alive?.45:.1;p.dot.position.copy(p.curve.getPoint((tm*(i===0?1.3:1)+i*.2)%1));});phone.visible=c.phone&&!close;
  caneForecastLabel.active=!!c.predict&&d.tCane!==null&&!!engine.hazard;bodyForecastLabel.active=!!c.predict&&d.tBody!==null;
  if(caneForecastLabel.active){caneForecastLabel.point.set(-engine.hazard.y,.08,engine.hazard.x);caneForecastLabel.el.querySelector('small').textContent=d.tCane.toFixed(2)+' s · điểm từ quan sát';}
  if(bodyForecastLabel.active){bodyForecastLabel.point.set(0,.09,c.speed*d.tBody+.15);bodyForecastLabel.el.querySelector('small').textContent=d.tBody.toFixed(2)+' s · TTC mô hình';}
  const rect=container.getBoundingClientRect();for(const l of labels){const p=l.point.clone().project(camera);const show=l.active!==false&&l.views.includes(current)&&p.z<1&&p.z>-1&&p.x>-.95&&p.x<.8&&p.y>-.8&&p.y<.85;l.el.hidden=!show;l.el.style.display=show?'flex':'none';if(show){l.el.style.left=((p.x*.5+.5)*rect.width)+'px';l.el.style.top=((-p.y*.5+.5)*rect.height)+'px';}}
  renderer.render(scene,camera);
 }
 return{render,focus,toggleExplode(){manualExplode=!manualExplode;explodeTarget=manualExplode?1:0;return manualExplode;},getView:()=>current,renderer,scene};
}
