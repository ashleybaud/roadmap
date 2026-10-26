/* ---------- OneTrackMind picks: real routes we rate, as ready-made trips ---------- */
let picks=null;
async function openPicks(){
  $("picksDlg").showModal();
  if(!picks){ $("pkList").innerHTML=`<div class="note">Loading…</div>`; try{ picks=(await (await fetch("/data/picks/picks.json")).json()).routes; }catch(e){ $("pkList").innerHTML=`<div class="errmsg">Couldn't load the picks. Check your connection.</div>`; return; } }
  const mine=settings.vehicle||"bike";
  const list=picks.slice().sort((a,b)=>(b.vehicles.includes(mine)-a.vehicles.includes(mine)));
  $("pkList").innerHTML=list.map(r=>{ const n=r.trip.days.length, fits=r.vehicles.includes(mine);
    return `<div class="rrow pk"><div><div class="rt">${esc(r.title)}</div><div class="note">${esc(r.region)} · ${n} day${n>1?"s":""} · ${r.vehicles.map(v=>esc((VEHICLES[v]||"").replace(/^\S+\s/,""))).join(", ")}</div><div class="pkb">${esc(r.blurb)}</div>${fits?"":`<div class="warnt">Not suggested for a ${esc((VEHICLES[mine]||"").replace(/^\S+\s/,"").toLowerCase())}.</div>`}</div>
      <div class="ract"><button class="btn small" type="button" data-pkopen="${esc(r.id)}">Open</button></div></div>`; }).join("");
}
$("picksDlg").addEventListener("click",e=>{
  if(e.target===$("picksDlg")||e.target.closest("[data-pkclose]")){ $("picksDlg").close(); return; }
  const o=e.target.closest("[data-pkopen]"); if(!o) return; const r=picks.find(x=>x.id===o.dataset.pkopen); if(!r) return;
  $("picksDlg").close();
  const t=JSON.parse(JSON.stringify(r.trip)); t.sugV=4; t.days.forEach(d=>{ d.fresh=true; d.legs=d.legs||[]; d.vias=d.vias||[]; d.style=d.style||"default"; });
  t.pick=r.id; applyTrip(t,{style:r.style},r.title);
});
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-picks]")) openPicks(); });
