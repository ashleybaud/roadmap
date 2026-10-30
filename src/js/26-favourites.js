/* ---------- Founder's fav's in the planner: /?fav=<id> sets it as your finish; a map layer shows them all ---------- */
var favList=null; // var: drawMap can run before this file does
function loadFavs(){ return favList?Promise.resolve(favList):fetch("/data/favourites/favourites.json").then(r=>r.ok?r.json():[]).then(j=>favList=j).catch(()=>favList=[]); }
/* Take me there to somewhere overseas: it's a flight first, so the road trip starts at the airport you'd land at */
async function farStart(dest,ev){
  if(!dest||dest.lat==null||hav({lat:-29,lon:24},dest)<2500) return false;
  try{ await window.otmAirP; }catch(e){}
  const a=typeof OTMtrip!=="undefined"&&OTMtrip.airport(dest.lat,dest.lon); if(!a||a.lat==null) return false;
  trip.start=pt(a.name+" airport ("+a.iata+")",a.lat,a.lon);
  /* a short drive from the airport: one day, the day before the event if there is one */
  const today=new Date().toISOString().slice(0,10); if(ev&&ev.start){ const d=addDays(ev.start,-1); trip.startDate=d>today?d:today; }
  trip.endDate=trip.startDate; trip.daysSet=true; syncDays(); changed();
  const t=$("toast"); t.innerHTML=`It's a flight first, so the road trip starts at <b>${esc(a.name)} airport (${esc(a.iata)})</b>. Flights, beds and a hire car are under <b>Make a trip of it</b>, below the plan.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,20000);
  return true;
}
{ const m=location.search.match(/[?&]fav=([\w-]+)/), go=/[?&]go=1/.test(location.search); if(m){ history.replaceState(null,"",location.pathname);
  setTimeout(async()=>{ const x=(await loadFavs()).find(f=>f.id===m[1]); if(!x) return;
    try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
    snapTrip(true); trip.end=pt(x.name,x.lat,x.lon); trip.round=false; trip.days.forEach(d=>{ d.vias=[]; d.legs=[]; d.to=null; delete d.noAutoNight; });
    if(trip.start&&trip.start.lat!=null&&hav(trip.start,x)<1) trip.start=pt("My location",null,null);
    changed();
    const t=$("toast"); t.innerHTML=`Finish set to <b>${esc(x.name)}</b>. Now set where you start (tap ⌖ or type a town) and your dates.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,15000);
    if(go){ /* "Take me there" from the newsletter: route from where you are, with the High Octane places and Founder's fav's along the way */
      ui.lay.moto=true; ui.lay.fav=true; ui.lay.sights=true; saveUi(); renderLayers(); renderAll();
      if(await farStart(trip.end)) return;
      if(!trip.start||trip.start.lat==null){ t.innerHTML=`Routing you to <b>${esc(trip.end.name)}</b> from where you are. Racing places and POI along the way are on the map.`; useMyLocation(); return; } }
    if(!trip.start||trip.start.lat==null) $("startPlace").focus();
  },300); } }
function drawFavs(){
  if(!favList){ setTimeout(()=>loadFavs().then(()=>{ if(favList.length) drawMap(); }),0); return; } // later: this can run before the rest of this file has
  // with a trip planned, only the ones near your route (within 50 km); with no trip, all of them to browse
  const g=plan&&plan.geom, near=x=>{ if(!g) return true; for(let i=0;i<g.length;i+=Math.max(1,Math.floor(g.length/1500))) if(Math.abs(g[i].lat-x.lat)<0.6&&hav(g[i],x)<=50) return true; return false; };
  favList.filter(near).forEach(x=>{ const html=`<b>${esc(x.name)}</b><br><span class="note">POI · ${esc(x.area)}</span><br>${esc(x.short)}<br><a href="/favourites/${x.id}/">Read about it</a> · <button type="button" class="linkbtn" data-favgo="${x.id}">Take me there</button>`;
    L.marker([x.lat,x.lon],{icon:L.divIcon({className:"",html:`<div class="favmk" title="${esc(x.name)}">♥</div>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:700}).bindTooltip(x.name).bindPopup(html).addTo(layer); });
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-favgo]"); if(!b) return; const x=(favList||[]).find(f=>f.id===b.dataset.favgo); if(!x) return; map.closePopup(); setFinish(pt(x.name,x.lat,x.lon)); });

/* /?ev=<id>: set an event's venue as the finish */
{ const m=location.search.match(/[?&]ev=([\w-]+)/), go=/[?&]go=1/.test(location.search); if(m){ history.replaceState(null,"",location.pathname);
  setTimeout(async()=>{ let L=[]; try{ L=await (await fetch("/data/events/events.json")).json(); }catch(e){} const x=L.find(f=>f.id===m[1]); if(!x) return;
    try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
    if(!settings.styleSet&&settings.style!=="tar"){ settings.style="tar"; if($("style")) $("style").value="tar"; store.set("rr2-settings",settings); showStyle(); } /* an event trip starts on main roads */
    snapTrip(true); trip.end=pt(x.venue||x.name,x.lat,x.lon); trip.round=false; trip.days.forEach(d=>{ d.vias=[]; d.legs=[]; d.to=null; delete d.noAutoNight; });
    if(trip.start&&trip.start.lat!=null&&hav(trip.start,x)<1) trip.start=pt("My location",null,null);
    changed();
    const t=$("toast"); t.innerHTML=`Finish set to <b>${esc(x.name)}</b> (${esc(x.start)}). Now set where you start and arrive by then.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,15000);
    if(go){ /* "Take me there" from the newsletter: route from where you are, with the High Octane places and Founder's fav's along the way */
      ui.lay.moto=true; ui.lay.fav=true; ui.lay.sights=true; saveUi(); renderLayers(); renderAll();
      if(await farStart(trip.end,x)) return;
      if(!trip.start||trip.start.lat==null){ t.innerHTML=`Routing you to <b>${esc(trip.end.name)}</b> from where you are. Racing places and POI along the way are on the map.`; useMyLocation(); return; } }
    if(!trip.start||trip.start.lat==null) $("startPlace").focus();
  },300); } }

/* /?poi=lat,lon&n=<name>: route from where you are to a place from the blog or Instagram */
{ const m=location.search.match(/[?&]poi=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/), go=/[?&]go=1/.test(location.search); if(m){ const nm=(location.search.match(/[?&]n=([^&]*)/)||[])[1]; history.replaceState(null,"",location.pathname);
  setTimeout(async()=>{ const lat=+m[1], lon=+m[2], name=nm?decodeURIComponent(nm.replace(/\+/g," ")).slice(0,80):"The place";
    if(!isFinite(lat)||!isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return;
    try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
    snapTrip(true); trip.end=pt(name,lat,lon); trip.round=false; trip.days.forEach(d=>{ d.vias=[]; d.legs=[]; d.to=null; delete d.noAutoNight; });
    if(trip.start&&trip.start.lat!=null&&hav(trip.start,{lat,lon})<1) trip.start=pt("My location",null,null);
    changed();
    const t=$("toast"); t.innerHTML=`Finish set to <b>${esc(name)}</b>. Tap ⌖ to start from where you are, or type a town.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,15000);
    if(go){ /* "Take me there" from the newsletter: route from where you are, with the High Octane places and Founder's fav's along the way */
      ui.lay.moto=true; ui.lay.fav=true; ui.lay.sights=true; saveUi(); renderLayers(); renderAll();
      if(await farStart(trip.end)) return;
      if(!trip.start||trip.start.lat==null){ t.innerHTML=`Routing you to <b>${esc(trip.end.name)}</b> from where you are. Racing places and POI along the way are on the map.`; useMyLocation(); return; } }
    if(!trip.start||trip.start.lat==null) $("startPlace").focus();
  },300); } }

/* /plan/?to=<place>[&from=<place>]: the Plan a trip bar on the home page. The place is looked up the same way as typing it here. */
{ const q=new URLSearchParams(location.search), to=(q.get("to")||"").trim().slice(0,80), fr=(q.get("from")||"").trim().slice(0,80);
  if(to){ history.replaceState(null,"",location.pathname);
    setTimeout(async()=>{ try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
      const hv=homeView()[0], c={lat:hv[0],lng:hv[1]};
      const find=async t=>{ const r=await searchPlaces(t,c); return r&&r[0]?pt(r[0].name,r[0].lat,r[0].lon):null; };
      const ll=(q.get("tll")||"").split(",").map(Number), fl=(q.get("fll")||"").split(",").map(Number);
      const dest=ll.length===2&&ll.every(isFinite)&&ll[0]?pt(to,ll[0],ll[1]):await find(to); if(!dest){ $("status").textContent=`Couldn't find "${to}". Type it in Where to?`; return; }
      snapTrip(true); trip.end=dest; trip.round=false; trip.days.forEach(d=>{ d.vias=[]; d.legs=[]; d.to=null; delete d.noAutoNight; });
      if((!fr||/^my location$/i.test(fr))&&await farStart(dest)) return;
      if(fr&&!/^my location$/i.test(fr)){ const st=fl.length===2&&fl.every(isFinite)&&fl[0]?pt(fr,fl[0],fl[1]):await find(fr); if(st) trip.start=st; }
      else if(!trip.start||trip.start.lat==null||hav(trip.start,dest)<1) trip.start=pt("My location",null,null);
      changed();
      const t=$("toast"); t.innerHTML=`Going to <b>${esc(dest.name)}</b>.${trip.start&&trip.start.lat!=null?"":" Tap ⌖ to start from where you are, or type a town."}`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,12000);
      if(!trip.start||trip.start.lat==null) $("startPlace").focus();
    },300); } }
