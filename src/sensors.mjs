// Geometric sensor approximation in body coordinates: x forward, y left, z up.
// Sensor assumptions are configurable simulation parameters, not calibrated hardware.
export const RAD=Math.PI/180;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function random(seed=42){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
export function rayBox(origin,dir,min,max){
 let near=0,far=Infinity;
 for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-10){if(origin[i]<min[i]||origin[i]>max[i])return null;continue;}let a=(min[i]-origin[i])/dir[i],b=(max[i]-origin[i])/dir[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}
 return far>0?near:null;
}
export function direction(pitch,yaw){return [Math.cos(pitch)*Math.cos(yaw),Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch)];}
export const pointAt=(o,d,t)=>o.map((v,i)=>v+d[i]*t);
export function cast(origin,dir,world,maxRange=4){
 let distance=maxRange,hit=null;
 for(const o of world){
  if(['drop','water','unknown'].includes(o.kind))continue;
  const low=o.kind==='upper'?o.height:0,high=o.kind==='upper'?o.height+.1:o.height;
  const t=rayBox(origin,dir,[o.x,o.y-o.width/2,low],[o.x+o.depth,o.y+o.width/2,high]);
  if(t!==null&&t<distance){distance=t;hit={kind:'solid',point:pointAt(origin,dir,t)};}
 }
 if(dir[2]<-.001){
  const t=-origin[2]/dir[2],p=pointAt(origin,dir,t);
  const patch=world.find(o=>['drop','water'].includes(o.kind)&&p[0]>=o.x&&p[0]<=o.x+o.depth&&Math.abs(p[1]-o.y)<=o.width/2);
  if(patch?.kind==='drop'){
   const lower=(patch.height-origin[2])/dir[2],lp=pointAt(origin,dir,lower);
   if(lower<distance&&lower>0&&lp[0]>=patch.x&&lp[0]<=patch.x+patch.depth&&Math.abs(lp[1]-patch.y)<=patch.width/2){distance=lower;hit={kind:'floor',point:lp};}
  }else if(t>0&&t<distance){distance=t;hit={kind:patch?.kind==='water'?'water':'floor',point:p};}
 }
 return {distance,hit};
}
export function tofFrame(world,config,t,rand){
 const n=config.resolution,origin=[.18,0,1.28],cells=[];
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const pitch=(-35+(row+.5-n/2)*45/n+config.pitch)*RAD,yaw=(col+.5-n/2)*45/n*RAD,dir=direction(pitch,yaw);
  const truth=cast(origin,dir,world,config.range),sigma=config.noise/1000;
  const invalid=!truth.hit||truth.hit.kind==='water'||config.blind||rand()<config.dropout;
  const range=invalid?null:Math.max(.05,truth.distance+(rand()+rand()+rand()-1.5)*sigma*2);
  // Measured point uses the estimated mounting pitch (bias is an error in compensation).
  const estimated=direction(pitch+config.tiltError*RAD,yaw);
  cells.push({row,col,status:invalid?0:5,range,sigma:sigma*1000,origin,dir:estimated,
   point:range===null?null:pointAt(origin,estimated,range),rayEnd:truth.hit?.point||pointAt(origin,dir,config.range)});
 }
 return {t,rows:n,cols:n,origin,cells,valid:cells.filter(c=>c.status===5).length};
}
export function ultrasound(world,config,t,rand){
 return [-15,15].map((heading,index)=>{
  const origin=[.18,index===0?-.055:.055,1.30];let best=null;
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
   const dir=direction((15+a*9+config.pitch)*RAD,(heading+b*8)*RAD);
   for(const o of world){if(['drop','water','unknown'].includes(o.kind))continue;
    const low=o.kind==='upper'?o.height:0,top=o.kind==='upper'?o.height+.1:o.height;
    const range=rayBox(origin,dir,[o.x,o.y-o.width/2,low],[o.x+o.depth,o.y+o.width/2,top]);
    if(range!==null&&range>.2&&range<config.range&&(!best||range<best.range))best={range,dir,point:pointAt(origin,dir,range)};
   }
  }
  if(!best)return {t,channel:index,valid:false,range:null,origin};
  const range=Math.max(.2,best.range+(rand()-.5)*config.noise/500);
  // Echo has only distance + channel; never expose the true object type or hit position to perception.
  return {t,channel:index,valid:true,range,origin,heading:heading*RAD,pitch:15*RAD};
 });
}
export function detectToF(frame){
 if(!frame)return [];
 const n=frame.cols,groups=[],used=new Set(),eligible=c=>c.status===5&&c.sigma<=60&&c.point&&Math.abs(c.point[2])>.075;
 for(let start=0;start<frame.cells.length;start++){
  if(used.has(start)||!eligible(frame.cells[start]))continue;
  const sign=Math.sign(frame.cells[start].point[2]),queue=[start],list=[];used.add(start);
  while(queue.length){const idx=queue.pop(),c=frame.cells[idx];list.push(c);for(const j of [idx-n,idx+n,...(idx%n>0?[idx-1]:[]),...(idx%n<n-1?[idx+1]:[])]){const v=frame.cells[j];if(v&&!used.has(j)&&eligible(v)&&Math.sign(v.point[2])===sign){used.add(j);queue.push(j);}}}
  if(list.length<2)continue;
  const xs=list.map(c=>c.point[0]),ys=list.map(c=>c.point[1]),zs=list.map(c=>c.point[2]),x=Math.min(...xs);
  const lateralCell=Math.max(.05,x*Math.tan(45*RAD/n));
  // Downward hazards need at least two measured low zones AND adjacent valid upper-ground evidence.
  const pairs=sign<0?list.filter(c=>{const i=c.row*n+c.col;return [i-n,i+n,i-1,i+1].some(j=>frame.cells[j]?.point&&frame.cells[j].status===5&&Math.abs(frame.cells[j].point[2])<.05);}).length:0;
  if(sign<0&&pairs<2)continue;
  groups.push({x,y:(Math.min(...ys)+Math.max(...ys))/2,width:Math.max(lateralCell,Math.max(...ys)-Math.min(...ys)+lateralCell),
   depth:Math.max(.1,Math.max(...xs)-x),kind:sign<0?'drop':'grounded',zLow:Math.min(...zs),zHigh:Math.max(...zs),
   confidence:clamp(.65+list.length*.025,0,.97),uncertainty:lateralCell/2,source:'ToF · cụm tia đo',evidence:list.map(c=>c.row*n+c.col),pairs});
 }
 return groups;
}
export function detectEcho(echo){
 return (echo||[]).filter(e=>e.valid).map(e=>({x:e.origin[0]+e.range*Math.cos(e.pitch)*Math.cos(e.heading),
  y:e.origin[1]+e.range*Math.cos(e.pitch)*Math.sin(e.heading),width:.55,depth:.1,kind:'upper',zLow:.75,zHigh:1.9,
  confidence:.8,uncertainty:.25,source:'Siêu âm · vùng thân trên',evidence:[e.channel]}));
}
