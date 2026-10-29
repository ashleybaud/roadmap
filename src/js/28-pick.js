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
function setPick(md,user){
  pickMode=md==="motorsport"?"motorsport":"adventure"; try{ localStorage.setItem("otm-pick",pickMode); }catch(e){}
  document.documentElement.setAttribute("data-pick",pickMode);
  document.querySelectorAll(".pbox").forEach(b=>{ const on=b.dataset.pick===pickMode; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
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
