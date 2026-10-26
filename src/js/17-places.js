/* ---------- Add yours: share a route, mark a place; and OneTrackMind's approval list ---------- */
const SPOT_ICON={view:"👁",pass:"⛰",farmstall:"🥧",coffee:"☕",stay:"🛏",camp:"⛺",workshop:"🔧",fuel:"⛽",water:"💧",other:"📍"};
let spots={key:"",list:[],kinds:null};
$("addBtn").addEventListener("click",()=>{ $("adMsg").textContent=""; $("addDlg").showModal(); });
$("addDlg").addEventListener("click",e=>{ if(e.target===$("addDlg")||e.target.closest("[data-adclose]")) $("addDlg").close(); });
document.addEventListener("click",e=>{
  if(!e.target.closest) return;
  if(e.target.closest("[data-addroute]")){ closeAllAdd();
    if(!acct.user){ acct.why="Sign in to add your route. Your trip stays on this device while you do."; openAcct("signin"); return; }
    if(plan&&!planStale){ openAcct("save"); $("status").textContent="Save it, then open My routes and tap Share publicly."; }
    else { ui.tab="ov"; renderAll(); const t=$("toast"); t.innerHTML=`Plan the route first (set From, then your stops or a GPX file), then tap <b>Save route</b> and <b>Share publicly</b> in My routes.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,12000); }
    return; }
  if(e.target.closest("[data-addspot]")){ closeAllAdd(); startPicking(); return; }
  const sa=e.target.closest("[data-spotat]"); if(sa){ const [lat,lon,...n]=sa.dataset.spotat.split(","); openSpot({lat:+lat,lon:+lon},n.join(",")); return; }
  const v=e.target.closest("[data-spotvote]"); if(v){ voteSpot(v.dataset.spotvote,v.dataset.undo==="1"); return; }
});
function closeAllAdd(){ ["addDlg","picksDlg"].forEach(id=>{ if($(id).open) $(id).close(); }); }
function startPicking(){
  if(!acct.user){ acct.why="Sign in to mark a place. It takes a minute."; openAcct("signin"); return; }
  if(!window.L||!map){ return; }
  $("map").classList.add("picking"); $("status").textContent="Tap the map where the place is.";
  if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"});
  map.once("click",ev=>{ $("map").classList.remove("picking"); openSpot({lat:+ev.latlng.lat.toFixed(5),lon:+ev.latlng.lng.toFixed(5)},""); });
}
let spotAt=null;
function openSpot(at,name){
  if(!acct.user){ acct.why="Sign in to mark a place. It takes a minute."; openAcct("signin"); return; }
  spotAt=at; const K=spots.kinds||{view:"Viewpoint",pass:"Pass",farmstall:"Farm stall",coffee:"Coffee or food",stay:"Bike-friendly stay",camp:"Camping",workshop:"Workshop or tyres",fuel:"Fuel",water:"Water",other:"Worth a stop"};
  $("spKind").innerHTML=Object.entries(K).map(([k,v])=>`<option value="${k}">${SPOT_ICON[k]||""} ${esc(v)}</option>`).join("");
  $("spName").value=name||""; $("spNote").value=""; $("spMsg").textContent=""; $("spWhere").textContent=`At ${at.lat.toFixed(4)}, ${at.lon.toFixed(4)}`;
  $("spotDlg").showModal(); setTimeout(()=>$("spName").focus(),50);
}
$("spotDlg").addEventListener("click",e=>{ if(e.target===$("spotDlg")||e.target.closest("[data-spclose]")) $("spotDlg").close(); });
$("spotForm").addEventListener("submit",async e=>{ e.preventDefault(); $("spMsg").textContent="Sending…";
  try{ const j=await api("/api/spots",{method:"POST",body:{kind:$("spKind").value,name:$("spName").value.trim(),note:$("spNote").value.trim(),lat:spotAt.lat,lon:spotAt.lon}});
    $("spotDlg").close(); spots.key=""; loadSpots(true); $("status").textContent=j.status==="ok"?"Place added.":"Thanks. Other riders see it once we've checked it."; }
  catch(err){ $("spMsg").textContent=err.message; } });
async function loadSpots(force){
  if(!acct.ready||!map) return;
  const b=plan&&plan.geom.length?L.latLngBounds(plan.geom.map(p=>[p.lat,p.lon])).pad(0.1):map.getBounds(); if(!b) return;
  const s=b.getSouth(),w=b.getWest(),n=b.getNorth(),e=b.getEast(); if(n-s>25||e-w>25) return;
  const key=[s,w,n,e].map(x=>x.toFixed(2)).join(","); if(key===spots.key&&!force) return; spots.key=key;
  try{ const j=await api(`/api/spots?s=${s.toFixed(3)}&w=${w.toFixed(3)}&n=${n.toFixed(3)}&e=${e.toFixed(3)}`); spots.kinds=j.kinds; spots.list=j.spots||[]; drawMap(); }catch(err){ spots.key=""; }
}
function drawSpots(){
  spots.list.forEach(p=>{ const pend=p.status!=="ok";
    const html=`<b>${esc(p.name)}</b><br><span class="note">${esc((spots.kinds||{})[p.kind]||p.kind)}${pend?" · waiting for approval":""}</span>${p.note?`<br>${esc(p.note)}`:""}<br>${pend?"":`<button class="btn small ${p.beenme?"":"ghost"}" type="button" data-spotvote="${p.id}" data-undo="${p.beenme?1:0}">${p.beenme?"✓ Been here":"Been here"}${p.been?` · ${p.been}`:""}</button>`}`;
    L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:`<div class="spotmk ${pend?"pend":""}">${SPOT_ICON[p.kind]||"📍"}</div>`,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:800}).bindTooltip(p.name).bindPopup(html).addTo(layer); });
}
async function voteSpot(id,undo){ if(!acct.user){ acct.why="Sign in to say you've been here."; openAcct("signin"); return; }
  try{ await api("/api/spots",{method:"POST",body:{vote:id,undo}}); map.closePopup(); loadSpots(true); }catch(e){ $("status").textContent=e.message; } }
{ const _ra=renderAll; renderAll=function(){ _ra(); if(acct.ready&&map&&!planStale) loadSpots(); }; }

/* ---------- approval list (OneTrackMind only) ---------- */
let revQ=null;
async function refreshReview(){ const b=$("reviewBtn"); if(!acct.admin){ b.hidden=true; return; }
  try{ revQ=await api("/api/admin/queue"); const n=revQ.routes.length+revQ.spots.length+revQ.reports.length+revQ.feedback.length; b.hidden=false; b.textContent=n?`Review (${n})`:"Review"; }catch(e){ b.hidden=true; } }
$("reviewBtn").addEventListener("click",async()=>{ await refreshReview(); renderReview(); $("revDlg").showModal(); });
function renderReview(){
  const q=revQ||{routes:[],spots:[],reports:[],feedback:[]}, when=t=>new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  const act=(type,id)=>`<div class="ract"><button class="btn small" type="button" data-rv="${type}:${id}:approve">${type==="feedback"?"Done":"Approve"}</button>${type==="feedback"?"":`<button class="btn small ghost" type="button" data-rv="${type}:${id}:reject">Reject</button>`}</div>`;
  let h="";
  h+=`<div class="rvh">Routes to share (${q.routes.length})</div>`+q.routes.map(r=>`<div class="rrow"><div><div class="rt">${esc(r.title)}</div><div class="note">${esc(r.email)} · ${r.km||"?"} km · ${r.days} day${r.days>1?"s":""} · ${when(r.updated)}</div>${r.summary?`<div class="pkb">${esc(r.summary)}</div>`:""}<button class="linkbtn small" type="button" data-rvopen="${r.id}">Open it in the planner</button></div>${act("route",r.id)}</div>`).join("");
  h+=`<div class="rvh">Places (${q.spots.length})</div>`+q.spots.map(p=>`<div class="rrow"><div><div class="rt">${SPOT_ICON[p.kind]||""} ${esc(p.name)}</div><div class="note">${esc(p.label)} · ${esc(p.email)} · ${when(p.created)}</div>${p.note?`<div class="pkb">${esc(p.note)}</div>`:""}<button class="linkbtn small" type="button" data-rvmap="${p.lat},${p.lon}">Show on the map</button></div>${act("spot",p.id)}</div>`).join("");
  h+=`<div class="rvh">Road reports (${q.reports.length})</div>`+q.reports.map(r=>`<div class="rrow"><div><div class="rt">${esc(r.label)}</div><div class="note">${esc(r.email)} · seen ${esc(r.seen_on)}</div>${r.text?`<div class="pkb">${esc(r.text)}</div>`:""}<button class="linkbtn small" type="button" data-rvmap="${r.lat},${r.lon}">Show on the map</button></div>${act("report",r.id)}</div>`).join("");
  h+=`<div class="rvh">Feedback (${q.feedback.length})</div>`+q.feedback.map(f=>`<div class="rrow"><div><div class="rt">${esc({feedback:"Feedback",fix:"Suggested change",bug:"Something broke"}[f.kind]||f.kind)}</div><div class="note">${esc(f.email||"not signed in")} · ${when(f.created)}</div><div class="pkb">${esc(f.text)}</div>${f.lat!=null?`<button class="linkbtn small" type="button" data-rvmap="${f.lat},${f.lon}">Show on the map</button>`:""}</div>${act("feedback",f.id)}</div>`).join("");
  $("rvBody").innerHTML=h;
}
$("revDlg").addEventListener("click",async e=>{
  if(e.target===$("revDlg")||e.target.closest("[data-rvclose]")){ $("revDlg").close(); return; }
  const a=e.target.closest("[data-rv]"); if(a){ const [type,id,action]=a.dataset.rv.split(":"); a.disabled=true; try{ await api("/api/admin/queue",{method:"POST",body:{type,id,action}}); await refreshReview(); renderReview(); spots.key=""; reps.key=""; picks=null; renderAll(); }catch(err){ a.disabled=false; $("status").textContent=err.message; } return; }
  const m=e.target.closest("[data-rvmap]"); if(m){ const [la,lo]=m.dataset.rvmap.split(",").map(Number); $("revDlg").close(); map.setView([la,lo],14); L.marker([la,lo]).addTo(layer); return; }
  const o=e.target.closest("[data-rvopen]"); if(o){ $("revDlg").close(); openRoute(o.dataset.rvopen); }
});
