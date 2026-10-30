/* Arriving at the planner from the menu (no place named in the link):
   - a last trip still ahead: keep it, with a bar to carry on or start a new one;
   - a last trip whose dates have passed: start fresh, with a link to open the old one (it's in recent trips). */
(function(){
  const q=window.otmArriveQuery||"";
  if(/[?&](ev|fav|poi|to|s|pick|route|evtrip|mode|gpx|r)=/.test(q)) return;
  const has=trip.start&&trip.start.lat!=null&&(trip.end||trip.days.some(d=>d.to||(d.vias&&d.vias.length)));
  if(!has) return;
  const today=new Date().toISOString().slice(0,10), past=!!window.otmArriveEnd&&window.otmArriveEnd<today, label=esc([trip.start.name,trip.end&&!trip.round?trip.end.name:""].filter(Boolean).join(" → ")+" · "+trip.days.length+(trip.days.length===1?" day":" days"));
  const bar=document.createElement("div"); bar.className="lastbar"; bar.setAttribute("role","status");
  const after=$("styleBanner"); if(!after||!after.parentNode) return; after.parentNode.insertBefore(bar,after);
  const fresh=()=>{ snapTrip(true); ["gpx","pick","founder","daysSet","name"].forEach(k=>delete trip[k]); Object.assign(trip,freshTrip()); ui.tab="ov"; plan=null; fp=null; changed(); locateIfAllowed(); };
  if(past){
    const old=JSON.parse(JSON.stringify(trip)); fresh();
    bar.innerHTML=`<span>New trip. Your last one (${label}) has been and gone.</span><span class="btns"><button type="button" class="btn small ghost" data-lb="open">Open your last trip</button><button type="button" class="linkbtn" data-lb="x">Close</button></span>`;
    bar.addEventListener("click",e=>{ const b=e.target.closest("[data-lb]"); if(!b) return; if(b.dataset.lb==="open"){ old.startDate=tomorrow; old.endDate=addDays(tomorrow,old.days.length-1); Object.assign(trip,old); plan=null; fp=null; changed(); } bar.remove(); });
  } else {
    bar.innerHTML=`<span>Your last trip: <b>${label}</b></span><span class="btns"><button type="button" class="btn small" data-lb="keep">Keep going</button><button type="button" class="btn small ghost" data-lb="new">New trip</button></span>`;
    bar.addEventListener("click",e=>{ const b=e.target.closest("[data-lb]"); if(!b) return; if(b.dataset.lb==="new") fresh(); bar.remove(); });
  }
})();
