
/* ================= v4: plan by dates ================= */
const TABS={fuel:"Fuel",stay:"Stay",food:"Food",sight:"Sights"};
const DAYCOL=["#0B6E4F","#2F5BA8","#9A6A33","#6B4E9B","#B3261E","#00838F","#5D4037"];
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function addDays(s,n){const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return ymd(d);}
const dayName=k=>dayDate(k).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
const dayLong=k=>dayDate(k).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
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
const freshTrip=()=>({startDate:tomorrow,endDate:tomorrow,start:pt("My location",null,null),end:null,round:true,days:[{to:null,style:"default",vias:[],legs:[]}]});
const trip=store.get("rr4-trip")||migrate()||freshTrip();
if(trip.sugV!==4){ (trip.days||[]).forEach(d=>{ const n=(d.vias||[]).length; d.vias=(d.vias||[]).filter(v=>!v.auto); if(d.vias.length!==n) d.legs=[]; d.fresh=true; delete d.noMore; }); trip.sugV=4; }
if(trip.startDate<ymd(new Date())){const n=trip.days.length;trip.startDate=tomorrow;trip.endDate=addDays(tomorrow,n-1);}

const SET_FIELDS=["range","leave","pace","corridor","style","maxHours","breakMin"];
const settings=Object.assign({range:200,reserve:30,leave:"08:00",pace:0,corridor:5,style:"rough",fuelMode:"suggest",maxHours:8,breakMin:20},store.get("rr2-settings")||{});
const ui=Object.assign({types:Object.fromEntries(TYPES.map(t=>[t.id,t.on])),max:"10",sleep:false},store.get("rr4-ui")||{});
ui.tab=ui.tab??"ov"; delete ui._lastSel;
let plan=null, pois=[], fuelStations=[], fuelAll=[], stays=[], placesOk=false, dataDate="", seq=0, panel=null, fp=null;
fetch("/data/updated.json").then(r=>r.ok?r.json():null).then(j=>{if(j&&j.updated)dataDate=new Date(j.updated).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}).catch(()=>{});

const save=()=>store.set("rr4-trip",trip), saveUi=()=>store.set("rr4-ui",ui);
const nDays=()=>trip.days.length;
function dayCountFromDates(){const a=new Date(trip.startDate+"T12:00:00"),b=new Date(trip.endDate+"T12:00:00");return Math.max(1,Math.min(60,Math.round((b-a)/86400000)+1));}
function syncDays(){
  const n=dayCountFromDates();
  while(trip.days.length<n) trip.days.splice(trip.days.length-1,0,{to:null,style:"default",vias:[],legs:[]});
  while(trip.days.length>n){const last=trip.days.pop(),prev=trip.days[trip.days.length-1]; if(prev.to) prev.vias.push(Object.assign(prev.to,{type:"pass"})); prev.to=null; prev.vias.push(...last.vias); prev.legs=[];}
  if(ui.tab!=="ov"&&ui.tab>=trip.days.length) ui.tab="ov";
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
  try{
    const res=await Promise.all(trip.days.map((d,k)=>{const pts=dayPts(k); if(!pts) return null; 
      return Promise.all(pts.slice(0,-1).map((a,j)=>routeLeg(a,pts[j+1],{fast:legFast(d,j),track:d.legs[j]&&d.legs[j].track,alts:d.legs[j]&&d.legs[j].wantAlts}))).then(opts=>({pts,opts}));}));
    if(my!==seq) return;
    const geom=[],cum=[],ptKm=new Map(),days=[]; let acc=0;
    res.forEach((r,k)=>{
      if(!r){days.push(null);return;}
      const d=trip.days[k];
      const legs=r.opts.map((o,j)=>{const ch=o[Math.min((d.legs[j]&&d.legs[j].alt)||0,o.length-1)];return {km:ch.km,min:ch.min,geom:ch.geom,n:o.length,alts:o.map(x=>x.km)};});
      if(!ptKm.has(r.pts[0])) ptKm.set(r.pts[0],acc);
      legs.forEach((L,j)=>{L.a=acc; L.geom.forEach((g,i)=>{if(geom.length&&i>0)acc+=hav(geom[geom.length-1],g); geom.push(g);cum.push(acc);}); L.b=acc; ptKm.set(r.pts[j+1],acc);});
      days.push({pts:r.pts,legs,km:legs.reduce((t,x)=>t+x.km,0),min:legs.reduce((t,x)=>t+x.min,0),a:legs[0].a,b:legs[legs.length-1].b});
    });
    if(!geom.length){plan=null;fp=null;$("status").textContent="Pick where you're going to see the route.";renderAll();return;}
    plan={days,geom,cum,total:acc,ptKm}; planStale=false;
    $("status").textContent="Finding fuel and places…";
    renderAll();
    loadWeather(my).then(()=>{if(my===seq) renderAll();}).catch(()=>{wx=null;});
    const ok=await loadPlaces(my); if(my!==seq) return;
    if(autoRounds<3){ fp=fuelPlan(); if(autoFuel()){ autoRounds++; save(); recalc(); return; } }
    $("status").textContent=ok===false?"Fuel stations couldn't load. Checking your own fuel stops only.":ok==="partial"?"Points of interest couldn't load.":"";
    renderAll();
  }catch(e){ if(my===seq){$("status").textContent="Couldn't get a route. Check each place is on a road, and your connection."; renderAll();} }
}

/* ---------- fuel ---------- */
let townList=null; allTowns().then(t=>{ townList=t.filter(x=>x.place!=="hamlet"); townLabels(); if(plan){ plan._cands=null; if(placesOk&&autoRounds<3){ fp=fuelPlan(); if(autoFuel()){ autoRounds++; save(); recalc(); return; } } renderAll(); } }).catch(()=>{});
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
  const own=pd.pts.slice(1,-1).map((p,i)=>({p,km:pd.legs[i].b})).filter(x=>ignoreAuto?!x.p.auto&&stopFuel(x.p):stopFuel(x.p)||x.p.auto);
  const sugg=[], probs=[]; if(!(S>0)) return {through,sugg,probs};
  let pos=pd.a, posName=pd.pts[0].name, guard=0;
  const inWin=(t,win)=>t.km>pos+5&&t.km<=win;
  const far=l=>{ const f=l.filter(t=>t.food); return (f.length?f:l).reduce((x,y)=>y.km>x.km?y:x); };
  const near=l=>l.reduce((x,y)=>y.off<x.off?y:x);
  while(pd.b-pos>S&&guard++<50){
    const win=pos+S, o=own.filter(x=>x.km>pos+5&&x.km<=win).pop();
    if(o){ pos=o.km; posName=o.p.name; continue; }
    const steps=[c=>c.fuel&&c.off<=5,c=>c.fuel&&c.off<=40,c=>c.off<=5,c=>c.off<=40];
    let pick=null;
    for(let i=0;i<steps.length&&!pick;i++){ const l=cands.filter(t=>steps[i](t)&&inWin(t,win)); if(l.length) pick=i%2===0?far(l):near(l); }
    if(pick){ sugg.push(pick); pos=pick.km; posName=pick.name; continue; }
    const next=cands.filter(t=>t.km>win&&t.km<pd.b).sort((x,y)=>(x.off<=5?0:1)-(y.off<=5?0:1)||x.km-y.km)[0];
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
  return {level:"warn",short:`No town within reach: ${len} km`,text:`No town within reach: ${len} km, ${pr.fromName} to ${pr.toName}`};
}
function fuelPill(f){
  if(!f) return "";
  return `<span class="pill fwarn" title="${esc(f.text)}">${ICON.fuel}Check fuel</span>`;
}
function dayMinutes(k){
  const d=plan&&plan.days[k]; if(!d) return 0;
  const pace=1+(+settings.pace||0)/100, stopMin=d.pts.slice(1,-1).reduce((t,p)=>t+breakOf(p),0);
  return d.min*pace+stopMin;
}

/* ---------- search wiring ---------- */
function wireSearch(input,list,onPick){
  let t,ctl,hits=null,hitsQ="",pending=null,pickWhenReady=false,done=false;
  const start0=input.value;
  const pick=h=>{ if(done) return; done=true; list.hidden=true; input.blur(); onPick(pt(h.name,h.lat,h.lon)); };
  const run=q=>{ ctl?.abort(); ctl=new AbortController(); list.innerHTML=`<div class="note" style="padding:8px">Searching…</div>`; list.hidden=false;
    const c=map?map.getCenter():{lat:-33,lng:19};
    pending=searchPlaces(q,c,ctl.signal).then(r=>{ hits=r; hitsQ=q; pending=null;
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
function hook(id,onPick){const el=document.getElementById(id); if(el) wireSearch(el,el.closest(".ac").querySelector(".sugg"),onPick);}

/* ---------- trip bar ---------- */
function renderTripBar(){
  $("startDate").value=trip.startDate; $("endDate").value=trip.endDate; $("endDate").min=trip.startDate;
  if(document.activeElement!==$("startPlace")) $("startPlace").value=trip.start&&trip.start.lat!=null?trip.start.name:"";
  if(document.activeElement!==$("endPlace")) $("endPlace").value=trip.round||!trip.end?"":trip.end.name;
  $("sameStart").hidden=!!trip.round||!trip.end; $("clearStart").hidden=!trip.start||trip.start.lat==null;
}
$("startDate").addEventListener("change",e=>{const n=nDays();trip.startDate=e.target.value||tomorrow;if(trip.endDate<trip.startDate)trip.endDate=addDays(trip.startDate,n-1);changed();});
$("endDate").addEventListener("change",e=>{trip.endDate=e.target.value<trip.startDate?trip.startDate:e.target.value;changed();});
wireSearch($("startPlace"),$("startPlace").parentElement.nextElementSibling,p=>{trip.start=p;changed();});
wireSearch($("endPlace"),$("endPlace").parentElement.nextElementSibling,p=>{trip.end=p;trip.round=false;changed();});
$("endPlace").addEventListener("change",e=>{ if(!e.target.value.trim()&&!trip.round){trip.round=true;changed();} });
$("sameStart").addEventListener("click",()=>{trip.round=true;changed();});
let toastT;
function setFinish(p){
  const prev={round:trip.round,end:trip.end}; trip.end=p; trip.round=false; changed();
  const t=$("toast"); t.innerHTML=`Finish changed to ${esc(p.name)}. <button type="button" class="linkbtn">Undo</button>`; t.hidden=false;
  t.querySelector("button").onclick=()=>{trip.round=prev.round;trip.end=prev.end;t.hidden=true;changed();};
  clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,8000);
}
function useMyLocation(){
  if(!navigator.geolocation){$("status").textContent="This browser can't share your location. Type a town.";return;}
  $("status").textContent="Getting your location…";
  navigator.geolocation.getCurrentPosition(p=>{trip.start=pt("My location",+p.coords.latitude.toFixed(5),+p.coords.longitude.toFixed(5));changed();},
    ()=>{$("status").textContent="Location not shared. Type a start town instead.";},{enableHighAccuracy:true,timeout:15000});
}
$("useLoc").addEventListener("click",useMyLocation);
$("clearStart").addEventListener("click",()=>{trip.start=null;$("startPlace").value="";$("startPlace").focus();changed();});
if(trip.start&&trip.start.name==="My location"&&trip.start.lat==null){
  $("status").textContent="Tap ⌖ to start from your location, or type a town.";
  navigator.permissions?.query({name:"geolocation"}).then(r=>{if(r.state==="granted") useMyLocation();}).catch(()=>{});
}

/* ---------- day tabs ---------- */
function renderTabs(){
  if(nDays()===1&&ui.tab!=="ov") ui.tab="ov";
  const tabs=[`<button class="dtab ${ui.tab==="ov"?"on":""}" data-day="ov" role="tab"><b>Overview</b><span class="note">${nDays()} day${nDays()>1?"s":""}</span></button>`];
  if(nDays()>1) trip.days.forEach((d,k)=>{
    const f=plan&&plan.days[k]?dayRisk(k):null, to=dayTo(k);
    tabs.push(`<button class="dtab ${ui.tab===k?"on":""}" data-day="${k}" role="tab"><b>${esc(dayDate(k).toLocaleDateString(undefined,{weekday:"short"}))}${f&&f.level!=="ok"?`<span class="tdot" style="background:var(--${f.level==="bad"?"bad":"warn"})"></span>`:""}</b><span class="note">${esc(dayDate(k).toLocaleDateString(undefined,{day:"numeric",month:"short"}))}</span><span class="note">→ ${esc(to?to.name:"night stop?")}</span></button>`);
  });
  tabs.push(`<button class="dtab keybtn" type="button" data-key title="What the icons and colours mean">?</button>`);
  $("dayTabs").innerHTML=tabs.join("");
  requestAnimationFrame(()=>{ const c=$("dayTabs"), on=c.querySelector(".dtab.on"); if(on&&c.scrollWidth>c.clientWidth) c.scrollTo({left:on.offsetLeft-c.offsetLeft-(c.clientWidth-on.offsetWidth)/2}); });
}
$("dayTabs").addEventListener("click",e=>{if(e.target.closest("[data-key]")){$("keyDlg").showModal();return;} const b=e.target.closest("[data-day]"); if(!b) return; ui.tab=b.dataset.day==="ov"?"ov":+b.dataset.day; stopFocus=null; saveUi(); closePanel(true); renderAll(); if(window.innerWidth<=1000) $("details").scrollIntoView({behavior:"smooth",block:"start"});});

/* ---------- details ---------- */
const TB=document.querySelector(".tripbar");
function renderDetails(){ hidePeek(); $("tbHold").append(TB); $("details").innerHTML=ui.tab==="ov"?overviewHtml():dayHtml(ui.tab); const slot=$("details").querySelector(".tbslot"); if(slot) slot.replaceWith(TB); wireDetails(); }

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
  if(!hits.length) return {none:true,opens:addDays(date,-15),tz};
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
const FEEDBACK_EMAIL="";
function routeSketch(){
  const g=plan.geom; let s=90,w=180,n=-90,e=-180; g.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const kx=Math.cos(rad((s+n)/2)), W=680, H=Math.max(220,Math.min(520,W*(n-s)/Math.max(1e-6,(e-w)*kx))), pad=40;
  const sc=Math.min((W-2*pad)/Math.max(1e-6,(e-w)*kx),(H-2*pad)/Math.max(1e-6,n-s));
  const X=lon=>pad+(lon-w)*kx*sc, Y=lat=>pad+(n-lat)*sc;
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:110mm">`;
  plan.days.forEach((d,k)=>{ if(!d) return; const pts=seg(d.a,d.b).filter((p,i,a)=>i%3===0||i===a.length-1);
    svg+=`<polyline fill="none" stroke="${DAYCOL[k%DAYCOL.length]}" stroke-width="3" points="${pts.map(p=>X(p.lon).toFixed(1)+","+Y(p.lat).toFixed(1)).join(" ")}"/>`; });
  const labels=[trip.start,...trip.days.slice(0,-1).map(d=>d.to),endPt()].filter((p,i,a)=>p&&p.lat!=null&&a.indexOf(p)===i);
  labels.forEach(p=>{svg+=`<circle cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="5" fill="#fff" stroke="#18201C" stroke-width="2"/><text x="${(X(p.lon)+8).toFixed(1)}" y="${(Y(p.lat)+4).toFixed(1)}" font-size="12" font-weight="700" fill="#18201C">${esc(p.name)}</text>`;});
  return svg+`</svg>`;
}
function printHtml(){
  const n=nDays(), tot=plan.days.reduce((t,d)=>t+(d?d.km:0),0), ride=plan.days.reduce((t,d,k)=>t+(d?dayMinutes(k):0),0);
  const fin=trip.round?trip.start.name:endPt().name;
  const fuelTxt=f=>f?f.short:"—";
  const lnk=(t,name,town)=>{ t=t||{}; const w=t.website?(/^https?:/.test(t.website)?t.website:"https://"+t.website):`https://www.google.com/search?q=${encodeURIComponent(name+" "+(town||""))}`; return `${t.phone?esc(t.phone)+" · ":""}<a href="${esc(w)}">${t.website?"website":"find online"}</a>`; };
  let h=`<section class="pcover"><h1>${esc(trip.start.name)} → ${esc(fin)}</h1>
    <p class="pmeta">${esc(dayLong(0))}${n>1?` to ${esc(dayLong(n-1))}`:""} · ${n} day${n>1?"s":""} · ${Math.round(tot).toLocaleString()} km · about ${fmtDur(ride)} riding</p>
    <div class="psketch">${routeSketch()}</div>
    <table class="ptable"><thead><tr><th>Day</th><th>Route</th><th>km</th><th>Riding</th><th>Fuel</th><th>Sunset</th><th>Weather</th><th>Watch out</th></tr></thead><tbody>`;
  plan.days.forEach((d,k)=>{ if(!d) return;
    const to=d.pts[d.pts.length-1], vias=d.pts.slice(1,-1), w=dayWx(k), s=sunMin(k), r=dayRisk(k), f=rangeFuel(d.a,d.b);
    const notes=r?r.reasons.filter(x=>x.lvl!=="info"&&x.kind!=="fuel").map(x=>x.short):[];
    h+=`<tr class="${r&&r.level!=="ok"?r.level:""}"><td><b>${esc(dayName(k))}</b></td><td>${vias.length?`<b class="via">via</b> <b>${vias.map(v=>esc(v.name)).join(", ")}</b> → `:"→ "}<b>${esc(to.name)}</b>${k<n-1?" (night)":""}</td>
      <td class="num">${Math.round(d.km)}</td><td class="num">${fmtDur(dayMinutes(k))}</td><td class="${f&&f.level?f.level:""}">${esc(fuelTxt(f))}</td><td>${s!=null?fmtT(s):"?"}</td><td>${w&&!w.none?`${esc(WXW(w.code))} ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C`:"—"}</td><td>${esc(notes.join(", "))||"—"}</td></tr>`;
  });
  h+=`</tbody></table><p class="pnote">Fuel is shown where the map knows it. Suggested stops are towns with fuel about every ${esc(String(settings.range))} km. "Check" marks a stretch with no town with fuel on our map: small towns may still have fuel, so ask locally. Places and hospitals come from OpenStreetMap and can be wrong: phone ahead on remote legs. Emergency from a mobile: 112.</p></section>`;
  plan.days.forEach((d,k)=>{ if(!d) return;
    const from=d.pts[0], to=d.pts[d.pts.length-1], last=k===n-1, r=dayRisk(k), m=dayMed(k);
    const fills=fp?fp.fills.filter(f=>f.km>d.a+0.3&&f.km<=d.b+0.3):[];
    h+=`<section class="pday"><h2>${esc(dayLong(k))}</h2><p class="pmeta">${esc(from.name)} → ${d.pts.slice(1,-1).map(v=>`<b>${esc(v.name)}</b> → `).join("")}<b>${esc(to.name)}</b> · ${Math.round(d.km)} km · about ${fmtDur(dayMinutes(k))} riding${trip.days[k].style==="fast"?" · quickest way":""}</p>`;
    const warn=r?r.reasons:[]; if(warn.length) h+=`<ul class="pwarn">${warn.map(x=>`<li class="${x.lvl}">${esc(x.text)}</li>`).join("")}</ul>`;
    // stops with what's there
    h+=`<h3>Stops</h3><table class="ptable"><thead><tr><th>Stop</th><th>km</th><th>At the stop</th></tr></thead><tbody>`;
    d.pts.forEach((p,j)=>{ if(j===0) return; const av=stopAvail(p), here=AV.filter(a=>av[a[0]].length).map(a=>a[2]).join(", ");
      h+=`<tr><td><b>${esc(p.name)}</b>${p.auto?" (suggested for fuel)":""}${j===d.pts.length-1?(last?" (finish)":" (night stop)"):""}</td><td class="num">${Math.round(d.legs[j-1].b-d.a)}</td><td>${esc(here)||"Nothing known within 1 km"}</td></tr>`; });
    h+=`</tbody></table>`;
    // fuel
    const ds=fp&&fp.days&&fp.days[k];
    h+=`<h3>Fuel on the way</h3>`+(fills.length?`<ul>${fills.map(f=>{ const x=fuelAll.find(q=>hav(q,f)<0.3)||f, t=x.tags||{}, g=gradesTxt(t); return `<li>km ${Math.round(f.km-d.a)}: <b>${esc(f.name&&f.name!=="Fuel"?f.name:"Fuel station")}</b>${g?" · "+esc(g):""}${t.hours?" · "+esc(t.hours):""}${t.phone?" · "+esc(t.phone):""}</li>`; }).join("")}</ul>`:`<p>None known on the route.</p>`);
    // night
    if(!(last&&trip.round)){ const sf=stayFor(to), pl=sf?sf.places:[], chosen=pl.find(p=>hav(p,to)<0.2);
      h+=`<h3>${last?"Finish":"Night"}: ${esc(to.name)}</h3>`;
      if(chosen) h+=`<p><b>${esc(chosen.name)}</b> (${esc((chosen.tags.tourism||"").replace("_"," "))}) · ${lnk(chosen.tags,chosen.name,to.name)}</p>`;
      const alt=pl.filter(p=>p!==chosen).slice(0,3);
      if(alt.length) h+=`<p>${chosen?"Other options":"Places to stay"}:</p><ul>${alt.map(p=>`<li><b>${esc(p.name)}</b> (${esc((p.tags.tourism||"").replace("_"," "))}, ${p.dist.toFixed(1)} km) · ${lnk(p.tags,p.name,to.name)}</li>`).join("")}</ul>`;
      else if(!chosen) h+=`<p>No places to stay listed nearby.</p>`; }
    if(m){ const hs=m.near.slice().sort((a,b)=>(a.type==="hospital"?0:1)-(b.type==="hospital"?0:1)).slice(0,3);
      h+=`<h3>Medical</h3><p>${hs.length?hs.map(x=>`${esc(x.name||(x.type==="hospital"?"Hospital":"Clinic"))}${x.phone?" "+esc(x.phone):""}`).join(" · "):"None within 25 km of the route"}. Furthest point from a hospital: ${fmtFar(m.far)} km.</p>`; }
    h+=`</section>`;
  });
  h+=`<p class="pmeta pfoot">Route and Range · routeandrange.pages.dev · printed ${esc(new Date().toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"}))}</p>`;
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
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Route and Range feedback")}&body=${encodeURIComponent(body)}`;
}

/* ---------- story layout: one line per day, same block on Overview and day views ---------- */
const editOpen=new Set(), editTo=new Set(), fuelOpen=new Set(), showAll=new Set(); let tripEdit=false;
const curDay=()=>ui.tab==="ov"?(nDays()===1?0:null):ui.tab;
const viaOpen=new Set();
function toCell(k){
  const last=k===nDays()-1, d=trip.days[k], to=dayTo(k), id=(last?"finish-":"night-")+k, cur=last?(to?to.name:""):(d.to?d.to.name:"");
  if(editTo.has(k)||!cur) return searchBox(id,cur,last?"Pick where you finish":"Pick where you sleep");
  return `<button type="button" class="tolink" data-editto="${k}" title="Tap to change">${esc(cur)}</button>`;
}
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
  return `<div class="totals"><span>Back at <b>${esc(fin)}</b></span><span>${n} day${n>1?"s":""} · ${Math.round(tot).toLocaleString()} km · about ${fmtDur(ride)} riding</span></div>`;
}
function stayRows(k){
  const last=k===nDays()-1, to=dayTo(k); if(!to||(last&&trip.round)) return "";
  const sf=stayFor(to), all=sf?sf.places:[], key="stay-"+k, list=showAll.has(key)?all:all.slice(0,10);
  let h=`<section class="dsec"><h3>Where to stay in ${esc(to.name)} <span class="note">${placesOk?all.length:"…"}</span></h3>`;
  h+=list.length?`<div class="stable">${list.map(p=>`<div class="srow"><div><b>${esc(p.name)}</b><span class="note">${esc((p.tags.tourism||"").replace("_"," "))} · ${p.dist.toFixed(1)} km</span></div>
      <div class="sact">${linksHtml(p.tags,p.name,to.name)}${!last?`<button class="linkbtn" type="button" data-staynight="${k}:${esc(p.id)}">Stay here</button>`:""}</div></div>`).join("")}</div>`
    :`<div class="note">${placesOk?"Nothing listed within 15 km. Phone the town's info office or check booking sites.":"Loading…"}</div>`;
  if(all.length>10) h+=`<button class="linkbtn" type="button" data-more="${key}">${showAll.has(key)?"Show fewer":`Show all ${all.length}`}</button>`;
  return h+`</section>`;
}

/* ---------- what's at a stop: fuel, food, shop, toilets, cash, repair ---------- */
let amen=[];
const AV=[["fuel","⛽","Fuel"],["food","🍴","Food"],["shop","🛒","Shop"],["toilets","🚻","Toilets"],["cash","🏧","Cash (ATM)"],["repair","🔧","Tyres and repair"]];
function stopAvail(p){
  const near=(list)=>list.filter(x=>hav(x,p)<=1).map(x=>Object.assign(x,{dstop:hav(x,p)})).sort((a,b)=>a.dstop-b.dstop);
  const fuel=near(fuelAll), food=near(pois.filter(x=>x.kind==="food"));
  const by=k=>near(amen.filter(x=>x.kind===k));
  const toilets=[...by("toilets"),...fuel.filter(f=>/\bT\b/.test(f.tags?.extra||"")).map(f=>Object.assign({},f,{kind:"toilets",name:(f.name||"Fuel station")+" (at the fuel station)"}))];
  return {fuel,food,shop:by("shop"),toilets,cash:by("cash"),repair:by("repair")};
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
  return v.map((x,i)=>x.auto?`<i class="autoname" data-gostop="${k}:${i+1}">${esc(x.name)} ⛽${x.detour?` (+${x.detour} km)`:""}</i>`:`<b>${esc(x.name)}</b>`).join(", ");
}
function sumBox(k,big){
  const pd=!planStale&&plan&&plan.days[k], d=trip.days[k], r=pd?dayRisk(k):null, from=dayFrom(k);
  const msg=!trip.start||trip.start.lat==null?"Pick where you start":!from?"Pick the night stop before this day":!dayTo(k)?"Pick where you sleep":!dayPts(k)?"Add a stop or a finish":"Working out the route…";
  const chain=stopsChain(k), ds=fp&&fp.days&&fp.days[k];
  const warn=ds&&+settings.range>0?ds.probs.map(p=>`<div class="wmin">⚠ No town within reach: ${Math.round(p.to-p.from)} km, ${esc(p.fromName)} to ${esc(p.toName)}.</div>`).join(""):"";
  return `<div class="sumbox ${big?"big":""}">
    ${nDays()===1&&trip.round&&!trip.days[0].vias.length?`<div class="sumline"><span class="sdate">${esc(big?dayLong(k):dayName(k))}:</span> ${esc(from?from.name:"?")} <span class="arr">→</span> <span class="wherebox">${searchBox("whereto-0","","Where to?",true)}</span> <span class="arr">→</span> back home</div>`:`<div class="sumline"><span class="sdate">${esc(big?dayLong(k):dayName(k))}:</span> ${esc(from?from.name:"?")} <span class="arr">→</span> ${chain?chain+` <span class="arr">→</span> `:""}${toCell(k)}${dayPts(k)&&dayPts(k).slice(1).some((_,j)=>legFast(d,j))?` <span class="sty" title="Quick way on some or all of this day">${STYLE_ICON.fast}</span>`:""}</div>`}
    ${pd?`<div class="sicons"><span class="sl">${timePill(k,pd.km,dayMinutes(k),`data-focusday="${k}"`)+fuelBtn(k)}</span><span class="sr">${sunSpan(k)+wxLink(k)}<span class="flags">${flagIcons(r,k)}</span></span></div>${big?warn:""}${riskHtml(r,k)}${big?fuelList(k):""}`:`<div class="note">${msg}</div>`}
  </div>`;
}
function dayHead(k){ return sumBox(k,true)+`<h3 class="detailh">Stops</h3>`; }

/* ---------- fuel towns added for the rider (marked, removable, can be kept) ---------- */
let autoRounds=0;
const legFast=(d,j)=>{ const v=d.vias[j], f=v?v.fast:d.toFast; return f!=null?f:d.style==="fast"; };
function autoFuel(){
  if(!plan||!placesOk||!townList||!(+settings.range>0)) return false;
  let added=false;
  plan.days.forEach((d,k)=>{ if(!d) return; const td=trip.days[k], no=td.noAuto||[]; if(!td.sig) td.sig=daySig(k);
    const ok=t=>!no.includes(t.name)&&!td.vias.some(v=>!v.auto&&(v.name===t.name||hav(v,t)<1))&&!(dayTo(k)&&hav(dayTo(k),t)<1)&&!(dayFrom(k)&&hav(dayFrom(k),t)<1);
    const mk=t=>pt(t.name,t.lat,t.lon,{auto:true,fuelHere:!!t.fuel,detour:t.off>5?Math.round(t.off*2):0});
    if(td.fresh){ // this day's start or night stop changed: work its suggestions out again from scratch
      delete td.noMore;
      const want=daySuggest(k,true).sugg.filter(ok), have=td.vias.filter(v=>v.auto).map(v=>v.name).sort().join("|");
      if(want.map(t=>t.name).sort().join("|")!==have){ td.vias=td.vias.filter(v=>!v.auto); td.legs=[]; want.forEach(t=>insertVia(k,mk(t))); added=true; }
    } else if(!td.noMore) daySuggest(k).sugg.filter(t=>ok(t)&&!td.vias.some(v=>v.name===t.name||hav(v,t)<1)).forEach(t=>{ if(insertVia(k,mk(t))!==false) added=true; }); });
  if(!added||autoRounds>=2) trip.days.forEach(d=>delete d.fresh);
  return added;
}

/* ---------- day planner: stops as a list, tap a stop to see it on the map ---------- */
let stopFocus=null;
function placeRow(x,k,j,extraAct){
  const t=x.tags||{}, town=plan.days[k].pts[j]?.name||"";
  const nm=x.name&&x.name!=="Fuel"?x.name:({fuel:"Fuel station",food:"Food",shop:"Shop",toilets:"Toilets",cash:"ATM",repair:"Workshop"}[x.kind]||"Place");
  const dist=x.dstop!=null?`${x.dstop<0.1?"at the stop":x.dstop.toFixed(1)+" km from the stop"}`:(x.off!=null?(x.off<0.3?"on the route":`${x.off.toFixed(1)} km off the route`):"");
  const g=x.kind==="fuel"?gradesTxt(t):"";
  const hrs=["fuel","food","shop","cash","repair"].includes(x.kind)?hoursHtml(t,k,j):"";
  return `<div class="srow" data-ploc="${x.lat},${x.lon}"><div><b>${esc(nm)}</b><span class="note">${esc(dist)}${g?" · "+esc(g):""}</span>${hrs}</div><div class="sact">${linksHtml(t,x.name&&x.name!=="Fuel"?x.name:"",town)}${extraAct||""}</div></div>`;
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
  if(cat){ const a=AV.find(x=>x[0]===cat); return h+listBlock(a[2]+" at the stop",a[1],av[cat],`${cat}-${k}-${j}`,x=>placeRow(x,k,j))+`</div>`; }
  if(j>0){ const f=rangeFuel(pd.legs[j-1].a,pd.legs[j-1].b); if(f&&f.level) h+=`<div class="verdict ${f.level==="bad"?"v-bad":"v-warn"}">${esc(f.text)}</div>`; }
  const any=AV.some(a=>av[a[0]].length);
  h+=`<h4 class="sub">At the stop</h4>`;
  h+=any?AV.filter(a=>av[a[0]].length).map(a=>listBlock(a[2],a[1],av[a[0]],`${a[0]}-${k}-${j}`,x=>placeRow(x,k,j))).join(""):`<div class="note">Nothing known within 1 km. Small places are often missing from the map, so ask locally.</div>`;
  { const auto=fuelAll.some(f=>hav(f,p)<=1);
    h+=`<div class="sopts">${auto?`<span class="note">Fuel here, on our map.</span>`:`<label class="chk"><input type="checkbox" data-fuelpt="${k}:${j}" ${p.fuelHere||p.type==="fuel"?"checked":""}> Fuel here (not on our map)</label>`}
      ${isVia?`<label class="chk">Break <input type="number" min="0" max="600" step="5" value="${breakOf(p)}" data-breakmin="${k}:${j-1}" style="width:5em"> min</label>`:""}</div>`;
  }
  if(isTo&&!(last&&trip.round)) h+=stayRows(k).replace('<section class="dsec">','<section class="dsec in">');
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
  if(!pd) return h+`<div class="rname"><span class="lbl" style="white-space:nowrap">Add a stop</span>${searchBox("addvia-"+k,"","Town, pass or place on this day",true)}</div>`;
  h+=`<ol class="stops">`;
  pd.pts.forEach((p,j)=>{
    if(j===0) return;
    const isFrom=j===0, isTo=j===pd.pts.length-1, vi=j-1, L=j>0?pd.legs[j-1]:null, lg=j>0?(d.legs[j-1]||{}):{};
    const open=stopFocus&&stopFocus.k===k&&stopFocus.j===j, km=j>0?Math.round(pd.legs[j-1].b-pd.a):0;
    const lab=isFrom?"From":isTo?(last?"Finish":"Night stop"):`Stop ${j}`;
    const av=placesOk?stopAvail(p):null;
    const icons=av?AV.filter(a=>av[a[0]].length).map(a=>`<button type="button" class="avi ${open&&stopFocus.cat===a[0]?"on":""}" data-av="${k}:${j}:${a[0]}" title="${esc(a[2])}: ${av[a[0]].length}">${a[1]}</button>`).join(""):"";
    const fq=legFast(d,j-1), way=lg.track?"":`<span class="seg2 legway" role="group" aria-label="Way to this stop"><button type="button" data-legsty="${j-1}:0" class="${fq?"":"on"}" title="${esc(styleName())} to here">${STYLE_ICON.default}</button><button type="button" data-legsty="${j-1}:1" class="${fq?"on":""}" title="Get me here quickly">${STYLE_ICON.fast}</button></span>`;
    const tools=!isFrom&&!isTo?`<button class="icon" type="button" title="Move up" data-vup="${vi}">↑</button><button class="icon" type="button" title="Remove" data-vdel="${vi}">✕</button>`:"";
    const opts=L?`<details class="legopts"><summary class="icon" title="Options for the way in">⋯</summary><div class="legmenu">
        ${L.n>1&&!lg.track?`<label class="chk">Way <select data-alt="${j-1}">${L.alts.map((km2,x)=>`<option value="${x}" ${(lg.alt||0)===x?"selected":""}>Way ${x+1} · ${Math.round(km2)} km</option>`).join("")}</select></label>`:lg.track?"":lg.wantAlts?`<span class="note">No other ways found for this stretch.</span>`:`<button class="btn small ghost" type="button" data-wantalts="${j-1}">Find other ways</button>`}
        ${lg.track?`<span class="note">Own track: ${esc(lg.trackName||"GPX")}</span><button class="btn small ghost" type="button" data-untrack="${j-1}">Remove track</button>`
          :`<label class="btn small ghost" style="cursor:pointer;align-self:flex-start">Use my GPX for this stretch<input type="file" accept=".gpx,application/gpx+xml" data-track="${j-1}" hidden></label>`}
      </div></details>`:"";
    const autoTag=p.auto?`<span class="autotag">Suggested ⛽${p.detour?` · +${p.detour} km`:""}</span>`:"";
    h+=`<li class="stop ${open?"open":""} ${p.auto?"auto":""}"><div class="shead"><button type="button" class="sname" data-stop="${k}:${j}"><span class="rlab">${lab}</span><b>${esc(p.name)}</b><span class="note">${isFrom?"":`km ${km}`}</span></button>${autoTag}
      <span class="avail">${icons}</span><span class="stools">${way}${tools}${opts}</span></div>${open&&plan?stopDetail(k,j,stopFocus.cat):""}</li>`;
  });
  h+=`</ol><div class="rname"><span class="lbl" style="white-space:nowrap">Add a stop</span>${searchBox("addvia-"+k,"","Town, pass or place on this day",true)}</div>`;
  return h;
}
function dayBody(k){
  const pd=!planStale&&plan&&plan.days[k];
  let h=stopList(k);
  if(!pd) return h;
  if(!placesOk) h+=`<div class="verdict v-warn">Fuel stations didn't load, so long stretches without fuel can't be checked. Check your connection and reload.</div>`;
  const m=dayMed(k);
  if(m) h+=`<details class="medbox"><summary><span class="lbl">Medical</span> ${m.near.length} hospital${m.near.length===1?"":"s"} and clinics near the route · furthest point ${fmtFar(m.far)} km from a hospital</summary>
    ${m.near.map(x=>`<div class="item"><div class="meta"><b>${esc(x.name||(x.type==="hospital"?"Hospital":"Clinic"))}</b><span class="note">${x.type==="hospital"?"Hospital":"Clinic"} · km ${Math.round(x.km-pd.a)} · ${x.off<0.5?"on the route":x.off.toFixed(1)+" km off"}${x.phone?` · <a href="tel:${esc(x.phone.replace(/[^\d+]/g,""))}">${esc(x.phone)}</a>`:""}</span></div></div>`).join("")||`<div class="note">None listed within 25 km of the route.</div>`}
    <div class="note">Emergency from a mobile: 112. Check the local numbers before you go.</div></details>`;
  h+=`<div class="btns"><button class="btn small" type="button" data-gpx="${k}">GPX file</button>${nDays()===1?`<button class="btn small ghost" type="button" data-print>Save as PDF</button>`:""}<span class="note">Download, then share it to your bike's app.</span></div>`;
  return h;
}
function drawStopLayer(){
  const {k,j,cat}=stopFocus, sc=scope(k,j); if(!sc) return false;
  const s=sc.jj>0&&!cat?seg(sc.a,sc.b):[];
  if(s.length>1) L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer);
  L.marker([sc.p.lat,sc.p.lon],{icon:dotIcon("#18201C",16)}).bindTooltip(sc.p.name,{permanent:true,direction:"right",offset:[10,0],className:"maplbl"}).addTo(layer);
  const av=stopAvail(sc.p), col={fuel:"#0B6E4F",food:"#B3261E",shop:"#6B4E9B",toilets:"#00838F",cash:"#2F5BA8",repair:"#5D4037"};
  const shown=[]; AV.forEach(([c,ic])=>{ if(cat&&c!==cat) return; av[c].forEach(p=>{ shown.push(p); L.marker([p.lat,p.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:${col[c]}">${ic}</div>`,iconSize:[22,22],iconAnchor:[11,11]})}).bindTooltip(p.name||AV.find(a=>a[0]===c)[2],cat?{permanent:true,direction:"right",offset:[12,0],className:"maplbl"}:{}).addTo(layer); }); });
  const pts=[...s,...shown,sc.p].map(p=>[p.lat,p.lon]);
  if(pts.length<2) map.setView([sc.p.lat,sc.p.lon],cat?15:12); else map.fitBounds(L.latLngBounds(pts),{padding:[30,30],maxZoom:cat?16:13});
  return true;
}
function clearLink(){ return `<div class="btns clearrow">${clearArm?`<span class="note">Clear this trip?</span><button class="btn small" type="button" data-newtrip>Clear</button><button class="btn small ghost" type="button" data-nocancel>Cancel</button>`:`<button class="linkbtn small" type="button" data-newtrip>Clear trip</button>`}</div>`; }
function overviewHtml(){
  let h=`<div class="tbslot"></div>`;
  if(nDays()===1) return h+sumBox(0,false)+dayBody(0)+clearLink()+footNote();
  h+=`<div class="days">`;
  trip.days.forEach((d,k)=>{ h+=`<div class="ovday" data-gotoday="${k}">${sumBox(k,false)}</div>`; });
  h+=`</div>`;
  h+=tripTotals();
  if(plan&&!planStale) h+=`<div><span class="lbl">Ride files</span><div class="btns" style="margin-top:6px">${plan.days.map((d,k)=>d?`<button class="btn small" type="button" data-gpx="${k}">${esc(dayName(k))} GPX</button>`:"").join("")}<button class="btn small ghost" type="button" data-print>Save as PDF</button></div></div>`;
  return h+clearLink()+footNote();
}
function footNote(){ return placesOk&&dataDate?`<div class="note">Map data from OpenStreetMap, as of ${esc(dataDate)}. Weather from Open-Meteo. Phone ahead on remote legs.</div>`:""; }
function dayHtml(k){ return dayHead(k)+dayBody(k); }
function wireDetails(){
  trip.days.forEach((d,k)=>hook("night-"+k,p=>{editTo.delete(k);trip.days[k].to=p;changed();}));
  hook("whereto-0",p=>{ trip.days[0].vias.push(p); trip.days[0].legs=[]; changed(); });
  hook("finish-"+(nDays()-1),p=>{editTo.delete(nDays()-1);setFinish(p);});
  editTo.forEach(k=>{ const el=document.getElementById((k===nDays()-1?"finish-":"night-")+k); if(el&&document.activeElement!==el){ el.focus(); el.select(); el.addEventListener("blur",()=>setTimeout(()=>{ if(editTo.has(k)&&el.value.trim()===el.defaultValue.trim()){ editTo.delete(k); renderDetails(); } },400)); } });
  { const k=curDay(); if(k==null) return; const d=trip.days[k];
    d.vias.forEach((v,i)=>hook(`via-${k}-${i}`,p=>{d.vias[i]=Object.assign(p,{type:v.type||"pass"});d.legs=[];changed();}));
    hook("addvia-"+k,p=>{if(insertVia(k,p)!==false) changed(); else renderDetails();});
  }
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
  if(t.closest("[data-newtrip]")){ clearArm=false; snapTrip(true); const prev=JSON.parse(JSON.stringify(trip)); Object.assign(trip,freshTrip()); tripEdit=true; ui.tab="ov"; plan=null; fp=null; changed();
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
    if(m[1]==="night"){trip.days[+m[2]].to=null;editTo.add(+m[2]);} else if(m[1]==="finish"){trip.round=true;} else {trip.days[+m[2]].vias.splice(+m[3],1);trip.days[+m[2]].legs=[];}
    changed(); return; }
  const fk=t.closest("[data-fuelk]"); if(fk){const k2=+fk.dataset.fuelk; if(ui.tab==="ov"){ fuelOpen.add(k2); const tb=document.querySelector(`[data-day="${k2}"]`); if(tb){ tb.click(); return; } } fuelOpen.has(k2)?fuelOpen.delete(k2):fuelOpen.add(k2); renderDetails(); return;}
  const af=t.closest("[data-addfill]"); if(af){const f=fp.fills.find(x=>x.id===af.dataset.addfill); if(f){insertVia(+af.dataset.day,pt(f.name&&f.name!=="Fuel"?f.name:"Fuel stop",f.lat,f.lon,{fuelHere:true}));changed();} return;}
  const er=t.closest("[data-editroute]"); if(er){const k2=+er.dataset.editroute; editOpen.has(k2)?editOpen.delete(k2):editOpen.add(k2); renderDetails(); return;}
  const mo=t.closest("[data-more]"); if(mo){const key=mo.dataset.more; showAll.has(key)?showAll.delete(key):showAll.add(key); renderDetails(); return;}
  const sn=t.closest("[data-staynight]"); if(sn){const [k2,id]=sn.dataset.staynight.split(":"); const to=dayTo(+k2), x=(stayFor(to)?.places||[]).find(q=>q.id===id); if(x){trip.days[+k2].to=pt(x.name,x.lat,x.lon,{stay:true});$("status").textContent=`Night stop: ${x.name}.`;changed();} return;}
  const ap=t.closest("[data-addpoi]"); if(ap){const [k2,id]=ap.dataset.addpoi.split(":"); const x=pois.find(q=>q.id===id); if(x){insertVia(+k2,pt(x.name,x.lat,x.lon,{}));$("status").textContent=`Added ${x.name}.`;changed();} return;}
  const go=t.closest("[data-gotoday]"); if(go&&!t.closest("button,input,a")){ui.tab=+go.dataset.gotoday;saveUi();renderAll();return;}
  const pn=t.closest("[data-panel]"); if(pn){hidePeek();const [dk,j,tab]=pn.dataset.panel.split(":");openPanel(+dk,j==="last"?"last":+j,tab);return;}
  const rb=t.closest("[data-risk]"); if(rb){const k2=+rb.dataset.risk; riskOpen.has(k2)?riskOpen.delete(k2):riskOpen.add(k2); renderDetails(); return;}
  if(t.closest("[data-print]")){printTrip();return;}
  const g=t.closest("[data-gpx]"); if(g){downloadGpx(+g.dataset.gpx);return;}
  const ls=t.closest("[data-legsty]"); if(ls&&k!=null){ const [j2,f2]=ls.dataset.legsty.split(":"); const d2=trip.days[k], v2=d2.vias[+j2]; if(v2) v2.fast=f2==="1"; else d2.toFast=f2==="1"; d2.legs[+j2]={wantAlts:(d2.legs[+j2]||{}).wantAlts}; changed(); return; }
  const fl=t.closest("[data-focusleg]"); if(fl&&plan&&k!=null){const L=plan.days[k].legs[+fl.dataset.focusleg-1]; focusRange(L.a,L.b); return;}
  const fd=t.closest("[data-focusday]"); if(fd&&plan){const pd=plan.days[+fd.dataset.focusday]; focusRange(pd.a,pd.b); return;}
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
function stayFor(p){ return stays.find(x=>x.night===p); }
function scope(k,j){
  const pd=plan&&plan.days[k]; if(!pd) return null; const jj=j==="last"?pd.pts.length-1:j, p=pd.pts[jj]; if(!p) return null;
  const b=jj>0?pd.legs[jj-1].b:pd.a, a=jj>0?pd.legs[jj-1].a:pd.a; return {a,b,p,jj};
}
function panelItems(k,j,tab){
  const sc=scope(k,j); if(!sc||sc.b==null) return [];
  const {a,b,p}=sc, inLeg=x=>x.km!=null&&x.km>=a-0.5&&x.km<=b+0.5, near=x=>hav(x,p)<=5;
  if(tab==="fuel") return fuelAll.filter(f=>inLeg(f)||near(f)).filter((f,i,arr)=>arr.findIndex(x=>x.id===f.id)===i).sort((x,y)=>x.km-y.km);
  if(tab==="stay") return stayFor(p)?.places||[];
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
  if(sy){const x=(stayFor(sc.p)?.places||[]).find(q=>q.id===sy.dataset.pstay); if(!x) return; d.to=pt(x.name,x.lat,x.lon); closePanel(true); $("status").textContent=`${dayDate(k).toLocaleDateString(undefined,{weekday:"long"})} night: ${x.name}.`; changed();}
  if(ad){const x=pois.find(q=>q.id===ad.dataset.padd); if(!x) return; if(!addStop(k,at,pt(x.name,x.lat,x.lon,{}))) return; closePanel(true); $("status").textContent=`Added ${x.name}.`; changed();}
});
const canHover=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
function hidePeek(){ $("peek").hidden=true; }
window.addEventListener("scroll",hidePeek,{passive:true});

/* ---------- map ---------- */
let map,layer,focusR=null,lastSel=null;
function focusRange(a,b){focusR={a:Math.min(a,b),b:Math.max(a,b)}; drawMap(); if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"});}
const dotIcon=(c,sz,sq)=>L.divIcon({className:"",html:`<div style="width:${sz}px;height:${sz}px;background:${c};border:2px solid #18201C;border-radius:${sq?"2px":"50%"}"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
let lblLayer=null;
function townLabels(){ if(!map||!lblLayer||!townList) return; lblLayer.clearLayers(); const z=map.getZoom(), bb=map.getBounds().pad(-0.03);
  const want=z<7?["city"]:["city","town"]; const list=townList.filter(t=>want.includes(t.place)&&bb.contains([t.lat,t.lon])).sort((a,b)=>(a.place==="city"?0:1)-(b.place==="city"?0:1)).slice(0,z<9?25:45);
  const own=plan?townPoints():[];
  const used=own.map(p=>map.latLngToContainerPoint([p.lat,p.lon])); list.forEach(t=>{ const pnt=map.latLngToContainerPoint([t.lat,t.lon]); if(used.some(u=>Math.abs(u.x-pnt.x)<90&&Math.abs(u.y-pnt.y)<22)) return; used.push(pnt);
    L.marker([t.lat,t.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:"townlbl"+(t.place==="city"?" city":""),html:`<span>${esc(t.name)}</span>`,iconSize:[0,0]})}).addTo(lblLayer); }); }
function ensureMap(){ if(!map){map=L.map("map",{scrollWheelZoom:true});L.tileLayer(TILES.url,{maxZoom:TILES.maxZoom,attribution:TILES.attribution}).addTo(map);map.setView([-31,20],5); lblLayer=L.layerGroup().addTo(map); map.on("moveend",townLabels); if(window.ResizeObserver) new ResizeObserver(()=>map.invalidateSize()).observe($("map"));} map.invalidateSize(); if(layer) layer.remove(); layer=L.layerGroup().addTo(map); }
const seg=(a,b)=>plan.geom.filter((g,i)=>plan.cum[i]>=a-0.01&&plan.cum[i]<=b+0.01);
function drawMap(){
  if(!window.L) return; ensureMap(); if(!plan) return; townLabels();
  const sel=ui.tab==="ov"?null:plan.days[ui.tab];
  plan.days.forEach((d,k)=>{ if(!d) return; const on=!sel||k===ui.tab; L.polyline(seg(d.a,d.b).map(g=>[g.lat,g.lon]),{color:on?DAYCOL[k%DAYCOL.length]:"#5C6660",weight:on?5:3,opacity:on?.9:.3}).addTo(layer); });
  if(panel){ drawPanelLayer(); return; }
  if(stopFocus&&sel&&stopFocus.k===ui.tab&&drawStopLayer()) return;
  if(focusR){ const s=seg(focusR.a,focusR.b); if(s.length>1){L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer); map.fitBounds(L.latLngBounds(s.map(g=>[g.lat,g.lon])),{padding:[30,30]});} }
  const range=sel?[sel.a,sel.b]:[0,plan.total], inR=x=>x.km!=null&&x.km>=range[0]-1&&x.km<=range[1]+1;
  townPoints().forEach(p=>{ const km=plan.ptKm.get(p); if(sel&&!(km!=null&&km>=sel.a-0.5&&km<=sel.b+0.5)) return;
    const night=trip.days.some((d,k)=>d.to===p&&k<nDays()-1);
    const key=sel?true:(p===trip.start||night||p===endPt());
    const m=L.marker([p.lat,p.lon],{icon:p.auto?L.divIcon({className:"",html:`<div class="mapemo dashed">⛽</div>`,iconSize:[22,22],iconAnchor:[11,11]}):dotIcon(night?"#2F5BA8":stopFuel(p)?"#0B6E4F":"#18201C",night||key?16:12,stopFuel(p))}).bindTooltip(p.auto?"Suggested: "+p.name:p.name,key?{permanent:true,direction:"right",offset:[10,0],className:"maplbl"}:{}).addTo(layer);
    m.on("click",()=>{ const k=trip.days.findIndex((d,i)=>plan.days[i]&&plan.days[i].pts.includes(p)&&(sel?i===ui.tab:true)); if(k<0) return; const j=plan.days[k].pts.indexOf(p); ui.tab=k; stopFocus={k,j}; saveUi(); renderAll(); });
  });
  if(fp&&ui.lay.fuel){
    fuelStations.filter(f=>inR(f)&&f.off<=2).forEach(f=>L.marker([f.lat,f.lon],{icon:dotIcon("#0B6E4F",10,true)}).bindTooltip("Fuel: "+f.name).addTo(layer));
    const stopsHere=townPoints(), gapsOn=(fp.days||[]).flatMap(d=>d?d.probs:[]);
    const ftowns=stopTowns().filter(t=>t.fuel&&t.off>2&&inR(t)&&!stopsHere.some(p=>hav(p,t)<3)&&gapsOn.some(g=>t.km>=g.from-5&&t.km<=g.to+5)), lbl=sel&&ftowns.length<=8;
    if(sel||plan.days.filter(Boolean).length===1) ftowns.forEach(t=>{ const k=plan.days.findIndex(d=>d&&t.km>=d.a-1&&t.km<=d.b+1); if(k<0) return;
      L.marker([t.lat,t.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:#0B6E4F">⛽</div>`,iconSize:[22,22],iconAnchor:[11,11]})})
        .bindTooltip(t.name,lbl?{permanent:true,direction:"right",offset:[12,0],className:"maplbl"}:{})
        .bindPopup(`<b>${esc(t.name)}</b><br>${Math.round(t.off)} km off the route${t.food?" · food":""}<br><button class="btn small" type="button" data-addtown="${k}|${esc(t.name)}|${t.lat}|${t.lon}">Add as a stop</button>`).addTo(layer); });
  }
  if(ui.lay.med&&meds) meds.filter(m=>m.off<=25&&inR(m)).forEach(m=>L.marker([m.lat,m.lon],{icon:L.divIcon({className:"",html:`<div class="mapemo" style="border-color:#B3261E">🏥</div>`,iconSize:[22,22],iconAnchor:[11,11]})}).bindTooltip(`${m.name||(m.type==="hospital"?"Hospital":"Clinic")}${m.phone?" · "+m.phone:""}`).addTo(layer));
  pois.filter(p=>ui.types[p.kind]&&inR(p)).sort((a,b)=>a.off-b.off).slice(0,+ui.max).forEach(p=>{const t=TYPES.find(x=>x.id===p.kind); L.marker([p.lat,p.lon],{icon:dotIcon(t.c,10)}).bindTooltip(`${p.name} · ${t.n}`).addTo(layer);});
  if(ui.lay.stay) stays.forEach(s=>{ if(!trip.days.some((d,k)=>d.to===s.night&&k<nDays()-1)) return; s.places.forEach(p=>L.marker([p.lat,p.lon],{icon:dotIcon("#2F5BA8",9)}).bindTooltip(p.name).addTo(layer)); });
  if(!focusR){ const g=sel?seg(sel.a,sel.b):plan.geom; if(g.length>1&&(window._refit||sel||lastSel!==ui.tab)){map.fitBounds(L.latLngBounds(g.map(x=>[x.lat,x.lon])),{padding:[24,24]});} window._refit=false; lastSel=ui.tab; }
}
function drawPanelLayer(){
  const {k,j,tab}=panel, sc=scope(k,j); if(!sc) return;
  const s=sc.jj>0?seg(sc.a,sc.b):[];
  if(s.length>1) L.polyline(s.map(g=>[g.lat,g.lon]),{color:"#B26A00",weight:7}).addTo(layer);
  L.marker([sc.p.lat,sc.p.lon],{icon:dotIcon("#18201C",16)}).bindTooltip(sc.p.name).addTo(layer);
  const col={fuel:"#0B6E4F",stay:"#2F5BA8",food:"#B3261E",sight:"#9A6A33"}[tab], items=panelItems(k,j,tab);
  items.forEach(p=>L.marker([p.lat,p.lon],{icon:dotIcon(tab==="sight"?(TYPES.find(t=>t.id===p.kind)?.c||col):col,11,tab==="fuel")}).bindTooltip(p.name||"Fuel").addTo(layer));
  const pts=[...s,...items,sc.p].map(p=>[p.lat,p.lon]);
  if(tab==="stay"||sc.jj===0) map.setView([sc.p.lat,sc.p.lon],12); else if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[30,30]});
}

/* ---------- icon bar: what to show on the map ---------- */
const LAY=[["fuel","⛽","Fuel","Fuel stations on the route"],["stay","🛏","Stay","Places to stay at night stops"],["food","🍴","Food","Places to eat"],["sights","★","Sights","Sights, viewpoints and passes"],["med","🏥","Medical","Hospitals and clinics"],["road","🛣","Road type","Tar to single track, coming next"]];
ui.lay=Object.assign({fuel:true,stay:!!ui.sleep,food:!!ui.types.food,sights:true,med:false},ui.lay||{});
function renderLayers(){
  $("iconbar").innerHTML=`<span class="iblbl">On the map</span>`+LAY.map(([id,ic,w,t])=>`<button type="button" class="ib ${ui.lay[id]?"on":""}" data-lay="${id}" title="${esc(t)}" aria-pressed="${!!ui.lay[id]}" ${id==="road"?"disabled":""}><span class="e">${ic}</span>${w}${id==="sights"&&ui.lay.sights?`<select data-max aria-label="How many sights">${[["10","10"],["25","25"],["50","50"],["1000","All"]].map(([v,l])=>`<option value="${v}" ${ui.max===v?"selected":""}>${l}</option>`).join("")}</select>`:""}</button>`).join("");
}
$("iconbar").addEventListener("click",e=>{ if(e.target.closest("select")) return; const b=e.target.closest("[data-lay]"); if(!b||b.disabled) return; const id=b.dataset.lay; ui.lay[id]=!ui.lay[id];
  if(id==="food") ui.types.food=ui.lay.food; if(id==="sights") ["view","pass","sight"].forEach(t=>ui.types[t]=ui.lay.sights); if(id==="stay"){ ui.sleep=ui.lay.stay; ui.types.camp=ui.lay.stay; }
  saveUi(); renderLayers(); renderAll(); });
$("iconbar").addEventListener("change",e=>{ if(e.target.dataset.max!==undefined){ ui.max=e.target.value; saveUi(); renderAll(); } });
document.addEventListener("click",e=>{ const b=e.target.closest("[data-addtown]"); if(!b) return; const [k,name,la,lo]=b.dataset.addtown.split("|"); if(insertVia(+k,pt(name,+la,+lo,{fuelHere:true}))!==false){ map.closePopup(); $("status").textContent=`Added ${name}.`; changed(); } });
document.addEventListener("click",e=>{ document.querySelectorAll(".legopts[open]").forEach(x=>{if(!x.contains(e.target)) x.open=false;});});

/* ---------- GPX ---------- */
function downloadGpx(k){
  const pd=plan.days[k]; if(!pd) return; const from=pd.pts[0], to=pd.pts[pd.pts.length-1];
  const name=`${dayName(k)} ${from.name} to ${to.name}`, g=seg(pd.a,pd.b);
  const w=[...pd.pts.slice(1).map(p=>({lat:p.lat,lon:p.lon,n:p.name})),...(fp?fp.fills.filter(f=>f.km>pd.a&&f.km<=pd.b).map(f=>({lat:f.lat,lon:f.lon,n:"Fuel "+f.name})):[])];
  const text=`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Route and Range" xmlns="http://www.topografix.com/GPX/1/1">
${w.map(p=>`  <wpt lat="${p.lat.toFixed(5)}" lon="${p.lon.toFixed(5)}"><name>${esc(p.n)}</name></wpt>`).join("\n")}
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${simplify(g,20).map(x=>`      <trkpt lat="${x.lat.toFixed(5)}" lon="${x.lon.toFixed(5)}"/>`).join("\n")}
    </trkseg>
  </trk>
</gpx>
`;
  const file=name.replace(/[^\w]+/g,"-").replace(/-+$/,"")+".gpx";
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:"application/gpx+xml"})); a.download=file; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
  $("status").textContent=`Saved ${file}. Open it from your downloads and share it to your bike's app.`;
}

/* ---------- settings + glue ---------- */
SET_FIELDS.forEach(id=>$(id).value=settings[id]);
$("openSettings").addEventListener("click",()=>{ renderHist(); $("settings").showModal(); });
$("settings").addEventListener("close",()=>{
  const reroute=+$("corridor").value!==+settings.corridor||$("style").value!==settings.style;
  SET_FIELDS.forEach(id=>settings[id]=$(id).value); store.set("rr2-settings",settings);
  showStyle(); reroute?recalc():renderAll();
});
const STYLE_TEXT={rough:"<b>Road less travelled:</b> gravel and back roads first. For the quick way, pick the motorway sign on that day.",mixed:"<b>Mixed:</b> gravel where it saves time, tar where it doesn't.",tar:"<b>Tar:</b> main roads and highways."};
function showStyle(){ $("styleBanner").innerHTML=STYLE_TEXT[settings.style]||STYLE_TEXT.rough; }
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
const daySig=k=>[dayFrom(k),dayTo(k)].map(p=>p&&p.lat!=null?p.lat.toFixed(3)+","+p.lon.toFixed(3):"-").join("|");
function changed(){ window._refit=true; focusR=null; stopFocus=null; autoRounds=0;
  syncDays(); trip.days.forEach((d,k)=>{ const s=daySig(k); if(d.sig&&d.sig!==s){ d.fresh=true; delete d.noMore; const n=d.vias.length; d.vias=d.vias.filter(v=>!v.auto); if(d.vias.length!==n) d.legs=[]; } d.sig=s; });
  snapTrip(); recalc(); }
$("keyDlg").innerHTML=$("keyDlg").innerHTML.replace("STYLE_FAST",STYLE_ICON.fast).replace("STYLE_ROUGH",STYLE_ICON.default).replaceAll("FUEL",ICON.fuel);
{const fb=$("feedback"); const set=()=>{const l=feedbackLink(); fb.hidden=!l; if(l) fb.href=l;}; set(); fb.addEventListener("click",set);}
snapTrip(true);
renderLayers(); showStyle(); syncDays(); renderAll(); recalc();
