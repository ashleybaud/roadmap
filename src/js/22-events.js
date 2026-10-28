/* ---------- what riders do: anonymous daily counts (no names, emails, places or IP kept) ---------- */
/* Each kind is counted at most once per page visit, so a rider re-planning ten times counts as one "planned". */
const EVENT_NAMES=["visit","plan","try","pick","gpx","gpx_all","group","gmaps","waze","pdf","save","near","book","signin","report"];
const tracked=new Set();
function track(name){
  if(!EVENT_NAMES.includes(name)||tracked.has(name)) return; tracked.add(name);
  if(/^(localhost|127\.)|\.test$/.test(location.hostname)||navigator.webdriver) return; // not from tests or local copies
  try{ const body=JSON.stringify({name}); if(navigator.sendBeacon) navigator.sendBeacon("/api/event",new Blob([body],{type:"text/plain"})); else fetch("/api/event",{method:"POST",body,keepalive:true}); }catch(e){}
}
track("visit");
// wrap the existing actions rather than editing each one
{ const wrap=(fn,name,test)=>function(...a){ if(!test||test(...a)) track(name); return fn.apply(this,a); };
  if(typeof downloadGpx==="function") downloadGpx=wrap(downloadGpx,"gpx");
  { const g=downloadGpx; downloadGpx=function(k){ if(k==="all") track("gpx_all"); return g.apply(this,arguments); }; }
  if(typeof groupPack==="function") groupPack=wrap(groupPack,"group");
  if(typeof openPick==="function") openPick=wrap(openPick,"pick");
  if(typeof nearOn==="function") nearOn=wrap(nearOn,"near");
  if(typeof saveRoute==="function") saveRoute=wrap(saveRoute,"save");
  if(typeof printTrip==="function") printTrip=wrap(printTrip,"pdf");
  if(typeof recalc==="function"){ const r=recalc; recalc=async function(){ const out=await r.apply(this,arguments); if(plan&&!planStale) track("plan"); return out; }; }
}
document.addEventListener("click",e=>{
  const a=e.target.closest&&e.target.closest("a[href]"); if(!a) return; const h=a.getAttribute("href")||"";
  if(h.includes("google.com/maps/dir")) track("gmaps"); else if(h.includes("waze.com/ul")) track("waze");
  else if(/booking\.com|hostelworld|discovercars|getyourguide|stay22|travelpayouts/.test(h)) track("book");
},true);

/* ---------- "Try a route": one tap opens a finished founder trip, so a newcomer sees what it does before filling anything in ---------- */
let TRY_PICK="swartberg-loop";
/* the right door: visitors from Southern Africa get a trip from home; everyone else gets the planner plus the Southern Africa band */
const LOCAL=["ZA","NA","BW","LS","SZ","ZW","MZ"];
fetch("/api/where").then(r=>r.ok?r.json():null).then(j=>{ const c=j&&j.country; if(!c||LOCAL.includes(c)) return;
  TRY_PICK="namibia-2020-tortoise"; const b=$("tryBtn"); if(b) b.textContent="Try a route: Northern Namibia by 4x4, 8 days ›";
  const h=$("heroBand"); if(h) h.hidden=false; }).catch(()=>{});
async function tryRoute(){
  track("try");
  try{ if($("welcome").open){ try{ localStorage.setItem("rr-welcome","1"); }catch(e){} $("welcome").close(); }
    picks=picks||await loadPicks(); const r=picks.find(x=>x.id===TRY_PICK)||picks.find(x=>!x.draft);
    if(r){ openPick(r); $("status").textContent=`Opened ${r.title}. Change anything: dates, stops, your vehicle. Tap New to start your own.`; if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"}); }
  }catch(e){ $("status").textContent="Couldn't open the sample route. Try Open › Find a route."; }
}
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-tryroute]")){ e.preventDefault(); tryRoute(); } });
