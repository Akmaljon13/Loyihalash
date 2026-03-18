let rooms=[], allFloors=[];
let selected=null;
let _map=null, _svgEl=null, _svgOverlay=null;
let _mapInited=false;

// ---- SCREENS ----
function showScreen(id){
  ['screen-loading','screen-error','viewer'].forEach(s=>{
    document.getElementById(s).style.display=s===id?(s==='viewer'?'flex':'flex'):'none';
  });
}
function showError(t,m,d){
  document.getElementById('err-title').textContent=t;
  document.getElementById('err-msg').textContent=m||'';
  const det=document.getElementById('err-detail');
  if(d){det.textContent=d;det.style.display='block';}else det.style.display='none';
  showScreen('screen-error');
}

// ---- SCREEN NAVIGATION ----
function openMap(){
  document.getElementById('screen-home').classList.add('hidden');
  document.getElementById('screen-map').classList.add('visible');
  closeDrawer();
  if(!_mapInited) initMap();
  else setTimeout(()=>{_map&&_map.invalidateSize();redrawOverlay();},100);
}

function closeMap(){
  document.getElementById('screen-map').classList.remove('visible');
  document.getElementById('screen-home').classList.remove('hidden');
  closeDrawer();
}

function open25D(){
  // Kelajakda 2.5D ekrani — hozir placeholder
  alert('2.5D reja — tez orada!');
}

// ---- BRAND ----
function applyBrand(p){
  const b=p.brand||{};
  if(b.color) document.documentElement.style.setProperty('--accent',b.color);
  if(b.company){
    document.getElementById('brand-name').textContent=b.company.toUpperCase();
    document.getElementById('home-company').textContent=b.company;
  }
}

// ---- RENDER PROJECT ----
function renderProject(data,project){
  window._currentProject=project;
  allFloors=data.floors&&data.floors.length>0
    ?data.floors:[{id:'f1',label:'Reja',rooms:data.rooms||[]}];
  rooms=allFloors[0].rooms||[];

  document.getElementById('proj-name').textContent=data.name||project.name||'—';
  document.getElementById('map-title').textContent=data.name||project.name||'Xarita';
  document.getElementById('owner-name').textContent=project.owner||'—';
  document.getElementById('home-address').textContent=project.address||'—';
  document.getElementById('h-area').textContent=data.totalArea||'—';
  document.getElementById('h-rooms').textContent=rooms.length;

  buildRoomStrips();
  showScreen('viewer');
}

// ---- ROOM STRIPS ----
function buildRoomStrips(){
  ['home-room-strip','map-room-strip'].forEach(id=>{
    const strip=document.getElementById(id);
    strip.innerHTML='';
    rooms.forEach(r=>{
      const el=document.createElement('div');
      el.className='rchip';
      el.id=id+'-chip-'+r.id;
      el.innerHTML=`<div class="rchip-dot" style="background:${r.color}"></div>
        <div class="rchip-name">${r.name}</div>
        <div class="rchip-area">${r.area}</div>`;
      el.onclick=()=>openDrawer(r);
      strip.appendChild(el);
    });
  });
}

// ---- DRAWER ----
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  selected=null;
  document.querySelectorAll('.rchip').forEach(el=>el.classList.remove('active'));
  redrawOverlay();
}

function openDrawer(r){
  selected=r.id;
  document.querySelectorAll('.rchip').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('#home-room-strip-chip-'+r.id+', #map-room-strip-chip-'+r.id).forEach(el=>{
    el&&el.classList.add('active');
    el&&el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  });

  const imgEl=document.getElementById('drawer-img');
  const placeholder=document.getElementById('drawer-img-placeholder');
  const badge=document.getElementById('drawer-img-badge');
  const wrap=document.getElementById('drawer-img-wrap');
  if(r.render){
    imgEl.src=r.render;imgEl.classList.add('loading');imgEl.style.display='block';
    placeholder.style.display='none';badge.style.display='block';wrap.style.height='200px';
  } else {
    imgEl.style.display='none';placeholder.style.display='flex';
    badge.style.display='none';wrap.style.height='80px';
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
  redrawOverlay();
}

// ---- MAP ----
function initMap(){
  _mapInited=true;
  const proj=window._currentProject;
  const loc=proj&&proj.location;
  if(!loc){return;}

  const center=loc.center?[loc.center[0],loc.center[1]]:[loc.lat,loc.lng];
  _map=L.map('leaflet-map',{
    center,zoom:loc.zoom||18,
    zoomControl:true,attributionControl:false
  });

  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19}
  ).addTo(_map);
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19,opacity:0.65}
  ).addTo(_map);

  if(loc.polygon&&loc.polygon.length>=3){
    createOverlay(loc);
  }
  _map.on('zoomend moveend',redrawOverlay);
  setTimeout(()=>{_map.invalidateSize();},300);
}

function createOverlay(loc){
  const poly=loc.polygon;
  const lats=poly.map(p=>p[0]), lngs=poly.map(p=>p[1]);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats);
  const minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
  const padLat=(maxLat-minLat)*0.4, padLng=(maxLng-minLng)*0.4;
  const bounds=[[minLat-padLat,minLng-padLng],[maxLat+padLat,maxLng+padLng]];
  window._overlayBounds=bounds;
  window._overlayPoly=poly;

  _svgEl=document.createElementNS('http://www.w3.org/2000/svg','svg');
  _svgEl.setAttribute('xmlns','http://www.w3.org/2000/svg');
  _svgOverlay=L.svgOverlay(_svgEl,bounds,{opacity:1,interactive:true}).addTo(_map);
  redrawOverlay();
}

function redrawOverlay(){
  if(!_svgEl||!_map||!window._overlayPoly||!rooms.length)return;
  const bounds=window._overlayBounds;
  const poly=window._overlayPoly;
  const tl=_map.latLngToLayerPoint([bounds[1][0],bounds[0][1]]);
  const br=_map.latLngToLayerPoint([bounds[0][0],bounds[1][1]]);
  const W=br.x-tl.x, H=br.y-tl.y;
  _svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  _svgEl.innerHTML='';

  const maxGx=Math.max(...rooms.map(r=>r.gx+r.gw));
  const maxGy=Math.max(...rooms.map(r=>r.gy+r.gh));

  function toSVG(lat,lng){
    const pt=_map.latLngToLayerPoint([lat,lng]);
    return{x:pt.x-tl.x, y:pt.y-tl.y};
  }
  function gridToGeo(gx,gy){
    const tx=gx/maxGx, ty=gy/maxGy;
    const p=poly;
    const tLat=p[0][0]+(p[3][0]-p[0][0])*tx;
    const tLng=p[0][1]+(p[3][1]-p[0][1])*tx;
    const bLat=p[1][0]+(p[2][0]-p[1][0])*tx;
    const bLng=p[1][1]+(p[2][1]-p[1][1])*tx;
    return[tLat+(bLat-tLat)*ty, tLng+(bLng-tLng)*ty];
  }

  rooms.forEach(r=>{
    const isSel=r.id===selected;
    const corners=[
      gridToGeo(r.gx,r.gy),
      gridToGeo(r.gx+r.gw,r.gy),
      gridToGeo(r.gx+r.gw,r.gy+r.gh),
      gridToGeo(r.gx,r.gy+r.gh)
    ];
    const pts=corners.map(([lat,lng])=>toSVG(lat,lng));
    const ptStr=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const pg=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    pg.setAttribute('points',ptStr);
    pg.setAttribute('fill', isSel?r.color+'cc':r.color+'55');
    pg.setAttribute('stroke',r.color);
    pg.setAttribute('stroke-width',isSel?'2.5':'1.5');
    pg.style.cursor='pointer';
    pg.addEventListener('click',()=>openDrawer(r));
    pg.addEventListener('touchstart',e=>{e.preventDefault();openDrawer(r);},{passive:false});
    _svgEl.appendChild(pg);

    const cx=pts.reduce((s,p)=>s+p.x,0)/4;
    const cy=pts.reduce((s,p)=>s+p.y,0)/4;
    const fs=Math.max(9,Math.min(15,Math.abs(pts[1].x-pts[0].x)*0.18));

    const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',cx.toFixed(1));
    txt.setAttribute('y',(cy-fs*0.4).toFixed(1));
    txt.setAttribute('text-anchor','middle');
    txt.setAttribute('dominant-baseline','middle');
    txt.setAttribute('font-size',fs.toFixed(1));
    txt.setAttribute('font-weight','600');
    txt.setAttribute('fill','white');
    txt.setAttribute('font-family','Syne,sans-serif');
    txt.setAttribute('pointer-events','none');
    txt.textContent=r.name;
    _svgEl.appendChild(txt);

    const atxt=document.createElementNS('http://www.w3.org/2000/svg','text');
    atxt.setAttribute('x',cx.toFixed(1));
    atxt.setAttribute('y',(cy+fs*0.85).toFixed(1));
    atxt.setAttribute('text-anchor','middle');
    atxt.setAttribute('dominant-baseline','middle');
    atxt.setAttribute('font-size',(fs*0.75).toFixed(1));
    atxt.setAttribute('fill','rgba(255,255,255,0.7)');
    atxt.setAttribute('font-family','Outfit,sans-serif');
    atxt.setAttribute('pointer-events','none');
    atxt.textContent=r.area;
    _svgEl.appendChild(atxt);
  });
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
    if(!project){showError('"'+id+'" topilmadi','Mavjud:',Object.keys(manifest).join('\n'));return;}
  }catch(e){showError('manifest.json yuklanmadi','',e.message);return;}

  applyBrand(project);
  document.getElementById('loading-msg').textContent='"'+project.name+'" yuklanmoqda...';

  let data=null;
  try{
    const res=await fetch(project.url);
    if(!res.ok)throw new Error('HTTP '+res.status);
    data=await res.json();
  }catch(e){
    try{
      const r2=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(project.url));
      if(!r2.ok)throw new Error('proxy');
      data=await r2.json();
    }catch(e2){
      showError("Yuklab bo'lmadi","Firebase Rules:\nallow read: if true;",e.message);
      return;
    }
  }
  renderProject(data,project);
}

init();
