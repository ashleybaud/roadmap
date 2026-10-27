/* ---------- toolbar above From: new trip, open route, import GPX, near me ---------- */
$("tbNew").addEventListener("click",()=>{ nearOff(); snapTrip(true); const prev=JSON.parse(JSON.stringify(trip)); delete trip.gpx; delete trip.pick; delete trip.founder; Object.assign(trip,freshTrip()); tripEdit=true; ui.tab="ov"; plan=null; fp=null; changed(); locateIfAllowed();
  const tt=$("toast"); tt.innerHTML=`New trip. <button type="button" class="linkbtn">Undo</button>`; tt.hidden=false; tt.querySelector("button").onclick=()=>{Object.keys(trip).forEach(x=>delete trip[x]);Object.assign(trip,prev);tt.hidden=true;changed();}; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,8000); });
$("tbGpx").addEventListener("change",async e=>{ const f=e.target.files[0]; if(f){ nearOff(); await planFromGpx(f); e.target.value=""; } });

/* ---------- Near me: on the map, following the On the map buttons ---------- */
let near=null; // {lat,lon,name}
const nearRad=()=>+$("nearRad").value||100;
try{ const r=localStorage.getItem("otm-nearrad"); if(r) $("nearRad").value=r; }catch(e){}
function nearCountries(c,km){ const d=km/111; return Object.entries(COUNTRY_BOX).filter(([,b])=>!(b[0]>c.lat+d||b[2]<c.lat-d||b[1]>c.lon+d*1.3||b[3]<c.lon-d*1.3)).map(([cc])=>cc); }
const NK={fuel:["fuel","⛽","#0B6E4F"],sleep:["stay","🛏","#2F5BA8"],camp:["stay","⛺","#2F5BA8"],food:["food","🍴","#B3261E"],pass:["sights","⛰","#5D4037"],view:["sights","👁","#6B4E9B"],sight:["sights","★","#6B4E9B"],med:["med","🏥","#B3261E"]};
let nearData=null, nearKey="";
async function loadNear(){
  const c=near, R=nearRad(), key=[c.lat,c.lon,R].join(); if(key===nearKey&&nearData) return nearData; nearKey=key;
  const ccs=nearCountries(c,R), out=[];
  for(const kind of Object.keys(NK)){ if(!ccs.length) break; const rows=await localKind(kind,ccs); const seen=new Set();
    (rows||[]).forEach(r=>{ const [lat,lon,name,type,phone,web,email,hours,extra]=r, p={lat,lon}; if(hav(c,p)>R) return; if(kind==="pass"&&(!name||seen.has(name))) return; if(name) seen.add(name);
      out.push({lat,lon,name:name||"",kind:kind==="camp"?"sleep":kind,ico:kind,tags:{tourism:type||(kind==="camp"?"camp_site":""),phone,website:web,email,hours,extra},d:hav(c,p)}); }); }
  let routes=[]; try{ picks=picks||await loadPicks(); routes=picks.filter(r=>r.kind==="pick"&&r.trip&&r.trip.start).map(r=>{ const pts=[r.trip.start,r.trip.end,...r.trip.days.flatMap(x=>[x.to,...(x.vias||[])])].filter(x=>x&&x.lat!=null); const best=pts.map(q=>({q,d:hav(c,q)})).sort((a,b)=>a.d-b.d)[0]; return {r,at:best.q,d:best.d}; }).filter(x=>x.d<=R); }catch(e){}
  return nearData={places:out,routes,ccs};
}
// what to do with a place: go there, stop there, or ride there and back
function nearActions(p){
  const ensureStart=()=>{ if(!trip.start||trip.start.lat==null) trip.start=pt(near.name==="where you are"?"My location":near.name,near.lat,near.lon); };
  const P=pt(p.name||"Place",p.lat,p.lon,p.kind==="pass"?{type:"pass"}:{});
  return [
    {label:"Go here",fn:()=>{ nearOff(); ensureStart(); const k=curDay(), last=nDays()-1; if(nDays()===1||k==null||k>=last){ setFinish(P); } else { trip.days[k].to=P; $("status").textContent=`Night ${k+1}: ${P.name}.`; changed(); } }},
    {label:"Add as a stop",fn:()=>{ nearOff(); ensureStart(); const k=curDay()??0; if(insertVia(k,P)!==false){ $("status").textContent=`Added ${P.name}.`; changed(); } }},
    {label:"There and back",fn:()=>{ const c=near; nearOff(); const today=ymd(new Date()); applyTrip({start:pt(c.name==="where you are"?"My location":c.name,c.lat,c.lon),end:null,round:true,startDate:today,endDate:today,sugV:5,days:[{to:null,vias:[P],style:"default",legs:[],fresh:true}]},null,`There and back: ${P.name}`); }}];
}
let nearLayer=null, nearFit=false;
async function drawNear(){
  if(nearLayer){ nearLayer.remove(); nearLayer=null; } if(!near||!map) return;
  const c=near, R=nearRad(), d=await loadNear(); if(!near) return;
  nearLayer=L.layerGroup().addTo(map);
  L.circle([c.lat,c.lon],{radius:R*1000,color:"#2F7DF6",weight:1.5,fill:true,fillOpacity:.04,interactive:false}).addTo(nearLayer);
  L.marker([c.lat,c.lon],{icon:L.divIcon({className:"",html:`<div class="nearme"></div>`,iconSize:[16,16],iconAnchor:[8,8]}),zIndexOffset:2000}).bindTooltip(c.name==="where you are"?"You are here":c.name).addTo(nearLayer);
  const z=map.getZoom(), lim=z<10?60:z<12?200:600, b=map.getBounds();
  const list=d.places.filter(p=>ui.lay[NK[p.ico][0]]&&(p.ico==="pass"||z>=9)&&b.contains([p.lat,p.lon])).sort((a,b2)=>a.d-b2.d).slice(0,p0(lim));
  list.forEach(p=>{ const [,ic,col]=NK[p.ico];
    L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:${col}">${ic}</div>`,iconSize:[22,22],iconAnchor:[11,11]})}).bindTooltip(p.name||KIND_NAME[p.kind]||"Place").on("click",()=>openInfoFor(p,{dist:`${Math.round(p.d)} km from ${c.name}`,town:"",actions:nearActions(p)})).addTo(nearLayer); });
  d.routes.forEach(({r,at,d:dd})=>{ L.marker([at.lat,at.lon],{icon:L.divIcon({className:"",html:`<div class="pin pstart" style="background:#D9A441;color:#18201C">↝</div>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:1500}).bindTooltip(r.title)
    .on("click",()=>openInfoFor({lat:at.lat,lon:at.lon,name:r.title,kind:"route",tags:{}},{dist:`${r.region} · ${r.trip.days.length} day${r.trip.days.length>1?"s":""}${r.founder?" · ridden by the founder":""} · ${Math.round(dd)} km away`,actions:[{label:"Open this route",fn:()=>{ nearOff(); openPick(r); }}]})).addTo(nearLayer); });
  const nP=d.places.filter(p=>p.ico==="pass").length;
  $("nsCount").textContent=`${d.routes.length} route${d.routes.length===1?"":"s"} · ${nP} pass${nP===1?"":"es"}${d.ccs.length?"":" · passes and places for South Africa and Namibia so far"}${z<9?" · zoom in for more":""}`;
  if(!nearFit){ nearFit=true; const dy=R/111, dx=R/(111*Math.cos(c.lat*Math.PI/180)); map.fitBounds([[c.lat-dy,c.lon-dx],[c.lat+dy,c.lon+dx]],{padding:[10,10]}); }
}
const p0=n=>n||0;
function nearOn(at){ near=at; nearFit=false; nearKey=""; $("nsWhere").textContent=at.name; $("nearStrip").hidden=false; $("tbNear").classList.add("on"); drawNear(); if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"}); }
function nearOff(){ if(!near) return; near=null; if(nearLayer){ nearLayer.remove(); nearLayer=null; } $("nearStrip").hidden=true; $("tbNear").classList.remove("on"); window._refit=true; drawMap(); }
function nearLocate(fallback){ if(!navigator.geolocation){ if(fallback) fallback(); return; } $("status").textContent="Finding you…";
  navigator.geolocation.getCurrentPosition(p=>{ $("status").textContent=""; nearOn({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),name:"where you are"}); },()=>{ $("status").textContent="Location not shared."; if(fallback) fallback(); },{timeout:15000,maximumAge:300000}); }
$("tbNear").addEventListener("click",()=>{ if(near){ nearOff(); return; } const st=trip.start&&trip.start.lat!=null?{lat:trip.start.lat,lon:trip.start.lon,name:trip.start.name}:null;
  navigator.permissions?.query({name:"geolocation"}).then(r=>{ if(r.state==="granted"||!st) nearLocate(st?()=>nearOn(st):null); else nearOn(st); }).catch(()=>{ if(st) nearOn(st); else nearLocate(); }); });
$("nsLoc").addEventListener("click",()=>nearLocate());
$("nsClose").addEventListener("click",nearOff);
$("nearRad").addEventListener("change",()=>{ try{ localStorage.setItem("otm-nearrad",$("nearRad").value); }catch(e){} nearFit=false; nearKey=""; drawNear(); });
$("nsDay").addEventListener("click",async()=>{ if(!near) return; const d=await loadNear(); const ps=d.places.filter(p=>p.ico==="pass").sort((a,b)=>a.d-b.d); const p=ps.find(x=>x.d>=15)||ps[0]; if(!p){ $("status").textContent="No passes within range. Try a bigger radius."; return; } nearActions(p)[2].fn(); });
{ const _dm=drawMap; drawMap=function(){ _dm.apply(this,arguments); if(near) drawNear(); }; }
{ let t; const hook=()=>{ if(map&&!map._nearHook){ map._nearHook=1; map.on("zoomend moveend",()=>{ clearTimeout(t); t=setTimeout(()=>{ if(near) drawNear(); },150); }); } }; const _em=ensureMap; ensureMap=function(){ _em(); hook(); }; hook(); }
// On the map buttons change what Near me shows
$("iconbar").addEventListener("click",()=>setTimeout(()=>{ if(near) drawNear(); },0));


// first GPX download: ask once what it's for, if nobody's said
{ const _dg=downloadGpx; downloadGpx=function(k){ let asked=false; try{ asked=!!localStorage.getItem("otm-gpsasked"); }catch(e){}
  if((settings.gps||"any")==="any"&&!asked){ try{ localStorage.setItem("otm-gpsasked","1"); }catch(e){} $("gpsAsk").value="any"; const d=$("gpsDlg");
    d.onclose=()=>{ settings.gps=$("gpsAsk").value; store.set("rr2-settings",settings); $("gps").value=settings.gps; _dg(k); }; d.showModal(); return; }
  _dg(k); }; }
