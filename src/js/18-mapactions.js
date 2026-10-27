/* ---------- tap the map to add, swap or sleep; place info boxes; passes worth the detour ---------- */
const callLink=t=>t&&t.phone?`<a href="tel:${esc(String(t.phone).replace(/[^\d+]/g,""))}" title="${esc(t.phone)}">Call</a>`:"";
const PINFO={}; let pinfoN=0;
function infoBtn(x,ctx){ const key="p"+(++pinfoN); PINFO[key]={x,ctx}; if(pinfoN>4000){ for(const k in PINFO) if(+k.slice(1)<pinfoN-2000) delete PINFO[k]; } return `<button class="linkbtn" type="button" data-pinfo="${key}">Info</button>`; }
const KIND_NAME={fuel:"Fuel station",food:"Food",shop:"Shop",toilets:"Toilets",cash:"Cash machine",repair:"Tyres and repair",sight:"Sight",view:"Viewpoint",pass:"Pass",camp:"Camping",sleep:"Place to stay"};
let pinfoMap=null, pinfoMk=null;
function openInfo(key){
  const it=PINFO[key]; if(!it) return; const {x,ctx}=it, t=x.tags||{};
  const kind=(t.tourism&&x.kind==="sleep")?t.tourism.replace(/_/g," "):(KIND_NAME[x.kind]||"Place");
  const web=t.website?(/^https?:/.test(t.website)?t.website:"https://"+t.website):"", g=x.kind==="fuel"?gradesTxt(t):"";
  const rows=[t.phone?["Phone",`<a href="tel:${esc(String(t.phone).replace(/[^\d+]/g,""))}">${esc(t.phone)}</a>`]:null, web?["Website",`<a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,""))}</a>`]:null,
    t.email?["Email",`<a href="mailto:${esc(t.email)}">${esc(t.email)}</a>`]:null, t.hours?["Hours",esc(t.hours)]:null, g?["Fuel",esc(g)]:null].filter(Boolean);
  const am=ctx.act&&ctx.act.match(/(data-[a-z0-9]+)="([^"]*)"/), lab=ctx.act&&(ctx.act.match(/>([^<]+)<\/button>/)||[])[1];
  $("piBody").innerHTML=`<h2 style="margin:0">${esc(x.name||kind)}</h2><div class="note">${esc(kind)}${ctx.dist?" · "+esc(ctx.dist):""}</div>
    ${rows.length?`<table class="pitable">${rows.map(([a,b])=>`<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</table>`:`<p class="note">The map has no phone, website or hours for this place. Ask locally, or check its sign when you get there.</p>`}
    <div id="pinfoMap" class="pimap"></div>
    <div class="btns">${am?`<button class="btn small" type="button" data-proxy="${am[1]}" data-pv="${esc(am[2])}">${esc(lab||"Add")}</button>`:""}<button class="btn small ghost" type="button" data-pclose>Close</button></div>
    ${rows.length?"":`<p class="note" style="margin:0"><a href="https://www.google.com/search?q=${encodeURIComponent((x.name||"")+" "+(ctx.town||""))}" target="_blank" rel="noopener">Search the web for it</a></p>`}`;
  $("pinfoDlg").showModal();
  if(pinfoMap){ pinfoMap.remove(); pinfoMap=null; } if(typeof L==="undefined"){ $("pinfoMap").hidden=true; return; }
  pinfoMap=L.map("pinfoMap",{zoomControl:false,attributionControl:false}).setView([x.lat,x.lon],15);
  L.tileLayer(TILES.url,{maxZoom:TILES.maxZoom}).addTo(pinfoMap); L.marker([x.lat,x.lon],{icon:dotIcon("#B3261E",14)}).addTo(pinfoMap);
  setTimeout(()=>pinfoMap&&pinfoMap.invalidateSize(),50);
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-pinfo]"); if(b){ e.preventDefault(); openInfo(b.dataset.pinfo); } });
$("pinfoDlg").addEventListener("click",e=>{
  if(e.target===$("pinfoDlg")||e.target.closest("[data-pclose]")){ $("pinfoDlg").close(); return; }
  const pr=e.target.closest("[data-proxy]"); if(pr){ $("pinfoDlg").close(); const b=document.querySelector(`#details [${pr.dataset.proxy}="${CSS.escape(pr.dataset.pv)}"]`); if(b) b.click(); }
});

// passes off the route that are worth the detour
function passRows(k){
  const pd=!planStale&&plan&&plan.days[k]; if(!pd||!passNear.length) return "";
  const d=trip.days[k], on=n=>d.vias.some(v=>v.name===n);
  const list=passNear.filter(p=>p.km>=pd.a-1&&p.km<=pd.b+1&&!on(p.name)).sort((a,b)=>a.off-b.off).slice(0,5); if(!list.length) return "";
  return `<section class="dsec"><h3>Passes nearby <span class="note">${list.length}</span></h3><div class="note">Off today's route. Add one and the route goes over it.</div><div class="stable">${list.map(p=>`<div class="srow"><div><b>⛰ ${esc(p.name)}</b><span class="note">${p.off.toFixed(0)} km off the route · about +${Math.round(p.off*2)} km</span></div><div class="sact"><button class="linkbtn" type="button" data-passadd="${k}:${esc(p.name)}">Ride it</button></div></div>`).join("")}</div></section>`;
}
$("details").addEventListener("click",e=>{ const b=e.target.closest("[data-passadd]"); if(!b) return; const [k,...n]=b.dataset.passadd.split(":"), name=n.join(":"), p=passNear.find(x=>x.name===name); if(!p) return;
  if(insertVia(+k,pt(p.name,p.lat,p.lon,{type:"pass"}))!==false){ $("status").textContent=`Added ${p.name}. Working out the route over it…`; changed(); } });

// tap the map: add a stop, swap a stop, or sleep here
function tapName(ll){
  const tw=(townList||[]).map(t=>({t,d:hav(t,ll)})).sort((a,b)=>a.d-b.d)[0];
  if(tw&&tw.d<=1.5) return pt(tw.t.name,tw.t.lat,tw.t.lon);
  return pt(tw&&tw.d<=40?`Near ${tw.t.name}`:"Point on the map",+ll.lat.toFixed(5),+ll.lon.toFixed(5));
}
function tapDay(ll){
  const c=curDay(); if(c!=null) return c;
  if(!plan||planStale) return nDays()===1?0:null;
  const h=locateDays(ll,plan.geom,plan.cum,80).sort((a,b)=>a.off-b.off)[0]; if(!h) return null;
  const i=plan.days.findIndex(pd=>pd&&h.km>=pd.a-0.5&&h.km<=pd.b+0.5); return i<0?null:i;
}
let tapPt=null, tapK=null;
function onMapTap(e){
  if(!trip.start||trip.start.lat==null) return;
  const ll={lat:e.latlng.lat,lon:e.latlng.lng}, k=tapDay(ll); if(k==null) return;
  tapPt=tapName(ll); tapK=k; const d=trip.days[k], last=k===nDays()-1;
  const vias=d.vias.map((v,i)=>({v,i})), focus=stopFocus&&stopFocus.k===k&&stopFocus.j>0&&stopFocus.j<=d.vias.length?stopFocus.j-1:null;
  if(focus!=null){ const f=vias.splice(focus,1)[0]; vias.unshift(f); }
  const html=`<div class="tapbox"><b>${esc(tapPt.name)}</b><div class="note">${esc(dayName(k))}</div>
    <button class="btn small" type="button" data-tap="add">Add a stop here</button>
    ${vias.slice(0,4).map(({v,i})=>`<button class="btn small ghost" type="button" data-tap="swap:${i}">Instead of ${esc(v.name)}</button>`).join("")}
    ${last?"":`<button class="btn small ghost" type="button" data-tap="sleep">Sleep here (night ${k+1})</button>`}</div>`;
  L.popup({maxWidth:260}).setLatLng(e.latlng).setContent(html).openOn(map);
}
$("map").addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-tap]"); if(!b||!tapPt) return; map.closePopup(); const a=b.dataset.tap, k=tapK, p=tapPt;
  if(a==="add"){ if(insertVia(k,p)!==false){ $("status").textContent=`Added ${p.name}.`; changed(); } }
  else if(a==="sleep"){ trip.days[k].to=p; $("status").textContent=`Night ${k+1}: ${p.name}.`; changed(); }
  else if(a.startsWith("swap:")) replaceVia(k,+a.slice(5),p);
});
let tapOn=false; const touchy=!window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const tapHook=()=>{ if(map&&!tapOn){ map.on("contextmenu",e=>{ if(e.originalEvent&&e.originalEvent.preventDefault) e.originalEvent.preventDefault(); onMapTap(e); }); if(!touchy) map.on("click",onMapTap); tapOn=true; } };
{ const _em=ensureMap; ensureMap=function(){ _em(); tapHook(); }; } tapHook();

// 4. keep your place: after a change, the stop you were working on stays where it was on screen
let keepAt=null;
document.addEventListener("click",e=>{ const st=e.target.closest&&e.target.closest("#details .stop"); if(!st||e.target.closest("[data-stop],[data-av]")) return;
  const del=e.target.closest("[data-vdel]"), ref=del?(st.previousElementSibling&&st.previousElementSibling.classList.contains("stop")?st.previousElementSibling:st.nextElementSibling):st;
  if(ref&&ref.dataset.sname) keepAt={name:ref.dataset.sname,top:ref.getBoundingClientRect().top,until:Date.now()+8000}; },true);
function keepPlace(){ if(!keepAt||Date.now()>keepAt.until) return; const el=[...document.querySelectorAll("#details .stop")].find(x=>x.dataset.sname===keepAt.name); if(!el) return;
  const dy=el.getBoundingClientRect().top-keepAt.top; if(Math.abs(dy)>2) window.scrollBy(0,dy); }
{ const _rd=renderDetails; renderDetails=function(){ _rd.apply(this,arguments); keepPlace(); }; }
