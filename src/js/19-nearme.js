/* ---------- toolbar: new trip, open route, import GPX, near me ---------- */
$("tbNew").addEventListener("click",()=>{ snapTrip(true); const prev=JSON.parse(JSON.stringify(trip)); delete trip.gpx; delete trip.pick; delete trip.founder; Object.assign(trip,freshTrip()); tripEdit=true; ui.tab="ov"; plan=null; fp=null; changed(); locateIfAllowed();
  const tt=$("toast"); tt.innerHTML=`New trip. <button type="button" class="linkbtn">Undo</button>`; tt.hidden=false; tt.querySelector("button").onclick=()=>{Object.keys(trip).forEach(x=>delete trip[x]);Object.assign(trip,prev);tt.hidden=true;changed();}; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,8000); });
$("tbGpx").addEventListener("change",async e=>{ const f=e.target.files[0]; if(f){ await planFromGpx(f); e.target.value=""; } });

/* Near me: routes, passes, sights and riders' places within a radius */
let nearAt=null; // {lat,lon,name}
const nearRad=()=>+$("nearRad").value||100;
try{ const r=localStorage.getItem("otm-nearrad"); if(r) $("nearRad").value=r; }catch(e){}
function nearCountries(c,km){ const d=km/111; return Object.entries(COUNTRY_BOX).filter(([,b])=>!(b[0]>c.lat+d||b[2]<c.lat-d||b[1]>c.lon+d*1.3||b[3]<c.lon-d*1.3)).map(([cc])=>cc); }
function rideFrom(p){ const c=nearAt; if(!c) return; const today=ymd(new Date());
  applyTrip({start:pt(c.name,c.lat,c.lon),end:null,round:true,startDate:today,endDate:today,sugV:5,days:[{to:null,vias:[pt(p.name,p.lat,p.lon,p.kind==="pass"?{type:"pass"}:{})],style:"default",legs:[],fresh:true}]},null,`Day ride over ${p.name}`);
  $("nearDlg").close(); }
let nearItems=[];
async function renderNear(){
  const c=nearAt, R=nearRad(), body=$("nearBody"); if(!c){ body.innerHTML=`<p class="note">Set where you are: tap <b>Use my location</b>, or set a start for your trip.</p>`; $("nearWhere").textContent=""; return; }
  $("nearWhere").textContent=`Around ${c.name}`; body.innerHTML=`<p class="note">Looking…</p>`; nearItems=[];
  const d=p=>hav(c,p), row=(p,act)=>{ nearItems.push(p); const i=nearItems.length-1; return `<div class="srow"><div><b>${esc(p.name)}</b><span class="note">${Math.round(d(p))} km away${p.sub?" · "+esc(p.sub):""}</span></div><div class="sact">${act(i)}</div></div>`; };
  // routes
  let routes=[]; try{ picks=picks||await loadPicks(); routes=picks.filter(r=>r.kind==="pick"&&r.trip&&r.trip.start).map(r=>{ const pts=[r.trip.start,r.trip.end,...r.trip.days.flatMap(x=>[x.to,...(x.vias||[])])].filter(x=>x&&x.lat!=null); return {r,dist:Math.min(...pts.map(q=>hav(c,q)))}; }).filter(x=>x.dist<=R).sort((a,b)=>a.dist-b.dist); }catch(e){}
  const ccs=nearCountries(c,R), inR=rows=>(rows||[]).map(x=>({lat:x[0],lon:x[1],name:x[2]})).filter(p=>p.name&&d(p)<=R);
  const uniq=l=>{ const seen=new Set(); return l.filter(p=>!seen.has(p.name)&&seen.add(p.name)); };
  let passes=[],sights=[];
  if(ccs.length){ passes=uniq(inR(await localKind("pass",ccs)).sort((a,b)=>d(a)-d(b))).map(p=>Object.assign(p,{kind:"pass"}));
    sights=uniq([...inR(await localKind("view",ccs)).map(p=>Object.assign(p,{sub:"viewpoint"})),...inR(await localKind("sight",ccs))].sort((a,b)=>d(a)-d(b))).slice(0,25); }
  let places=[]; if(acct.ready){ const k=R/111; try{ const j=await api(`/api/spots?s=${(c.lat-k).toFixed(3)}&w=${(c.lon-k*1.3).toFixed(3)}&n=${(c.lat+k).toFixed(3)}&e=${(c.lon+k*1.3).toFixed(3)}`); places=(j.spots||[]).filter(p=>p.status==="ok"&&d(p)<=R).map(p=>({lat:p.lat,lon:p.lon,name:p.name||"Rider's place",sub:(j.kinds&&j.kinds[p.kind])||""})).sort((a,b)=>d(a)-d(b)); }catch(e){} }
  const rideBtn=i=>`<button class="linkbtn" type="button" data-nride="${i}">Ride there</button>`;
  let h="";
  if(passes.length) h+=`<div class="btns"><button class="btn small" type="button" data-nride="day">Plan a day ride from here</button><span class="note">Over ${esc(passes.find(p=>d(p)>=15)?.name||passes[0].name)} and back.</span></div>`;
  h+=`<h3>Routes <span class="note">${routes.length}</span></h3>`+(routes.length?routes.map(({r,dist})=>`<div class="srow"><div><b>${esc(r.title)}</b><span class="note">${Math.round(dist)} km away · ${r.trip.days.length} day${r.trip.days.length>1?"s":""}${r.founder?" · ridden by the founder":""}</span></div><div class="sact"><button class="linkbtn" type="button" data-nopen="${esc(r.id)}">Open</button></div></div>`).join(""):`<div class="note">No routes within ${R} km yet. Plan one you love and share it.</div>`);
  if(passes.length) h+=`<h3>Passes and poorts <span class="note">${passes.length}</span></h3>`+passes.slice(0,20).map(p=>row(p,rideBtn)).join("");
  if(sights.length) h+=`<h3>Viewpoints and sights <span class="note">${sights.length}</span></h3>`+sights.map(p=>row(p,rideBtn)).join("");
  if(places.length) h+=`<h3>Riders' places <span class="note">${places.length}</span></h3>`+places.slice(0,25).map(p=>row(p,rideBtn)).join("");
  if(!ccs.length) h+=`<p class="note">Passes and sights are loaded for South Africa and Namibia so far. Routes and riders' places show everywhere.</p>`;
  body.innerHTML=h;
}
function openNear(){ if(!nearAt&&trip.start&&trip.start.lat!=null) nearAt={lat:trip.start.lat,lon:trip.start.lon,name:trip.start.name}; $("nearDlg").showModal(); renderNear(); }
$("tbNear").addEventListener("click",openNear);
$("nearRad").addEventListener("change",()=>{ try{ localStorage.setItem("otm-nearrad",$("nearRad").value); }catch(e){} renderNear(); });
$("nearLoc").addEventListener("click",()=>{ if(!navigator.geolocation){ $("nearWhere").textContent="This browser can't share your location."; return; } $("nearWhere").textContent="Finding you…";
  navigator.geolocation.getCurrentPosition(p=>{ nearAt={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),name:"where you are"}; renderNear(); },()=>{ $("nearWhere").textContent="Location not shared."; },{enableHighAccuracy:false,timeout:15000}); });
$("nearDlg").addEventListener("click",e=>{
  if(e.target===$("nearDlg")||e.target.closest("[data-nclose]")){ $("nearDlg").close(); return; }
  const o=e.target.closest("[data-nopen]"); if(o){ const r=picks.find(x=>x.id===o.dataset.nopen); if(r){ $("nearDlg").close(); openPick(r); } return; }
  const b=e.target.closest("[data-nride]"); if(!b) return;
  if(b.dataset.nride==="day"){ const c=nearAt, p=nearItems.filter(x=>x.kind==="pass").sort((a,z)=>hav(c,a)-hav(c,z)).find(x=>hav(c,x)>=15)||nearItems.find(x=>x.kind==="pass"); if(p) rideFrom(p); return; }
  const p=nearItems[+b.dataset.nride]; if(p) rideFrom(p);
});
// far from your usual start? say so (only if location is already allowed: never asks by itself)
navigator.permissions?.query({name:"geolocation"}).then(r=>{ if(r.state!=="granted") return;
  navigator.geolocation.getCurrentPosition(p=>{ const here={lat:p.coords.latitude,lon:p.coords.longitude}; let home=null; try{ home=JSON.parse(localStorage.getItem("otm-home")||"null"); }catch(e){}
    if(!home){ try{ localStorage.setItem("otm-home",JSON.stringify({lat:+here.lat.toFixed(3),lon:+here.lon.toFixed(3)})); }catch(e){} return; }
    if(hav(home,here)<200) return;
    const tw=(townList||[]).map(t=>({t,d:hav(t,here)})).sort((a,b)=>a.d-b.d)[0], nm=tw&&tw.d<60?tw.t.name:"here";
    nearAt={lat:+here.lat.toFixed(5),lon:+here.lon.toFixed(5),name:nm==="here"?"where you are":nm};
    const b=$("nearBanner"); b.innerHTML=`<span>You're a long way from home${nm!=="here"?`, near <b>${esc(nm)}</b>`:""}. See good roads and places around you.</span><span><button class="btn small" type="button" id="nbGo">🧭 Near me</button> <button class="linkbtn small" type="button" id="nbX">Not now</button></span>`; b.hidden=false;
    $("nbGo").onclick=()=>{ b.hidden=true; openNear(); }; $("nbX").onclick=()=>{ b.hidden=true; }; },()=>{},{timeout:15000,maximumAge:600000}); }).catch(()=>{});
