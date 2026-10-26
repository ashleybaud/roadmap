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
  $("spName").value=name||""; $("spNote").value=""; $("spName").required=false; $("spName").placeholder="Name (optional), e.g. Ou Meul Padstal"; $("spMsg").textContent=""; $("spWhere").textContent=`At ${at.lat.toFixed(4)}, ${at.lon.toFixed(4)}`;
  $("spotDlg").showModal(); setTimeout(()=>$("spName").focus(),50);
}
$("spotDlg").addEventListener("click",e=>{ if(e.target===$("spotDlg")||e.target.closest("[data-spclose]")) $("spotDlg").close(); });
$("spotForm").addEventListener("submit",async e=>{ e.preventDefault(); $("spMsg").textContent="Sending…";
  try{ const j=await api("/api/spots",{method:"POST",body:{kind:$("spKind").value,name:$("spName").value.trim(),note:$("spNote").value.trim(),lat:spotAt.lat,lon:spotAt.lon}});
    $("spotDlg").close(); spots.key=""; loadSpots(true); $("status").textContent=j.status==="ok"?"Place added.":"Thanks. Other riders see it once we've checked it."; }
  catch(err){ if(/contributor/.test(err.message)){ $("spotDlg").close(); setOutbox([...outbox(),{t:"spot",kind:$("spKind").value,name:$("spName").value.trim(),note:$("spNote").value.trim(),lat:spotAt.lat,lon:spotAt.lon,at:new Date().toISOString(),day:ymd(new Date())}]); acct.contributor=false; openContrib(); return; } $("spMsg").textContent=err.message; } });
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
  const who=x=>`${esc(x.who||"no name")} (${esc(x.email)}) <button class="linkbtn small" type="button" data-rvuser="${x.uid}:trust">Trust</button> <button class="linkbtn small" type="button" data-rvuser="${x.uid}:block">Block</button>`;
  const act=(type,id)=>`<div class="ract"><button class="btn small" type="button" data-rv="${type}:${id}:approve">${type==="feedback"?"Done":"Approve"}</button>${type==="feedback"?"":`<button class="btn small ghost" type="button" data-rv="${type}:${id}:reject">Reject</button>`}</div>`;
  let h="";
  h+=`<div class="rvh">Routes to share (${q.routes.length})</div>`+q.routes.map(r=>`<div class="rrow"><div><div class="rt">${esc(r.title)}</div><div class="note">${who(r)} · ${r.km||"?"} km · ${r.days} day${r.days>1?"s":""} · ${when(r.updated)}</div>${r.summary?`<div class="pkb">${esc(r.summary)}</div>`:""}<button class="linkbtn small" type="button" data-rvopen="${r.id}">Open it in the planner</button></div>${act("route",r.id)}</div>`).join("");
  h+=`<div class="rvh">Places (${q.spots.length})</div>`+q.spots.map(p=>`<div class="rrow"><div><div class="rt">${SPOT_ICON[p.kind]||""} ${esc(p.name)}</div><div class="note">${esc(p.label)} · ${who(p)} · ${when(p.created)}</div>${p.note?`<div class="pkb">${esc(p.note)}</div>`:""}<button class="linkbtn small" type="button" data-rvmap="${p.lat},${p.lon}">Show on the map</button></div>${act("spot",p.id)}</div>`).join("");
  h+=`<div class="rvh">Road reports (${q.reports.length})</div>`+q.reports.map(r=>`<div class="rrow"><div><div class="rt">${esc(r.label)}</div><div class="note">${who(r)} · seen ${esc(r.seen_on)}</div>${r.text?`<div class="pkb">${esc(r.text)}</div>`:""}<button class="linkbtn small" type="button" data-rvmap="${r.lat},${r.lon}">Show on the map</button></div>${act("report",r.id)}</div>`).join("");
  h+=`<div class="rvh">Feedback (${q.feedback.length})</div>`+q.feedback.map(f=>`<div class="rrow"><div><div class="rt">${esc({feedback:"Feedback",fix:"Suggested change",bug:"Something broke"}[f.kind]||f.kind)}</div><div class="note">${esc(f.email||"not signed in")} · ${when(f.created)}</div><div class="pkb">${esc(f.text)}</div>${f.lat!=null?`<button class="linkbtn small" type="button" data-rvmap="${f.lat},${f.lon}">Show on the map</button>`:""}</div>${act("feedback",f.id)}</div>`).join("");
  $("rvBody").innerHTML=h;
}
$("revDlg").addEventListener("click",async e=>{
  if(e.target===$("revDlg")||e.target.closest("[data-rvclose]")){ $("revDlg").close(); return; }
  const a=e.target.closest("[data-rv]"); if(a){ const [type,id,action]=a.dataset.rv.split(":"); a.disabled=true; try{ await api("/api/admin/queue",{method:"POST",body:{type,id,action}}); await refreshReview(); renderReview(); spots.key=""; reps.key=""; picks=null; renderAll(); }catch(err){ a.disabled=false; $("status").textContent=err.message; } return; }
  const us=e.target.closest("[data-rvuser]"); if(us){ const [id,action]=us.dataset.rvuser.split(":"); if(us.dataset.arm!=="1"){ us.dataset.arm="1"; us.textContent=action==="block"?"Block? Tap again":"Trust? Tap again"; return; }
    try{ await api("/api/admin/queue",{method:"POST",body:{type:"user",id,action}}); await refreshReview(); renderReview(); $("status").textContent=action==="block"?"Blocked. Their waiting items were rejected.":"Trusted. Their marks now go live straight away."; }catch(err){ $("status").textContent=err.message; } return; }
  const m=e.target.closest("[data-rvmap]"); if(m){ const [la,lo]=m.dataset.rvmap.split(",").map(Number); $("revDlg").close(); map.setView([la,lo],14); L.marker([la,lo]).addTo(layer); return; }
  const o=e.target.closest("[data-rvopen]"); if(o){ $("revDlg").close(); openRoute(o.dataset.rvopen); }
});

/* ---------- 📍 quick marks: two taps at your position, kept on the phone until they can be sent ---------- */
const QK_SPOTS=["view","pass","farmstall","coffee","stay","camp","workshop","fuel","water","other"];
const QK_SPOT_N={view:"Viewpoint",pass:"Pass",farmstall:"Farm stall",coffee:"Coffee / food",stay:"Bike-friendly stay",camp:"Camping",workshop:"Workshop / tyres",fuel:"Fuel",water:"Water",other:"Worth a stop"};
const QK_REPS=["washaway","bad_road","road_closed","no_fuel","fuel_ok","river_high","roadworks","animals","danger","graded"];
const QK_REP_N={washaway:"Washaway",bad_road:"Bad surface",road_closed:"Road closed",no_fuel:"No fuel",fuel_ok:"Fuel here",river_high:"River high",roadworks:"Roadworks",animals:"Animals",danger:"Danger",graded:"Freshly graded"};
const OBX="otm-outbox";
const outbox=()=>{ try{ return JSON.parse(localStorage.getItem(OBX))||[]; }catch(e){ return []; } };
const setOutbox=a=>{ try{ localStorage.setItem(OBX,JSON.stringify(a)); }catch(e){} fabBadge(); };
function fabBadge(){ const f=$("markFab"); f.hidden=!acct.ready; const n=outbox().length; f.innerHTML=`📍${n?`<span class="qn" title="${n} waiting to send">${n}</span>`:""}`; }
$("markFab").addEventListener("click",()=>{
  $("qkSpots").innerHTML=QK_SPOTS.map(k=>`<button type="button" data-qk="spot:${k}"><span>${SPOT_ICON[k]}</span>${esc(QK_SPOT_N[k])}</button>`).join("");
  $("qkReps").innerHTML=QK_REPS.map(k=>`<button type="button" data-qk="report:${k}"><span>${REP_ICON[k]||"•"}</span>${esc(QK_REP_N[k])}</button>`).join("");
  $("qkWhere").textContent="Pull over first. One tap saves it at your position."; $("quickDlg").showModal(); getPos(true);
});
// position: asked as the sheet opens, so it's usually ready by the time you tap
let posP=null;
function getPos(fresh){ if(fresh||!posP) posP=new Promise(res=>{ if(!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),acc:Math.round(p.coords.accuracy)}),()=>res(null),{enableHighAccuracy:true,timeout:12000,maximumAge:60000}); }); return posP; }
$("quickDlg").addEventListener("click",async e=>{
  if(e.target===$("quickDlg")||e.target.closest("[data-qkclose]")){ $("quickDlg").close(); return; }
  if(e.target.closest("[data-qkmap]")){ $("quickDlg").close(); startPicking(); return; }
  const b=e.target.closest("[data-qk]"); if(!b) return; const [t,kind]=b.dataset.qk.split(":");
  b.disabled=true; $("qkWhere").textContent="Getting your position…";
  const p=await getPos(); b.disabled=false;
  if(!p){ $("qkWhere").textContent="Couldn't get your position. Allow location for this site, or tap the map instead."; return; }
  const item={t,kind,lat:p.lat,lon:p.lon,at:new Date().toISOString(),day:ymd(new Date())};
  setOutbox([...outbox(),item]); $("quickDlg").close();
  const what=t==="spot"?QK_SPOT_N[kind]:QK_REP_N[kind];
  const tt=$("toast"); tt.innerHTML=`Saved: ${esc(what)}. ${acct.user?"":"Sign in once on this phone and it's sent."}`; tt.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,6000);
  flushOutbox();
});
let flushing=false, askedContrib=false;
async function flushOutbox(){
  const q=outbox(); fabBadge(); if(!q.length||flushing||!acct.ready||!navigator.onLine) return;
  if(!acct.user){ if(!flushOutbox.askedSignin){ flushOutbox.askedSignin=true; acct.why="Sign in once on this phone. After that, marking a place is two taps."; acct.wantContrib=true; if(!$("acctDlg").open) openAcct("signin"); } return; }
  if(!acct.contributor){ if(!askedContrib){ askedContrib=true; openContrib(); } return; }
  flushing=true; let sent=0;
  try{
    for(const it of q){
      try{
        if(it.t==="spot") await api("/api/spots",{method:"POST",body:{kind:it.kind,name:it.name||"",note:it.note||"",lat:it.lat,lon:it.lon}});
        else await api("/api/reports",{method:"POST",body:{kind:it.kind,text:it.note||"",lat:it.lat,lon:it.lon,seen_on:it.day,route:trip.pick?"pick:"+trip.pick:trip.savedId||""}});
        setOutbox(outbox().filter(x=>x.at!==it.at)); sent++;
      }catch(err){
        if(/contributor/.test(err.message)){ acct.contributor=false; askedContrib=false; break; }
        if(/connection|fetch|network/i.test(err.message)) break; // no signal: try again later
        setOutbox(outbox().filter(x=>x.at!==it.at)); $("status").textContent=err.message; // refused: drop it and say why
      }
    }
  } finally { flushing=false; }
  if(sent){ $("status").textContent=`Sent ${sent} mark${sent>1?"s":""}. We'll check ${sent>1?"them":"it"} before other riders see ${sent>1?"them":"it"}.`; spots.key=""; reps.key=""; loadSpots(true); }
}
window.addEventListener("online",flushOutbox);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") flushOutbox(); });
setInterval(flushOutbox,60000);

/* contributor agreement, once */
function openContrib(){ $("ctName").value=acct.user&&acct.user.name||""; $("ctAgree").checked=false; $("ctMsg").textContent=""; $("contribDlg").showModal(); }
$("contribDlg").addEventListener("click",e=>{ if(e.target===$("contribDlg")||e.target.closest("[data-ctclose]")) $("contribDlg").close(); });
$("contribForm").addEventListener("submit",async e=>{ e.preventDefault(); if(!$("ctAgree").checked){ $("ctMsg").textContent="Tick to agree."; return; }
  try{ await api("/api/account",{method:"POST",body:{contributor:true,name:$("ctName").value.trim()}}); acct.contributor=true; if(acct.user) acct.user.name=$("ctName").value.trim(); $("contribDlg").close(); $("status").textContent="Thanks. You're a contributor."; flushOutbox(); if(spotAt&&$("spName").value) {} }
  catch(err){ $("ctMsg").textContent=err.message; } });

/* My marks: your places (waiting or live) and anything still on this phone; add names later */
let myMarks=null;
async function loadMyMarks(){ try{ myMarks=(await api("/api/spots?mine=1")).spots; }catch(e){ myMarks=[]; } if($("acctDlg").open&&acctMode==="routes") renderAcct(); }
function marksHtml(){
  const ob=outbox(), M=myMarks;
  let h=`<div class="rvh">My marks</div>`;
  if(ob.length) h+=ob.map(it=>`<div class="rrow"><div><div class="rt">${it.t==="spot"?SPOT_ICON[it.kind]+" "+esc(QK_SPOT_N[it.kind]):(REP_ICON[it.kind]||"")+" "+esc(QK_REP_N[it.kind])}</div><div class="note">On this phone, not sent yet · ${esc(new Date(it.at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))}</div></div><div class="ract"><button class="btn small" type="button" data-obsend>Send now</button></div></div>`).join("");
  h+=M==null?`<div class="note">Loading…</div>`:M.length?M.map(p=>`<div class="rrow"><div style="flex:1"><div class="rt">${SPOT_ICON[p.kind]||"📍"} ${esc(p.name)}</div><div class="note">${p.status==="ok"?"Live":p.status==="rejected"?"Not approved":"Waiting for approval"} · ${esc(new Date(p.created).toLocaleDateString("en-GB",{day:"numeric",month:"short"}))}</div>
      <div class="markedit" data-mk="${p.id}" hidden><input type="text" maxlength="80" value="${esc(p.name)}" data-mkname placeholder="Name"><input type="text" maxlength="400" value="${esc(p.note||"")}" data-mknote placeholder="Why stop here?"><button class="btn small" type="button" data-mksave="${p.id}">Save</button></div></div>
      <div class="ract"><button class="btn small ghost" type="button" data-mkedit="${p.id}">Edit</button><button class="icon" type="button" title="Show on the map" data-rvmap2="${p.lat},${p.lon}">⌖</button></div></div>`).join(""):ob.length?"":`<div class="note">Nothing marked yet. Tap 📍 on the map.</div>`;
  return h;
}
$("acctDlg").addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-obsend]")){ flushOutbox(); return; }
  const ed=t.closest("[data-mkedit]"); if(ed){ const box=$("aBody").querySelector(`[data-mk="${ed.dataset.mkedit}"]`); if(box) box.hidden=!box.hidden; return; }
  const sv=t.closest("[data-mksave]"); if(sv){ const box=$("aBody").querySelector(`[data-mk="${sv.dataset.mksave}"]`);
    try{ await api("/api/spots",{method:"POST",body:{edit:sv.dataset.mksave,name:box.querySelector("[data-mkname]").value.trim(),note:box.querySelector("[data-mknote]").value.trim()}}); loadMyMarks(); spots.key=""; loadSpots(true); $("status").textContent="Saved."; }catch(err){ $("status").textContent=err.message; } return; }
  const mp=t.closest("[data-rvmap2]"); if(mp){ const [la,lo]=mp.dataset.rvmap2.split(",").map(Number); $("acctDlg").close(); map.setView([la,lo],14); return; }
});
// the full form (from a stop, or "tap the map") also asks for the agreement when needed
