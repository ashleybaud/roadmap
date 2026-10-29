/* ---------- Adventure or Motorsport: the two boxes at the top ----------
   Adventure: the road less travelled. Motorsport: the quick way, with tracks, museums, factories and upcoming events on the map.
   The rider's own route style in Settings always wins. The choice is remembered on this device. */
var pickMode=null, evList=null;
function loadEvents(){ return evList?Promise.resolve(evList):fetch("/data/events/events.json").then(r=>r.ok?r.json():[]).then(j=>{ const t=new Date().toISOString().slice(0,10), y=new Date(Date.now()+365*864e5).toISOString().slice(0,10); return evList=j.filter(e=>e.end>=t&&e.start<=y); }).catch(()=>evList=[]); }
function drawEvents(){
  if(pickMode!=="motorsport") return;
  if(!evList){ setTimeout(()=>loadEvents().then(()=>{ if(evList.length) drawMap(); }),0); return; }
  const g=plan&&plan.geom, near=x=>{ if(!g) return true; for(let i=0;i<g.length;i+=Math.max(1,Math.floor(g.length/1500))) if(Math.abs(g[i].lat-x.lat)<1.2&&hav(g[i],x)<=100) return true; return false; };
  const seen=new Set();
  evList.filter(near).forEach(x=>{ const k=x.lat.toFixed(2)+","+x.lon.toFixed(2); if(seen.has(k)) return; seen.add(k);
    const html=`<b>${esc(x.name)}</b><br><span class="note">${esc(x.start)}${x.end!==x.start?" to "+esc(x.end):""} · ${esc(x.venue||x.city||"")}</span><br><a href="/events/">All events</a> · <button type="button" class="linkbtn" data-evgo="${esc(x.id)}">Go here</button>`;
    L.marker([x.lat,x.lon],{icon:L.divIcon({className:"",html:`<div class="evmk" title="${esc(x.name)}">🏁</div>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:650}).bindTooltip(x.name).bindPopup(html).addTo(layer); });
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-evgo]"); if(!b) return; const x=(evList||[]).find(f=>f.id===b.dataset.evgo); if(!x) return; map.closePopup(); setFinish(pt(x.venue||x.name,x.lat,x.lon)); });
const ADV_PICKS=["swartberg-loop","die-hel","namibia-2020-tortoise"];
function pickExtra(){ const s=$("pickextra"); if(!s||!pickMode) return;
  if(pickMode==="adventure"){ fetch("/data/picks/picks.json").then(r=>r.json()).then(j=>{ const L=ADV_PICKS.map(id=>j.routes.find(r=>r.id===id)).filter(Boolean); if(!L.length) return;
      s.querySelector("h3").textContent="Ready to ride"; s.querySelector(".pxcards").innerHTML=L.map(r=>`<a href="/routes/${esc(r.id)}/"><b>${esc(r.title)}</b><span>${esc(r.region||"")}</span><i>See the route ›</i></a>`).join(""); s.hidden=false; }).catch(()=>{}); }
  else loadEvents().then(L=>{ const t=new Date().toISOString().slice(0,10), nx=L.filter(e=>e.start>=t).slice(0,3); if(!nx.length) return;
      s.querySelector("h3").textContent="Coming up"; s.querySelector(".pxcards").innerHTML=nx.map(e=>`<a href="/?ev=${esc(e.id)}"><b>${esc(e.name)}</b><span>${esc(new Date(e.start+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}))}${e.end!==e.start?" – "+esc(new Date(e.end+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})):""} · ${esc(e.city||e.venue||"")}, ${esc(e.country||"")}</span><i>Plan the trip there ›</i></a>`).join(""); s.hidden=false; }); }
function setPick(md,user){
  pickMode=md==="motorsport"?"motorsport":"adventure"; try{ localStorage.setItem("otm-pick",pickMode); }catch(e){}
  document.documentElement.setAttribute("data-pick",pickMode);
  document.querySelectorAll(".pbox").forEach(b=>{ const on=b.dataset.pick===pickMode; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
  pickExtra();
  if(!user) return;
  let reroute=false;
  if(!settings.styleSet){ const want=pickMode==="motorsport"?"tar":"rough"; if(settings.style!==want){ settings.style=want; if($("style")) $("style").value=want; store.set("rr2-settings",settings); showStyle(); reroute=true; } }
  if(pickMode==="motorsport"){ ui.lay.fav=true; }
  try{ reroute&&trip.start&&trip.start.lat!=null?recalc():drawMap(); }catch(e){}
  const t=$("toast"); if(t){ t.innerHTML=pickMode==="motorsport"?"<b>Motorsport:</b> the quick way, with tracks, museums, factories and upcoming events on the map. Set where you start and where you're going.":"<b>Adventure:</b> the road less travelled, graded for what you ride. Set where you start and where you're going."; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,9000); }
  const mp=$("map"); if(mp) mp.scrollIntoView({behavior:"smooth",block:"start"});
}
document.querySelectorAll(".pbox").forEach(b=>b.addEventListener("click",()=>setPick(b.dataset.pick,true)));
{ let s=null; try{ s=localStorage.getItem("otm-pick"); }catch(e){} if(s) setPick(s,false); }

/* Next races in the top banner */
loadEvents().then(L=>{ const u=$("evNext"); if(!u) return; const t=new Date().toISOString().slice(0,10), fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  u.innerHTML=L.filter(e=>e.start>=t).slice(0,4).map(e=>`<li><a href="/?ev=${esc(e.id)}"><b>${esc(e.name)}</b><span>${fmt(e.start)}${e.end!==e.start?"–"+fmt(e.end):""} · ${esc(e.country||"")}</span></a></li>`).join(""); });

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
