/* ---------- Founder's favourites in the planner: /?fav=<id> sets it as your finish; a map layer shows them all ---------- */
let favList=null;
const loadFavs=()=>favList?Promise.resolve(favList):fetch("/data/favourites/favourites.json").then(r=>r.ok?r.json():[]).then(j=>favList=j).catch(()=>favList=[]);
{ const m=location.search.match(/[?&]fav=([\w-]+)/); if(m){ history.replaceState(null,"",location.pathname);
  setTimeout(async()=>{ const x=(await loadFavs()).find(f=>f.id===m[1]); if(!x) return;
    try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
    snapTrip(true); trip.end=pt(x.name,x.lat,x.lon); trip.round=false; trip.days.forEach(d=>{ d.vias=[]; d.legs=[]; d.to=null; delete d.noAutoNight; });
    if(trip.start&&trip.start.lat!=null&&hav(trip.start,x)<1) trip.start=pt("My location",null,null);
    changed();
    const t=$("toast"); t.innerHTML=`Finish set to <b>${esc(x.name)}</b>. Now set where you start (tap ⌖ or type a town) and your dates.`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,15000);
    if(!trip.start||trip.start.lat==null) $("startPlace").focus();
  },300); } }
function drawFavs(){
  if(!favList){ loadFavs().then(()=>{ if(favList.length) drawMap(); }); return; }
  favList.forEach(x=>{ const html=`<b>${esc(x.name)}</b><br><span class="note">Founder's favourite · ${esc(x.area)}</span><br>${esc(x.short)}<br><a href="/favourites/${x.id}/">Read it</a> · <button type="button" class="linkbtn" data-favgo="${x.id}">Go here</button>`;
    L.marker([x.lat,x.lon],{icon:L.divIcon({className:"",html:`<div class="favmk" title="${esc(x.name)}">${x.petrol?"🏁":"★"}</div>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:700}).bindTooltip(x.name).bindPopup(html).addTo(layer); });
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-favgo]"); if(!b) return; const x=(favList||[]).find(f=>f.id===b.dataset.favgo); if(!x) return; map.closePopup(); setFinish(pt(x.name,x.lat,x.lon)); });
