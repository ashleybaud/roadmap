/* ---------- Race trip: pick your dates and where, tick the races, get the whole trip ----------
   Each race gets the night before it starts through the night of race day at the venue. The days in between are
   for getting there (night stops picked by the planner where it can). If there aren't enough days to drive a
   stretch, it says so before you build, and the Fly part of it card covers the long hops. */
const EVT_REG=[
  ["za","Southern Africa",["South Africa","Namibia","Botswana","Lesotho","Zimbabwe","Mozambique","Eswatini","Kenya"]],
  ["eu","Europe and the UK",["United Kingdom","UK","Isle of Man","Ireland","France","Germany","Italy","Spain","Portugal","Belgium","Netherlands","Austria","Switzerland","Czechia","Hungary","Monaco","San Marino","Finland","Sweden","Norway","Poland","Greece","Croatia","Latvia","Estonia","Slovakia","Denmark","Turkiye","Morocco"]],
  ["us","USA, Canada and Mexico",["United States","USA","Canada","Mexico"]],
  ["sa","South America",["Brazil","Argentina","Chile","Paraguay","Uruguay","Colombia"]],
  ["me","Middle East",["Qatar","Bahrain","Saudi Arabia","United Arab Emirates","Azerbaijan"]],
  ["as","Asia and Australia",["Japan","China","Macau","Singapore","Malaysia","Thailand","Indonesia","India","Australia","New Zealand","Korea"]]];
const evtRegion=c=>{ for(const [k,,L] of EVT_REG) if(L.includes(c)) return k; return "as"; };
const evt={reg:new Set(),sel:new Set()};
const fmtD=d=>new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const dDiff=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);
const evtKmDay=()=>Math.max(250,Math.round((+settings.maxHours||8)*(settings.vehicle==="bike"?65:75)));

function openEvTrip(){
  try{ if($("welcome").open) $("welcome").close(); }catch(e){}
  if(!$("evtFrom").value){ $("evtFrom").value=addDays(ymd(new Date()),7); $("evtTo").value=addDays(ymd(new Date()),37); }
  if(!evt.reg.size){ let r=null; try{ r=JSON.parse(localStorage.getItem("otm-evtreg")||"null"); }catch(e){}
    (r&&r.length?r:[trip.start&&trip.start.lat!=null&&trip.start.lat<-15&&trip.start.lon>10&&trip.start.lon<40?"za":"eu"]).forEach(x=>evt.reg.add(x)); }
  $("evtReg").innerHTML=EVT_REG.map(([k,n])=>`<button type="button" class="chip${evt.reg.has(k)?" on":""}" data-evtreg="${k}" aria-pressed="${evt.reg.has(k)}">${esc(n)}</button>`).join("");
  $("evtStart").textContent=trip.start&&trip.start.lat!=null?trip.start.name:"where you are now";
  $("evtDlg").showModal(); loadEvents().then(renderEvTrip);
}
function evtList(){
  const a=$("evtFrom").value, b=$("evtTo").value; if(!a||!b||b<a||!evList) return [];
  const my=mySeries();
  return evList.filter(e=>e.end>=a&&e.start<=b&&evt.reg.has(evtRegion(e.country))).sort((x,y)=>x.start.localeCompare(y.start)||(my.includes(y.series)-my.includes(x.series)));
}
// the plan in words: where you sleep each night, and any stretch that can't be driven in time
function evtPlan(){
  const a=$("evtFrom").value, b=$("evtTo").value, chosen=(evList||[]).filter(e=>evt.sel.has(e.id)).sort((x,y)=>x.start.localeCompare(y.start));
  const S=trip.start&&trip.start.lat!=null?trip.start:null, warn=[], legs=[];
  let at=S, free=a, prev=null;
  for(const e of chosen){
    const arrive=e.start>a?addDays(e.start,-1):a, days=dDiff(free,arrive)+ (prev?0:1), km=at?hav(at,e)*1.25:0, need=Math.ceil(km/evtKmDay());
    if(e.start<free&&prev) warn.push(`${e.name} is on at the same time as ${prev.name}. The trip stays at ${prev.name}: untick one of them.`);
    else if(at&&km>evtKmDay()*0.4&&need>Math.max(0,days)) warn.push(`${at===S?"From "+(S.name==="My location"?"home":S.name):"From "+prev.name} to ${e.name} is about ${Math.round(km/50)*50} km: ${need} day${need>1?"s":""} of driving, and you have ${Math.max(0,days)}. Fly that part, or drop one.`);
    legs.push({e,arrive,leave:addDays(e.end,1),km});
    at=e; free=addDays(e.end,1); prev=e;
  }
  if(S&&prev&&$("evtHome").checked){ const km=hav(prev,S)*1.25, days=dDiff(free,b)+1, need=Math.ceil(km/evtKmDay()); if(km>evtKmDay()*0.4&&need>days) warn.push(`Home from ${prev.name} is about ${Math.round(km/50)*50} km: ${need} day${need>1?"s":""} of driving, and you have ${Math.max(0,days)}. Fly home, or add days.`); }
  if(chosen.length&&chosen[chosen.length-1].end>b) warn.push(`${chosen[chosen.length-1].name} ends after your last day. Move your last day to ${fmtD(chosen[chosen.length-1].end)} or later.`);
  return {chosen,warn,legs};
}
function renderEvTrip(){
  const L=evtList(), ids=new Set(L.map(e=>e.id)); [...evt.sel].forEach(id=>{ if(!ids.has(id)) evt.sel.delete(id); });
  const my=mySeries();
  const wk=d=>{ const x=new Date(d+"T12:00:00"); x.setDate(x.getDate()-((x.getDay()+6)%7)); return ymd(x); };
  let h="", cur="";
  if(!evList) h=`<p class="note">Loading the calendar…</p>`;
  else if(!$("evtFrom").value||!$("evtTo").value||$("evtTo").value<$("evtFrom").value) h=`<p class="note">Set your first and last day.</p>`;
  else if(!L.length) h=`<p class="note">Nothing on in those places on those dates. Try more places or wider dates.</p>`;
  else L.forEach(e=>{ const w=wk(e.start); if(w!==cur){ cur=w; h+=`<div class="evtwk">Week of ${fmtD(w)}</div>`; }
    h+=`<label class="evtrow${evt.sel.has(e.id)?" on":""}"><input type="checkbox" data-evtsel="${esc(e.id)}"${evt.sel.has(e.id)?" checked":""}><span><b>${esc(e.name)}</b>${my.includes(e.series)?' <span class="evtmy" title="In My racing">★</span>':""}<br><span class="note">${fmtD(e.start)}${e.end!==e.start?" – "+fmtD(e.end):""}${e.confirmed?"":" (dates to confirm)"} · ${esc(e.venue||e.city||"")}, ${esc(e.country||"")}</span></span><a class="note" href="/events/${esc(e.id)}/" target="_blank" rel="noopener">More ›</a></label>`; });
  $("evtList").innerHTML=h;
  const P=evtPlan(), n=P.chosen.length;
  $("evtWarn").innerHTML=P.warn.map(w=>`<p class="evtw">⚠ ${esc(w)}</p>`).join("");
  $("evtGo").disabled=!n; $("evtGo").textContent=n?`Build my trip: ${n} race${n>1?"s":""}, ${dDiff($("evtFrom").value,$("evtTo").value)+1} days ›`:"Tick the races you want";
}
async function buildEvTrip(){
  const P=evtPlan(); if(!P.chosen.length) return;
  let a=$("evtFrom").value, b=$("evtTo").value; const last=P.chosen[P.chosen.length-1];
  if(last.end>b) b=last.end;                       // never cut a race short
  if(P.chosen[0].start<a) a=P.chosen[0].start;
  const n=Math.min(60,dDiff(a,b)+1), home=$("evtHome").checked;
  let S=trip.start&&trip.start.lat!=null?trip.start:null;
  if(!S){ S=await new Promise(res=>{ if(!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p=>res(pt("My location",+p.coords.latitude.toFixed(5),+p.coords.longitude.toFixed(5))),()=>res(null),{timeout:8000,maximumAge:600000}); }); }
  const first=P.chosen[0];
  if(!S) S=pt(first.venue||first.name,first.lat,first.lon);  // no start known: the trip starts at the first race (fly in)
  // night k is the evening of day a+k; races hold the nights from the evening before they start to the evening of race day
  const night=new Array(Math.max(0,n-1)).fill(null);
  for(const e of P.chosen){ const v=pt(e.venue||e.name,e.lat,e.lon,{event:e.id,evName:e.name});
    for(let d=addDays(e.start,-1);d<=e.end;d=addDays(d,1)){ const k=dDiff(a,d); if(k>=0&&k<n-1&&!night[k]) night[k]=v; } }
  // after the last race: home if asked, otherwise the trip ends the morning after at the venue
  const lastV=pt(last.venue||last.name,last.lat,last.lon,{event:last.id,evName:last.name});
  let end=home?S:lastV, days=n;
  if(!home){ const k=dDiff(a,last.end); days=Math.min(n,k+2); }   // morning after race day
  const nt={startDate:a,endDate:addDays(a,days-1),start:S,end,round:false,sugV:5,daysSet:true,evtrip:P.chosen.map(e=>e.id),
    days:Array.from({length:days},(_,k)=>{ const to=k<days-1?night[k]:null, from=k===0?S:night[k-1];
      const stay=to&&from&&to.lat===from.lat&&to.lon===from.lon;
      return {to:to?Object.assign({},to):null,style:"default",vias:[],legs:[],fresh:!stay,...(stay?{noMore:true,atEvent:true}:{})}; })};
  $("evtGo").disabled=true; $("evtGo").textContent="Working out where you sleep…";
  try{ await evtFillNights(nt); }catch(e){}
  if(!settings.styleSet&&settings.style!=="tar"){ settings.style="tar"; store.set("rr2-settings",settings); }
  try{ localStorage.setItem("otm-evtreg",JSON.stringify([...evt.reg])); }catch(e){}
  if(pickMode!=="motorsport") setPick("motorsport",false);
  ui.lay.moto=true; ui.lay.fav=true;
  $("evtDlg").close();
  applyTrip(nt,null,`your race trip (${P.chosen.map(e=>e.name).join(", ")})`);
  const mp=$("map"); if(mp) mp.scrollIntoView({behavior:"smooth",block:"start"});
}
// travel days outside the planner's own town list (it covers South Africa and Namibia): put each night in a town or city
// near an even split of the drive, found on OpenStreetMap. They're ordinary night stops: change any of them.
const inBox=p=>Object.values(COUNTRY_BOX).some(b=>p.lat>=b[0]&&p.lat<=b[2]&&p.lon>=b[1]&&p.lon<=b[3]);
async function evtFillNights(nt){
  const n=nt.days.length, from=k=>k===0?nt.start:nt.days[k-1].to, toOf=k=>k===n-1?nt.end:nt.days[k].to;
  let a=0;
  while(a<n-1){
    if(nt.days[a].to){ a++; continue; }
    let b=a; while(b<n-1&&!nt.days[b].to) b++;
    const A=from(a), B=toOf(b); if(!A||!B||A.lat==null||B.lat==null||(inBox(A)&&inBox(B))){ a=b+1; continue; }
    const parts=b-a+1; let g;
    try{ g=(await routeLeg(A,B,{fast:true}))[0].geom; }catch(e){ a=b+1; continue; }
    const cum=[0]; for(let i=1;i<g.length;i++) cum.push(cum[i-1]+hav(g[i-1],g[i]));
    const total=cum[cum.length-1], seg=total/parts, cuts=[];
    // plenty of days: ride shorter days; only a short drive leaves days spare
    const rideDays=Math.max(1,Math.min(parts,Math.max(Math.ceil(total/evtKmDay()),Math.floor(total/200))));  // easy days of about 200 km or more; the rest free at the far end
    for(let i=1;i<rideDays;i++){ const want=total*i/rideDays; let j=cum.findIndex(c=>c>=want); if(j<0) j=g.length-1; cuts.push(g[j]); }
    let towns=[];
    if(cuts.length){ try{ const q=`[out:json][timeout:25];(${cuts.map(c=>`node["place"~"^(city|town)$"](around:30000,${c.lat.toFixed(4)},${c.lon.toFixed(4)});`).join("")});out tags;`;
      towns=(await overpass(q)).filter(t=>t.tags&&t.tags.name); }catch(e){} }
    const picks=cuts.map(c=>{ let best=null,bs=1e9; for(const t of towns){ const d=hav(c,t)+(t.tags.place==="city"?0:6); if(d<bs){ bs=d; best=t; } } return best?pt(best.tags["name:en"]||best.tags.name,best.lat,best.lon):null; });
    // ride days first, then the spare nights at the place you arrive
    for(let i=0;i<parts-1;i++){ const k=a+i; nt.days[k].to=i<picks.length?picks[i]:null; }
    if(rideDays<parts){ for(let i=rideDays-1;i<parts-1;i++) nt.days[a+i].to=Object.assign({},B,{spare:true}); }
    nt.days.forEach((d,k)=>{ const f=from(k); if(d.to&&f&&d.to.lat===f.lat&&d.to.lon===f.lon){ d.noMore=true; d.fresh=false; } });
    a=b+1;
  }
}
$("evtDlg").addEventListener("click",e=>{
  if(e.target===$("evtDlg")||e.target.closest("[data-evtclose]")){ $("evtDlg").close(); return; }
  const r=e.target.closest("[data-evtreg]"); if(r){ const k=r.dataset.evtreg; evt.reg.has(k)&&evt.reg.size>1?evt.reg.delete(k):evt.reg.add(k); r.classList.toggle("on",evt.reg.has(k)); r.setAttribute("aria-pressed",String(evt.reg.has(k))); renderEvTrip(); return; }
  if(e.target.closest("#evtGo")) buildEvTrip();
});
$("evtDlg").addEventListener("change",e=>{ const c=e.target.closest("[data-evtsel]"); if(c){ c.checked?evt.sel.add(c.dataset.evtsel):evt.sel.delete(c.dataset.evtsel); c.closest(".evtrow").classList.toggle("on",c.checked); }
  if(e.target.id==="evtFrom"&&$("evtTo").value<e.target.value) $("evtTo").value=addDays(e.target.value,6);
  renderEvTrip(); });
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-evtrip]"); if(!b) return; e.preventDefault(); openEvTrip(); });
// /?evtrip=1 (from the events page) opens it straight away
if(/[?&]evtrip=1/.test(location.search)){ history.replaceState(null,"",location.pathname); setTimeout(openEvTrip,400); }
