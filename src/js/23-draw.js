/* ---------- Draw: technical riders build the day point to point on the map ----------
   Each tap adds the next point at the end of the day (before its night stop or finish), in the order tapped.
   "Follow roads" routes to it on the road choice; "Straight line" draws a straight stretch for tracks the map doesn't know. */
let drawOn=false, drawLine=false;
function drawDay(){ const c=curDay(); return c!=null?c:nDays()-1; }
function drawStrip(){ $("drawStrip").hidden=!drawOn; $("tbDraw").classList.toggle("on",drawOn); if(drawOn) $("dwDay").textContent=nDays()>1?dayName(drawDay()):"";
  $("dwMode").querySelectorAll("button").forEach(b=>b.classList.toggle("on",(b.dataset.dw==="line")===drawLine));
  const d=trip.days[drawDay()]; $("dwUndo").disabled=!(d&&d.vias.some(v=>v.drawn)); }
function drawStart(){
  if(!trip.start||trip.start.lat==null){ $("status").textContent="Pick where you start first, then draw from there."; return; }
  if(typeof nearOff==="function") nearOff(); drawOn=true; drawStrip(); map&&map.closePopup();
  $("status").textContent="Drawing: tap the map, point to point. Straight line is for tracks the map doesn't show.";
  if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"});
}
function drawStop(){ drawOn=false; drawStrip(); $("status").textContent="Done drawing. Tap ✏ Draw to carry on."; }
function drawAdd(e){
  if(!drawOn) return; const k=drawDay(), d=trip.days[k]; if(!d) return;
  const ll={lat:e.latlng.lat,lon:e.latlng.lng}, p=tapName(ll); p.drawn=true; if(p.name==="Point on the map"||/^Near /.test(p.name)) p.name=`Point ${d.vias.filter(v=>v.drawn).length+1}${p.name.startsWith("Near ")?" "+p.name.toLowerCase():""}`;
  const pts=[dayFrom(k),...d.vias], prev=pts[pts.length-1];
  if(prev&&hav(prev,p)<0.05){ $("status").textContent="That's on top of the last point. Tap a bit further on."; return; }
  if(drawLine) p.straight=true; // the stretch into this point is a straight line (a track the map doesn't know)
  const n=d.vias.length; d.vias.push(p); if(d.legs.length>n) d.legs.splice(n,0,undefined);
  $("status").textContent=`${p.name} added${drawLine?" (straight line)":""}. Working out the route…`; changed(); drawStrip();
}
function drawUndo(){ const k=drawDay(), d=trip.days[k]; if(!d) return; let i=-1; d.vias.forEach((v,j)=>{ if(v.drawn) i=j; }); if(i<0) return;
  const v=d.vias.splice(i,1)[0]; if(d.legs.length>i) d.legs.splice(i,1); $("status").textContent=`Removed ${v.name}.`; changed(); drawStrip(); }
$("tbDraw").addEventListener("click",()=>drawOn?drawStop():drawStart());
$("dwDone").addEventListener("click",drawStop); $("dwUndo").addEventListener("click",drawUndo);
$("dwMode").addEventListener("click",e=>{ const b=e.target.closest("[data-dw]"); if(!b) return; drawLine=b.dataset.dw==="line"; drawStrip(); });
// while drawing, a tap adds a point instead of opening the "add a stop / sleep here" box
{ let hooked=false; const hook=()=>{ if(map&&!hooked){ map.on("click",drawAdd); hooked=true; } };
  const _em=ensureMap; ensureMap=function(){ _em(); hook(); }; hook(); }
document.addEventListener("keydown",e=>{ if(!drawOn) return; if(e.key==="Escape") drawStop(); if((e.ctrlKey||e.metaKey)&&e.key==="z"){ e.preventDefault(); drawUndo(); } });
