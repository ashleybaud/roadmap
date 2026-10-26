/* ---------- rider reports and route ratings (need accounts switched on) ---------- */
const REP_ICON={fuel_ok:"⛽",no_fuel:"⛽",road_closed:"⛔",washaway:"🌊",bad_road:"〰",graded:"✓",roadworks:"🚧",river_high:"≈",animals:"🐄",danger:"⚠",good_stay:"🛏"};
const REP_LVL={no_fuel:"warn",road_closed:"bad",washaway:"bad",bad_road:"warn",roadworks:"info",river_high:"bad",animals:"warn",danger:"bad",fuel_ok:"info",graded:"info",good_stay:"info"};
let reps={key:"",list:[],kinds:null};
// load reports for the trip's area once per worked-out route
async function loadReports(){
  if(!acct.ready||!plan||!plan.geom.length) return;
  let s=90,w=180,n=-90,e=-180; plan.geom.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const key=[s,w,n,e].map(x=>x.toFixed(2)).join(","); if(key===reps.key) return; reps.key=key;
  try{ const j=await api(`/api/reports?s=${(s-0.1).toFixed(3)}&w=${(w-0.1).toFixed(3)}&n=${(n+0.1).toFixed(3)}&e=${(e+0.1).toFixed(3)}`); reps.kinds=j.kinds; reps.list=j.reports||[]; plan._rep=null; renderAll(); }catch(err){ reps.key=""; }
}
// reports within 2 km of the route, with where they are along it
function repsOnRoute(){
  if(!plan||!reps.list.length) return [];
  if(plan._rep) return plan._rep;
  return plan._rep=reps.list.map(r=>{ const h=locateDays(r,plan.geom,plan.cum,3).sort((a,b)=>a.off-b.off)[0]; return h&&h.off<=2?Object.assign({},r,{km:h.km,off:h.off}):null; }).filter(Boolean);
}
const ago=d=>{ const n=Math.round((Date.now()-Date.parse(d+"T12:00:00"))/864e5); return n<=0?"today":n===1?"yesterday":n<30?n+" days ago":Math.round(n/30)+" month"+(n>=60?"s":"")+" ago"; };
function reportsFor(k){
  const pd=plan&&plan.days[k]; if(!pd) return [];
  return repsOnRoute().filter(r=>r.km>=pd.a-0.5&&r.km<=pd.b+0.5).map(r=>({lvl:REP_LVL[r.kind]||"info",text:`Rider report, ${ago(r.seen_on)} at km ${Math.max(0,Math.round(r.km-pd.a))}: ${r.label}${r.text?". "+r.text:""}`}));
}
function drawReports(sel){
  repsOnRoute().forEach(r=>{ if(sel&&!(r.km>=sel.a-0.5&&r.km<=sel.b+0.5)) return; const lv=REP_LVL[r.kind];
    L.marker([r.lat,r.lon],{icon:L.divIcon({className:"",html:`<div class="repmk ${lv==="bad"?"bad":r.kind==="fuel_ok"||r.kind==="graded"||r.kind==="good_stay"?"good":""}">${REP_ICON[r.kind]||"•"}</div>`,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:900})
      .bindTooltip(`${r.label}, ${ago(r.seen_on)}${r.text?": "+r.text:""}`).addTo(layer); });
}

/* report dialog */
let repAt=null, repKind="";
function openReport(at){
  if(!acct.user){ acct.why="Sign in to report the road. It takes a minute and helps every rider after you."; openAcct("signin"); return; }
  repAt=at; repKind=""; $("rpMsg").textContent=""; $("rpText").value=""; $("rpDate").value=ymd(new Date()); $("rpDate").max=ymd(new Date());
  $("rpWhere").textContent=at?`At ${at.name||"this place"}`:"Pick a place, or use where you are now.";
  const K=reps.kinds||{fuel_ok:"Fuel available",no_fuel:"No fuel",road_closed:"Road closed",washaway:"Washaway or flood damage",bad_road:"Bad surface: corrugations, ruts, sand",graded:"Freshly graded",roadworks:"Roadworks or stop-go",river_high:"River crossing high",animals:"Animals on the road",danger:"Danger: crime or unsafe stop",good_stay:"Good place to stay or eat"};
  $("rpKinds").innerHTML=Object.entries(K).map(([k,v])=>`<button type="button" data-rk="${k}">${REP_ICON[k]||""} ${esc(v)}</button>`).join("");
  $("repDlg").showModal();
}
$("repDlg").addEventListener("click",e=>{
  if(e.target===$("repDlg")||e.target.closest("[data-rpclose]")){ $("repDlg").close(); return; }
  const b=e.target.closest("[data-rk]"); if(b){ repKind=b.dataset.rk; $("rpKinds").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); }
});
$("rpHere").addEventListener("click",()=>{ if(!navigator.geolocation){ $("rpMsg").textContent="This browser can't share your location."; return; }
  $("rpMsg").textContent="Finding you…"; navigator.geolocation.getCurrentPosition(p=>{ repAt={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),name:"where you are"}; $("rpWhere").textContent="At where you are now"; $("rpMsg").textContent=""; },()=>{ $("rpMsg").textContent="Location not shared."; },{enableHighAccuracy:true,timeout:15000}); });
$("repForm").addEventListener("submit",async e=>{ e.preventDefault();
  if(!repKind){ $("rpMsg").textContent="Pick what you saw."; return; } if(!repAt){ $("rpMsg").textContent="Where was it? Use where you are now, or report from a stop."; return; }
  $("rpMsg").textContent="Sending…";
  try{ await api("/api/reports",{method:"POST",body:{kind:repKind,text:$("rpText").value.trim(),lat:repAt.lat,lon:repAt.lon,seen_on:$("rpDate").value,route:trip.pick?"pick:"+trip.pick:trip.savedId||""}});
    $("repDlg").close(); reps.key=""; loadReports(); $("status").textContent="Thanks. Riders on this road will see it."; }
  catch(err){ $("rpMsg").textContent=err.message; } });
document.addEventListener("click",e=>{ const r=e.target.closest&&e.target.closest("[data-repat]"); if(!r) return; const [lat,lon,...n]=r.dataset.repat.split(","); openReport({lat:+lat,lon:+lon,name:n.join(",")}); });

/* ratings: a pick or a shared route */
const rateKey=()=>trip.pick?"pick:"+trip.pick:(trip.savedId||trip.sharedId||"");
let rating={key:"",data:null};
async function loadRating(){ const k=rateKey(); if(!acct.ready||!k||k===rating.key) return; rating={key:k,data:null};
  try{ rating.data=await api("/api/ratings?route="+encodeURIComponent(k)); renderDetails(); }catch(e){} }
function rateLine(){
  if(!acct.ready||!rateKey()) return ""; const d=rating.key===rateKey()?rating.data:null;
  const sum=d&&d.n?`<span>★ ${d.stars} from ${d.n} rider${d.n>1?"s":""}${d.grade?` · riders say ${GRADES[Math.round(d.grade)].name}`:""}</span>`:`<span class="note">No ratings yet.</span>`;
  return `<div class="rateline">${sum}<button class="linkbtn" type="button" data-rate>${d&&d.mine?"Change your rating":"Rode it? Rate it"}</button></div>`;
}
let rtStars=0;
function openRate(){
  if(!acct.user){ acct.why="Sign in to rate this route. Ratings only come from riders who've ridden it."; openAcct("signin"); return; }
  const m=rating.data&&rating.data.mine; rtStars=m?m.stars:0; $("rtMsg").textContent="";
  $("rtStars").innerHTML=[1,2,3,4,5].map(i=>`<button type="button" data-st="${i}" class="${i<=rtStars?"on":""}" aria-label="${i} star${i>1?"s":""}">★</button>`).join("");
  $("rtGrade").innerHTML=GRADES.slice(1).map(x=>`<option value="${x.g}">${x.name} (${vehNote(x.g)})</option>`).join("");
  const G=tripGrade(); $("rtGrade").value=m?m.grade:(G&&G.top||2); $("rtDate").value=m?m.rode_on:""; $("rtDate").max=ymd(new Date()); $("rtVeh").value=m&&m.vehicle||settings.vehicle||"bike";
  $("rateDlg").showModal();
}
$("rateDlg").addEventListener("click",e=>{ if(e.target===$("rateDlg")||e.target.closest("[data-rtclose]")){ $("rateDlg").close(); return; }
  const s=e.target.closest("[data-st]"); if(s){ rtStars=+s.dataset.st; $("rtStars").querySelectorAll("button").forEach(b=>b.classList.toggle("on",+b.dataset.st<=rtStars)); } });
$("rateForm").addEventListener("submit",async e=>{ e.preventDefault();
  if(!rtStars){ $("rtMsg").textContent="Pick 1 to 5 stars."; return; } if(!$("rtDate").value){ $("rtMsg").textContent="When did you ride it?"; return; }
  try{ await api("/api/ratings",{method:"POST",body:{route:rateKey(),stars:rtStars,grade:+$("rtGrade").value,rode_on:$("rtDate").value,vehicle:$("rtVeh").value}}); $("rateDlg").close(); rating.key=""; loadRating(); $("status").textContent="Thanks for rating it."; }
  catch(err){ $("rtMsg").textContent=err.message; } });
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-rate]")) openRate(); });

// after every render: fetch what's missing (cheap; each loads once per route)
{ const _ra=renderAll; renderAll=function(){ _ra(); if(acct.ready&&plan&&!planStale){ loadReports(); loadRating(); } }; }
