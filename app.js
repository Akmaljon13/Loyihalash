const ISO_X=0.866,ISO_Y=0.5,WALL_H_BASE=36,UNIT_BASE=52;
let UNIT=UNIT_BASE,WALL_H=WALL_H_BASE;
let allFloors=[],rooms=[],currentFloorIdx=0;
let selected=null,hovered=null,viewMode='2.5d',isPremium=false;
let panX=0,panY=0,scale=1;
let isPanning=false,lastTouch={x:0,y:0},lastPinchDist=0,touchStartPos={x:0,y:0};
const dpr=Math.min(devicePixelRatio||1,2);
const cv=document.getElementById('cv');
const ctx=cv.getContext('2d');

// ---- SCREENS ----
function showScreen(id){
  ['screen-loading','screen-error','viewer'].forEach(s=>{
    document.getElementById(s).style.display=s===id?(s==='viewer'?'flex':'flex'):'none';
  });
}
function showError(t,m,d=''){
  document.getElementById('err-title').textContent=t;
  document.getElementById('err-msg').textContent=m;
  const det=document.getElementById('err-detail');
  if(d){det.textContent=d;det.style.display='block';}else det.style.display='none';
  showScreen('screen-error');
}

// ---- INIT ----
async function init(){
  const id=new URLSearchParams(location.search).get('id');
  if(!id){showError("ID ko'rsatilmagan","URL misoli:","sayt.vercel.app/?id=abdullayev-047");return;}
  document.getElementById('loading-msg').textContent='manifest.json yuklanmoqda...';
  let project=null;
  try{
    const res=await fetch('/manifest.json');
    if(!res.ok)throw new Error('HTTP '+res.status);
    const manifest=await res.json();
    project=manifest[id];
    if(!project){showError('"'+id+'" topilmadi','Mavjud loyihalar:',Object.keys(manifest).join('\n'));return;}
  }catch(e){showError('manifest.json yuklanmadi','','Xato: '+e.message);return;}

  applyBrand(project);
  isPremium=project.premium||false;
  document.getElementById('loading-msg').textContent='"'+project.name+'" yuklanmoqda...';

  try{
    let data=null;
    try{
      const res=await fetch(project.url);
      if(res.status===401||res.status===403)throw new Error('PERM');
      if(!res.ok)throw new Error('HTTP '+res.status);
      data=await res.json();
    }catch(e){
      const p='https://api.allorigins.win/raw?url='+encodeURIComponent(project.url);
      const r2=await fetch(p);
      if(!r2.ok)throw new Error('CORS');
      data=await r2.json();
    }
    renderProject(data,project);
  }catch(e){
    showError("Yuklab bo'lmadi","Firebase Rules:\nallow read: if true;",'Xato: '+e.message);
  }
}

// ---- BRAND ----
function applyBrand(p){
  const b=p.brand||{};
  if(b.color)document.documentElement.style.setProperty('--accent',b.color);
  if(b.company)document.getElementById('brand-name').textContent=b.company.toUpperCase();
}

// ---- RENDER PROJECT ----
function renderProject(data,project){
  window._currentProject = project; // xarita uchun saqlanadi
  allFloors=data.floors&&data.floors.length>0
    ?data.floors:[{id:'f1',label:'Reja',rooms:data.rooms||[]}];
  document.getElementById('proj-name').textContent=data.name||project.name||'—';
  document.getElementById('owner-name').textContent=project.owner||'—';
  document.getElementById('s-area').textContent=data.totalArea||'—';
  const total=allFloors.reduce((s,f)=>s+(f.rooms||[]).length,0);
  document.getElementById('s-rooms').textContent=total;
  buildFloorTabs();
  if(isPremium)document.getElementById('vtoggle').style.display='flex';
  switchFloor(0);
  showScreen('viewer');
  setTimeout(()=>{resizeCanvas();fitToScreen();},80);
}

// ---- FLOORS ----
function buildFloorTabs(){
  const tabs=document.getElementById('floor-tabs');
  tabs.innerHTML='';
  if(allFloors.length<=1){tabs.style.display='none';return;}
  allFloors.forEach((f,i)=>{
    const btn=document.createElement('button');
    btn.className='ftab'+(i===0?' active':'');
    btn.textContent=f.label||('Qavat '+(i+1));
    btn.onclick=()=>switchFloor(i);
    tabs.appendChild(btn);
  });
}
function switchFloor(idx){
  currentFloorIdx=idx;rooms=allFloors[idx].rooms||[];
  selected=null;hovered=null;
  document.querySelectorAll('.ftab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  closeDrawer();buildRoomStrip();fitToScreen();draw();
}

// ---- VIEW ----
function setView(mode){
  viewMode=mode;
  document.getElementById('btn-25d').classList.toggle('active',mode==='2.5d');
  document.getElementById('btn-2d').classList.toggle('active',mode==='2d');
  fitToScreen();draw();
}

// ---- ROOM STRIP ----
function buildRoomStrip(){
  const strip=document.getElementById('room-strip');
  strip.innerHTML='';
  rooms.forEach(r=>{
    const el=document.createElement('div');
    el.className='rchip';el.id='chip-'+r.id;
    el.innerHTML=`<div class="rchip-dot" style="background:${r.color}"></div>
      <div class="rchip-name">${r.name}</div>
      <div class="rchip-area">${r.area}</div>`;
    el.onclick=()=>selectRoom(r.id);
    strip.appendChild(el);
  });
}

// ---- DRAWER ----
function openDrawer(r){
  const imgEl=document.getElementById('drawer-img');
  const placeholder=document.getElementById('drawer-img-placeholder');
  const badge=document.getElementById('drawer-img-badge');
  const wrap=document.getElementById('drawer-img-wrap');
  if(r.render){
    imgEl.src=r.render;
    imgEl.classList.add('loading');
    imgEl.style.display='block';
    placeholder.style.display='none';
    badge.style.display='block';
    wrap.style.height='200px';
  } else {
    imgEl.style.display='none';
    placeholder.style.display='flex';
    badge.style.display='none';
    wrap.style.height='80px';
  }
  document.getElementById('dw-accent').style.background=r.color;
  document.getElementById('dw-area').style.color=r.color;
  document.getElementById('dw-name').textContent=r.name;
  document.getElementById('dw-type').textContent=r.type;
  document.getElementById('dw-area').textContent=r.area;
  document.getElementById('dw-size').textContent=r.size;
  document.getElementById('dw-win').textContent=r.windows;
  document.getElementById('dw-door').textContent=r.doors;
  document.getElementById('dw-desc').textContent=r.desc||'';
  const feats=document.getElementById('dw-features');
  feats.innerHTML='';
  if(r.features&&r.features.length){
    r.features.forEach(f=>{
      feats.innerHTML+=`<div class="dw-feat"><span class="dw-feat-icon">${f.icon||'•'}</span><span class="dw-feat-txt">${f.text}</span></div>`;
    });
  } else {
    [{icon:'☀️',txt:r.windows+' deraza'},{icon:'🚪',txt:r.doors+' eshik'}].forEach(f=>{
      feats.innerHTML+=`<div class="dw-feat"><span class="dw-feat-icon">${f.icon}</span><span class="dw-feat-txt">${f.txt}</span></div>`;
    });
  }
  document.getElementById('drawer').classList.add('show');
  document.getElementById('overlay').classList.add('show');

  // XARITA — loyihada location bo'lsa ko'rsatiladi
  const mapWrap = document.getElementById('dw-map-wrap');
  const loc = window._currentProject?.location;
  if(loc && loc.lat && loc.lng){
    mapWrap.style.display = 'block';
    // Leaflet bir marta yuklanadi
    if(!window._leafletLoaded){
      window._leafletLoaded = true;
      const link = document.createElement('link');
      link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload=()=>initMap(loc);
      document.head.appendChild(script);
    } else if(window.L){
      initMap(loc);
    }
  } else {
    mapWrap.style.display = 'none';
  }

function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

function selectRoom(id){
  selected=id;
  document.querySelectorAll('.rchip').forEach(el=>el.classList.remove('active'));
  document.getElementById('chip-'+id)?.classList.add('active');
  document.getElementById('chip-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  const r=rooms.find(x=>x.id===id);
  if(r)openDrawer(r);
  draw();
}

// ================================================================
// DRAW
// ================================================================
function wh(){return WALL_H*scale;}
function toIso(gx,gy){return{x:panX+(gx-gy)*UNIT*scale*ISO_X,y:panY+(gx+gy)*UNIT*scale*ISO_Y};}
function toFlat(gx,gy){return{x:panX+gx*UNIT*scale,y:panY+gy*UNIT*scale};}

function draw(){
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#0a0a0b';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.strokeStyle='rgba(255,255,255,0.018)';ctx.lineWidth=.5;
  for(let i=0;i<=14;i++){
    const a=viewMode==='2d'?toFlat(i,0):toIso(i,0);
    const b=viewMode==='2d'?toFlat(i,12):toIso(i,12);
    const off=viewMode==='2d'?0:wh();
    ctx.beginPath();ctx.moveTo(a.x,a.y+off);ctx.lineTo(b.x,b.y+off);ctx.stroke();
  }
  for(let j=0;j<=12;j++){
    const a=viewMode==='2d'?toFlat(0,j):toIso(0,j);
    const b=viewMode==='2d'?toFlat(14,j):toIso(14,j);
    const off=viewMode==='2d'?0:wh();
    ctx.beginPath();ctx.moveTo(a.x,a.y+off);ctx.lineTo(b.x,b.y+off);ctx.stroke();
  }
  [...rooms].sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy)).forEach(r=>{
    if(viewMode==='2d')draw2D(r,r.id===hovered,r.id===selected);
    else draw25D(r,r.id===hovered,r.id===selected);
  });
}

function draw25D(r,isHov,isSel){
  const{gx,gy,gw,gh}=r;
  const lift=(isSel?8:isHov?4:0)*scale;
  const al=isSel?'ff':isHov?'ee':'cc';
  const p00=toIso(gx,gy),p10=toIso(gx+gw,gy),p11=toIso(gx+gw,gy+gh),p01=toIso(gx,gy+gh);
  const poly=(pts,fill,stroke,lw)=>{
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}
  };
  const L=p=>({x:p.x,y:p.y-lift});
  const T=p=>({x:p.x,y:p.y-lift-wh()});
  const sc=isSel?r.color+'cc':null;
  poly([L(p00),L(p10),L(p11),L(p01)],r.floor+al,sc,1.2);
  poly([L(p01),L(p11),{x:p11.x,y:p11.y-lift+wh()},{x:p01.x,y:p01.y-lift+wh()}],r.wallLeft+al,sc,.8);
  poly([L(p10),L(p11),{x:p11.x,y:p11.y-lift+wh()},{x:p10.x,y:p10.y-lift+wh()}],r.wallRight+al,sc,.8);
  poly([T(p00),T(p10),T(p11),T(p01)],r.wallTop+al,sc,.8);
  [p00,p10,p11,p01].forEach(p=>{
    ctx.beginPath();ctx.moveTo(p.x,p.y-lift-wh());ctx.lineTo(p.x,p.y-lift);
    ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=.6*scale;ctx.stroke();
  });
  const w1=toIso(gx+gw*.15,gy),w2=toIso(gx+gw*.85,gy);
  ctx.beginPath();
  ctx.moveTo(w1.x,w1.y-lift-wh()*.15);ctx.lineTo(w1.x,w1.y-lift-wh()*.85);
  ctx.lineTo(w2.x,w2.y-lift-wh()*.85);ctx.lineTo(w2.x,w2.y-lift-wh()*.15);
  ctx.strokeStyle='rgba(86,180,211,0.5)';ctx.lineWidth=1.5*scale;ctx.stroke();
  ctx.fillStyle='rgba(86,180,211,0.08)';ctx.fill();
  const cx=(p00.x+p10.x+p11.x+p01.x)/4;
  const cy=(p00.y+p10.y+p11.y+p01.y)/4-lift;
  const fs=Math.max(7,Math.min(12,UNIT*scale*.16));
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${fs}px Syne,sans-serif`;
  ctx.fillStyle=isSel?'#fff':'rgba(255,255,255,0.82)';ctx.fillText(r.name,cx,cy-fs*.65);
  ctx.font=`300 ${fs*.82}px Outfit,sans-serif`;
  ctx.fillStyle=isSel?r.color:'rgba(255,255,255,0.38)';ctx.fillText(r.area,cx,cy+fs*.72);
  ctx.restore();
}

function draw2D(r,isHov,isSel){
  const{gx,gy,gw,gh}=r;
  const p00=toFlat(gx,gy),p10=toFlat(gx+gw,gy),p11=toFlat(gx+gw,gy+gh),p01=toFlat(gx,gy+gh);
  const al=isSel?.2:isHov?.12:.06;
  ctx.beginPath();[p00,p10,p11,p01].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.fillStyle=r.color+(Math.round(al*255).toString(16).padStart(2,'0'));ctx.fill();
  ctx.strokeStyle=isSel?r.color:r.color+'55';ctx.lineWidth=isSel?2*scale:scale;ctx.stroke();
  ctx.strokeStyle='rgba(240,237,230,0.6)';ctx.lineWidth=3*scale;
  [[p00,p10],[p10,p11],[p11,p01],[p01,p00]].forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
  const wx=UNIT*scale*gw*.22;
  ctx.strokeStyle='rgba(86,180,211,0.85)';ctx.lineWidth=3*scale;
  ctx.beginPath();ctx.moveTo(p00.x+wx,p00.y);ctx.lineTo(p10.x-wx,p10.y);ctx.stroke();
  const dw=UNIT*scale*.8;
  ctx.beginPath();ctx.moveTo(p01.x,p01.y);ctx.lineTo(p01.x,p01.y-dw);
  ctx.strokeStyle='rgba(200,160,80,0.7)';ctx.lineWidth=1.5*scale;ctx.stroke();
  ctx.beginPath();ctx.arc(p01.x,p01.y,dw,Math.PI*1.5,Math.PI*2);
  ctx.setLineDash([3*scale,2*scale]);ctx.stroke();ctx.setLineDash([]);
  const cx=(p00.x+p11.x)/2,cy=(p00.y+p11.y)/2;
  const fs=Math.max(7,Math.min(12,UNIT*scale*.16));
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${fs}px Syne,sans-serif`;
  ctx.fillStyle=isSel?'#fff':'rgba(255,255,255,0.82)';ctx.fillText(r.name,cx,cy-fs*.65);
  ctx.font=`300 ${fs*.82}px Outfit,sans-serif`;
  ctx.fillStyle=isSel?r.color:'rgba(255,255,255,0.38)';ctx.fillText(r.area,cx,cy+fs*.72);
  ctx.restore();
  if(r.furniture)r.furniture.forEach(f=>drawFurniture(f,r.color));
}

function drawFurniture(f,rc){
  const u=UNIT*scale;
  const x=panX+f.x*u,y=panY+f.y*u,fw=f.w*u,fh=f.h*u;
  ctx.save();ctx.strokeStyle=rc+'88';ctx.fillStyle=rc+'1a';ctx.lineWidth=scale;
  if(f.type==='bed'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,3*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'33';ctx.beginPath();ctx.roundRect(x,y,fw,fh*.18,2*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'2a';
    ctx.beginPath();ctx.roundRect(x+fw*.08,y+fh*.06,fw*.38,fh*.28,2*scale);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.roundRect(x+fw*.54,y+fh*.06,fw*.38,fh*.28,2*scale);ctx.fill();ctx.stroke();
  } else if(f.type==='sofa'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,3*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'33';ctx.beginPath();ctx.roundRect(x,y,fw,fh*.28,2*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'22';
    const sw=fw/3;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.roundRect(x+i*sw+scale,y+fh*.32,sw-2*scale,fh*.65,2*scale);ctx.fill();}
  } else if(f.type==='table'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,2*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'44';const leg=2.5*scale;
    [[x+leg,y+leg],[x+fw-leg*2,y+leg],[x+leg,y+fh-leg*2],[x+fw-leg*2,y+fh-leg*2]].forEach(([lx,ly])=>{ctx.beginPath();ctx.roundRect(lx,ly,leg,leg,1);ctx.fill();});
  } else if(f.type==='chair'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,3*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle=rc+'33';ctx.beginPath();ctx.roundRect(x,y,fw,fh*.22,2*scale);ctx.fill();
  } else if(f.type==='wardrobe'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,2*scale);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+fw/2,y);ctx.lineTo(x+fw/2,y+fh);ctx.strokeStyle=rc+'55';ctx.lineWidth=scale;ctx.stroke();
    [[x+fw*.25,y+fh/2],[x+fw*.75,y+fh/2]].forEach(([hx,hy])=>{ctx.beginPath();ctx.arc(hx,hy,2*scale,0,Math.PI*2);ctx.fillStyle=rc+'88';ctx.fill();});
  } else if(f.type==='kitchen'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,2*scale);ctx.fill();ctx.stroke();
    const r2=fw*.11;
    [[.25,.3],[.65,.3],[.25,.7],[.65,.7]].forEach(([rx,ry])=>{ctx.beginPath();ctx.arc(x+fw*rx,y+fh*ry,r2,0,Math.PI*2);ctx.strokeStyle=rc+'66';ctx.lineWidth=scale;ctx.stroke();});
  } else if(f.type==='bathtub'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,5*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(86,180,211,0.15)';ctx.beginPath();ctx.ellipse(x+fw/2,y+fh/2,fw*.38,fh*.35,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(86,180,211,0.4)';ctx.stroke();
  } else if(f.type==='wc'){
    ctx.beginPath();ctx.ellipse(x+fw/2,y+fh*.6,fw*.42,fh*.38,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.roundRect(x+fw*.1,y,fw*.8,fh*.35,3*scale);ctx.fill();ctx.stroke();
  } else if(f.type==='sink'){
    ctx.beginPath();ctx.roundRect(x,y,fw,fh,3*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(86,180,211,0.18)';ctx.beginPath();ctx.ellipse(x+fw/2,y+fh/2,fw*.34,fh*.34,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=rc+'88';ctx.beginPath();ctx.arc(x+fw/2,y+fh/2,1.8*scale,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

// ---- FIT ----
function fitToScreen(){
  if(!rooms.length)return;
  const area=document.getElementById('canvas-area');
  const W=area.clientWidth,H=area.clientHeight;
  const maxGx=Math.max(...rooms.map(r=>r.gx+r.gw));
  const maxGy=Math.max(...rooms.map(r=>r.gy+r.gh));
  if(viewMode==='2d'){
    const sx=(W-32)/(maxGx*UNIT),sy=(H-32)/(maxGy*UNIT);
    scale=Math.min(sx,sy,1.8);
    panX=(W-maxGx*UNIT*scale)/2;panY=(H-maxGy*UNIT*scale)/2;
  } else {
    const isoW=(maxGx+maxGy)*UNIT*ISO_X;
    const isoH=(maxGx+maxGy)*UNIT*ISO_Y+WALL_H+20;
    const sx=(W-32)/isoW,sy=(H-50)/isoH;
    scale=Math.min(sx,sy,1.8);
    panX=W/2-(maxGy-maxGx)*UNIT*scale*ISO_X/2;
    panY=(H-isoH*scale)/2+8;
  }
  draw();
}

// ---- CANVAS ----
function resizeCanvas(){
  const area=document.getElementById('canvas-area');
  const W=area.clientWidth,H=area.clientHeight;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(1,0,0,1,0,0);ctx.scale(dpr,dpr);
}

// ---- HIT TEST ----
function getPos(e){const rect=cv.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-rect.left,y:t.clientY-rect.top};}
function hitTest(px,py){
  for(let i=rooms.length-1;i>=0;i--){
    const r=rooms[i];let pts;
    if(viewMode==='2d'){pts=[toFlat(r.gx,r.gy),toFlat(r.gx+r.gw,r.gy),toFlat(r.gx+r.gw,r.gy+r.gh),toFlat(r.gx,r.gy+r.gh)];}
    else{
      const lift=(r.id===selected?8:0)*scale;
      const fp=[toIso(r.gx,r.gy),toIso(r.gx+r.gw,r.gy),toIso(r.gx+r.gw,r.gy+r.gh),toIso(r.gx,r.gy+r.gh)];
      const tp=fp.map(p=>({x:p.x,y:p.y-lift-wh()}));
      if(polyHit(px,py,fp)||polyHit(px,py,tp))return r.id;continue;
    }
    if(polyHit(px,py,pts))return r.id;
  }
  return null;
}
function polyHit(px,py,pts){
  let inside=false;
  for(let a=0,b=pts.length-1;a<pts.length;b=a++){
    const xi=pts[a].x,yi=pts[a].y,xj=pts[b].x,yj=pts[b].y;
    if(((yi>py)!=(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}

// ---- TOUCH & MOUSE ----
const ca=document.getElementById('canvas-area');
ca.addEventListener('touchstart',e=>{
  e.preventDefault();
  if(e.touches.length===2){
    lastPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    isPanning=false;
    document.getElementById('zoom-hint').style.opacity='0';
  } else if(e.touches.length===1){
    isPanning=true;
    lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};
    touchStartPos={x:e.touches[0].clientX,y:e.touches[0].clientY};
  }
},{passive:false});

ca.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(e.touches.length===2){
    const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const delta=dist/lastPinchDist;
    const rect=ca.getBoundingClientRect();
    const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left;
    const my=(e.touches[0].clientY+e.touches[1].clientY)/2-rect.top;
    panX=(panX-mx)*delta+mx;panY=(panY-my)*delta+my;
    scale=Math.max(0.25,Math.min(5,scale*delta));
    lastPinchDist=dist;draw();
  } else if(e.touches.length===1&&isPanning){
    panX+=e.touches[0].clientX-lastTouch.x;
    panY+=e.touches[0].clientY-lastTouch.y;
    lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};draw();
  }
},{passive:false});

ca.addEventListener('touchend',e=>{
  if(e.changedTouches.length===1&&isPanning&&e.touches.length===0){
    const dx=Math.abs(e.changedTouches[0].clientX-touchStartPos.x);
    const dy=Math.abs(e.changedTouches[0].clientY-touchStartPos.y);
    if(dx<8&&dy<8){
      const rect=ca.getBoundingClientRect();
      const x=e.changedTouches[0].clientX-rect.left,y=e.changedTouches[0].clientY-rect.top;
      const h=hitTest(x,y);
      if(h)selectRoom(h);
      else{selected=null;document.querySelectorAll('.rchip').forEach(el=>el.classList.remove('active'));closeDrawer();draw();}
    }
  }
  isPanning=false;
},{passive:false});

cv.addEventListener('mousemove',e=>{const{x,y}=getPos(e);const h=hitTest(x,y);if(h!==hovered){hovered=h;draw();}cv.style.cursor=h?'pointer':'default';});
cv.addEventListener('mouseleave',()=>{hovered=null;draw();});
cv.addEventListener('click',e=>{const{x,y}=getPos(e);const h=hitTest(x,y);if(h)selectRoom(h);else{selected=null;document.querySelectorAll('.rchip').forEach(el=>el.classList.remove('active'));closeDrawer();draw();}});
ca.addEventListener('wheel',e=>{e.preventDefault();const rect=ca.getBoundingClientRect();const mx=e.clientX-rect.left,my=e.clientY-rect.top;const d=e.deltaY>0?.88:1.14;panX=(panX-mx)*d+mx;panY=(panY-my)*d+my;scale=Math.max(0.25,Math.min(5,scale*d));draw();},{passive:false});
window.addEventListener('resize',()=>{resizeCanvas();fitToScreen();});
init();

// ---- XARITA ----
function initMap(loc){
  const container = document.getElementById('dw-map-wrap');
  let mapDiv = document.getElementById('leaflet-map');
  if(mapDiv){
    mapDiv.remove();
    if(window._leafletMap){window._leafletMap.remove();window._leafletMap=null;}
  }
  mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map';
  mapDiv.style.cssText = 'width:100%;height:100%';
  container.appendChild(mapDiv);

  // Markaz — polygon bo'lsa o'rtasi, bo'lmasa lat/lng
  const center = loc.center
    ? [loc.center[0], loc.center[1]]
    : [loc.lat, loc.lng];

  const map = L.map('leaflet-map',{
    center: center,
    zoom: loc.zoom||18,
    zoomControl: true,
    attributionControl: false
  });
  window._leafletMap = map;

  // ArcGIS World Imagery
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19}
  ).addTo(map);

  // Ko'cha nomlari
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19, opacity:0.7}
  ).addTo(map);

  // Polygon — 4 burchak bor bo'lsa
  if(loc.polygon && loc.polygon.length >= 3){
    L.polygon(loc.polygon, {
      color: '#e8c97a',
      weight: 2.5,
      fillColor: '#e8c97a',
      fillOpacity: 0.18
    }).addTo(map);
  } else {
    // Oddiy marker
    const icon = L.divIcon({
      html:`<div style="width:14px;height:14px;background:#e8c97a;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
      iconSize:[14,14], iconAnchor:[7,7], className:''
    });
    L.marker(center, {icon}).addTo(map);
  }
}
