
/* ================= v4: plan by dates ================= */
const TABS={fuel:"Fuel",stay:"Stay",food:"Food",sight:"Sights"};
const DAYCOL=["#0F7B8A","#2F5BA8","#9A6A33","#6B4E9B","#B3261E","#00838F","#5D4037"];
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function addDays(s,n){const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return ymd(d);}
const dayName=k=>dayDate(k).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
const dayLong=k=>dayDate(k).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const fmtDate=d=>d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
const tomorrow=ymd(new Date(Date.now()+86400000));
const pt=(name,lat,lon,extra)=>Object.assign({name,lat,lon},extra||{});

function migrate(){
  const old=store.get("rr2-trip"); if(!old||!old.stops||old.stops.length<2) return null;
  const st=old.stops.filter(x=>x.lat!=null); if(st.length<2) return null;
  const days=[]; let cur={style:"default",vias:[],legs:[]};
  for(let i=1;i<st.length-1;i++){const x=st[i]; if(x.type==="sleep"||x.night){cur.to=pt(x.name,x.lat,x.lon);days.push(cur);cur={style:"default",vias:[],legs:[]};} else cur.vias.push(pt(x.name,x.lat,x.lon,{type:x.type||"pass"}));}
  days.push(cur);
  const start=old.date||tomorrow, f=st[0], l=st[st.length-1];
  return {startDate:start,endDate:addDays(start,days.length-1),start:pt(f.name,f.lat,f.lon),end:pt(l.name,l.lat,l.lon),round:!!old.round,days};
}
const freshTrip=()=>({startDate:tomorrow,endDate:tomorrow,start:pt("My location",null,null),end:null,round:false,days:[{to:null,style:"default",vias:[],legs:[]}]});
const trip=store.get("rr4-trip")||migrate()||freshTrip();
if(trip.sugV!==5){ (trip.days||[]).forEach(d=>{ const n=(d.vias||[]).length; d.vias=(d.vias||[]).filter(v=>!v.auto); if(d.vias.length!==n) d.legs=[]; d.fresh=true; delete d.noMore; }); trip.sugV=5; }
if(trip.startDate<ymd(new Date())){const n=trip.days.length;trip.startDate=tomorrow;trip.endDate=addDays(tomorrow,n-1);}

const SET_FIELDS=["vehicle","range","leave","pace","corridor","style","maxHours","breakMin","gps"];
const settings=Object.assign({range:200,reserve:30,leave:"08:00",pace:0,corridor:5,style:"rough",vehicle:"bike",fuelMode:"suggest",maxHours:8,breakMin:20,gps:"any"},store.get("rr2-settings")||{});
// fuel range follows the vehicle until you set your own: 200 km on a bike, 450 km in a car or 4x4 (both with a margin)
const RANGE_DEF={bike:200,car:450,jeep:450};
if(settings.rangeSet===undefined&&+settings.range!==200&&+settings.range!==150) settings.rangeSet=true; // someone who already chose their own keeps it
if(!settings.rangeSet) settings.range=RANGE_DEF[settings.vehicle]||200;
const ui=Object.assign({types:Object.fromEntries(TYPES.map(t=>[t.id,t.on])),max:"10",sleep:false},store.get("rr4-ui")||{});
ui.tab=ui.tab??"ov"; delete ui._lastSel;
let passNear=[];
let plan=null, pois=[], fuelStations=[], fuelAll=[], stays=[], placesOk=false, dataDate="", seq=0, panel=null, fp=null;
fetch("/data/updated.json").then(r=>r.ok?r.json():null).then(j=>{if(j&&j.updated)dataDate=new Date(j.updated).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}).catch(()=>{});

const save=()=>store.set("rr4-trip",trip), saveUi=()=>store.set("rr4-ui",ui);
const nDays=()=>trip.days.length;
function dayCountFromDates(){const a=new Date(trip.startDate+"T12:00:00"),b=new Date(trip.endDate+"T12:00:00");return Math.max(1,Math.min(60,Math.round((b-a)/86400000)+1));}
function syncDays(){
  const n=dayCountFromDates();
  while(trip.days.length<n) trip.days.splice(trip.days.length-1,0,{to:null,style:"default",vias:[],legs:[]});
  while(trip.days.length>n){const last=trip.days.pop(),prev=trip.days[trip.days.length-1]; if(prev.to&&!prev.to.autoNight) prev.vias.push(Object.assign(prev.to,{type:"pass"})); prev.to=null; prev.vias.push(...last.vias); prev.legs=[];}
  if(ui.tab!=="ov"&&ui.tab>=trip.days.length) ui.tab="ov";
}
// how many days a one-way trip needs: the riding time (plus a break at every fuel stop) over your "longest day" setting. Worked out once per trip; − / + or your own night stops take over
function autoDayCount(){
  if(trip.daysSet||trip.round||!plan||!trip.end||trip.gpx||trip.pick||trip.days.slice(0,-1).some(d=>d.to&&!d.to.autoNight)) return false; // your own nights: you decide the days
  const own=trip.days.flatMap(d=>d.vias.filter(v=>!v.auto&&!v.autoNight)).map(v=>v.lat.toFixed(3)+","+v.lon.toFixed(3));
  const sig=[trip.start.lat.toFixed(3),trip.start.lon.toFixed(3),trip.end.lat.toFixed(3),trip.end.lon.toFixed(3),settings.maxHours,settings.vehicle,settings.style,...own].join("|");
  if(trip.autoDaysSig===sig) return false; trip.autoDaysSig=sig;
  const mins=plan.days.reduce((t,d,k)=>t+(d?dayMinutes(k):0),0)+Math.floor(plan.total/Math.max(50,+settings.range||200))*(+settings.breakMin||20), want=Math.max(1,Math.min(14,Math.ceil(mins/(Math.max(2,+settings.maxHours||8)*60)-0.1)));
  if(want===nDays()) { save(); return false; }
  trip.endDate=addDays(trip.startDate,want-1); syncDays(); save(); return true;
}
// sleep at a stop: it becomes that day's night stop and the rest of the day moves to a new day
function sleepAt(k,i){
  const d=trip.days[k], v=d.vias[i]; if(!v) return;
  const nd={to:d.to,style:d.style,vias:d.vias.slice(i+1),legs:[]};
  d.vias=d.vias.slice(0,i); d.to=Object.assign(v,{type:undefined}); delete d.to.auto; delete d.to.autoNight; d.legs=[]; delete d.noAutoNight;
  trip.days.splice(k+1,0,nd); trip.daysSet=true; trip.endDate=addDays(trip.startDate,nDays()-1);
}
// no night here: the two days become one, the night stop stays on the way (a suggested one just goes)
function dropNight(k){
  const d=trip.days[k], nx=trip.days[k+1]; if(!nx) return;
  if(d.to&&!d.to.autoNight) d.vias.push(Object.assign(d.to,{type:"pass"}));
  d.vias.push(...nx.vias); d.to=nx.to; d.legs=[]; trip.days.splice(k+1,1); trip.daysSet=true; trip.endDate=addDays(trip.startDate,nDays()-1);
  if(ui.tab!=="ov"&&ui.tab>=nDays()) ui.tab="ov";
}
const endPt=()=>trip.round?trip.start:trip.end;
const dayFrom=k=>k===0?trip.start:trip.days[k-1].to;
const dayTo=k=>k===nDays()-1?endPt():trip.days[k].to;
const dayDate=k=>new Date(addDays(trip.startDate,k)+"T12:00:00");
function dayPts(k){const a=dayFrom(k),b=dayTo(k); if(!a||!b||a.lat==null||b.lat==null) return null; const v=trip.days[k].vias.filter(v=>v.lat!=null); if(!v.length&&hav(a,b)<0.2) return null; return [a,...v,b];}
function townPoints(){const s=new Set(); trip.days.forEach((d,k)=>{const p=dayPts(k); if(p) p.forEach(x=>s.add(x));}); return [...s];}
const styleName=()=>({rough:"Road less travelled",mixed:"Mixed",tar:"Tar"})[settings.style]||"Road less travelled";

/* ---------- planning ---------- */
async function recalc(){
  const my=++seq; syncDays(); save();
  if(!trip.start||trip.start.lat==null){ plan=null; fp=null; if(!/Getting|Tap/.test($("status").textContent))$("status").textContent="Pick where you start."; renderAll(); return; }
  $("status").textContent="Working out the route…"; planStale=true; renderAll();
  try{ if(await autoNights()){ if(my!==seq) return; $("status").textContent="Picked your night stops. Change any of them. Working out the route…"; renderAll(); } }catch(e){}
  if(my!==seq) return;
  try{
    const gs=gpxSlices(), gtr=(k,j)=>gs&&gs[k]&&gs[k][j]||null;
    const res=await Promise.all(trip.days.map((d,k)=>{const pts=dayPts(k); if(!pts) return null; 
      return Promise.all(pts.slice(0,-1).map((a,j)=>routeLeg(a,pts[j+1],{fast:legFast(d,j),track:(d.legs[j]&&d.legs[j].track)||gtr(k,j)||(pts[j+1].straight?[[pts[j].lat,pts[j].lon],[pts[j+1].lat,pts[j+1].lon]]:null),alts:d.legs[j]&&d.legs[j].wantAlts}))).then(opts=>({pts,opts}));}));
    if(my!==seq) return;
    const geom=[],cum=[],ptKm=new Map(),days=[]; let acc=0;
    res.forEach((r,k)=>{
      if(!r){days.push(null);return;}
      const d=trip.days[k];
      const legs=r.opts.map((o,j)=>{const ch=o[Math.min((d.legs[j]&&d.legs[j].alt)||0,o.length-1)];return {km:ch.km,min:ch.min,geom:ch.geom,gravelKm:ch.gravelKm,grades:ch.grades||[[0,ch.km,0]],n:o.length,alts:o.map(x=>x.km),gpx:!(d.legs[j]&&d.legs[j].track)&&!!gtr(k,j)};});
      if(!ptKm.has(r.pts[0])) ptKm.set(r.pts[0],acc);
      legs.forEach((L,j)=>{L.a=acc; L.geom.forEach((g,i)=>{if(geom.length&&i>0)acc+=hav(geom[geom.length-1],g); geom.push(g);cum.push(acc);}); L.b=acc; ptKm.set(r.pts[j+1],acc);});
      days.push({pts:r.pts,legs,km:legs.reduce((t,x)=>t+x.km,0),min:legs.reduce((t,x)=>t+x.min,0),a:legs[0].a,b:legs[legs.length-1].b});
    });
    if(!geom.length){plan=null;fp=null;$("status").textContent="Pick where you're going to see the route.";renderAll();return;}
    plan={days,geom,cum,total:acc,ptKm}; planStale=false;
    if(autoDayCount()){ recalc(); return; }
    $("status").textContent="Finding fuel and places…";
    renderAll();
    loadWeather(my).then(()=>{if(my===seq) renderAll();}).catch(()=>{wx=null;});
    const ok=await loadPlaces(my); if(my!==seq) return;
    fp=fuelPlan(); if(autoRounds<1&&autoFuel()){ autoRounds++; save(); recalc(); return; }
    $("status").textContent=ok===false?"Fuel stations couldn't load. Checking your own fuel stops only.":ok==="partial"?"Points of interest couldn't load.":"";
    renderAll();
  }catch(e){ if(my===seq){$("status").textContent="Couldn't get a route. Check each place is on a road, and your connection."; renderAll();} }
}

/* ---------- fuel ---------- */
let townList=null; allTowns().then(t=>{ townList=t.filter(x=>x.place!=="hamlet"); townLabels(); if(plan){ plan._cands=null; if(placesOk){ fp=fuelPlan(); if(autoRounds<1&&autoFuel()){ autoRounds++; save(); recalc(); return; } } renderAll(); } }).catch(()=>{});
/* fuel: riders fill up wherever there's fuel. We only flag stretches with no known fuel longer than the bike's range. */
/* fuel: we suggest towns to stop in (fuel, preferably food) at least every "stop every" km.
   Towns on the route first; if none, the nearest one off the route with the detour. */
let fuelRowsAll=null, foodRowsAll=null;
function stopTowns(){
  if(!plan||!townList) return [];
  if(plan._cands) return plan._cands;
  const g=plan.geom, c=plan.cum, step=Math.max(1,Math.floor(g.length/2000)), out=[];
  let s=90,w=180,n=-90,e=-180; g.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const fuelSrc=fuelRowsAll||fuelAll, foodSrc=foodRowsAll||pois.filter(x=>x.kind==="food");
  townList.forEach(t=>{ if(t.lat<s-0.6||t.lat>n+0.6||t.lon<w-0.7||t.lon>e+0.7) return;
    const hits=locateDays(t,g,c,60).filter(r=>r.off<=60); if(!hits.length) return;
    const fuel=fuelSrc.some(f=>Math.abs(f.lat-t.lat)<0.04&&hav(f,t)<=3), food=foodSrc.some(f=>Math.abs(f.lat-t.lat)<0.03&&hav(f,t)<=2);
    hits.forEach(r=>out.push({name:t.name,lat:t.lat,lon:t.lon,km:r.km,off:r.off,fuel,food,place:t.place})); });
  out.sort((a,b)=>a.km-b.km); plan._cands=out.filter((t,i,a)=>!a.slice(0,i).some(o=>o.name===t.name&&Math.abs(o.km-t.km)<20)); return plan._cands;
}
function daySuggest(k,ignoreAuto){
  const pd=plan&&plan.days[k], S=+settings.range||0; if(!pd||!placesOk) return {through:[],sugg:[],probs:[]};
  const no=trip.days[k].noAuto||[], cands=stopTowns().filter(t=>!no.includes(t.name)), through=cands.filter(t=>t.off<=2&&t.km>=pd.a-1&&t.km<=pd.b+1);
  const own=pd.pts.slice(1,-1).map((p,i)=>({p,km:pd.legs[i].b})).filter(x=>stopFuel(x.p)&&!(ignoreAuto&&x.p.auto));
  const sugg=[], probs=[]; if(!(S>0)) return {through,sugg,probs};
  let pos=pd.a, posName=pd.pts[0].name, guard=0;
  const inWin=(t,win)=>t.km>pos+5&&t.km<=win;
  while(pd.b-pos>S&&guard++<50){
    const win=pos+S, o=own.filter(x=>x.km>pos+5&&x.km<=win).pop();
    if(o){ pos=o.km; posName=o.p.name; continue; }
    // pick: a fuel town late in the window (so stops aren't bunched), on the route if possible, with food if possible
    const choose=l=>{ const late=l.filter(t=>t.km>=pos+S*0.6);
      if(!late.length) return l.slice().sort((x,y)=>((x.off>2)-(y.off>2))||(y.km-x.km))[0];
      return late.slice().sort((x,y)=>((x.off>2)-(y.off>2))||((!x.food)-(!y.food))||(y.km-x.km))[0]; };
    let pick=null, pi=-1; const mo=2; // only towns on the route: a suggestion must never bend the route. Fuel off the route is shown with the gap warning, to add by hand
    const fuelL=cands.filter(t=>t.fuel&&t.off<=mo&&inWin(t,win));
    if(fuelL.length){ pick=choose(fuelL); pi=0; } else { const anyL=cands.filter(t=>t.off<=mo&&inWin(t,win)); /* a town without fuel is only worth a short detour */ if(anyL.length){ pick=choose(anyL); pi=2; } }
    if(pick&&pi>=2){ const nf=cands.filter(t=>t.fuel&&t.off<=40&&t.km>win&&t.km<pd.b)[0]; probs.push({from:pos,to:nf?nf.km:pd.b,fromName:posName,toName:nf?nf.name:pd.pts[pd.pts.length-1].name}); }
    if(pick){ sugg.push(pick); pos=pick.km; posName=pick.name; continue; }
    const next=cands.filter(t=>t.km>win&&t.km<pd.b&&t.off<=mo).sort((x,y)=>(x.off<=5?0:1)-(y.off<=5?0:1)||x.km-y.km)[0];
    probs.push({from:pos,to:next?next.km:pd.b,fromName:posName,toName:next?next.name:pd.pts[pd.pts.length-1].name});
    if(!next) break; sugg.push(next); pos=next.km; posName=next.name;
  }
  return {through,sugg,probs};
}
function fuelPlan(){
  const fills=(placesOk?fuelStations:[]).map(f=>({id:f.id,km:f.km,lat:f.lat,lon:f.lon,name:f.name&&f.name!=="Fuel"?f.name:"Fuel station",tags:f.tags,st:true}));
  return {fills,days:plan.days.map((d,k)=>d?daySuggest(k):null)};
}
/* small towns within 5 km of the route, so a rider can judge a long stretch for themselves */
function rangeFuel(a,b){
  if(!fp||!fp.days) return null;
  const k=plan.days.findIndex(d=>d&&Math.abs(d.a-a)<0.5&&Math.abs(d.b-b)<0.5); if(k<0) return null;
  const pr=fp.days[k]&&fp.days[k].probs[0]; if(!pr) return null; const len=Math.round(pr.to-pr.from);
  return {level:"warn",len,k,from:pr.from,to:pr.to,short:`No fuel for ${len} km`,text:`No fuel on our map for ${len} km, ${pr.fromName} to ${pr.toName}`};
}
// climb and descent over one stretch (same smoothing as the day's figures)
function legElev(a,b){ const pts=[]; plan.geom.forEach((g,i)=>{ if(plan.cum[i]>=a-0.01&&plan.cum[i]<=b+0.01&&g.ele!=null) pts.push(g.ele); }); if(pts.length<5) return null;
  let up=0,dn=0,ref=pts[0]; pts.forEach(e=>{ const d=e-ref; if(d>=8){ up+=d; ref=e; } else if(d<=-8){ dn-=d; ref=e; } }); return {up:Math.round(up),dn:Math.round(dn)}; }
function legElevTxt(a,b){ const e=legElev(a,b); return e?` · ↑${fmtM(e.up)} ↓${fmtM(e.dn)} m`:""; }
// the fuel gap button opens the stretch where the gap ends, and keeps it in view
function goGap(k){ const f=rangeFuel(plan.days[k].a,plan.days[k].b); if(!f) return false; const pd=plan.days[k];
  let j=pd.legs.findIndex(L=>L.b>=f.to-0.5); if(j<0) j=pd.legs.length-1; ui.tab=k; saveUi(); stopFocus=null; renderAll();
  focusR={a:f.from,b:f.to}; drawMap(); // the gap on the map; the stop stays closed: the rider opens it if they want
  setTimeout(()=>{ const b=document.querySelector(`#details [data-stop="${k}:${j+1}"]`); if(b){ const st=b.closest(".stop"); st.scrollIntoView({behavior:"smooth",block:"center"}); st.classList.add("flash"); setTimeout(()=>st.classList.remove("flash"),2500); } },60);
  $("status").textContent=`${f.text}. Your "stop at least every" setting is ${settings.range} km: change it in Settings if your tank goes further.`; return true; }
function fuelPill(f){
  if(!f) return "";
  return `<span class="pill fwarn" title="${esc(f.text)}. Tap to see where.">${ICON.fuel}Check fuel</span>`;
}
function dayMinutes(k){
  const d=plan&&plan.days[k]; if(!d) return 0;
  const pace=1+(+settings.pace||0)/100, stopMin=d.pts.slice(1,-1).reduce((t,p)=>t+breakOf(p),0);
  return d.min*pace+stopMin;
}

/* ---------- search wiring ---------- */
function wireSearch(input,list,onPick,opt){
  let t,ctl,hits=null,hitsQ="",pending=null,pickWhenReady=false,done=false;
  let start0=input.value;
  // the From and Finish boxes are wired once and used again and again: each visit starts fresh
  input.addEventListener("focus",()=>{ done=false; start0=input.value; hits=null; pickWhenReady=false; });
  const pick=h=>{ if(done) return; done=true; list.hidden=true; input.blur(); onPick(pt(h.name,h.lat,h.lon,h.stay?{stay:true}:null)); };
  const run=q=>{ ctl?.abort(); ctl=new AbortController(); list.innerHTML=`<div class="note" style="padding:8px">Searching…</div>`; list.hidden=false;
    const c=map?map.getCenter():{lat:-33,lng:19};
    pending=searchPlaces(q,c,ctl.signal).then(r=>{ if(opt&&opt.near) r=nearTrip(r); hits=r; hitsQ=q; pending=null;
      if(pickWhenReady){ pickWhenReady=false; if(r.length) pick(r[0]); else { list.hidden=true; $("status").textContent="Not changed — pick a place from the list."; } return; }
      list.innerHTML=r.map((h,k)=>`<button type="button" data-k="${k}"><b>${esc(h.name)}</b><br><span class="note">${esc(h.sub)}</span></button>`).join("")||`<div class="note" style="padding:8px">No match. Try a nearby town.</div>`;
      list.hidden=false;
      list.querySelectorAll("button").forEach(b=>b.addEventListener("mousedown",e=>{e.preventDefault();pick(r[+b.dataset.k]);}));
    }).catch(()=>{pending=null;}); };
  input.addEventListener("input",()=>{ clearTimeout(t); const q=input.value.trim(); if(q.length<3){list.hidden=true;return;} t=setTimeout(()=>run(q),300); });
  const commit=()=>{ const q=input.value.trim(); if(!q||q===start0.trim()) return false;
    clearTimeout(t);
    if(hits&&hitsQ===q){ if(hits.length) pick(hits[0]); else $("status").textContent="Not changed — pick a place from the list."; return true; }
    pickWhenReady=true; if(!pending||hitsQ!==q) run(q); return true; };
  input.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); commit(); input.blur(); } });
  input.addEventListener("blur",()=>{ setTimeout(()=>{ if(!done&&!commit()) list.hidden=true; },150); });
}
function searchBox(id,value,placeholder,noClear){return `<div class="ac" style="flex:1;min-width:0"><div class="inbtn"><input type="text" id="${id}" class="${value?"":"empty"}" value="${esc(value||"")}" placeholder="${esc(placeholder)}" autocomplete="off">${!noClear&&value?`<button class="icon" type="button" data-clear="${id}" title="Clear" aria-label="Clear">✕</button>`:""}</div><div class="sugg" hidden></div></div>`;}
function hook(id,onPick){const el=document.getElementById(id); if(el) wireSearch(el,el.closest(".ac").querySelector(".sugg"),onPick,{near:/^(night|addvia)-/.test(id)});}
// night stops and stops along the way: only places within reach of the trip (a worldwide search can return a "Colony" in India)
function nearTrip(r){ const a=trip.start&&trip.start.lat!=null?trip.start:null, b=endPt()&&endPt().lat!=null?endPt():null; if(!a&&!b) return r;
  const lim=Math.max(800,a&&b?hav(a,b):0)*1.2, ok=r.filter(h=>(a&&hav(a,h)<=lim)||(b&&hav(b,h)<=lim)); return ok; }

/* ---------- trip bar ---------- */
function renderTripBar(){
  $("startDate").value=trip.startDate; $("stayType").value=trip.stayType||"any"; $("dN").textContent=nDays(); $("dMinus").disabled=nDays()<2;
  $("roundTrip").checked=!!trip.round; $("endField").hidden=!!trip.round;
  if(document.activeElement!==$("startPlace")) $("startPlace").value=trip.start&&trip.start.lat!=null?trip.start.name:"";
  const noStart=!trip.start||trip.start.lat==null; $("startPlace").classList.toggle("need",noStart); $("startPlace").placeholder=noStart?"Tap ⌖ or type a town":"My location or a town";
  if(document.activeElement!==$("endPlace")) $("endPlace").value=trip.round||!trip.end?"":trip.end.name;
  $("endPlace").classList.toggle("need",!trip.round&&!trip.end&&!!trip.start&&trip.start.lat!=null);
  $("sameStart").hidden=!!trip.round||!trip.end; $("clearStart").hidden=!trip.start||trip.start.lat==null;
}
$("stayType").addEventListener("change",e=>{ trip.stayType=e.target.value; trip.days.forEach(d=>{ if(d.stayType===trip.stayType) delete d.stayType; }); save(); renderDetails(); drawMap(); });
// the days follow the trip: one more for every night stop. Leave is the only date; − / + adds or drops a day
$("startDate").addEventListener("change",e=>{const n=nDays();trip.startDate=e.target.value||tomorrow;trip.endDate=addDays(trip.startDate,n-1);changed();});
function setDayCount(n){ n=Math.max(1,Math.min(60,n)); trip.daysSet=true; trip.endDate=addDays(trip.startDate,n-1); changed(); }
$("dMinus").addEventListener("click",()=>setDayCount(nDays()-1));
$("dPlus").addEventListener("click",()=>setDayCount(nDays()+1));
$("roundTrip").addEventListener("change",e=>{ trip.round=e.target.checked; delete trip.daysSet; changed(); });
wireSearch($("startPlace"),$("startPlace").parentElement.nextElementSibling,p=>{trip.start=p;delete trip.daysSet;changed();});
wireSearch($("endPlace"),$("endPlace").parentElement.nextElementSibling,p=>{ if(p.stay&&trip.start&&trip.start.lat!=null){ p=Object.assign({},p); delete p.stay; } trip.end=p;trip.round=false;delete trip.daysSet;changed();});
$("endPlace").addEventListener("change",e=>{ if(!e.target.value.trim()&&trip.end){trip.end=null;changed();} });
$("sameStart").addEventListener("click",()=>{trip.end=null;changed();});
// tapping a place box means you want to change it: select what's there so typing replaces it
document.addEventListener("focusin",e=>{ const el=e.target; if(el&&el.tagName==="INPUT"&&el.type==="text"&&el.closest(".ac")&&el.value) setTimeout(()=>{ try{ el.select(); }catch(x){} },0); });
let toastT;
{ const st=$("status"); let t0; new MutationObserver(()=>{ st.classList.remove("gone"); clearTimeout(t0); if(!/…$/.test(st.textContent)) t0=setTimeout(()=>st.classList.add("gone"),6000); }).observe(st,{childList:true,characterData:true,subtree:true}); }
function setFinish(p){
  const prev={round:trip.round,end:trip.end}; trip.end=p; trip.round=false; changed();
  const t=$("toast"); t.innerHTML=`Finish changed to ${esc(p.name)}. <button type="button" class="linkbtn">Undo</button>`; t.hidden=false;
  t.querySelector("button").onclick=()=>{trip.round=prev.round;trip.end=prev.end;t.hidden=true;changed();};
  clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,8000);
}
function useMyLocation(){
  if(!navigator.geolocation){$("status").textContent="This browser can't share your location. Type a town.";return;}
  $("status").textContent="Getting your location…";
  navigator.geolocation.getCurrentPosition(async p=>{ const here={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5)};
    // computers without GPS guess from the network and can be a country out. Check it against where the connection is
    const w=await whereP.catch(()=>null);
    if(w&&w.lat!=null&&p.coords.accuracy>2000&&hav(here,w)>300){ trip.start=null; changed(); $("status").textContent="Your browser's location looks wrong, so it isn't used. Type your start town."; $("startPlace").focus(); return; }
    trip.start=pt("My location",here.lat,here.lon);changed();},
    ()=>{$("status").textContent="Location not shared. Type a start town instead.";},{enableHighAccuracy:true,timeout:15000});
}
$("useLoc").addEventListener("click",useMyLocation);
$("clearStart").addEventListener("click",()=>{trip.start=null;$("startPlace").value="";$("startPlace").focus();changed();});
function locateIfAllowed(){ navigator.permissions?.query({name:"geolocation"}).then(r=>{if(r.state==="granted") useMyLocation();}).catch(()=>{}); }
// a "My location" saved from a bad network guess (a country out): drop it
if(trip.start&&trip.start.name==="My location"&&trip.start.lat!=null) whereP.then(w=>{ if(w&&w.lat!=null&&trip.start&&trip.start.name==="My location"&&hav(trip.start,w)>300){ trip.start=pt("My location",null,null); changed(); locateIfAllowed(); } });
if(trip.start&&trip.start.name==="My location"&&trip.start.lat==null){
  locateIfAllowed();
}

/* ---------- day tabs ---------- */
function renderTabs(){
  if(nDays()===1&&ui.tab!=="ov") ui.tab="ov";
  const tabs=[`<button class="dtab ${ui.tab==="ov"?"on":""}" data-day="ov" role="tab"><b>Overview</b><span class="note">${nDays()} day${nDays()>1?"s":""}</span></button>`];
  if(nDays()>1) trip.days.forEach((d,k)=>{
    const f=plan&&plan.days[k]?dayRisk(k):null, to=dayTo(k);
    tabs.push(`<button class="dtab ${ui.tab===k?"on":""}" data-day="${k}" role="tab" title="${esc(dayLong(k))} → ${esc(to?to.name:"night stop?")}"><b>${esc(dayDate(k).toLocaleDateString(undefined,{weekday:"short"}))} ${dayDate(k).getDate()}${f&&f.level!=="ok"?`<span class="tdot" style="background:var(--${f.level==="bad"?"bad":"warn"})"></span>`:""}</b><span class="note tto">→ ${esc(to?to.name:"night stop?")}</span></button>`);
  });
  $("dayTabs").innerHTML=tabs.join("");
  requestAnimationFrame(()=>{ const c=$("dayTabs"), on=c.querySelector(".dtab.on"); if(on&&c.scrollWidth>c.clientWidth) c.scrollTo({left:on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2}); });
}
$("dayTabs").addEventListener("click",e=>{if(e.target.closest("[data-key]")){$("keyDlg").showModal();return;} const b=e.target.closest("[data-day]"); if(!b) return; ui.tab=b.dataset.day==="ov"?"ov":+b.dataset.day; stopFocus=null; saveUi(); closePanel(true); renderAll(); if(window.innerWidth<=1000) $("details").scrollIntoView({behavior:"smooth",block:"start"});});

/* ---------- details ---------- */
const TB=document.querySelector(".tripbar");
function renderDetails(){ hidePeek(); $("tbHold").append(TB); $("details").innerHTML=ui.tab==="ov"?overviewHtml():dayHtml(ui.tab); const slot=$("details").querySelector(".tbslot"); TB.querySelectorAll(".tadd").forEach(x=>x.remove()); if(slot){ slot.replaceWith(TB); const a=$("details").querySelector(".planbox>.tadd"); if(a) TB.insertBefore(a,TB.querySelector(".tbwhen")); } wireDetails(); }

/* ---------- weather, time zones (Open-Meteo, no key) ---------- */
let wx=null, meds=null, fords=null;
function pointAt(km){ let i=plan.cum.findIndex(c=>c>=km); if(i<0) i=plan.geom.length-1; return plan.geom[i]; }
async function loadWeather(my){
  const q=[];
  plan.days.forEach((d,k)=>{ if(!d) return; const s=d.pts[0], e=d.pts[d.pts.length-1];
    [["from",s],["mid",pointAt((d.a+d.b)/2)],["to",e]].forEach(([role,p])=>{ if(p.name!=="My location") q.push({k,role,lat:+p.lat.toFixed(2),lon:+p.lon.toFixed(2)}); }); });
  if(!q.length){wx=null;return;}
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${q.map(x=>x.lat).join(",")}&longitude=${q.map(x=>x.lon).join(",")}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunset&timezone=auto&forecast_days=16`;
  const ctl=new AbortController(); setTimeout(()=>ctl.abort(),20000);
  const r=await fetch(url,{signal:ctl.signal}); if(!r.ok) throw new Error("weather "+r.status);
  const j=await r.json(), arr=Array.isArray(j)?j:[j];
  if(my!==seq) return;
  wx=q.map((x,i)=>Object.assign(x,{tz:arr[i]?.utc_offset_seconds,tzName:arr[i]?.timezone,daily:arr[i]?.daily}));
}
const WXW=c=>c==null?"":c>=95?"Thunderstorms":c>=85?"Snow showers":c>=80?"Showers":c>=71?"Snow":c>=61?"Rain":c>=51?"Drizzle":c>=45?"Fog":c>=3?"Overcast":c>=1?"Partly cloudy":"Clear";
function dayWx(k){
  if(!wx) return null;
  const date=addDays(trip.startDate,k), rows=wx.filter(x=>x.k===k&&x.daily);
  if(!rows.length) return null;
  const hits=rows.map(x=>{const i=x.daily.time.indexOf(date); return i<0?null:{role:x.role,code:x.daily.weather_code[i],tmax:x.daily.temperature_2m_max[i],tmin:x.daily.temperature_2m_min[i],rain:x.daily.precipitation_sum[i],prob:x.daily.precipitation_probability_max[i],gust:x.daily.wind_gusts_10m_max[i],sunset:x.daily.sunset[i]};}).filter(Boolean);
  const from=rows.find(x=>x.role==="from"), to=rows.find(x=>x.role==="to");
  const tz=from&&to&&from.tz!=null&&to.tz!=null&&from.tz!==to.tz?{from:from.tz,to:to.tz}:null;
  if(!hits.length) return date<ymd(new Date())?{none:true,past:true,tz}:{none:true,opens:addDays(date,-15),tz};
  const mx=f=>Math.max(...hits.map(h=>h[f]??-99)), mn=f=>Math.min(...hits.map(h=>h[f]??99));
  const toH=hits.find(h=>h.role==="to");
  return {code:mx("code"),tmax:mx("tmax"),tmin:mn("tmin"),rain:mx("rain"),prob:mx("prob"),gust:mx("gust"),sunset:toH&&toH.sunset,tz};
}
const utc=s=>`UTC${s>=0?"+":"−"}${Math.abs(s/3600)}`;
function wxText(w){
  if(!w) return "";
  if(w.none) return `Forecast from ${fmtDate(new Date(w.opens+"T12:00:00"))}`;
  return `${WXW(w.code)} · ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C · rain ${w.rain<0.5?"none":Math.round(w.rain)+" mm"}${w.prob>=20?` (${w.prob}%)`:""} · gusts ${Math.round(w.gust)} km/h`;
}

/* ---------- medical + river crossings (own map data) ---------- */
function dayMed(k){
  const pd=plan&&plan.days[k]; if(!pd||!meds) return null;
  const hosp=meds.filter(m=>m.type==="hospital"), samples=[];
  for(let km=pd.a;km<=pd.b;km+=10) samples.push(pointAt(km));
  let far=0; samples.forEach(s=>{let best=999; hosp.forEach(h=>{const d=hav(s,h); if(d<best)best=d;}); far=Math.max(far,best);});
  const near=meds.filter(m=>m.km!=null&&m.km>=pd.a-1&&m.km<=pd.b+1&&m.off<=25).sort((a,b)=>a.km-b.km);
  return {far,near};
}
function dayFords(k){ const pd=plan&&plan.days[k]; if(!pd||!fords) return null; return fords.filter(f=>f.km>=pd.a&&f.km<=pd.b).length; }

/* ---------- safety light: one per day, worst three reasons ---------- */
const fmtFar=f=>f>150?"150+":String(Math.round(f));
const RANK_L={bad:2,warn:1,info:0};
function dayRisk(k){
  const pd=plan&&plan.days[k]; if(!pd) return null;
  const r=[], add=(lvl,text,kind,short)=>r.push({lvl,text:short||text,kind,short:short||text});
  const f=rangeFuel(pd.a,pd.b); if(f&&f.level) add(f.level,f.text,"fuel",f.short);
  const mins=dayMinutes(k), arrive=toMin(settings.leave)+mins, s=sunMin(k);
  if(s!=null){ if(s<arrive) add("bad",`Arrives after dark: ${fmtT(arrive)}, sunset ${fmtT(s)}.`,"dark",`After dark: arrive ${fmtT(arrive)}, sunset ${fmtT(s)}`); else if(s-arrive<60) add("warn",`Arrives ${fmtT(arrive)}, under an hour before sunset.`,"dark",`Close to sunset: arrive ${fmtT(arrive)}`); }
  if(mins>+settings.maxHours*60) add("warn",`Travel time ${fmtDur(mins)}, over your ${settings.maxHours}h setting.`,"long",`Travel time ${fmtDur(mins)}`);
  const w=dayWx(k);
  if(w&&!w.none){
    if(w.code>=95) add("warn","Thunderstorms forecast.","wx","Storms");
    if(w.gust>=80) add("bad",`Wind gusts to ${Math.round(w.gust)} km/h.`,"wx",`Gusts ${Math.round(w.gust)} km/h`); else if(w.gust>=60) add("warn",`Strong wind, gusts to ${Math.round(w.gust)} km/h.`,"wx",`Gusts ${Math.round(w.gust)} km/h`);
    if(w.tmax>=42) add("bad",`Extreme heat: ${Math.round(w.tmax)}°C.`,"wx",`${Math.round(w.tmax)}°C`); else if(w.tmax>=37) add("warn",`Hot: ${Math.round(w.tmax)}°C. Carry extra water.`,"wx",`${Math.round(w.tmax)}°C`);
    if(w.tmin<=2) add("warn",`Near freezing: ${Math.round(w.tmin)}°C. Watch for ice early.`,"wx",`Near freezing: ${Math.round(w.tmin)}°C`);
    if(w.rain>=25) add("bad",`Heavy rain: ${Math.round(w.rain)} mm.`,"wx",`Rain ${Math.round(w.rain)} mm`); else if(w.rain>=8&&w.prob>=50) add("warn",`Rain likely: ${Math.round(w.rain)} mm.`,"wx",`Rain ${Math.round(w.rain)} mm`);
  }
  { const last=k===nDays()-1, n=trip.days[k].vias.filter(v=>v.stay).length+(last?0:1); if(n>1) add("warn",`${n} places to stay on this day. Check that's what you want.`,"stay",`${n} places to stay`); }
  const fd=dayFords(k);
  if(fd) add(w&&!w.none&&w.rain>=5?"warn":"info",`${fd} river crossing${fd>1?"s":""} on the route${w&&!w.none&&w.rain>=5?", and rain forecast":""}.`,"ford",`${fd} river crossing${fd>1?"s":""}`);
  const m=dayMed(k); if(m&&m.far>120) add("warn",`Remote: up to ${fmtFar(m.far)} km from a hospital.`,"med",`Up to ${fmtFar(m.far)} km from a hospital`);
  if(w&&w.tz) add("info",`Clocks change: ${utc(w.tz.from)} to ${utc(w.tz.to)}.`,"tz",`Clocks: ${utc(w.tz.from)} → ${utc(w.tz.to)}`);
  r.sort((a,b)=>RANK_L[b.lvl]-RANK_L[a.lvl]);
  const top=r.length?r[0].lvl:"info";
  return {level:top==="bad"?"bad":top==="warn"?"warn":"ok",reasons:r};
}
function sunMin(k){
  const w=dayWx(k); if(w&&!w.none&&w.sunset){const t=w.sunset.split("T")[1]; return toMin(t);}
  const to=dayTo(k); if(!to) return null; const ss=sunset(dayDate(k),to.lat,to.lon); return ss.getHours()*60+ss.getMinutes();
}
const FLAG_ICON={wx:"☂",ford:"≈",med:"✚",tz:"◷",stay:"⌂"};
const STYLE_ICON={fast:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="3" fill="#1D5BBF"/><rect x="4" y="5" width="16" height="2.6" fill="#fff"/><path d="M6 21 10.5 9.5M18 21 13.5 9.5" stroke="#fff" stroke-width="2.2" fill="none"/><path d="M12 20.5v-2.5M12 15.5v-2.5" stroke="#fff" stroke-width="1.6"/></svg>`,
  default:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="3" fill="#8A5A2B"/><path d="M8 22c0-5 8-4 8-9s-6-4-6-9" stroke="#fff" stroke-width="2.2" fill="none" stroke-dasharray="3 2.2"/></svg>`};
const WXI=c=>c==null?"":c>=95?"⚡":c>=85?"❄":c>=80?"☂":c>=71?"❄":c>=51?"☂":c>=45?"≋":c>=3?"☁":c>=2?"⛅":"☀";
function sunSpan(k){
  const s=sunMin(k); if(s==null) return ""; const arrive=toMin(settings.leave)+dayMinutes(k);
  const cls=s<arrive?"sbad":s-arrive<60?"swarn":"";
  return `<span class="sun ${cls}" title="Sunset ${fmtT(s)}${cls?`. Arrive about ${fmtT(arrive)} if you leave at ${fmtT(toMin(settings.leave))}.`:""}">☼ ${fmtT(s)}</span>`;
}
function wxLink(k){
  const w=dayWx(k), to=dayTo(k); if(!to) return "";
  const href=`https://www.windy.com/?${to.lat.toFixed(2)},${to.lon.toFixed(2)},9`;
  if(!w) return `<a class="wxlink" href="${href}" target="_blank" rel="noopener" title="Forecast for the area">☁ …</a>`;
  if(w.past) return "";
  if(w.none) return `<a class="wxlink" href="${href}" target="_blank" rel="noopener" title="Forecast for the area">☁ from ${esc(fmtDate(new Date(w.opens+"T12:00:00")))}</a>`;
  return `<a class="wxlink" href="${href}" target="_blank" rel="noopener" title="${esc(wxText(w))}. Opens the forecast for the area.">${WXI(w.code)} ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C</a>`;
}
/* fuel and travel time colour their own pills; everything else is a small coloured icon */
function flagIcons(r,k){
  if(!r) return "";
  const seen=new Set();
  return r.reasons.filter(x=>FLAG_ICON[x.kind]&&!(x.lvl==="info"&&x.kind!=="tz")).filter(x=>!seen.has(x.kind)&&seen.add(x.kind)).map(x=>
    `<button type="button" class="flag ${x.lvl==="bad"?"fbad":x.lvl==="warn"?"fwarn":"finfo"}" data-risk="${k}" title="${esc(r.reasons.filter(y=>y.kind===x.kind).map(y=>y.text).join("\n"))}" aria-label="${esc(x.text)}">${FLAG_ICON[x.kind]}</button>`).join("");
}
const riskOpen=new Set();
function riskHtml(r,k){
  if(!r||!riskOpen.has(k)) return "";
  return `<div class="risklist">${r.reasons.map(x=>`<div class="${x.lvl==="bad"?"rbad":x.lvl==="warn"?"rwarn":"rinfo"}">${esc(x.text)}</div>`).join("")||`<div class="rinfo">Nothing flagged for this day.</div>`}</div>`;
}
function timePill(k,km,mins,attrs){ const long=mins>+settings.maxHours*60; return `<span class="pill dist ${long?"long":""}" ${attrs||""} title="${long?`Travel time over your ${settings.maxHours}h setting. `:""}Show on the map">${Math.round(km)} km · ${fmtDur(mins)}</span>`; }


/* ---------- printable trip summary (Save as PDF) ---------- */
const FEEDBACK_EMAIL="feedback@onetrackmind.online";
function routeSketch(){
  const g=plan.geom; let s=90,w=180,n=-90,e=-180; g.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const kx=Math.cos(rad((s+n)/2)), W=680, H=Math.max(220,Math.min(520,W*(n-s)/Math.max(1e-6,(e-w)*kx))), pad=40;
  const sc=Math.min((W-2*pad)/Math.max(1e-6,(e-w)*kx),(H-2*pad)/Math.max(1e-6,n-s));
  const X=lon=>pad+(lon-w)*kx*sc, Y=lat=>pad+(n-lat)*sc;
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:110mm">`;
  plan.days.forEach((d,k)=>{ if(!d) return; const pts=seg(d.a,d.b).filter((p,i,a)=>i%3===0||i===a.length-1);
    svg+=`<polyline fill="none" stroke="${DAYCOL[k%DAYCOL.length]}" stroke-width="3" points="${pts.map(p=>X(p.lon).toFixed(1)+","+Y(p.lat).toFixed(1)).join(" ")}"/>`; });
  const labels=[trip.start,...trip.days.slice(0,-1).map(d=>d.to),endPt()].filter((p,i,a)=>p&&p.lat!=null&&a.indexOf(p)===i);
  labels.forEach(p=>{svg+=`<circle cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="5" fill="#fff" stroke="#11262B" stroke-width="2"/><text x="${(X(p.lon)+8).toFixed(1)}" y="${(Y(p.lat)+4).toFixed(1)}" font-size="12" font-weight="700" fill="#11262B">${esc(p.name)}</text>`;});
  return svg+`</svg>`;
}
function printHtml(){
  const n=nDays(), tot=plan.days.reduce((t,d)=>t+(d?d.km:0),0), ride=plan.days.reduce((t,d,k)=>t+(d?dayMinutes(k):0),0);
  const fin=trip.round?trip.start.name:endPt().name, lv=toMin(settings.leave);
  const lnk=(t,name,town)=>{ t=t||{}; const w=t.website?(/^https?:/.test(t.website)?t.website:"https://"+t.website):`https://www.google.com/search?q=${encodeURIComponent(name+" "+(town||""))}`; return `${t.phone?esc(t.phone)+" · ":""}<a href="${esc(w)}">${t.website?"website":"find online"}</a>`; };
  const li=x=>`<li class="${x.lvl}">${esc(x.text)}</li>`;
  const G=plan.days.map((d,k)=>d?goodToKnow(k):[]);
  // ---- page 1: the whole trip, critical first
  let h=`<section class="pcover"><h1>${esc(trip.start.name)} → ${esc(fin)}</h1>
    <p class="pmeta">${esc(dayLong(0))}${n>1?` to ${esc(dayLong(n-1))}`:""} · ${n} day${n>1?"s":""} · ${Math.round(tot).toLocaleString()} km · about ${fmtDur(ride)} ${VEH().ing} · leave each day ${fmtT(lv)}</p>`;
  h+=`<p class="pmeta">Planning aid only. Map, fuel, grade, stay and weather data can be wrong or out of date: check before you go. You ride at your own risk. Terms: onetrackmind.online/terms.html</p>`;
  const crit=[]; G.forEach((g,k)=>g.filter(x=>x.lvl!=="info").forEach(x=>crit.push(Object.assign({},x,{text:dayName(k)+": "+x.text}))));
  h+=`<div class="pcrit"><h2>Before you go</h2>${crit.length?`<ul class="pwarn">${crit.map(li).join("")}</ul>`:`<p>Nothing flagged. Still phone ahead on remote legs.</p>`}</div>`;
  if(n>1) h+=`<div class="pcrit"><h2>Where you sleep</h2><table class="ptable"><tbody>${trip.days.slice(0,n-1).map((d,k)=>{ const to=d.to; return `<tr class="${to&&to.stay&&to.booked?"":"warn"}"><td><b>${esc(dayName(k))}</b></td><td>${to?`<b>${esc(to.name)}</b>${to.stay?(to.town?", "+esc(to.town.name):""):" (town: place to stay not chosen)"}`:"not set"}</td><td>${to&&to.stay?esc([to.phone,to.web,to.email].filter(Boolean).join(" · ")):""}</td><td>${to&&to.stay?(to.booked?"Booked":"Not booked"):""}</td></tr>`; }).join("")}</tbody></table></div>`;
  h+=`<table class="ptable"><thead><tr><th>Day</th><th>Route</th><th>km</th><th>${VEH().Ing}</th><th>Arrive</th><th>Sunset</th><th>Weather</th><th>To know</th></tr></thead><tbody>`;
  plan.days.forEach((d,k)=>{ if(!d) return;
    const to=d.pts[d.pts.length-1], vias=d.pts.slice(1,-1), w=dayWx(k), s=sunMin(k), arr=arrMin(k,d.pts.length-1), nk=G[k].filter(x=>x.lvl!=="info").length, bad=G[k].some(x=>x.lvl==="bad");
    h+=`<tr class="${bad?"bad":nk?"warn":""}"><td><b>${esc(dayName(k))}</b></td><td>${vias.length?`via ${vias.map(v=>esc(v.name)).join(", ")} → `:"→ "}<b>${esc(to.name)}</b>${k<n-1?" (night)":""}</td>
      <td class="num">${Math.round(d.km)}</td><td class="num">${fmtDur(dayMinutes(k))}</td><td class="num">${fmtT(arr)}</td><td class="num">${s!=null?fmtT(s):"?"}</td><td>${w&&!w.none?`${esc(WXW(w.code))} ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C`:"—"}</td><td>${nk?nk+" item"+(nk>1?"s":""):"—"}</td></tr>`;
  });
  h+=`</tbody></table><div class="psketch">${routeSketch()}</div>
    <p class="pnote">Arrival times assume you leave at ${fmtT(lv)}, your pace setting and ${esc(String(settings.breakMin))} min at each stop. Suggested stops are towns with fuel about every ${esc(String(settings.range))} km. Fuel, hours, places and hospitals come from OpenStreetMap and can be wrong: phone ahead on remote legs. Emergency from a mobile: 112.</p></section>`;
  // ---- one page per day: key facts, what needs attention, then detail
  plan.days.forEach((d,k)=>{ if(!d) return;
    const from=d.pts[0], to=d.pts[d.pts.length-1], last=k===n-1, m=dayMed(k), w=dayWx(k), s=sunMin(k), g=G[k], arr=arrMin(k,d.pts.length-1), date=dayDate(k);
    const info=sec=>g.filter(x=>x.lvl==="info"&&x.sec===sec);
    h+=`<section class="pday"><h2>${esc(dayLong(k))}: ${esc(from.name)} → ${esc(to.name)}</h2>
      <p class="pmeta">${Math.round(d.km)} km · about ${fmtDur(dayMinutes(k))} ${VEH().ing} · leave ${fmtT(lv)}, arrive about ${fmtT(arr)} · sunset ${s!=null?fmtT(s):"?"}${w&&!w.none?" · "+esc(wxText(w)):""}</p>`;
    const cr=g.filter(x=>x.lvl!=="info"); if(cr.length) h+=`<div class="pcrit"><h3>Needs attention</h3><ul class="pwarn">${cr.map(li).join("")}</ul></div>`;
    // destination
    h+=`<h3>At your destination: ${esc(to.name)}</h3>`; const di=info("dest"); if(di.length) h+=`<ul>${di.map(li).join("")}</ul>`;
    if(!(last&&trip.round)){ const sf=stayFor(to), pl=sf?sf.places:[], chosen=pl.find(p=>hav(p,to)<0.2);
      if(chosen) h+=`<p>Staying at <b>${esc(chosen.name)}</b> (${esc((chosen.tags.tourism||"").replace("_"," "))}) · ${lnk(chosen.tags,chosen.name,to.name)}</p>`;
      const alt=pl.filter(p=>p!==chosen&&stayMatch(p,stayTypeOf(k))).slice(0,3);
      if(alt.length) h+=`<p>${chosen?"Other options":"Places to stay"}:</p><ul>${alt.map(p=>`<li><b>${esc(p.name)}</b> (${esc((p.tags.tourism||"").replace("_"," "))}, ${p.dist.toFixed(1)} km) · ${lnk(p.tags,p.name,to.name)}</li>`).join("")}</ul>`;
      else if(!chosen&&!last) h+=`<p>No places to stay listed nearby.</p>`; }
    // stops
    h+=`<h3>Stops along the way</h3><table class="ptable"><thead><tr><th>Stop</th><th>km</th><th>Arrive</th><th>At the stop</th><th>Fuel when you pass</th></tr></thead><tbody>`;
    d.pts.forEach((p,j)=>{ if(j===0) return; const av=stopAvail(p), here=AV.filter(a=>av[a[0]].length).map(a=>a[2]).join(", "), t=arrMin(k,j), fo=av.fuel.length?groupOpen(av.fuel,date,t):undefined;
      h+=`<tr><td><b>${esc(p.name)}</b>${p.auto?(p.fuelHere?" (suggested stop)":" (suggested, fuel not confirmed)"):""}${j===d.pts.length-1?(last?" (finish)":" (night stop)"):""}</td><td class="num">${Math.round(d.legs[j-1].b-d.a)}</td><td class="num">${fmtT(t)}</td><td>${esc(here)||"Nothing known within 1 km"}</td><td class="${fo===false?"warn":""}">${fo===undefined?"—":fo===true?"Open":fo===false?"Closed":"Hours unknown"}</td></tr>`; });
    h+=`</tbody></table>`; const si=info("stops"); if(si.length) h+=`<ul>${si.map(li).join("")}</ul>`;
    // fuel by town
    const fills=fp?fp.fills.filter(f=>f.km>=d.a-0.3&&f.km<=d.b+0.3):[], groups=fuelGroups(fills);
    h+=`<h3>Fuel stops: ${groups.length}</h3>`+(groups.length?`<table class="ptable"><tbody>${groups.map(gr=>{ const f=gr.st[0], t=f.tags||{}, all=gr.st.map(x=>[x.name,gradesTxt(x.tags||{}),(x.tags||{}).hours,(x.tags||{}).phone].filter(Boolean).join(" · ")).join("; ");
      return `<tr><td class="num">km ${Math.max(0,Math.round(gr.km-d.a))}</td><td><b>${esc(gr.town?gr.town.name:f.name)}</b>${gr.st.length>1?` · ${gr.st.length} stations`:""}</td><td>${esc(all)}</td></tr>`; }).join("")}</tbody></table>`:`<p>None known on the route.</p>`);
    // route
    const ri=info("route"); if(ri.length) h+=`<h3>The route and weather</h3><ul>${ri.map(li).join("")}</ul>`;
    if(m){ const hs=m.near.slice().sort((a,b)=>(a.type==="hospital"?0:1)-(b.type==="hospital"?0:1)).slice(0,4);
      h+=`<h3>Medical</h3><p>${hs.length?hs.map(x=>`${esc(x.name||(x.type==="hospital"?"Hospital":"Clinic"))} (km ${Math.round(x.km-d.a)})${x.phone?" "+esc(x.phone):""}`).join(" · "):"None within 25 km of the route"}. Furthest point from a hospital: ${fmtFar(m.far)} km. Emergency from a mobile: 112.</p>`; }
    h+=`</section>`;
  });
  h+=`<p class="pmeta pfoot">OneTrackMind · onetrackmind.online · printed ${esc(new Date().toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}))}</p>`;
  return h;
}
function printTrip(){
  if(!plan){ $("status").textContent="Plan the trip first."; return; }
  $("print").innerHTML=printHtml();
  const title=document.title; document.title=`Trip ${trip.startDate} ${trip.start.name}`;
  setTimeout(()=>{ window.print(); document.title=title; },50);
}
function feedbackLink(){
  if(!FEEDBACK_EMAIL) return "";
  const nights=trip.days.slice(0,-1).map(d=>d.to?d.to.name:"?").join(", ");
  const body=`What worked:\n\nWhat didn't:\n\nPhone or computer:\n\n---\nTrip: ${trip.start?.name||"?"} → ${trip.round?"same as start":trip.end?.name||"?"}, ${trip.startDate} to ${trip.endDate}. Nights: ${nights||"none"}.`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("OneTrackMind feedback")}&body=${encodeURIComponent(body)}`;
}

/* ---------- story layout: one line per day, same block on Overview and day views ---------- */
const editOpen=new Set(), editTo=new Set(), fuelOpen=new Set(), showAll=new Set(); let tripEdit=false;
const curDay=()=>ui.tab==="ov"?(nDays()===1?0:null):ui.tab;
const viaOpen=new Set();
function toCell(k){
  const last=k===nDays()-1, d=trip.days[k], to=dayTo(k), id=(last?"finish-":"night-")+k, cur=last?(to?to.name:""):(d.to?d.to.name:"");
  if(editTo.has(k)||!cur) return searchBox(id,cur,last?"Pick where you finish":"Pick where you sleep");
  return `<button type="button" class="tolink" data-editto="${k}" title="Tap to change">${esc(cur)}</button>${last?"":nightBadge(k)}`;
}
// is tonight a town or a place to stay, and is it booked
function nightBadge(k){ const to=trip.days[k]&&trip.days[k].to; if(!to) return "";
  if(!to.stay) return ` <span class="nbadge warn" title="This is a town, not a place to stay. Pick where you sleep under Where to stay.">town</span>`;
  return to.booked?` <span class="nbadge ok" title="You've marked this booked">booked ✓</span>`:` <span class="nbadge warn" title="Chosen, not booked yet">not booked</span>`; }
function fuelBtn(k){ const pd=plan.days[k], f=rangeFuel(pd.a,pd.b), n=fp?fuelGroups(fp.fills.filter(x=>x.km>=pd.a-0.3&&x.km<=pd.b+0.3)).length:0;
  if(!placesOk) return `<span class="pill foff" title="Fuel stations are still loading">${ICON.fuel}Checking fuel…</span>`;
  return `<button type="button" class="fbtn" data-fuelk="${k}" title="${n} fuel stop${n===1?"":"s"} en route">${f?fuelPill(f):`<span class="pill foff">${ICON.fuel}${n}</span>`}</button>`; }
function fuelGroups(st){
  const groups=[]; st.forEach(f=>{ const tw=townList&&townList.filter(t=>Math.abs(t.lat-f.lat)<0.05&&hav(t,f)<=3).sort((x,y)=>hav(x,f)-hav(y,f))[0];
    const gr=tw&&groups.find(g=>g.town&&g.town.name===tw.name&&Math.abs(g.km-f.km)<20); if(gr) gr.st.push(f); else groups.push({town:tw||null,st:[f],km:f.km}); });
  return groups;
}
function fuelList(k){
  if(!fuelOpen.has(k)||!plan||!plan.days[k]||!fp) return "";
  const pd=plan.days[k], st=fp.fills.filter(f=>f.km>=pd.a-0.3&&f.km<=pd.b+0.3);
  let h="";
  const tel=t=>t.phone?` · <a href="tel:${esc(String(t.phone).replace(/[^\d+]/g,""))}">${esc(t.phone)}</a>`:"";
  const one=f=>{const t=f.tags||{}, g=gradesTxt(t), off=fuelAll.find(x=>x.id===f.id)?.off; return `<b>${esc(f.name)}</b>${off>=1?` · ${off.toFixed(1)} km off the route`:""}${g?" · "+esc(g):""}${t.hours?` · <span class="note">${esc(t.hours)}</span>`:""}${tel(t)}`;};
  const groups=fuelGroups(st);
  const h24=f=>/24\/7|00:00-24:00/.test((f.tags||{}).hours||""), dsl=f=>/D/.test(((f.tags||{}).extra||""))||/diesel/i.test(gradesTxt(f.tags||{})||"");
  h+=`<div class="rinfo"><b>Fuel stops:</b> ${groups.length}</div>`+(groups.length?groups.map(g=>{ const km=`km ${Math.max(0,Math.round(g.km-pd.a))}`;
    if(!g.town||g.st.length===1){ const f=g.st[0]; return `<div class="frow"><span>${km}: ${g.town&&g.town.name!==f.name?`<b>${esc(g.town.name)}</b> · `:""}${one(f)}</span><button class="btn small ghost" type="button" data-addfill="${f.id}" data-day="${k}">Add as a stop</button></div>`; }
    const n=g.st.length, x=[g.st.some(h24)?"open 24h":"",g.st.some(dsl)?"Diesel":""].filter(Boolean).join(" · ");
    return `<div class="frow"><details class="fgrp"><summary>${km}: <b>${esc(g.town.name)}</b> · ${n} stations${x?" · "+x:""}</summary>${g.st.map(f=>`<div class="note">${one(f)}</div>`).join("")}</details><button class="btn small ghost" type="button" data-addtown="${k}|${esc(g.town.name)}|${g.town.lat}|${g.town.lon}">Add as a stop</button></div>`; }).join(""):`<div class="rinfo">None known on the route today.</div>`);
  return `<div class="risklist">${h}</div>`;
}
function tripTotals(){
  if(!plan) return "";
  const n=nDays(), tot=plan.days.reduce((t,d)=>t+(d?d.km:0),0), ride=plan.days.reduce((t,d,k)=>t+(d?dayMinutes(k):0),0);
  const fin=trip.round||!trip.end?(trip.start?trip.start.name:"?"):trip.end.name;
  return `<div class="totals"><span>Back at <b>${esc(fin)}</b></span><span>${n} day${n>1?"s":""} · ${Math.round(tot).toLocaleString()} km · about ${fmtDur(ride)} ${VEH().ing}</span></div>${gradeBar(tripGrade(),true)}${typeof founderLine==="function"?founderLine():""}${typeof rateLine==="function"?rateLine():""}`;
}
/* ---------- what kind of place to stay: set for the trip, changed per night ---------- */
const STAY_TYPES=[{id:"any",n:"Anything"},{id:"camp",n:"⛺ Camping",rx:/^(camp_site|caravan_site)$/},{id:"guest",n:"Guesthouse / B&B",rx:/^guest_house$/},{id:"hotel",n:"Hotel / Lodge",rx:/^(hotel|motel)$/},{id:"self",n:"Self-catering",rx:/^(chalet|apartment)$/},{id:"back",n:"Backpackers",rx:/^hostel$/}];
const stayTypeOf=k=>(trip.days[k]&&trip.days[k].stayType)||trip.stayType||"any";
const stayMatch=(p,id)=>{ const t=STAY_TYPES.find(x=>x.id===id); return !t||!t.rx||t.rx.test((p.tags&&p.tags.tourism)||""); };
function staysFor(k){ const to=dayTo(k), sf=to&&stayFor(to); return sf?sf.places.filter(p=>stayMatch(p,stayTypeOf(k))):[]; }
function stayChips(k){ const to=dayTo(k), sf=to&&stayFor(to), all=sf?sf.places:[], cur=stayTypeOf(k);
  return `<div class="staychips" role="group" aria-label="Kind of place to stay">${STAY_TYPES.map(t=>{ const n=t.rx?all.filter(p=>stayMatch(p,t.id)).length:all.length; return `<button type="button" class="${t.id===cur?"on":""}" data-staytype="${k}:${t.id}" ${n||t.id==="any"||t.id===cur?"":"disabled"}>${esc(t.n)}${placesOk?` <span>${n}</span>`:""}</button>`; }).join("")}</div>`; }
function stayRows(k){
  const last=k===nDays()-1, to=dayTo(k); if(!to||(last&&trip.round)) return "";
  const all=staysFor(k), key="stay-"+k, list=showAll.has(key)?all:all.slice(0,10), ty=STAY_TYPES.find(t=>t.id===stayTypeOf(k));
  const town=to.stay?(to.town&&to.town.name)||"":to.name, mine=p=>to.stay&&p.name===to.name&&hav(p,to)<0.1;
  let h=`<section class="dsec" id="stays-${k}"><h3>Where to stay${town?" in "+esc(town):" near "+esc(to.name)} <span class="note">${placesOk?all.length:"…"}</span></h3>`;
  if(!last) h+=to.stay?`<div class="mystay"><div><span class="lbl">Your stay tonight</span><b>${esc(to.name)}</b>${to.kind?` <span class="note">${esc(to.kind)}</span>`:""}<div class="sact">${stayContacts(to,town)}</div></div>
      <div class="btns"><button class="btn small ${to.booked?"":"ghost"}" type="button" data-booked="${k}">${to.booked?"Booked ✓":"Mark booked"}</button>${to.town?`<button class="linkbtn" type="button" data-staytown="${k}">Back to ${esc(to.town.name)}</button>`:""}</div></div>`
    :`<div class="note stayhint">Tonight is set to the town of ${esc(to.name)}, not a place to stay. Choose one below or tap a blue dot on the map. You can change it later.</div>`;
  h+=stayChips(k);
  h+=list.length?`<div class="stable">${list.map(p=>`<div class="srow ${mine(p)?"on":""}"><div><b>${esc(p.name)}</b><span class="note">${esc((p.tags.tourism||"").replace("_"," "))} · ${p.dist.toFixed(1)} km</span></div>
      <div class="sact">${callLink(p.tags)}<a href="${esc(bookingUrl(p.name+", "+(town||to.name),addDays(trip.startDate,k),addDays(trip.startDate,k+1)))}" target="_blank" rel="sponsored noopener">Book</a>${infoBtn(Object.assign({kind:"sleep"},p),{town:town||to.name,dist:p.dist.toFixed(1)+" km from "+(town||to.name),act:last||mine(p)?"":`<button class="linkbtn" type="button" data-staynight="${k}:${esc(p.id)}">Stay here</button>`})}${last?"":mine(p)?`<span class="okt">✓ Your stay</span>`:`<button class="linkbtn" type="button" data-staynight="${k}:${esc(p.id)}">Stay here</button>`}</div></div>`).join("")}</div>`
    :`<div class="note">${placesOk?(ty&&ty.rx?`No ${esc(ty.n.replace(/^\S+ /,"").toLowerCase())} listed within 15 km. Try Anything, or check booking sites.`:"Nothing listed within 15 km. Phone the town's info office or check booking sites."):"Loading…"}</div>`;
  if(all.length>10) h+=`<button class="linkbtn" type="button" data-more="${key}">${showAll.has(key)?"Show fewer":`Show all ${all.length}`}</button>`;
  if(!last){ const tw=town||to.name, ci=addDays(trip.startDate,k), co=addDays(trip.startDate,k+1);
    h+=`<div class="btns partnerrow"><a class="btn small ghost" href="${esc(bookingUrl(tw,ci,co,to.lat,to.lon))}" target="_blank" rel="sponsored noopener">More on Booking.com ↗</a>${stayTypeOf(k)==="back"?`<a class="btn small ghost" href="${esc(hostelUrl(tw))}" target="_blank" rel="sponsored noopener">Hostels ↗</a>`:""}</div><div class="note">Book links may earn OneTrackMind a small commission. It costs you nothing and keeps the planner free.</div>`; }
  return h+`</section>`;
}

/* ---------- where you sleep: a town, or a place to stay you've chosen (and booked) ---------- */
function chooseStay(k,p){
  const d=trip.days[k], cur=d.to; if(!p) return;
  const town=cur&&cur.stay?(cur.town||null):cur?{name:cur.name,lat:cur.lat,lon:cur.lon}:null, tg=p.tags||{};
  d.to=pt(p.name,p.lat,p.lon,{stay:true,town,kind:(tg.tourism||"").replace(/_/g," "),phone:tg.phone||"",web:tg.website||"",email:tg.email||"",booked:false});
  $("status").textContent=`${dayName(k)} night: ${p.name}. Tap Mark booked once it's booked.`; changed();
}
function stayContacts(s,town){
  const web=s.web?(/^https?:/.test(s.web)?s.web:"https://"+s.web):"";
  return [s.phone?`<a href="tel:${esc(String(s.phone).replace(/[^\d+]/g,""))}">${esc(s.phone)}</a>`:"", web?`<a href="${esc(web)}" target="_blank" rel="noopener">Website</a>`:"", s.email?`<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`:"",
    !s.phone&&!web&&!s.email?`<a href="https://www.google.com/search?q=${encodeURIComponent(s.name+" "+(town||""))}" target="_blank" rel="noopener">Find online</a>`:""].filter(Boolean).join(" · ");
}
// the to-do list: every night, where you sleep, how to reach them, booked or not
function sleepList(){
  const n=nDays(); if(n<2) return "";
  const rows=trip.days.slice(0,n-1).map((d,k)=>{ const to=d.to;
    if(!to) return `<div class="slrow"><span class="sln">${esc(dayName(k))}</span><span class="warnt">No night stop yet</span></div>`;
    if(!to.stay){ // the top places to stay right on the line, so a multi-day trip is sorted in one place
      const all=staysFor(k), top=all.slice(0,3), ci=addDays(trip.startDate,k), co=addDays(trip.startDate,k+1);
      const opts=top.length?`<ul class="slopts">${top.map((p,i)=>`<li><span><b>${esc(p.name)}</b>${i===0?` <span class="sugtag">Suggested</span>`:""}<span class="note"> ${esc((p.tags.tourism||"").replace(/_/g," "))} · ${p.dist.toFixed(1)} km</span></span><span class="sact"><a href="${esc(bookingUrl(p.name+", "+to.name,ci,co))}" target="_blank" rel="sponsored noopener">Book</a><button class="btn small ${i===0?"":"ghost"}" type="button" data-staynight="${k}:${esc(p.id)}">Stay here</button></span></li>`).join("")}</ul>${all.length>3?`<button class="linkbtn small" type="button" data-pickstay="${k}">See all ${all.length}</button>`:""}`
        :`<div class="note">${placesOk?`Nothing listed nearby for your Stay in choice. <button class="linkbtn small" type="button" data-pickstay="${k}">See other kinds</button>`:"Finding places to stay…"}</div>`;
      return `<div class="slrow slpick"><span class="sln">${esc(dayName(k))}</span><span><b>${esc(to.name)}</b> <span class="nbadge warn">pick a bed</span>${opts}</span></div>`; }
    const town=to.town&&to.town.name;
    return `<div class="slrow"><span class="sln">${esc(dayName(k))}</span><span><b>${esc(to.name)}</b>${town?` <span class="note">${esc(town)}</span>`:""}${to.kind?` <span class="note">· ${esc(to.kind)}</span>`:""}<br><span class="sact">${stayContacts(to,town)}</span></span>
      <span>${to.booked?"":`<a class="linkbtn small" href="${esc(bookingUrl(to.name+(town?", "+town:""),addDays(trip.startDate,k),addDays(trip.startDate,k+1)))}" target="_blank" rel="sponsored noopener">Book</a> `}<button class="btn small ${to.booked?"":"ghost"}" type="button" data-booked="${k}">${to.booked?"Booked ✓":"Mark booked"}</button></span></div>`; }).join("");
  const nb=trip.days.slice(0,n-1).filter(d=>d.to&&d.to.stay&&d.to.booked).length;
  return `<section class="sleeplist"><h3>Where you sleep <span class="note">${nb} of ${n-1} booked</span></h3>${rows}<button class="linkbtn small" type="button" data-copysleep>Copy the list</button></section>`;
}
function sleepText(){
  return trip.days.slice(0,nDays()-1).map((d,k)=>{ const to=d.to; if(!to) return `${dayName(k)}: no night stop yet`;
    if(!to.stay) return `${dayName(k)}: ${to.name} (town, place to stay not chosen)`;
    return `${dayName(k)}: ${to.name}${to.town?", "+to.town.name:""} · ${[to.phone,to.web,to.email].filter(Boolean).join(" · ")||"no contact details"} · ${to.booked?"BOOKED":"not booked"}`; }).join("\n");
}

/* ---------- what's at a stop: fuel, food, shop, toilets, cash, repair ---------- */
let amen=[];
// solid icons for fuel, beds, food and sights on stop lines (emoji were too faint on Windows)
const TRIO_SVG={fuel:'<path d="M5 3h8v8h1a2 2 0 0 1 2 2v4a1 1 0 0 0 2 0V9l-2-2 1.4-1.4L20 8v9a3 3 0 0 1-6 0v-4h-1v8H5zM7 5v4h4V5z"/>',
  stay:'<path d="M2 6h2v7h7V8h8a3 3 0 0 1 3 3v8h-2v-3H4v3H2zM7.5 12.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"/>',
  food:'<path d="M6 2h1.4v6h1V2h1.2v6h1V2H12v8a2.2 2.2 0 0 1-1.8 2.2V22H7.8v-9.8A2.2 2.2 0 0 1 6 10zM17.5 2C16 2 14 4.2 14 8v5h2v9h2V2z"/>',
  sights:'<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>'};
const trioIcon=c=>`<svg viewBox="0 0 24 24" aria-hidden="true">${TRIO_SVG[c]}</svg>`;
const AV=[["fuel","⛽","Fuel"],["food","🍴","Food"],["stay","🛏","Places to stay"],["sights","★","Sights"],["shop","🛒","Shop"],["toilets","🚻","Toilets"],["cash","🏧","Cash (ATM)"],["repair","🔧","Tyres and repair"]];
function stopAvail(p){
  const near=(list)=>list.filter(x=>hav(x,p)<=1).map(x=>Object.assign(x,{dstop:hav(x,p)})).sort((a,b)=>a.dstop-b.dstop).filter((x,i,arr)=>arr.findIndex(y=>(x.id&&y.id===x.id)||(y.name===x.name&&hav(x,y)<0.05))===i); // the same place listed twice in the data shows once
  const fuel=near(fuelAll), food=near(pois.filter(x=>x.kind==="food"));
  const by=k=>near(amen.filter(x=>x.kind===k));
  const toilets=[...by("toilets"),...fuel.filter(f=>/\bT\b/.test(f.tags?.extra||"")).map(f=>Object.assign({},f,{kind:"toilets",name:(f.name||"Fuel station")+" (at the fuel station)"}))];
  // places to stay within 5 km, matching what you chose under Stay in (night stops use that night's choice)
  const kk=trip.days.findIndex((d,i)=>d.to===p&&i<nDays()-1), ty=kk>=0?stayTypeOf(kk):(trip.stayType||"any");
  const stay=(stayFor(p)?.places||[]).filter(x=>stayMatch(x,ty)&&hav(x,p)<=5).map(x=>Object.assign(x,{dstop:hav(x,p)})).sort((a,b)=>a.dstop-b.dstop);
  const sights=pois.filter(x=>["view","pass","sight"].includes(x.kind)&&Math.abs(x.lat-p.lat)<0.1&&hav(x,p)<=5).map(x=>Object.assign(x,{dstop:hav(x,p)})).sort((a,b)=>a.dstop-b.dstop);
  return {fuel,food,stay,sights,shop:by("shop"),toilets,cash:by("cash"),repair:by("repair")};
}
function stopFuel(p){ return p.type==="fuel"||!!p.fuelHere||(placesOk&&fuelAll.some(f=>hav(f,p)<=1)); }
function addStop(k,at,p){
  const d=trip.days[k];
  if(d.vias.some(v=>hav(v,p)<0.2)||(dayTo(k)&&hav(dayTo(k),p)<0.2)){ $("status").textContent=`${p.name} is already on this day.`; return false; }
  d.vias.splice(Math.max(0,Math.min(at,d.vias.length)),0,p); d.legs=[]; return true;
}
/* opening hours: reads the common OpenStreetMap formats; anything unusual shows as text only */
const OH_D=["Su","Mo","Tu","We","Th","Fr","Sa"];
function ohOpen(str,date,min){
  if(!str) return null; str=str.trim(); if(str==="24/7") return true;
  const day=date.getDay(); let state=false, matched=false;
  for(let rule of str.split(";")){ rule=rule.trim(); if(!rule) continue;
    const m=rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)?\s*(.*)$/); if(!m) return null;
    const days=m[1], times=(m[2]||"").trim(); let applies=!days;
    if(days) for(const part of days.replace(/\s/g,"").split(",").filter(Boolean)){ if(part==="PH") continue; const [a,b]=part.split("-"); const ia=OH_D.indexOf(a), ib=b?OH_D.indexOf(b):ia; if(ia<0||ib<0) return null; for(let i=ia,g=0;g<8;i=(i+1)%7,g++){ if(i===day) applies=true; if(i===ib) break; } }
    if(!applies) continue;
    if(/^(off|closed)$/i.test(times)){ state=false; matched=true; continue; }
    if(!times||times==="24/7"){ state=true; matched=true; continue; }
    let open=false;
    for(const r of times.split(",")){ const t=r.trim().match(/^(\d{1,2}):(\d\d)-(\d{1,2}):(\d\d)\+?$/); if(!t) return null; const s=+t[1]*60+ +t[2]; let e=+t[3]*60+ +t[4]; if(e<=s) e+=1440; if(min>=s&&min<e) open=true; }
    state=open; matched=true;
  }
  return matched?state:false;
}
function arrMin(k,j){
  const pd=plan.days[k], pace=1+(+settings.pace||0)/100; let m=toMin(settings.leave);
  for(let i=1;i<=j;i++){ m+=pd.legs[i-1].min*pace; if(i<j) m+=breakOf(pd.pts[i]); }
  return m;
}
const breakOf=p=>p&&p.mins!=null?+p.mins:+settings.breakMin;
function linksHtml(t,name,town){
  t=t||{}; const phone=t.phone, web=t.website;
  return `${phone?`<a href="tel:${esc(String(phone).replace(/[^\d+]/g,""))}" title="${esc(phone)}">Call</a>`:""}${web?`<a href="${esc(/^https?:/.test(web)?web:"https://"+web)}" target="_blank" rel="noopener">Website</a>`:name?`<a href="https://www.google.com/search?q=${encodeURIComponent(name+" "+(town||""))}" target="_blank" rel="noopener">Find online</a>`:""}`;
}
function hoursHtml(t,k,j){
  const h=t&&t.hours; if(!h) return `<span class="note">Hours unknown${t&&t.phone?", phone ahead":""}</span>`;
  const a=arrMin(k,j), st=ohOpen(h,dayDate(k),((a%1440)+1440)%1440);
  return `<span class="note">${esc(h.length>60?h.slice(0,60)+"…":h)}</span>${st===true?`<span class="okt">Open when you arrive (~${fmtT(a)})</span>`:st===false?`<span class="warnt">Closed when you arrive (~${fmtT(a)})</span>`:""}`;
}
function gradesTxt(t){ const e=(t&&t.extra)||""; const g=[]; if(/\b93\b/.test(e)) g.push("93"); if(/\b95\b/.test(e)) g.push("95"); if(/\bD\b/.test(e)) g.push("Diesel"); return g.length?g.join(" · "):""; }


/* day view heading: named after where you sleep; departure underneath so the stops read top to bottom */
/* ---------- summary box: one line per day, used on the Overview and the day view ---------- */
function stopsChain(k){
  const d=trip.days[k], v=d.vias.filter(x=>x.lat!=null);
  return v.map((x,i)=>x.auto?`<i class="autoname" data-gostop="${k}:${i+1}" title="Suggested stop">${esc(x.name)}${x.fuelHere?" ⛽":" (fuel?)"}${x.detour?` (+${x.detour} km)`:""}</i>`:`<span class="stopname">${esc(x.name)}</span>`).join(`<span class="arr">→</span>`);
}
// the way this day is ridden: one icon on the right of every day line, matching the icons on each stretch
function dayWay(k){
  const d=trip.days[k], pts=dayPts(k), pd=!planStale&&plan&&plan.days[k]; if(!pts) return "";
  const n=pts.length-1; let fast=0, gpx=0;
  for(let j=0;j<n;j++){ if(pd&&pd.legs[j]&&pd.legs[j].gpx) gpx++; else if(legFast(d,j)) fast++; }
  if(gpx===n) return `<span class="dway" title="Follows your GPX file"><span class="note gpxnote">GPX</span></span>`;
  const rest=n-gpx, all=fast===rest, none=fast===0;
  const t=all?"Quick way all day":none?`${styleName()} all day`:`${styleName()}, with ${fast} stretch${fast>1?"es":""} the quick way`;
  if(settings.style==="tar") return `<span class="dway" title="Main roads, like normal sat-nav">${STYLE_ICON.fast}</span>`;
  return `<span class="dway" title="${esc(t)}. Change it per stretch on the day's stops.">${none?STYLE_ICON.default:all?STYLE_ICON.fast:STYLE_ICON.default+STYLE_ICON.fast}</span>`;
}
// overview: the same filter icons for where the day ends; tap to open that day zoomed to it, showing just those
function dayTrio(k,big){
  const pd=!planStale&&plan&&plan.days[k]; if(!pd||!placesOk) return ""; const j=pd.pts.length-1, p=pd.pts[j], av=stopAvail(p);
  const on=["fuel","stay","food","sights"].filter(c=>ui.lay[c]&&!(c==="stay"&&k===nDays()-1&&trip.round)); if(!on.length) return "";
  return `<span class="trioset">${AV.filter(a=>on.includes(a[0])).map(a=>{ const n=av[a[0]].length; return `<button type="button" class="avi trio ${n?"":"none"} ${(big?stopFocus&&stopFocus.k===k&&stopFocus.j===j&&stopFocus.cat===a[0]:ovFocus&&ovFocus.k===k&&ovFocus.cat===a[0])?"on":""}" ${n?(big?`data-av="${k}:${j}:${a[0]}"`:`data-ovav="${k}:${j}:${a[0]}"`):"disabled"} data-c="${a[0]}" title="${esc(a[2])} at ${esc(p.name)}: ${n||"none"}">${trioIcon(a[0])}</button>`; }).join("")}</span>`;
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-ovav]"); if(!b) return; const [k,j,c]=b.dataset.ovav.split(":"); const same=ovFocus&&ovFocus.k===+k&&ovFocus.cat===c; ovFocus=same?null:{k:+k,j:+j,cat:c}; if(!ovFocus) window._refit=true; renderAll(); if(ovFocus&&window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"}); });
function fromCell(k){ const from=dayFrom(k); if(!from||from.lat==null) return `<span class="ep need">${k===0?"Set your start":"Pick the night before"}</span>`; return `<span class="ep">${k===0?"▶":"🛏"} ${esc(from.name)}</span>`; }
function sumBox(k,big,noChain){
  const pd=!planStale&&plan&&plan.days[k], d=trip.days[k], r=pd?dayRisk(k):null, from=dayFrom(k), last=k===nDays()-1;
  const msg=!trip.start||trip.start.lat==null?(k===0?"Set your start above to see the route":""):!from?"Pick the night stop before this day":!dayTo(k)?"":!dayPts(k)?"Add a stop or a finish":"Working out the route…";
  const chain=stopsChain(k), arr=` <span class="arr">→</span> `, toSym=last?(trip.round?"⟲":"🏁"):"🛏";
  const pdx=!planStale&&plan&&plan.days[k], mins=pdx?dayMinutes(k):0, long=pdx&&mins>+settings.maxHours*60;
  const date=`<span class="sdate">${esc(big?dayLong(k):dayName(k))}${pdx?`<span class="sdtot" data-focusday="${k}" title="Show the day on the map"> · ${Math.round(pdx.km)} km · <span class="${long?"overt":""}" title="${long?`Over your ${settings.maxHours}h a day`:"Riding time"}">${fmtDur(mins)}</span></span>`:""}</span>`;
  const line=nDays()===1&&trip.round&&!trip.days[0].vias.length
    ?`<span class="schain">${fromCell(k)}${arr}<span class="wherebox">${searchBox("whereto-0","","Where to?",true)}</span>${arr}<span class="ep">⟲ back home</span></span>`
    :`<span class="schain">${fromCell(k)}${arr}${chain?chain+arr:""}<span class="ep to ${last?"":"night"}" ${last?"":`title="Night ${k+1}: where you sleep"`}>${toSym} ${toCell(k)}</span></span>${dayTrio(k,big)}${dayWay(k)}`;
  return `<div class="sumbox ${big?"big":""}">
    <div class="sumline">${date}${noChain?"":`<div class="sumrow">${line}</div>`}</div>
    ${!pd&&!msg?"":pd?`<div class="sicons"><span class="sl">${fuelBtn(k)}</span><span class="sr">${sunSpan(k)+wxLink(k)}<span class="flags">${flagIcons(r,k)}</span></span></div>${gradeBar(dayGrade(k),big)}${elevLine(k)}${big||nDays()===1?elevProfile(k):""}${riskHtml(r,k)}${big?fuelList(k):""}${!big&&nDays()>1?gtkLine(k):""}`:`<div class="note">${msg}</div>`}
  </div>${big||noChain?"":ovList(k)}`;
}
function dayHead(k){ const pd=!planStale&&plan&&plan.days[k], jl=pd?pd.pts.length-1:-1, endOpen=pd&&stopFocus&&stopFocus.k===k&&stopFocus.j===jl;
  return sumBox(k,true)+(endOpen?`<div class="stop open enddetail">${stopDetail(k,jl,stopFocus.cat)}</div>`:"")+(pd?gtkHtml(k):"")+`<h3 class="detailh">Stops</h3>`; }
function gtkLine(k){ if(planStale||!plan||!plan.days[k]) return ""; const g=goodToKnow(k), n=g.filter(x=>x.lvl!=="info").length, bad=g.some(x=>x.lvl==="bad");
  return n?`<div class="gtkline ${bad?"gbad":"gwarn"}">⚠ ${n} thing${n>1?"s":""} to know ›</div>`:""; }

/* ---------- fuel towns added for the rider (marked, removable, can be kept) ---------- */
let autoRounds=0;
// way of the stretch into stop j; a suggested stop takes the way of the stretch it sits in (the next own stop's choice)
const legFast=(d,j)=>{ let i=j; while(i<d.vias.length&&d.vias[i].auto&&d.vias[i].fast==null) i++; const v=d.vias[i], f=v?v.fast:d.toFast; return f!=null?f:d.style==="fast"; };
function autoFuel(){
  if(!plan||!placesOk||!townList||!(+settings.range>0)||plan._autoDone) return false;
  plan._autoDone=true; // one pass per worked-out route
  let added=false;
  plan.days.forEach((d,k)=>{ if(!d) return; const td=trip.days[k], no=td.noAuto||[]; if(!td.sig) td.sig=daySig(k);
    const ok=t=>!no.includes(t.name)&&!td.vias.some(v=>!v.auto&&(v.name===t.name||hav(v,t)<1))&&!(dayTo(k)&&hav(dayTo(k),t)<1)&&!(dayFrom(k)&&hav(dayFrom(k),t)<1);
    const mk=t=>pt(t.name,t.lat,t.lon,{auto:true,fuelHere:!!t.fuel,detour:t.off>5?Math.round(t.off*2):0});
    if(td.fresh){ // this day's start or night stop changed: work its suggestions out again from scratch
      delete td.noMore;
      const want=daySuggest(k,true).sugg.filter(ok), have=td.vias.filter(v=>v.auto).map(v=>v.name).sort().join("|");
      if(want.map(t=>t.name).sort().join("|")!==have){ td.vias=td.vias.filter(v=>!v.auto); td.legs=[]; want.forEach(t=>insertVia(k,mk(t))); added=true; }
    } else if(!td.noMore){ const add=daySuggest(k).sugg.filter(t=>ok(t)&&!td.vias.some(v=>v.name===t.name||hav(v,t)<1));
      if(add.length){ const n=td.vias.length; td.vias=td.vias.filter(v=>!(v.auto&&!v.fuelHere)); if(td.vias.length!==n) td.legs=[]; // fill-in towns without fuel make way for the new picks
        const again=daySuggest(k).sugg.filter(t=>ok(t)&&!td.vias.some(v=>v.name===t.name||hav(v,t)<1));
        (again.length?again:add).forEach(t=>{ if(insertVia(k,mk(t))!==false) added=true; }); if(td.vias.length!==n) added=true; } } });
  trip.days.forEach(d=>delete d.fresh); // one pass: suggestions are picked on the route without them, then left alone
  return added;
}

/* ---------- day planner: stops as a list, tap a stop to see it on the map ---------- */
let stopFocus=null;
function placeRow(x,k,j,extraAct){
  const t=x.tags||{}, town=plan.days[k].pts[j]?.name||"";
  const nm=x.name&&x.name!=="Fuel"?x.name:({fuel:"Fuel station",food:"Food",shop:"Shop",toilets:"Toilets",cash:"ATM",repair:"Workshop"}[x.kind]||"Place");
  const dist=x.dstop!=null?`${Math.max(0.1,x.dstop).toFixed(1)} km from ${town||"the stop"}`:(x.off!=null?(x.off<0.3?"on the route":`${x.off.toFixed(1)} km off the route`):"");
  const g=x.kind==="fuel"?gradesTxt(t):"";
  const hrs=["fuel","food","shop","cash","repair"].includes(x.kind)?hoursHtml(t,k,j):"";
  return `<div class="srow" data-ploc="${x.lat},${x.lon}"><div><b>${esc(nm)}</b><span class="note">${esc(dist)}${g?" · "+esc(g):""}</span>${hrs}</div><div class="sact">${callLink(t)}${infoBtn(Object.assign({},x,{name:nm}),{town,dist,act:extraAct})}${extraAct||""}</div></div>`;
}
function listBlock(title,icon,list,key,rowFn){
  const shown=showAll.has(key)?list:list.slice(0,8);
  let h=`<h4>${icon} ${esc(title)} <span class="note">${list.length}</span></h4>${shown.map(rowFn).join("")}`;
  if(list.length>8) h+=`<button class="linkbtn" type="button" data-more="${key}">${showAll.has(key)?"Show fewer":`Show all ${list.length}`}</button>`;
  return h;
}
function stopDetail(k,j,cat){
  const pd=plan.days[k], last=k===nDays()-1, p=pd.pts[j], isTo=j===pd.pts.length-1, isVia=j>0&&!isTo;
  const av=stopAvail(p);
  let h=`<div class="sdetail">`;
  if(cat){ const a=AV.find(x=>x[0]===cat), canStay=cat==="stay"&&isTo&&!last; return h+listBlock(a[2]+(cat==="stay"?" near the stop":" at the stop"),a[1],av[cat],`${cat}-${k}-${j}`,x=>placeRow(x,k,j,canStay?`<button class="linkbtn" type="button" data-staynight="${k}:${esc(x.id)}">Stay here</button>`:""))+`</div>`; }
  if(j>0){ const f=rangeFuel(pd.legs[j-1].a,pd.legs[j-1].b); if(f&&f.level) h+=`<div class="verdict ${f.level==="bad"?"v-bad":"v-warn"}">${esc(f.text)}</div>`; }
  if(isVia){ const vi=j-1, v=trip.days[k].vias[vi]; h+=`<div class="rname chgstop"><span class="lbl" style="white-space:nowrap">${v&&v.auto?"Stop somewhere else":"Change this stop"}</span>${searchBox(`via-${k}-${vi}`,"","Another town or place",true)}</div><div class="note">Or ${canHover?"click":"press and hold"} the map where you'd rather stop.</div>`; }
  const any=AV.some(a=>av[a[0]].length);
  h+=`<h4 class="sub">At the stop</h4>`;
  h+=any?AV.filter(a=>av[a[0]].length).map(a=>listBlock(a[2],a[1],av[a[0]],`${a[0]}-${k}-${j}`,x=>placeRow(x,k,j))).join(""):`<div class="note">Nothing known within 1 km. Small places are often missing from the map, so ask locally.</div>`;
  { const auto=fuelAll.some(f=>hav(f,p)<=1);
    h+=`<div class="sopts">${auto?`<span class="note">Fuel here, on our map.</span>`:`<label class="chk"><input type="checkbox" data-fuelpt="${k}:${j}" ${p.fuelHere||p.type==="fuel"?"checked":""}> Fuel here (not on our map)</label>`}
      ${isVia?`<label class="chk">Break <input type="number" min="0" max="600" step="5" value="${breakOf(p)}" data-breakmin="${k}:${j-1}" style="width:5em"> min</label>`:""}</div>`;
  }
  if(j>0){
    const sc=scope(k,j), way=fuelAll.filter(f=>f.km!=null&&f.km>=sc.a-0.5&&f.km<=sc.b+0.5&&hav(f,p)>1).sort((a,b)=>a.km-b.km);
    const sights=panelItems(k,j,"sight");
    h+=`<h4 class="sub">On the way in from ${esc(pd.pts[j-1].name)}</h4>`;
    h+=way.length?listBlock("Fuel along the way",AV[0][1],way,`wf-${k}-${j}`,x=>placeRow(x,k,j,`<button class="linkbtn" type="button" data-sfuel="${k}:${j}:${esc(x.id)}">Add as a stop</button>`)):`<div class="note">No other fuel known on this stretch.</div>`;
    if(sights.length) h+=listBlock("Sights and viewpoints","★",sights,`s-${k}-${j}`,x=>placeRow(Object.assign({},x,{kind:"sight"}),k,j,`<button class="linkbtn" type="button" data-sadd="${k}:${j}:${esc(x.id)}">Add</button>`));
  }
  return h+`</div>`;
}
function stopList(k){
  const d=trip.days[k], pd=!planStale&&plan&&plan.days[k], last=k===nDays()-1;
  let h="";
  if(!pd) return nDays()===1&&trip.round&&!d.vias.length?h:h+`<div class="rname"><span class="lbl" style="white-space:nowrap">Add a stop</span>${searchBox("addvia-"+k,"","Town, pass or place on this day",true)}</div>`;
  h+=`<ol class="stops">`;
  pd.pts.forEach((p,j)=>{
    if(j===0) return;
    const isFrom=j===0, isTo=j===pd.pts.length-1, vi=j-1, L=j>0?pd.legs[j-1]:null, lg=j>0?(d.legs[j-1]||{}):{};
    const open=stopFocus&&stopFocus.k===k&&stopFocus.j===j, km=j>0?Math.round(pd.legs[j-1].b-pd.a):0;
    const lab=isFrom?"From":isTo?(last?(trip.round?"⟲ Home":"🏁 Finish"):`🛏 Night ${k+1}`):`Stop ${j}`;
    const av=placesOk?stopAvail(p):null;
    const TRIO=["fuel","stay","food","sights"].filter(c=>ui.lay[c]), trio=AV.filter(a=>TRIO.includes(a[0])).map(a=>{ const n=av?av[a[0]].length:0; return `<button type="button" class="avi trio ${open&&stopFocus.cat===a[0]?"on":""} ${n?"":"none"}" ${n?`data-av="${k}:${j}:${a[0]}"`:"disabled"} data-c="${a[0]}" title="${esc(a[2])}: ${av?(n||"none")+(a[0]==="stay"||a[0]==="sights"?" within 5 km":" at the stop"):"loading"}">${trioIcon(a[0])}</button>`; }).join("");
    const icons=av?AV.filter(a=>!["fuel","stay","food","sights"].includes(a[0])&&av[a[0]].length).map(a=>`<button type="button" class="avi ${open&&stopFocus.cat===a[0]?"on":""}" data-av="${k}:${j}:${a[0]}" title="${esc(a[2])}: ${av[a[0]].length}">${a[1]}</button>`).join(""):"";
    const fq=legFast(d,j-1), way=p.straight&&!lg.track?`<span class="note gpxnote" title="A straight line to this point: a track the map doesn't show">Straight</span>`:lg.track||(L&&L.gpx)?(L&&L.gpx?`<span class="note gpxnote" title="This stretch follows your GPX file">GPX</span>`:""):(settings.style==="tar"?`<span class="legway one" title="Main roads, like normal sat-nav">${STYLE_ICON.fast}</span>`:`<span class="legway one"><button type="button" data-legsty="${j-1}:${fq?0:1}" class="on" title="${fq?"Quick way, main roads":esc(styleName())} to here. Tap for ${fq?esc(styleName()):"the quick way"}">${fq?STYLE_ICON.fast:STYLE_ICON.default}</button></span>`);
    const tools="";
    const isVia2=!isFrom&&!isTo, mtool=`${isVia2?`${p.auto?"":`<button class="btn small ghost" type="button" data-vren="${vi}">✎ Rename</button>`}<button class="btn small ghost" type="button" data-vup="${vi}" ${vi===0?"disabled":""}>↑ Move up</button><button class="btn small ghost" type="button" data-vdel="${vi}">✕ Remove this stop</button>`:""}`;
    const rtool=`${acct.ready?`<button class="linkbtn small" type="button" data-repat="${p.lat},${p.lon},${esc(p.name)}">Report the road here</button><button class="linkbtn small" type="button" data-spotat="${p.lat},${p.lon},${esc(p.name)}">Mark a place here</button>`:""}<button class="linkbtn small" type="button" data-fixat="${p.lat},${p.lon},${esc(p.name)}">Report a map mistake</button>`;
    const opts=L?`<details class="legopts"><summary class="icon" title="More">⋯</summary><div class="legmenu">${mtool}
        ${L.n>1&&!lg.track?`<label class="chk">Way <select data-alt="${j-1}">${L.alts.map((km2,x)=>`<option value="${x}" ${(lg.alt||0)===x?"selected":""}>Way ${x+1} · ${Math.round(km2)} km</option>`).join("")}</select></label>`:lg.track?"":lg.wantAlts?`<span class="note">No other ways found for this stretch.</span>`:`<button class="btn small ghost" type="button" data-wantalts="${j-1}">Find other ways</button>`}
        ${lg.track?`<span class="note">Own track: ${esc(lg.trackName||"GPX")}</span><button class="btn small ghost" type="button" data-untrack="${j-1}">Remove track</button>`
          :`<label class="btn small ghost" style="cursor:pointer;align-self:flex-start">Use my GPX for this stretch<input type="file" accept=".gpx,application/gpx+xml" data-track="${j-1}" hidden></label>`}
        ${rtool}
      </div></details>`:"";
    const autoTag=p.auto?(p.fuelHere?`<span class="autotag" title="Fuel and food here. You asked to stop at least every ${esc(String(settings.range))} km.">Suggested stop${p.detour?` · +${p.detour} km`:""}</span>`
      :`<span class="autotag nofuel" title="No fuel on our map here, and none closer. Ask locally or carry extra.">Suggested stop · fuel not confirmed${p.detour?` · +${p.detour} km`:""}</span>`):"";
    // the day ends where the summary line above already says: just the last stretch's tools here, no second Colesberg block
    if(isTo){ h+=`<li class="stop slim"><div class="sl2"><span class="sl2l"><span class="note">The stretch into ${esc(p.name)}</span> <span class="selev">${L?legElevTxt(L.a,L.b).replace(/^ · /,""):""}</span></span><span class="stools">${way}${tools}${opts}</span></div></li>`; return; }
    h+=`<li class="stop ${open?"open":""} ${p.auto?"auto":isTo||isFrom?"":"mine"} ${isTo&&!last?"night":""}" data-sname="${esc(p.name)}"><div class="shead"><div class="sl1"><button type="button" class="sname" data-stop="${k}:${j}"><span class="rlab ${isTo&&!last?"nightlab":""}">${lab}</span><b>${esc(p.name)}</b></button><span class="sright"><span class="trioset">${trio}</span><span class="avail">${icons}</span>${isFrom?"":`<span class="skm">km ${km}</span>`}</span></div>
      <div class="sl2"><span class="sl2l">${p.auto?`<span class="autotag ${p.fuelHere?"":"nofuel"}" title="${p.fuelHere?"Suggested fuel stop":"Suggested stop: no fuel on our map here"}">Suggested${p.fuelHere?"":" · fuel?"}${p.detour?` · +${p.detour} km`:""}</span>`:""}<span class="selev">${L?legElevTxt(L.a,L.b).replace(/^ · /,""):""}</span></span><span class="stools">${way}${tools}${opts}</span></div></div>${open&&plan?stopDetail(k,j,stopFocus.cat):""}</li>`;
  });
  h+=`</ol><div class="rname"><span class="lbl" style="white-space:nowrap">Add a stop</span>${searchBox("addvia-"+k,"","Town, pass or place on this day",true)}</div>`;
  return h;
}
function dayBody(k,noStops){
  const pd=!planStale&&plan&&plan.days[k];
  let h=noStops?"":stopList(k);
  if(!pd) return h;
  if(!placesOk) h+=`<div class="verdict v-warn">Fuel stations didn't load, so long stretches without fuel can't be checked. Check your connection and reload.</div>`;
  const m=dayMed(k);
  h+=passRows(k);
  if(k<nDays()-1) h+=stayRows(k);
  if(m) h+=`<details class="medbox"><summary><span class="lbl">Medical</span> ${m.near.length} hospital${m.near.length===1?"":"s"} and clinics near the route · furthest point ${fmtFar(m.far)} km from a hospital</summary>
    ${m.near.map(x=>`<div class="item"><div class="meta"><b>${esc(x.name||(x.type==="hospital"?"Hospital":"Clinic"))}</b><span class="note">${x.type==="hospital"?"Hospital":"Clinic"} · km ${Math.round(x.km-pd.a)} · ${x.off<0.5?"on the route":x.off.toFixed(1)+" km off"}${x.phone?` · <a href="tel:${esc(x.phone.replace(/[^\d+]/g,""))}">${esc(x.phone)}</a>`:""}</span></div></div>`).join("")||`<div class="note">None listed within 25 km of the route.</div>`}
    <div class="note">Emergency from a mobile: 112. Check the local numbers before you go.</div></details>`;
  h+=`<div class="btns"><button class="btn small" type="button" data-gpx="${k}">GPX file</button>${nDays()===1?`<button class="btn small ghost" type="button" data-print>Save as PDF</button>${saveRouteBtn()}`:""}<span class="note">GPX for your bike's GPS or a phone app.</span></div><div class="btns phonenav"><span class="lbl">On your phone</span>${navButtons(k)}<button class="btn small share" type="button" data-sharetrip>Share this trip ↗</button><button class="btn small wa" type="button" data-sharewa title="Send this trip on WhatsApp">WhatsApp this trip</button>${nameBtn()}</div>`;
  return h;
}
// one category at a stop on the map: plain numbered dots matching the list; the name shows on hover or tap
const CATCOL={fuel:"#0F7B8A",food:"#B3261E",stay:"#2F5BA8",sights:"#9A6A33",shop:"#6B4E9B",toilets:"#00838F",cash:"#2F5BA8",repair:"#5D4037"};
function catPins(list,c,k,j){
  const night=c==="stay"&&j===plan.days[k].pts.length-1&&k<nDays()-1;
  list.forEach((p,i)=>{ const nm=p.name||AV.find(a=>a[0]===c)[2];
    L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:`<div class="numpin" style="background:${CATCOL[c]}">${i+1}</div>`,iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:800-i})
      .bindTooltip(`${i+1}. ${esc(nm)}`).bindPopup(`<b>${i+1}. ${esc(nm)}</b>${night?`<br><button class="btn small" type="button" data-staynight="${k}:${esc(p.id)}">Stay here</button>`:""}`).addTo(layer); });
  return list;
}
// Overview: tap ⛽ 🛏 🍴 ★ on a day and the list opens under that day, the map shows just those, and you stay on the Overview
var ovFocus=null; // var: renders can run before this line
function drawOvLayer(){
  const {k,j,cat}=ovFocus, pd=plan&&plan.days[k], p=pd&&pd.pts[j]; if(!p) return false;
  L.marker([p.lat,p.lon],{icon:dotIcon("#11262B",16)}).bindTooltip(p.name,{permanent:true,direction:"right",offset:[10,0],className:"maplbl"}).addTo(layer);
  const list=catPins(stopAvail(p)[cat],cat,k,j), pts=[...list,p].map(x=>[x.lat,x.lon]);
  const fit=()=>{ if(!ovFocus) return; if(pts.length<2) map.setView([p.lat,p.lon],14); else map.fitBounds(L.latLngBounds(pts),{padding:[30,30],maxZoom:15}); };
  fit(); setTimeout(fit,250); // again once the list below has opened and the page has settled
  return true;
}
function ovList(k){
  if(!ovFocus||ovFocus.k!==k||!plan||!plan.days[k]) return ""; const {j,cat}=ovFocus, p=plan.days[k].pts[j], a=AV.find(x=>x[0]===cat), list=stopAvail(p)[cat], night=cat==="stay"&&j===plan.days[k].pts.length-1&&k<nDays()-1;
  const key=`ov-${cat}-${k}`, shown=showAll.has(key)?list:list.slice(0,8), ci=addDays(trip.startDate,k), co=addDays(trip.startDate,k+1);
  return `<div class="ovlist"><div class="ovhead"><b>${a[1]} ${esc(a[2])} in ${esc(p.name)}</b> <span class="note">${list.length}</span><button class="linkbtn small" type="button" data-ovclose>Close ✕</button></div>
    <ol class="ovrows">${shown.map((x,i)=>`<li><span class="num" style="background:${CATCOL[cat]}">${i+1}</span><span class="ovn"><b>${esc(x.name||a[2])}</b>${night&&i===0?` <span class="sugtag">Suggested</span>`:""}<span class="note"> ${esc(((x.tags&&x.tags.tourism)||"").replace(/_/g," "))}${(x.tags&&x.tags.tourism)?" · ":""}${Math.max(0.1,x.dstop).toFixed(1)} km from ${esc(p.name)}</span></span><span class="sact">${night?`<a href="${esc(bookingUrl(x.name+", "+p.name,ci,co))}" target="_blank" rel="sponsored noopener">Book</a><button class="btn small ${i===0?"":"ghost"}" type="button" data-staynight="${k}:${esc(x.id)}">Stay here</button>`:`<button class="linkbtn small" type="button" data-ploc="${x.lat},${x.lon}">Show</button>`}</span></li>`).join("")}</ol>
    ${list.length>8?`<button class="linkbtn small" type="button" data-more="${key}">${showAll.has(key)?"Show fewer":`Show all ${list.length}`}</button>`:""}</div>`;
}
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-ovclose]")){ ovFocus=null; window._refit=true; renderAll(); } });
function drawStopLayer(){
  const {k,j,cat}=stopFocus, sc=scope(k,j); if(!sc) return false;
  const s=sc.jj>0&&!cat?seg(sc.a,sc.b):[];
  if(s.length>1) L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer);
  L.marker([sc.p.lat,sc.p.lon],{icon:dotIcon("#11262B",16)}).bindTooltip(sc.p.name,{permanent:true,direction:"right",offset:[10,0],className:"maplbl"}).addTo(layer);
  const av=stopAvail(sc.p), col={fuel:"#0F7B8A",food:"#B3261E",stay:"#2F5BA8",sights:"#9A6A33",shop:"#6B4E9B",toilets:"#00838F",cash:"#2F5BA8",repair:"#5D4037"};
  const shown=[]; AV.forEach(([c,ic])=>{ if(cat&&c!==cat) return; if(cat){ shown.push(...catPins(av[c],c,k,j)); return; } av[c].forEach(p=>{ shown.push(p); L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:${col[c]}">${ic}</div>`,iconSize:[22,22],iconAnchor:[11,11]})}).bindTooltip(p.name||AV.find(a=>a[0]===c)[2]).addTo(layer); }); });
  const pts=[...s,...shown,sc.p].map(p=>[p.lat,p.lon]);
  if(!cat) map.setView([sc.p.lat,sc.p.lon],14); // the stop and what's around it
  else if(pts.length<2) map.setView([sc.p.lat,sc.p.lon],15); else map.fitBounds(L.latLngBounds(pts),{padding:[30,30],maxZoom:16});
  return true;
}
function clearLink(){ return `<div class="btns clearrow">${clearArm?`<span class="note">Clear this trip?</span><button class="btn small" type="button" data-newtrip>Clear</button><button class="btn small ghost" type="button" data-nocancel>Cancel</button>`:`<button class="linkbtn small" type="button" data-newtrip>Clear trip</button>`}</div>`; }
function overviewHtml(){
  // 1. Your trip  2. Stop  3. Details (each its own box)
  let h=tripBox(null)+stopSummary(null), det="";
  if(nDays()===1){ det=sumBox(0,false,true)+(typeof founderLine==="function"?founderLine():"")+(plan&&!planStale&&typeof rateLine==="function"?rateLine():"")+(!planStale&&plan&&plan.days[0]?gtkHtml(0):"")+dayBody(0,true); }
  else { let hh=`<div class="days">`; trip.days.forEach((d,k)=>{ hh+=`<div class="ovday" data-gotoday="${k}">${sumBox(k,false,true)}</div>`; }); hh+=`</div>`;
    det=(function(){ let h=hh;
  h+=tripTotals();
  h+=sleepList();
  if(plan&&!planStale&&settings.vehicle!=="bike"&&trip.start) h+=`<div class="btns partnerrow"><a class="btn small ghost" href="${esc(carHireUrl(trip.start.name))}" target="_blank" rel="sponsored noopener">Hire a ${settings.vehicle==="jeep"?"4x4":"car"} ↗</a><span class="note">Self-drive? Compare hire companies.</span></div>`;
  if(plan&&!planStale) h+=`<div><span class="lbl">Ride files</span><div class="btns" style="margin-top:6px"><button class="btn small share" type="button" data-sharetrip title="A link anyone can open: the whole plan, then Google Maps / Waze or GPX">Share this trip ↗</button><button class="btn small wa" type="button" data-sharewa title="Send this trip on WhatsApp">WhatsApp this trip</button>${nameBtn()}${plan.days.map((d,k)=>d?`<button class="btn small" type="button" data-gpx="${k}">${esc(dayName(k))} GPX</button>`:"").join("")}<button class="btn small" type="button" data-gpx="all">Whole trip GPX</button><button class="btn small" type="button" data-navlinks title="Open each day in Google Maps or Waze on your phone">Google Maps / Waze</button><button class="btn small ghost" type="button" data-grouppack title="Every GPX format in one zip, with a read-me, for a group ride">Group ride pack ↓</button><button class="btn small ghost" type="button" data-print>Save as PDF</button>${saveRouteBtn()}</div></div>`;
      return h; })(); }
  h+=boxSec("detailbox","Details",det);
  return h+clearLink()+footNote();
}
function footNote(){ return `<div class="note">${placesOk&&dataDate?`Map data from OpenStreetMap, as of ${esc(dataDate)}. Weather from Open-Meteo. Phone ahead on remote legs. `:""}Plan with it, check before you go: you ride at your own risk. <a href="/terms.html">Terms and disclaimer</a> · <a href="/privacy.html">Privacy</a></div>`; }
function dayHtml(k){ return tripBox(k)+stopSummary(k)+boxSec("detailbox","Details",sumBox(k,true,true)+(!planStale&&plan&&plan.days[k]?gtkHtml(k):"")+dayBody(k,true)); }
function wireDetails(){
  trip.days.forEach((d,k)=>hook("night-"+k,p=>{editTo.delete(k);trip.days[k].to=p;changed();}));
  hook("whereto-0",p=>{ trip.days[0].vias.push(p); trip.days[0].legs=[]; changed(); });
  hook("finish-"+(nDays()-1),p=>{editTo.delete(nDays()-1);setFinish(p);});
  editTo.forEach(k=>{ const el=document.getElementById((k===nDays()-1?"finish-":"night-")+k); if(el&&document.activeElement!==el){ el.focus(); el.select(); el.addEventListener("blur",()=>setTimeout(()=>{ if(editTo.has(k)&&el.value.trim()===el.defaultValue.trim()){ editTo.delete(k); renderDetails(); } },400)); } });
  hook("addstop",p=>{ addOpen=false;
    if(!trip.round&&!trip.end){ const q=Object.assign({},p); delete q.stay; trip.end=q; delete trip.daysSet; changed(); return; } // no destination yet: this is it
    const k2=curDay()!=null?curDay():dayForPoint(p); if(insertVia(k2,p)===false){ renderDetails(); return; }
    if(p.stay){ const i=trip.days[k2].vias.indexOf(p); if(i>=0) sleepAt(k2,i); } // a place to stay is a night: the trip gets a day
    changed(); });
  { const k=curDay(); if(k==null) return; const d=trip.days[k];
    d.vias.forEach((v,i)=>hook(`via-${k}-${i}`,p=>replaceVia(k,i,p)));
    hook("addvia-"+k,p=>{if(insertVia(k,p)!==false) changed(); else renderDetails();});
  }
}
// swap a stop for another place (from search or the map); a swapped-out suggestion isn't suggested again
function replaceVia(k,i,p){
  const d=trip.days[k], old=d.vias[i]; if(!old) return;
  if(old.auto){ d.noAuto=[...(d.noAuto||[]),old.name]; }
  d.vias[i]=pt(p.name,p.lat,p.lon,p.type?{type:p.type}:{}); d.legs=[]; stopFocus=null;
  $("status").textContent=`${old.name} changed to ${p.name}.`; changed();
}
function insertVia(k,p){
  if(trip.days[k].vias.some(v=>hav(v,p)<0.2)||(dayTo(k)&&hav(dayTo(k),p)<0.2)){ $("status").textContent=`${p.name} is already on this day.`; return false; }
  const d=trip.days[k], pts=[dayFrom(k),...d.vias,dayTo(k)].filter(x=>x&&x.lat!=null); let best=d.vias.length,cost=Infinity;
  for(let i=1;i<pts.length;i++){const c=hav(pts[i-1],p)+hav(p,pts[i])-hav(pts[i-1],pts[i]); if(c<cost){cost=c;best=i-1;}}
  d.vias.splice(Math.min(best,d.vias.length),0,p); d.legs=[]; return true;
}
$("details").addEventListener("click",e=>{
  const t=e.target, k=curDay();
  if(t.closest("[data-tripedit]")){tripEdit=!tripEdit;renderDetails();return;}
  if(t.closest("[data-newtrip]")&&!clearArm){ clearArm=true; renderDetails(); return; }
  if(t.closest("[data-nocancel]")){ clearArm=false; renderDetails(); return; }
  if(t.closest("[data-newtrip]")){ clearArm=false; snapTrip(true); const prev=JSON.parse(JSON.stringify(trip)); delete trip.gpx; delete trip.pick; delete trip.founder; Object.assign(trip,freshTrip()); tripEdit=true; ui.tab="ov"; plan=null; fp=null; changed(); locateIfAllowed();
    const tt=$("toast"); tt.innerHTML=`Trip cleared. <button type="button" class="linkbtn">Undo</button>`; tt.hidden=false; tt.querySelector("button").onclick=()=>{Object.keys(trip).forEach(x=>delete trip[x]);Object.assign(trip,prev);tt.hidden=true;changed();}; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,8000); return; }
  const avb=t.closest("[data-av]"); if(avb){ const [k2,j2,c]=avb.dataset.av.split(":"); const same=stopFocus&&stopFocus.k===+k2&&stopFocus.j===+j2&&stopFocus.cat===c; stopFocus=same?null:{k:+k2,j:+j2,cat:c}; if(!stopFocus) window._refit=true; renderDetails(); drawMap(); return; }
  const pl=t.closest("[data-ploc]"); if(pl&&!t.closest("a,button")&&map){ const [la,lo]=pl.dataset.ploc.split(",").map(Number); map.setView([la,lo],16); if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"}); return; }
  const so=t.closest("[data-stop]"); if(so){ const [k2,j2]=so.dataset.stop.split(":").map(Number); stopFocus=stopFocus&&stopFocus.k===k2&&stopFocus.j===j2&&!stopFocus.cat?null:{k:k2,j:j2}; if(!stopFocus) window._refit=true; renderDetails(); drawMap(); return; }
  const sf=t.closest("[data-sfuel]"); if(sf){ const [k2,j2,id]=sf.dataset.sfuel.split(":"); const x=fuelAll.find(q=>q.id===id); if(x){ if(!addStop(+k2,+j2-1,pt(x.name&&x.name!=="Fuel"?x.name:"Fuel stop",x.lat,x.lon,{fuelHere:true}))) return; stopFocus=null; $("status").textContent="Fuel stop added."; changed(); } return; }
  const sa=t.closest("[data-sadd]"); if(sa){ const [k2,j2,id]=sa.dataset.sadd.split(":"); const x=pois.find(q=>q.id===id); if(x){ if(!addStop(+k2,+j2-1,pt(x.name,x.lat,x.lon,{stay:x.kind==="sleep"||x.kind==="camp"}))) return; stopFocus=null; $("status").textContent=`Added ${x.name}.`; changed(); } return; }
  const s2=t.closest("[data-sadd2]"); if(s2){ const [k2,...nm]=s2.dataset.sadd2.split(":"); const name=nm.join(":"), tw=(fp.days[+k2]?.sugg||[]).find(x=>x.name===name); if(tw&&insertVia(+k2,pt(tw.name,tw.lat,tw.lon,{fuelHere:true}))!==false){ $("status").textContent=`Added ${tw.name}.`; changed(); } return; }
  const mv=t.closest("[data-morevias]"); if(mv){viaOpen.add(+mv.dataset.morevias);renderDetails();return;}
  const et=t.closest("[data-editto]"); if(et){editTo.add(+et.dataset.editto);renderDetails();return;}
  const cl=t.closest("[data-clear]"); if(cl){ const id=cl.dataset.clear, m=id.match(/^(night|finish|via)-(\d+)(?:-(\d+))?$/); if(!m) return;
    if(m[1]==="night"){trip.days[+m[2]].to=null;trip.days[+m[2]].noAutoNight=true;editTo.add(+m[2]);} else if(m[1]==="finish"){trip.end=null;} else {trip.days[+m[2]].vias.splice(+m[3],1);trip.days[+m[2]].legs=[];}
    changed(); return; }
  const fk=t.closest("[data-fuelk]"); if(fk&&goGap(+fk.dataset.fuelk)) return; if(fk){const k2=+fk.dataset.fuelk; if(ui.tab==="ov"){ fuelOpen.add(k2); const tb=document.querySelector(`[data-day="${k2}"]`); if(tb){ tb.click(); return; } } fuelOpen.has(k2)?fuelOpen.delete(k2):fuelOpen.add(k2); renderDetails(); return;}
  const af=t.closest("[data-addfill]"); if(af){const f=fp.fills.find(x=>x.id===af.dataset.addfill); if(f){insertVia(+af.dataset.day,pt(f.name&&f.name!=="Fuel"?f.name:"Fuel stop",f.lat,f.lon,{fuelHere:true}));changed();} return;}
  const er=t.closest("[data-editroute]"); if(er){const k2=+er.dataset.editroute; editOpen.has(k2)?editOpen.delete(k2):editOpen.add(k2); renderDetails(); return;}
  const mo=t.closest("[data-more]"); if(mo){const key=mo.dataset.more; showAll.has(key)?showAll.delete(key):showAll.add(key); renderDetails(); return;}
  const sn=t.closest("[data-staynight]"); if(sn){const [k2,id]=sn.dataset.staynight.split(":"); const to=dayTo(+k2), x=(stayFor(to)?.places||[]).find(q=>q.id===id); if(x){ if(map) map.closePopup(); chooseStay(+k2,x); } return;}
  const bk=t.closest("[data-booked]"); if(bk){ const d2=trip.days[+bk.dataset.booked]; if(d2&&d2.to&&d2.to.stay){ d2.to.booked=!d2.to.booked; save(); renderAll(); $("status").textContent=d2.to.booked?`${d2.to.name} marked booked.`:`${d2.to.name}: not booked.`; } return; }
  const stn=t.closest("[data-staytown]"); if(stn){ const d2=trip.days[+stn.dataset.staytown], tw=d2&&d2.to&&d2.to.town; if(tw){ d2.to=pt(tw.name,tw.lat,tw.lon); $("status").textContent=`Night stop back to ${tw.name}.`; changed(); } return; }
  const ps=t.closest("[data-pickstay]"); if(ps){ const k2=+ps.dataset.pickstay; ui.tab=k2; saveUi(); renderAll(); setTimeout(()=>{ const el=$("stays-"+k2); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },60); return; }
  if(t.closest("[data-copysleep]")){ const txt=sleepText(); (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{ $("status").textContent="List copied. Paste it into a note or message."; },()=>{ $("status").textContent="Couldn't copy here. Use Save as PDF instead."; }); return; }
  const ap=t.closest("[data-addpoi]"); if(ap){const [k2,id]=ap.dataset.addpoi.split(":"); const x=pois.find(q=>q.id===id); if(x){insertVia(+k2,pt(x.name,x.lat,x.lon,{}));$("status").textContent=`Added ${x.name}.`;changed();} return;}
  const go=t.closest("[data-gotoday]"); if(go&&!t.closest("button,input,a")){ui.tab=+go.dataset.gotoday;saveUi();renderAll();return;}
  const pn=t.closest("[data-panel]"); if(pn){hidePeek();const [dk,j,tab]=pn.dataset.panel.split(":");openPanel(+dk,j==="last"?"last":+j,tab);return;}
  if(t.closest("[data-ungpx]")){ delete trip.gpx; gpxCache=null; $("status").textContent="Not following the GPX any more. The route is worked out between your stops."; changed(); return; }
  const gb=t.closest("[data-gtk]"); if(gb){ const k2=+gb.dataset.gtk; gtkOpen.has(k2)?gtkOpen.delete(k2):gtkOpen.add(k2); renderDetails(); return; }
  const rb=t.closest("[data-risk]"); if(rb){const k2=+rb.dataset.risk; riskOpen.has(k2)?riskOpen.delete(k2):riskOpen.add(k2); renderDetails(); return;}
  if(t.closest("[data-print]")){printTrip();return;}
  const g=t.closest("[data-gpx]"); if(g){downloadGpx(g.dataset.gpx==="all"?"all":+g.dataset.gpx);return;}
  const ls=t.closest("[data-legsty]"); if(ls&&k!=null){ const [j2,f2]=ls.dataset.legsty.split(":"), j=+j2, f=f2==="1", d2=trip.days[k], v=d2.vias[j];
    if(v&&v.auto){ let i=j; while(i<d2.vias.length&&d2.vias[i].auto) i++; if(i<d2.vias.length) d2.vias[i].fast=f; else d2.toFast=f; // the way belongs to the stretch, up to the next own stop
      let a=j; while(a>0&&d2.vias[a-1].auto) a--; d2.vias.splice(a,i-a); d2.legs=[]; delete d2.noMore; changed(); return; }
    if(v) v.fast=f; else d2.toFast=f;
    let i=j-1, cut=false; while(i>=0&&d2.vias[i].auto){ d2.vias.splice(i,1); i--; cut=true; } // suggestions on this stretch were picked for the old way
    if(cut){ d2.legs=[]; delete d2.noMore; } else d2.legs[j]={wantAlts:(d2.legs[j]||{}).wantAlts};
    changed(); return; }
  const fl=t.closest("[data-focusleg]"); if(fl&&plan&&k!=null){const L=plan.days[k].legs[+fl.dataset.focusleg-1]; focusRange(L.a,L.b); return;}
  const fd=t.closest("[data-focusday]"); if(fd&&plan){const pd=plan.days[+fd.dataset.focusday]; focusRange(pd.a,pd.b); return;}
  const stb=t.closest("[data-staytype]"); if(stb){ const [k2,id]=stb.dataset.staytype.split(":"), d2=trip.days[+k2]; if(id===(trip.stayType||"any")) delete d2.stayType; else d2.stayType=id; showAll.delete("stay-"+k2); save(); renderDetails(); drawMap(); return; }
  const kp=t.closest("[data-keep]"); if(kp&&k!=null){ const v=trip.days[k].vias[+kp.dataset.keep]; if(v&&v.auto){ delete v.auto; v.kept=true; save(); renderDetails(); drawMap(); $("status").textContent=`${v.name} is now one of your stops.`; } return; }
  const rn=t.closest("[data-vren]"); if(rn&&k!=null){ const v=trip.days[k].vias[+rn.dataset.vren]; if(!v) return; const nm=(window.prompt("Name for this stop",v.name)||"").trim(); if(nm&&nm!==v.name){ v.name=nm.slice(0,60); save(); renderAll(); $("status").textContent=`Renamed to ${v.name}.`; } return; }
  const up=t.closest("[data-vup]"); if(up&&k!=null){const i=+up.dataset.vup,v=trip.days[k].vias; if(i>0){[v[i-1],v[i]]=[v[i],v[i-1]];trip.days[k].legs=[];changed();} return;}
  const del=t.closest("[data-vdel]"); if(del&&k!=null){ const d=trip.days[k], v=d.vias[+del.dataset.vdel]; if(v&&v.auto){ d.noAuto=[...(d.noAuto||[]),v.name]; d.noMore=true; } d.vias.splice(+del.dataset.vdel,1); d.legs=[]; changed(); return; }
  const wa=t.closest("[data-wantalts]"); if(wa&&k!=null){ const j2=+wa.dataset.wantalts; trip.days[k].legs[j2]=Object.assign({},trip.days[k].legs[j2],{wantAlts:true}); $("status").textContent="Looking for other ways…"; save(); recalc(); return; }
  const gs=t.closest("[data-gostop]"); if(gs){ const [k2,j2]=gs.dataset.gostop.split(":").map(Number); ui.tab=k2; stopFocus={k:k2,j:j2}; saveUi(); renderAll(); return; }
  const un=t.closest("[data-untrack]"); if(un&&k!=null){const L=trip.days[k].legs[+un.dataset.untrack]; if(L){delete L.track;delete L.trackName;} changed();return;}
  const as=t.closest("[data-addsugg]"); if(as&&k!=null){const f=fp.fills.find(x=>x.id===as.dataset.addsugg); if(f){if(!addStop(k,+as.dataset.at-1,pt(f.name&&f.name!=="Fuel"?f.name:"Fuel stop",f.lat,f.lon,{fuelHere:true}))) return;changed();} return;}
});
$("details").addEventListener("change",async e=>{
  const t=e.target;
  if(t.dataset.fuelpt!==undefined){ const [k2,j2]=t.dataset.fuelpt.split(":").map(Number); const p=plan&&plan.days[k2]&&plan.days[k2].pts[j2]; if(p){ p.fuelHere=t.checked; if(!t.checked&&p.type==="fuel") delete p.type; save(); window._refit=false; recalc(); } return; }
  if(t.dataset.fuelhere!==undefined){ const [k2,i]=t.dataset.fuelhere.split(":").map(Number); const v=trip.days[k2].vias[i]; if(v){ v.fuelHere=t.checked; if(!t.checked&&v.type==="fuel") delete v.type; save(); recalc(); } return; }
  if(t.dataset.breakmin!==undefined){ const [k2,i]=t.dataset.breakmin.split(":").map(Number); const v=trip.days[k2].vias[i]; if(v){ v.mins=Math.max(0,+t.value||0); save(); renderAll(); } return; }
  if(t.dataset.nightfill!==undefined){const to=trip.days[+t.dataset.nightfill].to; if(to){to.fill=t.checked;changed();} return;}
  if(t.dataset.tripgpx!==undefined&&t.files[0]){ await planFromGpx(t.files[0]); t.value=""; return; }
  const k=curDay(); if(k==null) return; const d=trip.days[k];
  if(t.dataset.vtype!==undefined){d.vias[+t.dataset.vtype].type=t.value;changed();}
  if(t.dataset.alt!==undefined){const j=+t.dataset.alt; d.legs[j]=Object.assign({},d.legs[j],{alt:+t.value}); changed();}
  if(t.dataset.track!==undefined&&t.files[0]){
    const j=+t.dataset.track,f=t.files[0],pts=dayPts(k);
    try{const g=parseGpx(await f.text()); if(g.length<2) throw new Error(); const a=pts[j],b=pts[j+1]; let tr=g;
      if(hav(g[0],b)+hav(g[g.length-1],a)<hav(g[0],a)+hav(g[g.length-1],b)) tr=g.slice().reverse();
      d.legs[j]=Object.assign({},d.legs[j],{track:simplify(tr,8).map(p=>[+p.lat.toFixed(5),+p.lon.toFixed(5)]),trackName:f.name}); $("status").textContent=`Using ${f.name} for this stretch.`; changed();
    }catch(err){$("status").textContent="That file has no track or route points.";}
  }
});

/* ---------- stop panel: the way in plus the town ---------- */
function stayFor(p){ return p&&(stays.find(x=>x.night===p)||stays.find(x=>x.night&&x.night.name===p.name&&hav(x.night,p)<0.3)); } // same place, even if the trip was copied (undo, reload)
function scope(k,j){
  const pd=plan&&plan.days[k]; if(!pd) return null; const jj=j==="last"?pd.pts.length-1:j, p=pd.pts[jj]; if(!p) return null;
  const b=jj>0?pd.legs[jj-1].b:pd.a, a=jj>0?pd.legs[jj-1].a:pd.a; return {a,b,p,jj};
}
function panelItems(k,j,tab){
  const sc=scope(k,j); if(!sc||sc.b==null) return [];
  const {a,b,p}=sc, inLeg=x=>x.km!=null&&x.km>=a-0.5&&x.km<=b+0.5, near=x=>hav(x,p)<=5;
  if(tab==="fuel") return fuelAll.filter(f=>inLeg(f)||near(f)).filter((f,i,arr)=>arr.findIndex(x=>x.id===f.id)===i).sort((x,y)=>x.km-y.km);
  if(tab==="stay"){ const kk=trip.days.findIndex((d,i)=>d.to===p&&i<nDays()-1); return (stayFor(p)?.places||[]).filter(x=>stayMatch(x,kk>=0?stayTypeOf(kk):(trip.stayType||"any"))); }
  if(tab==="food") return pois.filter(x=>x.kind==="food"&&(inLeg(x)||near(x))).sort((x,y)=>x.km-y.km);
  return pois.filter(x=>x.kind!=="food"&&ui.types[x.kind]&&(inLeg(x)||near(x))).sort((x,y)=>x.km-y.km);
}
function openPanel(k,j,tab){ if(!plan||!plan.days[k]) return; panel={k,j,tab}; renderPanel(); $("panel").hidden=false; drawMap(); if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"}); }
function closePanel(silent){ if(!panel) return; panel=null; $("panel").hidden=true; if(!silent&&plan) drawMap(); }
function renderPanel(){
  if(!panel) return; const {k,j,tab}=panel, sc=scope(k,j); if(!sc) return closePanel();
  const pd=plan.days[k], p=sc.p, isNight=sc.jj===pd.pts.length-1&&k<nDays()-1;
  $("pTitle").textContent=p.name; $("pSub").textContent=sc.jj===0?"In and around town":`On the way in from ${pd.pts[sc.jj-1].name}, and in town`;
  $("pTabs").innerHTML=Object.entries(TABS).filter(([x])=>x!=="food"||ui.types.food).map(([x,v])=>`<button type="button" class="tab ${x===tab?"on":""}" data-tab="${x}">${ICON[x]}${v} <span class="note">${panelItems(k,j,x).length}</span></button>`).join("");
  const items=panelItems(k,j,tab); let h="";
  if(tab==="fuel"&&sc.jj>0){const f=rangeFuel(sc.a,sc.b); if(f&&f.level) h+=`<div class="verdict ${f.level==="bad"?"v-bad":"v-warn"}">${esc(f.text)}</div>`;}
  if(tab==="stay") h+=`<div class="note">Within 15 km of ${esc(p.name)}, from OpenStreetMap. Prices aren't listed, so phone or check the website.</div>`;
  h+=items.length?items.map(x=>{
    const where=tab==="stay"?`${esc((x.tags.tourism||"").replace("_"," "))} · ${x.dist.toFixed(1)} km from town`:x.km!=null?`${x.off<0.3?"on the route":x.off.toFixed(1)+" km off"}`:"";
    const kindTxt=tab==="sight"?(TYPES.find(t=>t.id===x.kind)?.n||"")+" · ":"";
    const act=tab==="fuel"?`<button class="btn small" type="button" data-pfuel="${x.id}">Fuel stop here</button>`:tab==="stay"?(isNight?`<button class="btn small" type="button" data-pstay="${x.id}">Stay here</button>`:""):`<button class="btn small" type="button" data-padd="${x.id}">Add to route</button>`;
    return `<div class="item"><div class="meta"><b>${esc(x.name&&x.name!=="Fuel"?x.name:tab==="fuel"?"Fuel station":x.name)}</b><span class="note">${kindTxt}${where}</span>${x.note?`<span class="note">${esc(x.note)}</span>`:""}${tab==="stay"||tab==="food"?contactHtml(x.tags||{},x.name,p.name):""}</div>${act}</div>`;
  }).join(""):`<div class="note">${tab==="fuel"?"No stations known here. Carry extra fuel, or if you know a town has fuel, add it as a Fuel stop.":"Nothing listed here."}</div>`;
  $("pBody").innerHTML=h;
}
$("pTabs").addEventListener("click",e=>{const t=e.target.closest("[data-tab]"); if(t&&panel){panel.tab=t.dataset.tab;renderPanel();drawMap();}});
$("pClose").addEventListener("click",()=>closePanel());
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&panel) closePanel();});
$("pBody").addEventListener("change",e=>{ if(!panel||!e.target.matches("[data-pfill]")) return; const sc=scope(panel.k,panel.j); sc.p.fill=e.target.checked; changed(); });
$("pBody").addEventListener("click",e=>{
  if(!panel) return; const {k,j}=panel, sc=scope(k,j), d=trip.days[k], at=Math.max(0,sc.jj-1);
  const f=e.target.closest("[data-pfuel]"),sy=e.target.closest("[data-pstay]"),ad=e.target.closest("[data-padd]");
  if(f){const x=fuelAll.find(q=>q.id===f.dataset.pfuel); if(!x) return; if(!addStop(k,at,pt(x.name&&x.name!=="Fuel"?x.name:"Fuel stop",x.lat,x.lon,{fuelHere:true}))) return; closePanel(true); $("status").textContent="Fuel stop added."; changed();}
  if(sy){const x=(stayFor(sc.p)?.places||[]).find(q=>q.id===sy.dataset.pstay); if(!x) return; closePanel(true); chooseStay(k,x);}
  if(ad){const x=pois.find(q=>q.id===ad.dataset.padd); if(!x) return; if(!addStop(k,at,pt(x.name,x.lat,x.lon,{}))) return; closePanel(true); $("status").textContent=`Added ${x.name}.`; changed();}
});
const canHover=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
function hidePeek(){ $("peek").hidden=true; }
window.addEventListener("scroll",hidePeek,{passive:true});

/* ---------- map ---------- */
let map,layer,focusR=null,lastSel=null;
function focusRange(a,b){focusR={a:Math.min(a,b),b:Math.max(a,b)}; drawMap(); if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"});}
const dotIcon=(c,sz,sq)=>L.divIcon({className:"",html:`<div style="width:${sz}px;height:${sz}px;background:${c};border:2px solid #11262B;border-radius:${sq?"2px":"50%"}"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
let lblLayer=null, ovHi=null;
document.addEventListener("mouseover",e=>{ const o=e.target.closest&&e.target.closest(".ovday"); const k=o?+o.dataset.gotoday:null; if(k!==ovHi&&ui.tab==="ov"){ ovHi=k; drawMap(); } });
function townLabels(){ if(!map||!lblLayer||!townList) return; lblLayer.clearLayers(); const z=map.getZoom(), bb=map.getBounds().pad(-0.03);
  const want=z<7?["city"]:["city","town"]; const list=townList.filter(t=>want.includes(t.place)&&bb.contains([t.lat,t.lon])).sort((a,b)=>(a.place==="city"?0:1)-(b.place==="city"?0:1)).slice(0,z<9?25:45);
  const own=plan?townPoints():[];
  const used=own.map(p=>map.latLngToContainerPoint([p.lat,p.lon])); list.forEach(t=>{ const pnt=map.latLngToContainerPoint([t.lat,t.lon]); if(used.some(u=>Math.abs(u.x-pnt.x)<90&&Math.abs(u.y-pnt.y)<22)) return; used.push(pnt);
    L.marker([t.lat,t.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:"townlbl"+(t.place==="city"?" city":""),html:`<span>${esc(t.name)}</span>`,iconSize:[0,0]})}).addTo(lblLayer); }); }
function ensureMap(){ if(!map){map=L.map("map",{scrollWheelZoom:true});L.tileLayer(TILES.url,{maxZoom:TILES.maxZoom,attribution:TILES.attribution}).addTo(map);map.setView(...homeView()); lblLayer=L.layerGroup().addTo(map); map.on("moveend",townLabels); map.on("zoomend",()=>$("map").classList.toggle("zoomin",map.getZoom()>=12)); $("map").classList.toggle("zoomin",map.getZoom()>=12); if(window.ResizeObserver) new ResizeObserver(()=>map.invalidateSize()).observe($("map"));} map.invalidateSize(); if(layer) layer.remove(); layer=L.layerGroup().addTo(map); }
const seg=(a,b)=>plan.geom.filter((g,i)=>plan.cum[i]>=a-0.01&&plan.cum[i]<=b+0.01);
// where the map opens before there's a trip: the region of the device's time zone, no location prompt
function homeView(){
  let tz=""; try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""; }catch(e){}
  if(/^Africa\/(Johannesburg|Windhoek|Gaborone|Maputo|Harare|Maseru|Mbabane|Lusaka)/.test(tz)) return [[-29,24],5];
  if(/^Europe\/(London|Dublin)|^Atlantic\/(Reykjavik|Faroe)/.test(tz)) return [[54,-3],6];
  if(/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota)|^US\//.test(tz)) return [[39,-97],4];
  if(/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/.test(tz)) return [[54,-100],4];
  if(/^Australia\//.test(tz)) return [[-27,134],4];
  if(/^Pacific\/Auckland/.test(tz)) return [[-41,173],5];
  if(/^Europe\//.test(tz)) return [[50,10],4];
  if(/^Africa\//.test(tz)) return [[2,20],3];
  if(/^America\//.test(tz)) return [[-15,-60],3];
  if(/^Asia\//.test(tz)) return [[30,90],3];
  return [[20,0],2];
}
let startSeen="";
function drawMap(){
  if(!window.L) return; ensureMap();
  if(!plan){ const s0=trip.start; if(s0&&s0.lat!=null){ L.marker([s0.lat,s0.lon],{icon:L.divIcon({className:"",html:`<div class="pin pstart">▶</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip("Start: "+s0.name,{permanent:true,direction:"right",offset:[14,0],className:"maplbl"}).addTo(layer);
      const key=s0.lat+","+s0.lon; if(startSeen!==key){ startSeen=key; map.setView([s0.lat,s0.lon],9,{animate:false}); } } try{ if(ui.lay.fav&&typeof drawFavs==="function") drawFavs(); }catch(e){} return; }
  townLabels();
  const sel=ui.tab==="ov"?null:plan.days[ui.tab];
  const hl=sel?null:ovHi;
  plan.days.forEach((d,k)=>{ if(!d) return; const on=sel?k===ui.tab:(hl==null||hl===k), col=DAYCOL[k%DAYCOL.length];
    const st=sel?{color:on?col:"#54666A",weight:on?5:3,opacity:on?.9:.3}:{color:on?col:"#54666A",weight:on?(k===0?7:5):3,opacity:on?.95:.25,dashArray:k>0?"10 8":null,lineCap:"butt"};
    L.polyline(seg(d.a,d.b).map(g=>[g.lat,g.lon]),st).addTo(layer); });
  if(ui.lay.road) drawGradeLayer(sel);
  if(ui.lay.rep&&typeof drawReports==="function") drawReports(sel);
  if(ui.lay.spots&&typeof drawSpots==="function") drawSpots();
  try{ if(ui.lay.fav&&typeof drawFavs==="function") drawFavs(); }catch(e){} // an extra layer must never stop the route
  try{ if(typeof drawEvents==="function") drawEvents(); }catch(e){}
  if(panel){ drawPanelLayer(); return; }
  if(stopFocus&&sel&&stopFocus.k===ui.tab&&drawStopLayer()) return;
  if(ovFocus&&(!sel||ovFocus.k===ui.tab)&&drawOvLayer()) return;
  if(focusR){ const s=seg(focusR.a,focusR.b); if(s.length>1){L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer); map.fitBounds(L.latLngBounds(s.map(g=>[g.lat,g.lon])),{padding:[30,30]});} }
  const range=sel?[sel.a,sel.b]:[0,plan.total], inR=x=>x.km!=null&&x.km>=range[0]-1&&x.km<=range[1]+1;
  townPoints().forEach(p=>{ const km=plan.ptKm.get(p); if(sel&&!(km!=null&&km>=sel.a-0.5&&km<=sel.b+0.5)) return;
    const nk=trip.days.findIndex((d,k)=>d.to===p&&k<nDays()-1), night=nk>=0, isStart=p===trip.start, isEnd=p===endPt()&&!isStart, round=isStart&&trip.round;
    const dk=plan.days.findIndex(d=>d&&d.pts.slice(1,-1).includes(p));
    const badge=!sel&&dk>=0?`<i class="pinday" style="background:${DAYCOL[dk%DAYCOL.length]}">${dk+1}</i>`:"";
    let html, size=[22,22], label;
    if(isStart){ html=`<div class="pin pstart">${round?"⟲":"▶"}</div>`; size=[28,28]; label=round?`Start · finish: ${p.name}`:`Start: ${p.name}`; }
    else if(isEnd){ html=`<div class="pin pend">🏁</div>`; size=[28,28]; label=`Finish: ${p.name}`; }
    else if(night){ html=`<div class="pin pnight" style="border-color:${DAYCOL[nk%DAYCOL.length]}">🛏<b>${nk+1}</b></div>`; size=[38,28]; label=`Night ${nk+1}: ${p.name}`; }
    else if(p.auto){ html=`<div class="mapemo dashed">⛽${badge}</div>`; label="Suggested: "+p.name; }
    else { html=`<div class="pin pstop">${stopFuel(p)?"⛽":"•"}${badge}</div>`; label=p.name; }
    const key=sel?true:(isStart||night||isEnd);
    const m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html,iconSize:size,iconAnchor:[size[0]/2,size[1]/2]}),zIndexOffset:night||isStart||isEnd?1000:0}).bindTooltip(label,key?{permanent:true,direction:night&&nk%2===1?"left":"right",offset:[night&&nk%2===1?-size[0]/2:size[0]/2,0],className:"maplbl"+(night?" mlnight":"")}:{}).addTo(layer);
    m.on("click",()=>{ const k=trip.days.findIndex((d,i)=>plan.days[i]&&plan.days[i].pts.includes(p)&&(sel?i===ui.tab:true)); if(k<0) return; const j=plan.days[k].pts.indexOf(p); ui.tab=k; stopFocus={k,j}; saveUi(); renderAll(); });
  });
  if(fp&&ui.lay.fuel){
    fuelStations.filter(f=>inR(f)&&f.off<=2).forEach(f=>L.marker([f.lat,f.lon],{icon:dotIcon("#0F7B8A",10,true)}).bindTooltip("Fuel: "+f.name).addTo(layer));
    const stopsHere=townPoints(), gapsOn=(fp.days||[]).flatMap(d=>d?d.probs:[]);
    const ftowns=stopTowns().filter(t=>t.fuel&&t.off>2&&inR(t)&&!stopsHere.some(p=>hav(p,t)<3)&&gapsOn.some(g=>t.km>=g.from-5&&t.km<=g.to+5)), lbl=sel&&ftowns.length<=8;
    if(sel||plan.days.filter(Boolean).length===1) ftowns.forEach(t=>{ const k=plan.days.findIndex(d=>d&&t.km>=d.a-1&&t.km<=d.b+1); if(k<0) return;
      L.marker([t.lat,t.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:#0F7B8A">⛽</div>`,iconSize:[22,22],iconAnchor:[11,11]})})
        .bindTooltip(t.name,lbl?{permanent:true,direction:"right",offset:[12,0],className:"maplbl"}:{})
        .bindPopup(`<b>${esc(t.name)}</b><br>${Math.round(t.off)} km off the route${t.food?" · food":""}<br><button class="btn small" type="button" data-addtown="${k}|${esc(t.name)}|${t.lat}|${t.lon}">Add as a stop</button>`).addTo(layer); });
  }
  if(ui.lay.med&&meds) meds.filter(m=>m.off<=25&&inR(m)).forEach(m=>L.marker([m.lat,m.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:#B3261E">🏥</div>`,iconSize:[22,22],iconAnchor:[11,11]})}).bindTooltip(`${m.name||(m.type==="hospital"?"Hospital":"Clinic")}${m.phone?" · "+m.phone:""}`).addTo(layer));
  pois.filter(p=>ui.types[p.kind]&&inR(p)).sort((a,b)=>a.off-b.off).slice(0,+ui.max).forEach(p=>{const t=TYPES.find(x=>x.id===p.kind); L.marker([p.lat,p.lon],{icon:dotIcon(t.c,10)}).bindTooltip(`${p.name} · ${t.n}`).addTo(layer);});
  // zoomed out, 21 dots sit on top of each other under the night marker: show one "🏨 21" badge per night instead (tap to zoom in)
  if(ui.lay.stay) stays.forEach(s=>{ const k=trip.days.findIndex((d,i)=>d.to===s.night&&i<nDays()-1); if(k<0) return; const n=s.places.filter(p=>stayMatch(p,stayTypeOf(k))).length; if(!n||(trip.days[k].to&&trip.days[k].to.stay)) return;
    L.marker([s.night.lat,s.night.lon],{icon:L.divIcon({className:"",html:`<div class="staybadge" title="${n} places to stay. Tap to see them">🛏 ${n}</div>`,iconSize:[54,24],iconAnchor:[-14,30]}),zIndexOffset:900}).on("click",()=>map.setView([s.night.lat,s.night.lon],14)).addTo(layer); });
  if(ui.lay.stay) stays.forEach(s=>{ const k=trip.days.findIndex((d,i)=>d.to===s.night&&i<nDays()-1); if(k<0) return; s.places.filter(p=>stayMatch(p,stayTypeOf(k))).forEach(p=>{ const on=trip.days[k].to&&trip.days[k].to.stay&&trip.days[k].to.name===p.name&&hav(p,trip.days[k].to)<0.1;
    L.marker([p.lat,p.lon],{icon:dotIcon(on?"#0F7B8A":"#2F5BA8",on?13:9)}).bindTooltip(p.name).bindPopup(`<b>${esc(p.name)}</b><br><span class="note">${esc((p.tags.tourism||"").replace(/_/g," "))}</span><br>${on?`<span class="okt">✓ Your stay, ${esc(dayName(k))}</span>`:`<button class="btn small" type="button" data-staynight="${k}:${esc(p.id)}">Stay here, ${esc(dayName(k))}</button>`}`).addTo(layer); }); });
  if(!focusR){ const g=sel?seg(sel.a,sel.b):plan.geom; if(g.length>1&&(window._refit||sel||lastSel!==ui.tab)){map.fitBounds(L.latLngBounds(g.map(x=>[x.lat,x.lon])),{padding:[24,24]});} if(!planStale) window._refit=false; lastSel=ui.tab; }
}
function drawPanelLayer(){
  const {k,j,tab}=panel, sc=scope(k,j); if(!sc) return;
  const s=sc.jj>0?seg(sc.a,sc.b):[];
  if(s.length>1) L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer);
  L.marker([sc.p.lat,sc.p.lon],{icon:dotIcon("#11262B",16)}).bindTooltip(sc.p.name).addTo(layer);
  const col={fuel:"#0F7B8A",stay:"#2F5BA8",food:"#B3261E",sight:"#9A6A33"}[tab], items=panelItems(k,j,tab);
  items.forEach(p=>L.marker([p.lat,p.lon],{icon:dotIcon(tab==="sight"?(TYPES.find(t=>t.id===p.kind)?.c||col):col,11,tab==="fuel")}).bindTooltip(p.name||"Fuel").addTo(layer));
  const pts=[...s,...items,sc.p].map(p=>[p.lat,p.lon]);
  if(tab==="stay"||sc.jj===0) map.setView([sc.p.lat,sc.p.lon],12); else if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[30,30]});
}

/* ---------- icon bar: what to show on the map ---------- */
const LAY=[["fuel","⛽","Fuel","Fuel stations on the route"],["stay","🛏","Places to stay","Places to stay at your night stops"],["food","🍴","Food","Places to eat"],["sights","★","Sights","Sights, viewpoints and passes"],["med","🏥","Medical","Hospitals and clinics"],["rep","📣","Rider reports","What riders reported on the road lately"],["spots","📍","Riders' places","Places riders marked: viewpoints, farm stalls, stays"],["fav","♥","Founder's fav's","Places the founder would send you, and petrolhead places"],["road","🛣","Road grade","The route coloured by terrain grade, Race to Single"]];
ui.lay=Object.assign({fuel:true,stay:!!ui.sleep,food:!!ui.types.food,sights:true,med:false,rep:true,spots:true,fav:false},ui.lay||{}); if(ui.favV!==1){ ui.lay.fav=false; ui.favV=1; } // fav's off by default: a button for those who want them if(ui.lay.rep===undefined) ui.lay.rep=true; if(ui.lay.spots===undefined) ui.lay.spots=true;
function renderLayers(){
  $("iconbar").innerHTML=`<span class="ibhead">On the map</span>`+LAY.map(([id,ic,w,t])=>{ const on=!!ui.lay[id];
    return `<button type="button" class="ib ${on?"on":""}" data-lay="${id}" title="${esc(w)}: ${esc(t)}" aria-label="${esc(w)}" aria-pressed="${on}">${ic}</button>`; }).join("")
    +(ui.lay.sights?`<label class="ibmax" title="How many sights to show">★ <select data-max aria-label="How many sights">${[["10","10"],["25","25"],["50","50"],["1000","All"]].map(([v,l])=>`<option value="${v}" ${ui.max===v?"selected":""}>${l}</option>`).join("")}</select></label>`:"")+`<button type="button" class="ibkey" data-key title="What the icons and colours mean">?</button>`;
}
$("iconbar").addEventListener("click",e=>{ if(e.target.closest("select")) return; if(e.target.closest("[data-key]")){ $("keyDlg").showModal(); return; } const b=e.target.closest("[data-lay]"); if(!b||b.disabled) return; const id=b.dataset.lay; ui.lay[id]=!ui.lay[id];
  if(id==="food") ui.types.food=ui.lay.food; if(id==="sights") ["view","pass","sight"].forEach(t=>ui.types[t]=ui.lay.sights); if(id==="stay"){ ui.sleep=ui.lay.stay; ui.types.camp=ui.lay.stay; }
  saveUi(); renderLayers(); renderAll(); });
$("iconbar").addEventListener("change",e=>{ if(e.target.dataset.max!==undefined){ ui.max=e.target.value; saveUi(); renderAll(); } });
document.addEventListener("click",e=>{ const b=e.target.closest("[data-addtown]"); if(!b) return; const [k,name,la,lo]=b.dataset.addtown.split("|"); if(insertVia(+k,pt(name,+la,+lo,{fuelHere:true}))!==false){ map.closePopup(); $("status").textContent=`Added ${name}.`; changed(); } });
document.addEventListener("click",e=>{ document.querySelectorAll(".legopts[open]").forEach(x=>{if(!x.contains(e.target)) x.open=false;});});

/* ---------- GPX ---------- */
/* GPX for the rider's bike or GPS: track for most, plus a short route for Garmin and BMW (they navigate a route) */
const GPS_NAME={any:"GPS or phone app",garmin:"Garmin",bmw:"BMW Motorrad Connected app",ducati:"Ducati Link app",ktm:"KTM app",harley:"Harley Boom! Box (copy it to a USB stick)",closed:"phone app",phone:"phone app"};
function gpxDay(k){
  const pd=plan.days[k]; if(!pd) return null; const from=pd.pts[0], to=pd.pts[pd.pts.length-1];
  const name=`${dayName(k)} ${from.name} to ${to.name}`, g=seg(pd.a,pd.b);
  const last=k===nDays()-1, sym=(p,j)=>j===pd.pts.length-1?(last?"Flag, Red":"Lodging"):stopFuel(p)?"Gas Station":p.type==="sight"||p.type==="pass"?"Scenic Area":"Flag, Blue";
  const fuelW=fp?fuelGroups(fp.fills.filter(f=>f.km>pd.a&&f.km<=pd.b)).filter(g=>!pd.pts.some(p=>hav(p,g.st[0])<2)).map(g=>({lat:g.st[0].lat,lon:g.st[0].lon,n:"Fuel "+(g.town?g.town.name:g.st[0].name),s:"Gas Station"})):[];
  const w=[...pd.pts.slice(1).map((p,i)=>({lat:p.lat,lon:p.lon,n:p.name,s:sym(p,i+1)})),...fuelW];
  // route: the stops plus shaping points along the line, at most 50 (BMW's limit; Garmin is happy with it)
  const stopsKm=pd.pts.map((p,j)=>j===0?pd.a:pd.legs[j-1].b), want=Math.max(0,50-pd.pts.length), step=(pd.b-pd.a)/(want+1);
  const shape=[]; for(let i=1;i<=want;i++){ const km=pd.a+step*i; if(stopsKm.some(x=>Math.abs(x-km)<step*0.4)) continue; const gi=plan.cum.findIndex(c=>c>=km); if(gi>=0) shape.push({km,lat:plan.geom[gi].lat,lon:plan.geom[gi].lon}); }
  const rte=[...pd.pts.map((p,j)=>({km:stopsKm[j],lat:p.lat,lon:p.lon,n:p.name})),...shape].sort((a,b)=>a.km-b.km).slice(0,50);
  return {name,w,trk:simplify(g,20),rte};
}
const x5=v=>v.toFixed(5);
function gpxText(days,dev){
  const withRte=dev==="garmin"||dev==="bmw", withTrk=dev!=="bmw";
  const w=days.flatMap(d=>d.w).filter((p,i,a)=>a.findIndex(q=>q.n===p.n&&Math.abs(q.lat-p.lat)<1e-4)===i);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OneTrackMind (onetrackmind.online)" xmlns="http://www.topografix.com/GPX/1/1">
${w.map(p=>`  <wpt lat="${x5(p.lat)}" lon="${x5(p.lon)}"><name>${esc(p.n)}</name><sym>${esc(p.s)}</sym></wpt>`).join("\n")}
${withRte?days.map(d=>`  <rte>
    <name>${esc(d.name)}</name>
${d.rte.map(p=>`    <rtept lat="${x5(p.lat)}" lon="${x5(p.lon)}">${p.n?`<name>${esc(p.n)}</name>`:""}</rtept>`).join("\n")}
  </rte>`).join("\n"):""}
${withTrk?days.map(d=>`  <trk>
    <name>${esc(d.name)}</name>
    <trkseg>
${d.trk.map(x=>`      <trkpt lat="${x5(x.lat)}" lon="${x5(x.lon)}"/>`).join("\n")}
    </trkseg>
  </trk>`).join("\n"):""}
</gpx>
`;
}
function downloadGpx(k){
  const dev=settings.gps||"any", ks=k==="all"?plan.days.map((d,i)=>d?i:-1).filter(i=>i>=0):[k];
  const days=ks.map(gpxDay).filter(Boolean); if(!days.length) return;
  const name=k==="all"?`${trip.start.name} trip ${trip.startDate}`:days[0].name;
  const file=name.replace(/[^\w]+/g,"-").replace(/-+$/,"")+".gpx";
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([gpxText(days,dev)],{type:"application/gpx+xml"})); a.download=file; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
  $("status").textContent=dev==="closed"?`Saved ${file}. Your bike's own app can't import GPX: open the file in Calimoto, Kurviger or OsmAnd on your phone instead.`
    :`Saved ${file} for your ${GPS_NAME[dev]}. Open it from your downloads and share it to the app${dev==="bmw"?" (shown as a route: your stops plus shaping points, 50 at most)":""}.`;
  // on a phone, people try to open the file in Waze or Google Maps, which can't read GPX
  if(/iPhone|iPad|Android/i.test(navigator.userAgent)){ const t=$("toast"); t.innerHTML=`GPX is for a GPS or apps like OsmAnd, Calimoto or Kurviger. <b>Waze and Google Maps can't open it.</b> <button type="button" class="linkbtn" data-navlinks>Open in Google Maps / Waze</button>`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,20000); }
}

/* ---------- settings + glue ---------- */
SET_FIELDS.forEach(id=>$(id).value=settings[id]);
$("openSettings").addEventListener("click",()=>{ renderHist(); $("settings").showModal(); });
$("settings").addEventListener("close",()=>{
  if($("style").value!==settings.style) settings.styleSet=true;
  const reroute=+$("corridor").value!==+settings.corridor||$("style").value!==settings.style||$("vehicle").value!==settings.vehicle;
  const prevVeh=settings.vehicle, typed=$("range").value; if(String(typed)!==String(settings.range)) settings.rangeSet=true;
  SET_FIELDS.forEach(id=>settings[id]=$(id).value); if(!settings.rangeSet&&prevVeh!==settings.vehicle){ settings.range=RANGE_DEF[settings.vehicle]||200; $("range").value=settings.range; } store.set("rr2-settings",settings);
  showStyle(); reroute?recalc():renderAll();
});
/* ---------- first visit: what this is and how to start (shown once; "How it works" brings it back) ---------- */
function openWelcome(){ $("wGps").value=settings.gps||"any"; $("welcome").returnValue=""; $("wOk").textContent=trip.start&&trip.start.lat!=null?"Save changes":"Start planning"; $("wVehicle").value=settings.vehicle; $("wStyle").value=settings.style; $("wHours").value=settings.maxHours; $("wRange").value=settings.range; $("welcome").showModal(); }
$("welcome").addEventListener("close",()=>{
  if($("welcome").returnValue!=="ok"){ try{localStorage.setItem("rr-welcome","1");}catch(e){} return; } // ✕, Cancel or Esc: nothing changes
  const was=[settings.vehicle,settings.style].join();
  settings.vehicle=$("wVehicle").value; settings.style=$("wStyle").value; settings.gps=$("wGps").value; settings.maxHours=$("wHours").value; if(String($("wRange").value)!==String(settings.range)) settings.rangeSet=true; settings.range=settings.rangeSet?$("wRange").value:(RANGE_DEF[settings.vehicle]||200);
  store.set("rr2-settings",settings); SET_FIELDS.forEach(id=>$(id).value=settings[id]); try{localStorage.setItem("rr-welcome","1");}catch(e){}
  showStyle(); was!==[settings.vehicle,settings.style].join()?recalc():renderAll();
  if(!trip.start||trip.start.lat==null) $("startPlace").focus();
});
$("howItWorks").addEventListener("click",openWelcome);
/* no popup on the first visit: the map opens straight away with sensible defaults; the vehicle and road style chip (Change) opens the settings card */ // wait for fonts so the box doesn't jump
const STYLE_TEXT={rough:"<b>Road less travelled</b>: gravel and back roads wherever they go",mixed:"<b>Mixed</b>: plenty of gravel, tar to link it up",tar:"<b>Tar</b>: main roads, like normal sat-nav"};
function showStyle(){ $("styleBanner").innerHTML=`${VEHICLES[settings.vehicle]||VEHICLES.bike} · ${STYLE_TEXT[settings.style]||STYLE_TEXT.rough}.${settings.style==="tar"?"":" Tap a stretch's way icon to switch it to the quick way."} <button type="button" class="linkbtn" id="bannerEdit">Change</button>`; }
document.addEventListener("click",e=>{ if(e.target.id==="bannerEdit") openWelcome(); });
function render(){ renderAll(); }
function renderAll(){
  fp=plan?fuelPlan():null;
  renderTripBar(); renderTabs();
  const ae=document.activeElement; if(!(ae&&ae.closest&&ae.closest("#details")&&ae.tagName==="INPUT"&&ae.type==="text")) renderDetails();
  if(panel) renderPanel();
  drawMap();
  const tot=plan?plan.days.reduce((t,d)=>t+(d?d.km:0),0):0;
  $("hdrSummary").textContent=plan?`${Math.round(tot)} km · ${nDays()} day${nDays()>1?"s":""}`:"";
}
let clearArm=false, planStale=false;
function tripLabel(t){ const n=(t.days||[]).length, nights=(t.days||[]).slice(0,-1).map(d=>d.to&&d.to.name).filter(Boolean); const last=(t.days||[])[n-1]; const dest=nights.length?nights.join(", "):(last&&last.vias&&last.vias[0]?last.vias[0].name:""); return `${t.start?t.start.name:"?"}${dest?" → "+dest:""} · ${n} day${n>1?"s":""}`; }
function snapTrip(force){
  const t=JSON.parse(JSON.stringify(trip)); if(!t.start||t.start.lat==null) return;
  if(!t.days.some(d=>d.to||d.vias.length)&&!(t.end&&!t.round)) return;
  const h=store.get("rr4-hist")||[], key=JSON.stringify(t);
  if(h[0]&&h[0].key===key) return;
  if(!force&&h[0]&&Date.now()-h[0].at<60000) h.shift();
  h.unshift({at:Date.now(),key,label:tripLabel(t)}); store.set("rr4-hist",h.slice(0,5));
}
function renderHist(){
  const h=store.get("rr4-hist")||[];
  $("histList").innerHTML=h.length?h.map((x,i)=>`<div class="srow"><div><b>${esc(x.label)}</b><span class="note">saved ${esc(new Date(x.at).toLocaleString(undefined,{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))}</span></div><button class="btn small ghost" type="button" data-restore="${i}">Restore</button></div>`).join(""):`<div class="note">Nothing saved yet.</div>`;
}
$("histList").addEventListener("click",e=>{ const b=e.target.closest("[data-restore]"); if(!b) return; const h=store.get("rr4-hist")||[], x=h[+b.dataset.restore]; if(!x) return; snapTrip(true); const t=JSON.parse(x.key); Object.keys(trip).forEach(k=>delete trip[k]); Object.assign(trip,t); ui.tab="ov"; $("settings").close(); changed(); });
const daySig=k=>[dayFrom(k),...(trip.days[k]?trip.days[k].vias.filter(v=>!v.auto):[]),dayTo(k)].map(p=>p&&p.lat!=null?p.lat.toFixed(3)+","+p.lon.toFixed(3):"-").join("|");
function changed(){ window._refit=true; focusR=null; stopFocus=null; ovFocus=null; selStop=null; autoRounds=0;
  syncDays(); trip.days.forEach((d,k)=>{ const s=daySig(k); if(d.sig&&d.sig!==s){ d.fresh=true; delete d.noMore; const n=d.vias.length; d.vias=d.vias.filter(v=>!v.auto); if(d.vias.length!==n) d.legs=[]; } d.sig=s; });
  snapTrip(); recalc(); }
$("keyDlg").innerHTML=$("keyDlg").innerHTML.replace("STYLE_FAST",STYLE_ICON.fast).replace("STYLE_ROUGH",STYLE_ICON.default).replaceAll("FUEL",ICON.fuel);

snapTrip(true);
renderLayers(); showStyle(); syncDays(); renderAll(); recalc();
// "Stay here" in a map popup (the map isn't inside the details panel)
$("map").addEventListener("click",e=>{ const sn=e.target.closest&&e.target.closest("[data-staynight]"); if(!sn) return;
  const [k2,id]=sn.dataset.staynight.split(":"), x=(stayFor(dayTo(+k2))?.places||[]).find(q=>q.id===id); if(x){ map.closePopup(); chooseStay(+k2,x); } });

["vehicle","wVehicle"].forEach(id=>{ const el=$(id); if(el) el.addEventListener("change",()=>{ if(settings.rangeSet) return; const r=$(id==="vehicle"?"range":"wRange"); if(r) r.value=RANGE_DEF[el.value]||200; }); });
