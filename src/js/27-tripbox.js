/* ---------- Google Maps style trip panel: three boxes, each with its own border and heading ----------
   1. Plan (the Google-style box, same on every screen): From, Finish, dates, + Add a stop
   1b. Your trip / Your day: every stop in route order (move ▲▼, remove ✕)
   2. Stop: what's at the selected stop, following the On the map filters (fuel, beds, food, sights)
   3. Details: the day facts, Good to know, passes, places to stay, ride files                                     */
var selStop=null, addOpen=false; // var: renders can run before this file
function boxSec(cls,head,body){ return `<section class="box ${cls}"><h2 class="boxh">${head}</h2>${body}</section>`; }
// a stretch's road choice and its ⋯ menu (other ways, own GPX, report), shown on the day's stop rows
function legTools(k,j){
  const pd=plan&&plan.days[k], d=trip.days[k]; if(!pd||!pd.legs[j-1]) return "";
  const L=pd.legs[j-1], lg=d.legs[j-1]||{}, p=pd.pts[j], fq=legFast(d,j-1), vi=j-1, isVia=j<pd.pts.length-1;
  const way=p.straight&&!lg.track?`<span class="note gpxnote" title="A straight line to this point">Straight</span>`:lg.track||L.gpx?(L.gpx?`<span class="note gpxnote" title="This stretch follows your GPX file">GPX</span>`:"")
    :(settings.style==="tar"?`<span class="legway one" title="Main roads, like normal sat-nav">${STYLE_ICON.fast}</span>`:`<span class="legway one"><button type="button" data-legsty="${j-1}:${fq?0:1}" class="on" title="${fq?"Quick way, main roads":esc(styleName())} to here. Tap for ${fq?esc(styleName()):"the quick way"}">${fq?STYLE_ICON.fast:STYLE_ICON.default}</button></span>`);
  const rtool=`${acct.ready?`<button class="linkbtn small" type="button" data-repat="${p.lat},${p.lon},${esc(p.name)}">Report the road here</button><button class="linkbtn small" type="button" data-spotat="${p.lat},${p.lon},${esc(p.name)}">Mark a place here</button>`:""}<button class="linkbtn small" type="button" data-fixat="${p.lat},${p.lon},${esc(p.name)}">Report a map mistake</button>`;
  const opts=`<details class="legopts"><summary class="icon" title="More">⋯</summary><div class="legmenu">${isVia&&!p.auto?`<button class="btn small ghost" type="button" data-vren="${vi}">✎ Rename</button>`:""}
      ${L.n>1&&!lg.track?`<label class="chk">Way <select data-alt="${j-1}">${L.alts.map((km2,x)=>`<option value="${x}" ${(lg.alt||0)===x?"selected":""}>Way ${x+1} · ${Math.round(km2)} km</option>`).join("")}</select></label>`:lg.track?"":lg.wantAlts?`<span class="note">No other ways found for this stretch.</span>`:`<button class="btn small ghost" type="button" data-wantalts="${j-1}">Find other ways</button>`}
      ${lg.track?`<span class="note">Own track: ${esc(lg.trackName||"GPX")}</span><button class="btn small ghost" type="button" data-untrack="${j-1}">Remove track</button>`:`<label class="btn small ghost" style="cursor:pointer;align-self:flex-start">Use my GPX for this stretch<input type="file" accept=".gpx,application/gpx+xml" data-track="${j-1}" hidden></label>`}
      ${rtool}</div></details>`;
  return way+opts;
}
function stopRows(kOnly){
  const days=kOnly==null?trip.days.map((d,k)=>k):[kOnly], numOf={}; let n=0, h=`<ol class="tstops">`;
  trip.days.forEach((d,k)=>d.vias.forEach((v,i)=>{ if(!v.auto) numOf[k+":"+i]=++n; }));
  const first=days[0], s0=dayFrom(first), isSel=(k,j)=>selStop&&selStop.k===k&&selStop.j===j;
  if(s0&&s0.lat!=null) h+=`<li class="trow tstart ${isSel(first,0)?"on":""}" ${plan&&!planStale?`data-selstop="${first}:0"`:""}><span class="tmk">${first===0?"▶":"🛏"}</span><span class="tnm"><b>${esc(s0.name)}</b><span class="note"> ${first===0?"start":"night "+first} · leave ${esc(dayName(first))} ${esc(settings.leave)}</span></span></li>`;
  days.forEach(k=>{
    const d=trip.days[k], pd=!planStale&&plan&&plan.days[k], last=k===nDays()-1, onDay=kOnly!=null;
    if(!onDay&&nDays()>1) h+=`<li class="tday"><button type="button" class="linkbtn" data-day="${k}">${esc(dayName(k))}</button>${pd?`<span class="note">${Math.round(pd.km)} km · ${fmtDur(dayMinutes(k))}</span>`:""}</li>`;
    d.vias.forEach((v,i)=>{ if(v.lat==null) return; const j=i+1, L=pd&&pd.legs[j-1], km=L?Math.round(onDay?L.b-pd.a:L.b):null;
      const canUp=!v.auto&&(i>0||k>0), canDn=!v.auto&&(i<d.vias.length-1||k<nDays()-1);
      h+=`<li class="trow ${v.auto?"auto":""} ${isSel(k,j)?"on":""}" ${pd?`data-selstop="${k}:${j}"`:""}><span class="tmk ${v.auto?"sug":""}">${v.auto?"⛽":numOf[k+":"+i]}</span><span class="tnm"><b>${esc(v.name)}</b>${v.auto?` <span class="autotag">Suggested${v.fuelHere?" fuel":""}</span>`:""}</span><span class="tkm">${km!=null?"km "+km:""}</span>
        <span class="tctl">${onDay&&pd?legTools(k,j):""}${v.auto||(k===nDays()-1&&!dayTo(k))?"":`<button type="button" class="tbtn" data-tsleep="${k}:${i}" title="Sleep here: this becomes a night stop and the trip gets a day">🛏</button>`}${v.auto?"":`<button type="button" class="tbtn" data-tmove="${k}:${i}:-1" ${canUp?"":"disabled"} title="Move up">▲</button><button type="button" class="tbtn" data-tmove="${k}:${i}:1" ${canDn?"":"disabled"} title="Move down">▼</button>`}<button type="button" class="tbtn" data-tdel="${k}:${i}" title="Remove this stop">✕</button></span></li>`; });
    const to=dayTo(k);
    if(!to||to.lat==null){ h+=`<li class="trow need"><span class="tmk">${last?"🏁":"🛏"}</span><span class="tnm">${last?`<span class="note">${trip.round?"Add a stop to ride to":"Where to? Type it above"}</span>`:toCell(k)}</span></li>`; return; }
    const j=pd?pd.pts.length-1:null, km=pd?Math.round(onDay?pd.km:pd.b):null, arr=pd?fmtT(arrMin(k,j)):"";
    h+=`<li class="trow end ${last?"fin":"night"} ${pd&&isSel(k,j)?"on":""}" ${pd?`data-selstop="${k}:${j}"`:""}><span class="tmk">${last?(trip.round?"⟲":"🏁"):"🛏"}</span><span class="tnm">${last?`<b>${esc(to.name)}</b><span class="note"> ${trip.round?"back home":"finish"}</span>`:`${toCell(k)} <span class="note">night ${k+1}</span>`}</span><span class="tkm">${km!=null?"km "+km:""}${arr?` · ${arr}`:""}</span>
      <span class="tctl">${onDay&&pd?legTools(k,j):""}${last?"":`<button type="button" class="tbtn" data-dropnight="${k}" title="No night here: one day less">✕</button>`}</span></li>`;
  });
  h+=`</ol>`;
  return h;
}
function tripHead(kOnly){
  if(kOnly!=null){ const pd=!planStale&&plan&&plan.days[kOnly]; return `Your day · ${esc(dayLong(kOnly))}${pd?` <span class="boxsub">${Math.round(pd.km)} km · ${fmtDur(dayMinutes(kOnly))}</span>`:""}`; }
  const km=plan&&!planStale?Math.round(plan.total):0, mins=plan&&!planStale?plan.days.reduce((t,d,k)=>t+(d?dayMinutes(k):0),0):0;
  return `Your trip${km?` <span class="boxsub">${nDays()} day${nDays()>1?"s":""} · ${km.toLocaleString()} km · ${fmtDur(mins)}</span>`:""}`;
}
// the Google-style box (From, Finish, dates, Stay in, tools) is the same on every screen; the stops box follows the tab
function addStopCtl(){ return addOpen?`<div class="rname tadd">${searchBox("addstop","","Town, pass or place to add",true)}<button type="button" class="linkbtn small" data-addclose>Cancel</button></div>`:`<button type="button" class="btn small tadd" data-addopen>+ Add a stop</button>`; }
function planBox(kOnly){ return boxSec("planbox","Plan",`<div class="tbslot"></div>${addStopCtl()}${kOnly==null&&typeof gpxBar==="function"?gpxBar():""}`); }
function tripBox(kOnly){ return planBox(kOnly)+boxSec("tripbox",tripHead(kOnly),stopRows(kOnly)); }
// what's at the selected stop (the day's night stop until you pick another)
function stopSummary(kOnly){
  if(!plan||planStale) return "";
  let s=selStop; const okSel=s&&plan.days[s.k]&&plan.days[s.k].pts[s.j]&&(kOnly==null||s.k===kOnly);
  if(!okSel){ const k=kOnly==null?0:kOnly, pd=plan.days[k]; if(!pd) return ""; s={k,j:pd.pts.length-1}; }
  const {k,j}=s, pd=plan.days[k], p=pd.pts[j], last=k===nDays()-1, isEnd=j===pd.pts.length-1, night=isEnd&&!last, kmA=j===0?pd.a:pd.legs[j-1].b;
  const what=j===0?(k===0?"Start":`Night ${k}`):night?`🛏 Night ${k+1}`:isEnd?(trip.round?"⟲ Back home":"🏁 Finish"):p.auto?"⛽ Suggested stop":"Stop";
  const head=`${what} · ${esc(p.name)} <span class="boxsub">${esc(dayName(k))} · km ${Math.round(kmA)}${j>0?` · arrive ${fmtT(arrMin(k,j))}`:` · leave ${esc(settings.leave)}`}</span>`;
  const av=placesOk?stopAvail(p):null, on=["fuel","stay","food","sights"].filter(c=>ui.lay[c]);
  const LAB={fuel:["fuel station","fuel stations"],stay:["place to stay","places to stay"],food:["place to eat","places to eat"],sights:["sight","sights"]};
  let b="";
  if(!av) b+=`<div class="note">Finding what's here…</div>`;
  else if(!on.length) b+=`<div class="note">Switch on fuel, beds, food or sights under On the map to see them here.</div>`;
  else on.forEach(c=>{ const a=AV.find(x=>x[0]===c), L=av[c], top=L[0], open=ovFocus&&ovFocus.k===k&&ovFocus.j===j&&ovFocus.cat===c;
    b+=`<div class="srow2"><span class="avi trio ${L.length?"":"none"} ${open?"on":""}" data-c="${c}">${trioIcon(c)}</span><span class="sn"><b>${L.length?L.length:"No"} ${L.length===1?LAB[c][0]:LAB[c][1]}</b>${top?`<span class="note"> · ${esc(top.name||a[2])}, ${Math.max(0.1,top.dstop).toFixed(1)} km</span>`:`<span class="note"> within ${c==="stay"||c==="sights"?5:1} km</span>`}</span>
      <span class="sact">${top&&c==="stay"&&night?`<button class="btn small" type="button" data-staynight="${k}:${esc(top.id)}">Stay here</button>`:""}${L.length?`<button class="linkbtn small" type="button" data-ovav="${k}:${j}:${c}">${open?"Hide":"Show all"}</button>`:""}</span></div>${open?ovList(k):""}`; });
  const nf=(fuelStations||[]).filter(f=>f.km!=null&&f.km>kmA+2).sort((x,y)=>x.km-y.km)[0];
  if(av&&!isEnd||av&&night) b+=`<div class="note snext">${nf?`Next fuel after this: ${esc(nf.name&&nf.name!=="Fuel"?nf.name:"a fuel station")}, ${Math.round(nf.km-kmA)} km on.`:"No more fuel on our map along the rest of the route."}</div>`;
  return boxSec("stopbox",head,b);
}
// which day a new stop belongs to: the day whose stretch of road passes closest
function dayForPoint(p){
  if(!plan||planStale) return nDays()-1; let best=0,bd=1e9;
  plan.geom.forEach((g,i)=>{ if(i%3) return; const dd=Math.abs(g.lat-p.lat)<2?hav(g,p):1e9; if(dd<bd){ bd=dd; best=plan.cum[i]; } });
  const k=plan.days.findIndex(d=>d&&best>=d.a-0.5&&best<=d.b+0.5); return k<0?nDays()-1:k;
}
function moveStop(k,i,dir){
  const d=trip.days[k], v=d.vias[i]; if(!v) return;
  if(dir<0){ if(i>0){ d.vias.splice(i,1); d.vias.splice(i-1,0,v); } else if(k>0){ d.vias.splice(i,1); trip.days[k-1].vias.push(v); trip.days[k-1].legs=[]; } else return; }
  else { if(i<d.vias.length-1){ d.vias.splice(i,1); d.vias.splice(i+1,0,v); } else if(k<nDays()-1){ d.vias.splice(i,1); trip.days[k+1].vias.unshift(v); trip.days[k+1].legs=[]; } else return; }
  d.legs=[]; changed();
}
document.addEventListener("click",e=>{
  const t=e.target; if(!t.closest) return;
  const mv=t.closest("[data-tmove]"); if(mv){ const [k,i,dir]=mv.dataset.tmove.split(":").map(Number); moveStop(k,i,dir); return; }
  const dl=t.closest("[data-tdel]"); if(dl){ const [k,i]=dl.dataset.tdel.split(":").map(Number), d=trip.days[k], v=d.vias[i]; if(v&&v.auto){ d.noAuto=[...(d.noAuto||[]),v.name]; d.noMore=true; } d.vias.splice(i,1); d.legs=[]; selStop=null; changed(); return; }
  const sl=t.closest("[data-tsleep]"); if(sl){ const [k2,i2]=sl.dataset.tsleep.split(":").map(Number); sleepAt(k2,i2); changed(); return; }
  const dn=t.closest("[data-dropnight]"); if(dn){ dropNight(+dn.dataset.dropnight); changed(); return; }
  if(t.closest("[data-addopen]")){ addOpen=true; renderDetails(); const el=document.getElementById("addstop"); if(el) el.focus(); return; }
  if(t.closest("[data-addclose]")){ addOpen=false; renderDetails(); return; }
  const sr=t.closest("[data-selstop]"); if(sr&&!t.closest("button,a,input,select,details,label")){ const [k,j]=sr.dataset.selstop.split(":").map(Number); selStop={k,j}; ovFocus=null;
    renderAll(); const p=plan&&plan.days[k]&&plan.days[k].pts[j]; if(p&&map) map.setView([p.lat,p.lon],Math.max(11,Math.min(map.getZoom(),13))); return; }
});
