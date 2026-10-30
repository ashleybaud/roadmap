/* ---------- Adventure or Motorsport: the two boxes at the top ----------
   Adventure: the road less travelled. Motorsport: the quick way, with tracks, museums, factories and upcoming events on the map.
   The rider's own route style in Settings always wins. The choice is remembered on this device. */
var pickMode=null, evList=null;
const mySeries=()=>{ try{ return JSON.parse(localStorage.getItem("otm-series")||"[]"); }catch(e){ return []; } };
function loadEvents(){ return evList?Promise.resolve(evList):fetch("/data/events/events.json").then(r=>r.ok?r.json():[]).then(j=>{ const t=new Date().toISOString().slice(0,10), y=new Date(Date.now()+365*864e5).toISOString().slice(0,10); return evList=j.filter(e=>e.end>=t&&e.start<=y); }).catch(()=>evList=[]); }
function drawEvents(){
  if(pickMode!=="motorsport") return;
  if(!evList){ setTimeout(()=>loadEvents().then(()=>{ if(evList.length) drawMap(); }),0); return; }
  const g=plan&&plan.geom, near=x=>{ if(!g) return true; for(let i=0;i<g.length;i+=Math.max(1,Math.floor(g.length/1500))) if(Math.abs(g[i].lat-x.lat)<1.2&&hav(g[i],x)<=100) return true; return false; };
  const seen=new Set();
  const my=mySeries();
  evList.filter(near).filter(x=>!my.length||my.includes(x.series)).forEach(x=>{ const k=x.lat.toFixed(2)+","+x.lon.toFixed(2); if(seen.has(k)) return; seen.add(k);
    const html=`<b>${esc(x.name)}</b><br><span class="note">${esc(x.start)}${x.end!==x.start?" to "+esc(x.end):""} · ${esc(x.venue||x.city||"")}</span><br><a href="/events/">All events</a> · <button type="button" class="linkbtn" data-evgo="${esc(x.id)}">Go here</button>`;
    L.marker([x.lat,x.lon],{icon:L.divIcon({className:"",html:`<div class="evmk" title="${esc(x.name)}">🏁</div>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:650}).bindTooltip(x.name).bindPopup(html).addTo(layer); });
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-evgo]"); if(!b) return; const x=(evList||[]).find(f=>f.id===b.dataset.evgo); if(!x) return; map.closePopup(); setFinish(pt(x.venue||x.name,x.lat,x.lon)); });
const ADV_PICKS=["swartberg-loop","die-hel","namibia-2020-tortoise"];
function pickExtra(){ const s=$("pickextra"); if(!s||!pickMode) return;
  if(pickMode==="adventure"){ fetch("/data/picks/picks.json").then(r=>r.json()).then(j=>{ const L=ADV_PICKS.map(id=>j.routes.find(r=>r.id===id)).filter(Boolean); if(!L.length) return;
      s.querySelector("h3").textContent="Ready to ride"; s.querySelector(".pxcards").innerHTML=L.map(r=>`<a href="/routes/${esc(r.id)}/"><b>${esc(r.title)}</b><span>${esc(r.region||"")}</span><i>See the route ›</i></a>`).join(""); s.hidden=false; }).catch(()=>{}); }
  else s.hidden=true; } // Motorsport: the next races are in Coming up
function setPick(md,user){
  pickMode=md==="motorsport"?"motorsport":"adventure"; try{ localStorage.setItem("otm-pick",pickMode); }catch(e){}
  document.documentElement.setAttribute("data-pick",pickMode);
  document.querySelectorAll(".pbox").forEach(b=>{ const on=b.dataset.pick===pickMode; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
  pickExtra();
  if(!user) return;
  let reroute=false;
  if(!settings.styleSet){ const want=pickMode==="motorsport"?"tar":"rough"; if(settings.style!==want){ settings.style=want; if($("style")) $("style").value=want; store.set("rr2-settings",settings); showStyle(); reroute=true; } }
  ui.lay.moto=pickMode==="motorsport"; if(pickMode==="motorsport"){ ui.lay.fav=true; } try{ renderLayers(); }catch(e){}
  try{ reroute&&trip.start&&trip.start.lat!=null?recalc():drawMap(); }catch(e){}
  const t=$("toast"); if(t){ t.innerHTML=pickMode==="motorsport"?"<b>Motorsport:</b> the quick way, with tracks, museums, factories and upcoming events on the map. Set where you start and where you're going.":"<b>Adventure:</b> the road less travelled, graded for what you ride. Set where you start and where you're going."; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,9000); }
  const mp=$("map"); if(mp) mp.scrollIntoView({behavior:"smooth",block:"start"});
}
document.querySelectorAll(".pbox").forEach(b=>b.addEventListener("click",()=>setPick(b.dataset.pick,true)));
{ let s=null; try{ s=localStorage.getItem("otm-pick"); }catch(e){} if(s) setPick(s,false); }

/* Coming up on the landing page: the next races and festivals, filtered by where (remembered), followed series first */
var evRegSel=null;
// Seasonal campaigns (data/campaigns.json): Christmas, Father's Day, long weekends, the new year's calendar. Two at most, gifts and long weekends first.
var campList=null;
function drawCampaigns(){ const b=$("ev2027"); if(!b) return;
  if(!campList){ campList=[]; fetch("/data/campaigns.json").then(r=>r.ok?r.json():{campaigns:[]}).then(j=>{ campList=j.campaigns||[]; drawCampaigns(); }).catch(()=>{}); return; }
  const t=ymd(new Date()), K={gift:0,longweekend:1,holiday:2,experience:3,booking:4};
  const L=campList.filter(c=>!c.hidden&&c.from<=t&&c.to>=t).sort((a,b)=>(K[a.kind]??5)-(K[b.kind]??5)).slice(0,2);
  b.innerHTML=L.map(c=>`<div class="camp"><b>${esc(c.title)}.</b> ${esc(c.line)} <a href="${esc(c.link)}">${esc(c.cta)} ›</a></div>`).join("");
}
// Two views: Book ahead (1 to 6 months out: when people actually decide) and This month. The big ones get bigger cards.
var evView=null;
function drawComing(){ const u=$("evNext"), r=$("evRegs"), v=$("evView"); if(!u||!evList) return;
  if(evRegSel===null){ try{ evRegSel=localStorage.getItem("otm-evcome")||""; }catch(e){ evRegSel=""; } }
  if(evView===null){ try{ evView=localStorage.getItem("otm-evview")||"ahead"; }catch(e){ evView="ahead"; } }
  const t=ymd(new Date()), my=mySeries(), M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const reg=typeof EVT_REG!=="undefined"?EVT_REG:[];
  if(v) v.innerHTML=[["ahead","Book ahead"],["soon","This month"]].map(([k,n])=>`<button type="button" data-evview="${k}" class="${k===evView?"on":""}">${n}</button>`).join("");
  r.innerHTML=[["","Everywhere"],...reg.map(x=>[x[0],x[1].replace(" and the UK","").replace(", Canada and Mexico","").replace(" and Australia","")])].map(([k,n])=>`<button type="button" data-evcome="${k}" class="${k===evRegSel?"on":""}">${esc(n)}</button>`).join("");
  const inReg=e=>!evRegSel||evtRegion(e.country)===evRegSel, a30=addDays(t,30), a183=addDays(t,183);
  let L;
  if(evView==="ahead"){ // the big ones first, then fill with championship rounds, in date order
    const pool=evList.filter(e=>e.start>=a30&&e.start<=a183&&inReg(e));
    const pick=[...pool.filter(e=>e.tier===1),...pool.filter(e=>e.tier===2&&my.includes(e.series)),...pool.filter(e=>e.tier===2),...pool.filter(e=>e.tier===3)];
    L=[...new Map(pick.map(e=>[e.id,e])).values()].slice(0,12).sort((a,b)=>a.start.localeCompare(b.start));
  } else L=evList.filter(e=>e.end>=t&&e.start<=a30&&inReg(e)).sort((a,b)=>a.start.localeCompare(b.start)||(a.tier||2)-(b.tier||2)).slice(0,12);
  u.innerHTML=L.length?L.map(e=>{ const d=new Date(e.start+"T12:00:00"), live=e.start<=t, tier=e.tier||2;
    return `<a class="evcard t${tier}" href="/events/${esc(e.id)}/"><span class="evdate"><b>${d.getDate()}</b><i>${M[d.getMonth()]}${d.getFullYear()!==new Date().getFullYear()?" "+String(d.getFullYear()).slice(2):""}</i></span><span>${e.genre?`<span class="eg">${esc(genreName(e.genre))}</span>`:""}<span class="en">${esc(e.name.replace(/\s*\(.*?\)/g,"").replace(/\s+20\d\d$/,""))}${my.includes(e.series)?" ★":""}</span><span class="ew">${esc(e.city||e.venue||"")}, ${esc(e.country||"")}${e.confirmed?"":" · to confirm"}</span>${live?`<span class="ef">On now</span>`:tier===1&&e.tickets?`<span class="ef">Tickets on sale. Book early ›</span>`:""}</span></a>`; }).join(""):`<p class="note">Nothing ${evView==="ahead"?"in the next six months":"this month"} there yet.</p>`;
  drawCampaigns();
}
loadEvents().then(drawComing);
document.addEventListener("click",e=>{ const v=e.target.closest&&e.target.closest("[data-evview]"); if(!v) return; evView=v.dataset.evview; try{ localStorage.setItem("otm-evview",evView); }catch(x){} drawComing(); });
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-evcome]"); if(!b) return; evRegSel=b.dataset.evcome; try{ localStorage.setItem("otm-evcome",evRegSel); }catch(x){} drawComing(); });

/* On your dates: races and festivals near the route while you're travelling (Motorsport looks further afield) */
var evDatesAsked=false;
function onDatesHtml(){
  if(!trip.startDate||!trip.start||trip.start.lat==null) return "";
  if(!evList){ if(!evDatesAsked){ evDatesAsked=true; loadEvents().then(()=>{ if(ui.tab==="ov") renderDetails(); }); } return ""; }
  const a=addDays(trip.startDate,-3), b=addDays(trip.endDate||trip.startDate,3), far=pickMode==="motorsport"?300:120;
  const pts=[]; if(plan&&plan.geom){ const g=plan.geom, st=Math.max(1,Math.floor(g.length/400)); for(let i=0;i<g.length;i+=st) pts.push(g[i]); }
  else { [trip.start,trip.end,...trip.days.flatMap(d=>[d.to,...(d.vias||[])])].forEach(p=>{ if(p&&p.lat!=null) pts.push(p); }); }
  const near=e=>{ let m=1e9; for(const p of pts){ if(Math.abs(p.lat-e.lat)>4) continue; const d=hav(p,e); if(d<m) m=d; } return m; };
  const L=evList.filter(e=>e.end>=a&&e.start<=b).map(e=>Object.assign({},e,{km:near(e)})).filter(e=>e.km<=far).sort((x,y)=>x.start.localeCompare(y.start)).slice(0,5);
  if(!L.length) return "";
  const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  return `<div class="ondates"><h3>🏁 On your dates</h3><ul>${L.map(e=>`<li><span><b>${esc(e.name)}</b> · ${fmt(e.start)}${e.end!==e.start?"–"+fmt(e.end):""}${e.confirmed?"":" (dates unconfirmed)"}<br><span class="note">${esc(e.venue||e.city||"")} · ${e.km<5?"on your route":Math.round(e.km)+" km off your route"}</span></span><span><button type="button" class="linkbtn" data-evgo="${esc(e.id)}">Make it the finish</button> · <a href="${esc(e.tickets||e.url||"/events/")}" target="_blank" rel="noopener">Tickets ›</a></span></li>`).join("")}</ul></div>`;
}

/* Fly part of it: when the start and finish are far apart (or across the sea), offer flights and a car at the far end */
function flightHtml(){
  const s=trip.start, e=trip.end; if(!s||!e||s.lat==null||e.lat==null) return "";
  const km=hav(s,e), noRoad=!plan||(plan&&plan.error);
  if(km<1500&&!(noRoad&&km>300)) return "";
  const when=trip.startDate||"", q=`Flights from ${s.name==="My location"?"my nearest airport":s.name} to ${e.name}${when?" on "+when:""}`;
  return `<div class="ondates flycard"><h3>✈ Fly part of it</h3><p class="note">${e.name} is about ${Math.round(km).toLocaleString("en-ZA")} km away${noRoad?" and there may be no road all the way":""}. Fly the long bit, then ride or drive the good part.</p><div class="btns"><a class="btn small" href="https://www.google.com/travel/flights?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">Find flights ↗</a><a class="btn small ghost" href="${esc(carHireUrl(e.name))}" target="_blank" rel="sponsored noopener">Hire a car at ${esc(e.name)} ↗</a></div></div>`;
}
