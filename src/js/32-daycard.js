/* ---------- day card: one card per day, with tabs for Route, Fuel, Sleep, Eat, See, Good to know (Book on the last day) ----------
   Function declarations only: the first render runs before this file does, so nothing here may rely on top-level data.
   The open tab is kept per day in ui.dtab; the map follows it when MAP_FOLLOWS_TAB is on (see mapLay). */
function dcTabsDef(){ return [["route","route","Route"],["fuel","fuel","Fuel"],["stay","stay","Sleep"],["food","utensils","Eat"],["sights","eye","See"],["gtk","info","Good to know"],["book","tix","Book"]]; }
function dcIcon(k,n){ return typeof OTMhouse!=="undefined"?OTMhouse.icon(k,n):""; }
function dcPlay(n){ return `<svg class="ico" width="${n}" height="${n}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>`; }
function dcLast(k){ return k===nDays()-1; }
function dcHasBook(k){ const e=trip.end; return dcLast(k)&&!!plan&&!planStale&&!trip.round&&!!e&&e.lat!=null; } // the same test tripBlockHtml makes
// the tabs this day has: no Sleep on the last day, Book only when there's a trip to book at the finish
function dcTabs(k){ return dcTabsDef().filter(([t])=>t==="stay"?!dcLast(k):t==="book"?dcHasBook(k):true); }
function dcTab(k){ const t=ui.dtab&&ui.dtab[k]; return t&&dcTabs(k).some(x=>x[0]===t)?t:"route"; }
// which map category a tab stands for (Route, Good to know and Book keep the rider's own choices)
function dcFollowCat(t){ return {fuel:"fuel",stay:"stay",food:"food",sights:"sights"}[t]||null; }
/* what the map shows: the rider's own "On the map" choices, or only the open tab's category for that day */
function mapLay(){
  const k=curDay(), own={lay:ui.lay,types:ui.types,k:null,cat:null};
  if(!MAP_FOLLOWS_TAB||k==null||planStale||!plan||!plan.days[k]) return own;
  const cat=dcFollowCat(dcTab(k)); if(!cat) return own;
  const lay=Object.assign({},ui.lay,{fuel:false,stay:false,food:false,sights:false,med:false,rep:false,spots:false,fav:false,moto:false}); lay[cat]=true;
  const types=Object.assign({},ui.types); TYPES.forEach(t=>types[t.id]=false);
  if(cat==="food") types.food=true; if(cat==="sights") ["view","pass","sight"].forEach(t=>types[t]=true); if(cat==="stay") types.camp=true;
  return {lay,types,k,cat};
}
function setDtab(k,t){
  ui.dtab=ui.dtab||{}; ui.dtab[k]=t; saveUi();
  const card=document.querySelector(`.daycard[data-k="${k}"]`);
  if(card){ card.querySelectorAll("[data-dtab]").forEach(b=>{ const on=b.dataset.dtab===t; b.setAttribute("aria-selected",String(on)); b.tabIndex=on?0:-1; });
    card.querySelectorAll("[data-dpanel]").forEach(p=>p.hidden=p.dataset.dpanel!==t);
    const b=card.querySelector(`[data-dtab="${t}"]`); if(b&&b.scrollIntoView&&b.parentNode.scrollWidth>b.parentNode.clientWidth) b.parentNode.scrollTo({left:b.offsetLeft-b.parentNode.offsetLeft-24,behavior:"smooth"}); }
  else renderDetails();
  try{ renderLayers(); }catch(e){}
  window._refit=true; drawMap();
}

/* ---------- what each tab lists ---------- */
function dcFuelGroups(k){ const pd=plan.days[k]; return fp?fuelGroups(fp.fills.filter(x=>x.km>=pd.a-0.3&&x.km<=pd.b+0.3)):[]; }
// the longest stretch with no fuel on our map: fuel stations on the route, and stops you said have fuel
function dcGap(k){
  const pd=plan.days[k], last=pd.pts.length-1, m=[{km:pd.a,name:pd.pts[0].name}];
  pd.pts.forEach((p,j)=>{ if(j>0&&j<last&&stopFuel(p)) m.push({km:pd.legs[j-1].b,name:p.name}); });
  dcFuelGroups(k).forEach(g=>m.push({km:g.km,name:g.town?g.town.name:g.st[0].name}));
  m.push({km:pd.b,name:pd.pts[last].name}); m.sort((x,y)=>x.km-y.km);
  let best=null; for(let i=1;i<m.length;i++){ const len=m[i].km-m[i-1].km; if(!best||len>best.len) best={len,from:m[i-1],to:m[i]}; }
  return best;
}
// the stops to group Eat and See by: every stop of the day, and the start on the first day
function dcStops(k){ const pd=plan.days[k]; return pd.pts.map((p,j)=>({p,j})).filter(x=>x.j>0||k===0); }
var DCM=null; // lists worked out once per card render
function dcMemo(name,k,fn){ if(!DCM||DCM.k!==k) return fn(); return DCM[name]||(DCM[name]=fn()); }
function dcFood(k){ return dcMemo("food",k,()=>dcFood0(k)); }
function dcSights(k){ return dcMemo("sights",k,()=>dcSights0(k)); }
function dcGtk(k){ return dcMemo("gtk",k,()=>dcGtk0(k)); }
function dcFood0(k){ const seen=new Set(); return dcStops(k).map(({p,j})=>({p,j,list:stopAvail(p).food.filter(x=>{ const id=x.id||x.name+x.lat; if(seen.has(id)) return false; seen.add(id); return true; })})); }
function dcSights0(k){
  const pd=plan.days[k], seen=new Set(), SK=["view","pass","sight"];
  return dcStops(k).map(({p,j})=>{ const a=j>0?pd.legs[j-1].a:pd.a, b=j>0?pd.legs[j-1].b:pd.a;
    const list=pois.filter(x=>SK.includes(x.kind)&&((x.km!=null&&x.km>=a-0.5&&x.km<=b+0.5)||(Math.abs(x.lat-p.lat)<0.1&&hav(x,p)<=5)))
      .filter(x=>{ const id=x.id||x.name+x.lat; if(seen.has(id)) return false; seen.add(id); return true; }).sort((x,y)=>(x.km??1e9)-(y.km??1e9));
    return {p,j,list}; });
}
function dcPasses(k){ const pd=plan.days[k], d=trip.days[k]; if(!passNear.length) return 0; return passNear.filter(p=>p.km>=pd.a-1&&p.km<=pd.b+1&&!d.vias.some(v=>v.name===p.name)).slice(0,5).length; }
// Good to know: the day's notes plus sunset and weather (which used to sit in the day summary), worst first
function dcGtk0(k){
  const pd=plan.days[k], last=pd.pts.length-1, out=goodToKnow(k).filter(x=>!(x.sec==="dest"&&/sunset/i.test(x.text)));
  const r=dayRisk(k); (r?r.reasons:[]).filter(x=>x.kind==="stay").forEach(x=>out.push({lvl:x.lvl,sec:"route",text:x.text}));
  const s=sunMin(k), arr=arrMin(k,last), lv=toMin(settings.leave);
  if(s!=null) out.push({lvl:s<arr?"bad":s-arr<60?"warn":"info",head:`Sunset ${fmtT(s)}`,text:s<arr?`You arrive about ${fmtT(arr)}, after dark. Leave earlier or shorten the day.`:`You arrive about ${fmtT(arr)} if you leave at ${fmtT(lv)}.${s-arr<60?" Not much light to spare.":""}`});
  const w=dayWx(k), to=dayTo(k);
  if(w&&!w.past&&to){ const href=`https://www.windy.com/?${to.lat.toFixed(2)},${to.lon.toFixed(2)},9`;
    out.push({lvl:"info",head:w.none?"Weather":`${WXW(w.code)}, ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C`,text:w.none?`The forecast opens ${fmtDate(new Date(w.opens+"T12:00:00"))}.`:`Rain ${w.rain<0.5?"none":Math.round(w.rain)+" mm"}${w.prob>=20?` (${w.prob}%)`:""}, gusts ${Math.round(w.gust)} km/h.`,link:href}); }
  const rank={bad:0,warn:1,info:2};
  return out.map((x,i)=>Object.assign(x,{i})).sort((a,b)=>rank[a.lvl]-rank[b.lvl]||a.i-b.i);
}
// one note in two parts: the first sentence in bold, the rest under it
function dcSplit(x){ if(x.head) return [x.head,x.text]; const m=x.text.match(/^(.+?[.!?])\s+(.+)$/); return m?[m[1],m[2]]:[x.text,""]; }

/* ---------- the panels ---------- */
function dcGroup(title,sub,list,key,rowFn){
  const shown=showAll.has(key)?list:list.slice(0,6);
  return `<div class="dcgrp"><h4>${esc(title)}${sub?` <span class="note">${esc(sub)}</span>`:""}</h4>${shown.map(rowFn).join("")}${list.length>6?`<button class="linkbtn small" type="button" data-more="${key}">${showAll.has(key)?"Show fewer":`Show all ${list.length}`}</button>`:""}</div>`;
}
function dcRoutePanel(k){
  const pd=plan.days[k], last=pd.pts.length-1, night=!dcLast(k), sel=selStop&&selStop.k===k?selStop.j:null;
  let h=`<ol class="dcroute">`;
  pd.pts.forEach((p,j)=>{ const t=j===0?toMin(settings.leave):arrMin(k,j), km=j===0?"":Math.round(j===last?pd.km:pd.legs[j-1].b-pd.a)+" km"; // the end uses the day's total, as the day box does
    const fuel=placesOk&&stopFuel(p), bed=night&&j===last;
    const marks=(bed?`<button type="button" class="dcmk b" data-dcgo="${k}:${j}:stay" title="Places to stay at ${esc(p.name)}" aria-label="Places to stay at ${esc(p.name)}">${dcIcon("stay",15)}</button>`:"")
      +(fuel?`<button type="button" class="dcmk f" data-dcgo="${k}:${j}:fuel" title="Fuel at ${esc(p.name)}" aria-label="Fuel at ${esc(p.name)}">${dcIcon("fuel",15)}</button>`:"");
    const tag=p.auto?` <span class="autotag ${p.fuelHere?"":"nofuel"}">Suggested${p.fuelHere?"":" · fuel?"}</span>`:j===last?` <span class="note">${night?"night "+(k+1):trip.round?"back home":"finish"}</span>`:"";
    h+=`<li class="dcst ${sel===j?"on":""}" data-selstop="${k}:${j}" tabindex="0"><span class="tm">${fmtT(t)}</span><span class="nm"><b>${esc(p.name)}</b>${tag}</span><span class="mk">${marks}</span><span class="km">${km}</span></li>`; });
  h+=`</ol>`;
  const ep=elevProfile(k), E=ep&&dayElev(k); if(ep) h+=`<div class="dcelev"><span class="note">Climb ${fmtM(E.up)}&nbsp;m · descent ${fmtM(E.dn)}&nbsp;m · highest ${fmtM(E.top)}&nbsp;m</span>${ep}</div>`;
  return h+`<p class="note dcnote">Tap a stop to see it on the map. Tap a fuel or bed mark to open that tab.</p>`;
}
function dcFuelPanel(k){
  const pd=plan.days[k], G=dcFuelGroups(k), sel=selStop&&selStop.k===k?selStop.j:null, selKm=sel==null?null:sel===0?pd.a:pd.legs[sel-1].b;
  if(!placesOk) return `<div class="verdict v-warn">Fuel stations didn't load, so long stretches without fuel can't be checked. Check your connection and reload.</div>`;
  const tel=t=>t.phone?` · <a href="tel:${esc(String(t.phone).replace(/[^\d+]/g,""))}">${esc(t.phone)}</a>`:"";
  const one=f=>{ const t=f.tags||{}, g=gradesTxt(t); return [g?esc(g):"",t.hours?esc(t.hours):"Hours unknown"].filter(Boolean).join(" · ")+tel(t); };
  const gapNow=rangeFuel(pd.a,pd.b); // the fuel pill says "Check fuel" then, and shows the gap on the map
  let h=`<div class="dcsum">${fuelBtn(k)}<span class="note">${gapNow?`${G.length} fuel stop${G.length===1?"":"s"} on this day's route. Tap Check fuel to see the gap on the map.`:`${G.length===1?"fuel stop":"fuel stops"} on this day's route. Tap one to see it on the map.`}</span></div>`;
  const gp=dcGap(k), R=+settings.range||0;
  if(gp&&gp.len>=1){ const lvl=R&&gp.len>R?"bad":R&&gp.len>R*0.8?"warn":"";
    h+=`<div class="dcrow dcgap ${lvl}"><div><b>Longest gap: ${Math.round(gp.len)} km</b><span class="note">${esc(gp.from.name)} to ${esc(gp.to.name)}. ${R?gp.len>R?`That's more than your ${R} km range. Carry extra or add a fuel stop.`:`Your range is ${R} km${gp.len>R*0.8?", so it's close.":", so you're fine."}`:"Set your range in Settings to check it."}</span></div></div>`; }
  const f=rangeFuel(pd.a,pd.b); if(f) h+=`<div class="verdict v-warn">${esc(f.text)}. Small towns may still have fuel: ask locally or carry extra.</div>`;
  if(!G.length) h+=`<p class="dcempty">No fuel stops found on this day's route.</p>`;
  const key="fuel-"+k, selI=selKm==null?-1:G.findIndex(g=>Math.abs(g.km-selKm)<3), shown=showAll.has(key)||selI>=8?G:G.slice(0,8);
  shown.forEach(g=>{ const f=g.st[0], km=Math.max(0,Math.round(g.km-pd.a)), onRoute=pd.pts.some(p=>hav(p,f)<2), on=selKm!=null&&Math.abs(g.km-selKm)<3;
    const nm=g.town&&g.town.name!==f.name?`${esc(g.town.name)} · ${esc(f.name)}`:esc(f.name);
    const act=onRoute?`<span class="note">On your route</span>`:g.town&&g.st.length>1?`<button class="btn small ghost" type="button" data-addtown="${k}|${esc(g.town.name)}|${g.town.lat}|${g.town.lon}">Add as a stop</button>`:`<button class="btn small ghost" type="button" data-addfill="${f.id}" data-day="${k}">Add as a stop</button>`;
    h+=`<div class="dcrow ${on?"on dcsel":""}" data-ploc="${f.lat},${f.lon}"><div><b>${nm}</b>${g.st.length>1?` <span class="note">${g.st.length} stations</span>`:""}<span class="note">${km?"km "+km:"Start of day"} · ${one(f)}</span>${g.st.length>1?`<details class="fgrp"><summary class="note">All stations</summary>${g.st.map(x=>`<div class="note"><b>${esc(x.name)}</b> · ${one(x)}</div>`).join("")}</details>`:""}</div><div class="sact">${act}</div></div>`; });
  if(G.length>8) h+=`<button class="linkbtn small" type="button" data-more="${key}">${shown.length>8?"Show fewer":`Show all ${G.length}`}</button>`;
  return h;
}
function dcStayPanel(k){ const h=stayRows(k); return h||`<p class="dcempty">No night stop set for this day.</p>`; }
function dcFoodPanel(k){
  const G=dcFood(k).filter(g=>g.list.length);
  if(!placesOk) return `<p class="dcempty">Finding places to eat…</p>`;
  if(!G.length) return `<p class="dcempty">No places to eat on our map at this day's stops. Small places are often missing, so ask locally.</p>`;
  const sel=selStop&&selStop.k===k?selStop.j:null;
  return G.map(g=>`<div class="${sel===g.j?"dcsel":""}">${dcGroup(g.p.name,g.list.length+" within 1 km",g.list,`eat-${k}-${g.j}`,x=>placeRow(x,k,g.j))}</div>`).join("");
}
function dcSeePanel(k){
  const G=dcSights(k).filter(g=>g.list.length), pr=passRows(k), sel=selStop&&selStop.k===k?selStop.j:null;
  if(!G.length&&!pr) return `<p class="dcempty">No sights or viewpoints on our map along this day's route.</p>`;
  return G.map(g=>`<div class="${sel===g.j?"dcsel":""}">${dcGroup(g.j===0?g.p.name:`On the way to ${g.p.name}`,String(g.list.length),g.list,`see-${k}-${g.j}`,x=>placeRow(Object.assign({},x,{kind:"sight"}),k,g.j,g.j>0?`<button class="linkbtn" type="button" data-sadd="${k}:${g.j}:${esc(x.id)}">Add</button>`:""))}</div>`).join("")+pr;
}
function dcGtkPanel(k){
  const g=dcGtk(k), m=dayMed(k), pd=plan.days[k];
  let h=`<section class="gtk dcgtk">`+(g.length?g.map(x=>{ const [a,b]=dcSplit(x); return `<div class="dcnote2 ${x.lvl}"><span class="dot"></span><div><b>${esc(a)}</b>${b?`<span>${esc(b)}</span>`:""}${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">Full forecast</a>`:""}</div></div>`; }).join(""):`<p class="dcempty">Nothing to flag for this day.</p>`)+`</section>`;
  if(m) h+=`<details class="medbox"><summary><span class="lbl">Medical</span> ${m.near.length} hospital${m.near.length===1?"":"s"} and clinics near the route · furthest point ${fmtFar(m.far)} km from a hospital</summary>
    ${m.near.map(x=>`<div class="item"><div class="meta"><b>${esc(x.name||(x.type==="hospital"?"Hospital":"Clinic"))}</b><span class="note">${x.type==="hospital"?"Hospital":"Clinic"} · km ${Math.round(x.km-pd.a)} · ${x.off<0.5?"on the route":x.off.toFixed(1)+" km off"}${x.phone?` · <a href="tel:${esc(x.phone.replace(/[^\d+]/g,""))}">${esc(x.phone)}</a>`:""}</span></div></div>`).join("")||`<div class="note">None listed within 25 km of the route.</div>`}
    <div class="note">Emergency from a mobile: 112. Check the local numbers before you go.</div></details>`;
  return h;
}
function dcBookPanel(){ return tripBlockHtml(true); }

/* ---------- the card ---------- */
function dcCounts(k){
  if(!placesOk) return {};
  const g=dcGtk(k), warn=g.filter(x=>x.lvl!=="info");
  return { fuel:dcFuelGroups(k).length, stay:dcLast(k)?0:staysFor(k).length, food:dcFood(k).reduce((t,x)=>t+x.list.length,0),
    sights:dcSights(k).reduce((t,x)=>t+x.list.length,0)+dcPasses(k), gtk:warn.length, gtkAll:g.length, gtkLvl:g.some(x=>x.lvl==="bad")?"bad":warn.length?"warn":"" };
}
function dcGradeLegend(G){
  if(!G||!G.tot) return "";
  return `<div class="dcleg">${[1,2,3,4,5,0].filter(g=>G.km[g]>=0.5).map(g=>`<span><i style="background:${GRADES[g].col}"></i>${Math.round(G.km[g]/G.tot*100)}% ${esc(g?GRADES[g].name:"unknown")}${g?` <span class="vn">${esc(vehNote(g))}</span>`:""}</span>`).join("")}</div>`;
}
function dayCard(k,pre){
  const pd=!planStale&&plan&&plan.days[k];
  if(!pd) return boxSec("detailbox","Details",(pre||"")+sumBox(k,true,true));
  DCM={k}; try{ return dayCard0(k,pd,pre); } finally{ DCM=null; }
}
function dayCard0(k,pd,pre){
  const last=dcLast(k), from=dayFrom(k), mins=dayMinutes(k), long=mins>+settings.maxHours*60, cur=dcTab(k), C=dcCounts(k);
  const toIc=last?(trip.round?"home":"race"):"stay";
  let h=`<section class="box detailbox daycard" data-k="${k}">${pre||""}
    <div class="dchead"><div class="dcl"><b>Day ${k+1}</b> · ${esc(dayName(k))}</div><button type="button" class="dcr" data-focusday="${k}" title="Show the day on the map">${Math.round(pd.km)} km · <span class="${long?"overt":""}" title="${long?`Over your ${settings.maxHours}h a day`:`${VEH().Ing} time`}">${fmtDur(mins)}</span></button></div>
    <div class="dcft"><span class="ep">${k===0?dcPlay(14):dcIcon("stay",16)} ${esc(from?from.name:"")}</span><span class="arr">→</span><span class="ep to">${dcIcon(toIc,16)} ${toCell(k)}</span></div>
    ${gradeBar(dayGrade(k),true)}${dcGradeLegend(dayGrade(k))}`;
  if(!placesOk) h+=`<div class="verdict v-warn">Fuel stations and places didn't load, so the counts below are missing. Check your connection and reload.</div>`;
  const tabs=dcTabs(k);
  h+=`<div class="dctabs" role="tablist" aria-label="${esc(dayName(k))}">`+tabs.map(([t,ic,lab])=>{ const n=t==="gtk"?C.gtk:C[t], empty=t==="gtk"?C.gtkAll===0:n===0;
    const badge=t==="route"||t==="book"||n==null?"":`<em class="cnt ${t==="gtk"?C.gtkLvl:""}" title="${n}">${n>99?"99+":n}</em>`;
    return `<button type="button" class="dctab ${empty?"empty":""}" role="tab" id="dct-${k}-${t}" aria-controls="dcp-${k}-${t}" aria-selected="${t===cur}" tabindex="${t===cur?0:-1}" data-dtab="${t}">${dcIcon(ic,15)}<span>${lab}</span>${badge}</button>`; }).join("")+`</div>`;
  const P={route:dcRoutePanel,fuel:dcFuelPanel,stay:dcStayPanel,food:dcFoodPanel,sights:dcSeePanel,gtk:dcGtkPanel,book:dcBookPanel};
  h+=`<div class="dcpanels">`+tabs.map(([t])=>`<div class="dcpanel" role="tabpanel" id="dcp-${k}-${t}" aria-labelledby="dct-${k}-${t}" data-dpanel="${t}" ${t===cur?"":"hidden"}>${P[t](k)}</div>`).join("")+`</div>`;
  // ride files and phone links: for the whole day, whichever tab is open
  h+=`<div class="dcfoot"><div class="btns"><button class="btn small" type="button" data-gpx="${k}">GPX file</button>${nDays()===1?`<button class="btn small ghost" type="button" data-print>Save as PDF</button>${saveRouteBtn()}`:""}<span class="note">GPX for your bike's GPS or a phone app.</span></div><div class="btns phonenav"><span class="lbl">On your phone</span>${navButtons(k)}<button class="btn small share" type="button" data-sharetrip>Share this trip ↗</button><button class="btn small wa" type="button" data-sharewa title="Send this trip on WhatsApp">WhatsApp this trip</button>${nameBtn()}</div></div>`;
  return h+`</section>`;
}

// after a render: the open tab stays in sight when the tabs scroll sideways (phones)
function dcAfterRender(){ document.querySelectorAll(".daycard .dctabs").forEach(bar=>{ const b=bar.querySelector('[aria-selected="true"]'); if(b&&bar.scrollWidth>bar.clientWidth) bar.scrollLeft=Math.max(0,b.offsetLeft-bar.offsetLeft-24); }); }
/* ---------- clicks: tabs, marks on the route, arrow keys ---------- */
$("details").addEventListener("click",e=>{
  const t=e.target; if(!t.closest) return;
  const b=t.closest("[data-dtab]"); if(b){ const card=b.closest(".daycard"); if(card) setDtab(+card.dataset.k,b.dataset.dtab); return; }
  const g=t.closest("[data-dcgo]"); if(g){ const [k,j,c]=g.dataset.dcgo.split(":"); selStop={k:+k,j:+j}; ovFocus=null; ui.dtab=ui.dtab||{}; ui.dtab[+k]=c; saveUi(); renderAll(); try{ renderLayers(); }catch(err){}
    const p=plan&&plan.days[+k]&&plan.days[+k].pts[+j]; if(p&&map) map.setView([p.lat,p.lon],c==="stay"?13:12);
    setTimeout(()=>{ const el=document.querySelector(".daycard .dcpanel:not([hidden]) .dcsel")||document.querySelector(`.daycard [data-dtab="${c}"]`); if(el) el.scrollIntoView({behavior:"smooth",block:"nearest"}); },60); return; }
});
$("details").addEventListener("keydown",e=>{
  const b=e.target.closest&&e.target.closest("[data-dtab]");
  if(b&&(e.key==="ArrowRight"||e.key==="ArrowLeft")){ const all=[...b.parentNode.querySelectorAll("[data-dtab]")], i=all.indexOf(b), n=all[(i+(e.key==="ArrowRight"?1:-1)+all.length)%all.length]; e.preventDefault(); n.focus(); n.click(); return; }
  const s=e.target.closest&&e.target.closest(".dcst[data-selstop]"); if(s&&(e.key==="Enter"||e.key===" ")&&e.target===s){ e.preventDefault(); s.click(); }
});
