/* ---------- Find a route: OneTrackMind picks, routes riders shared, and how to add yours ---------- */
let picks=null, pkTab="picks";
async function loadPicks(){
  const drafts=/[?&]drafts=1/.test(location.search)||acct.admin;
  const list=(await (await fetch("/data/picks/picks.json")).json()).routes.filter(r=>!r.draft||drafts).map(r=>Object.assign(r,{kind:"pick"}));
  if(acct.ready) try{ ((await api("/api/routes/public")).routes||[]).forEach(r=>list.push({id:"db:"+r.id,dbId:r.id,kind:r.pick?"pick":"rider",title:r.title,region:r.pick?"OneTrackMind pick":"Shared by a rider",blurb:r.summary||"",vehicles:r.vehicle?[r.vehicle]:["bike","jeep","car"],trip:{days:new Array(r.days||1)},stars:r.stars,ratings:r.ratings})); }catch(e){}
  return list;
}
async function openPicks(tab){
  pkTab=tab||pkTab||"picks"; if(!$("picksDlg").open) $("picksDlg").showModal(); renderPkTabs();
  if(pkTab==="add"){ $("pkList").innerHTML=`<div class="addgrid"><button type="button" class="addcard" data-addroute><b>Add a route</b><span>Plan it here or load a GPX file, save it, then share it. We check it before other riders see it.</span></button><button type="button" class="addcard" data-addspot><b>Mark a place</b><span>A viewpoint, farm stall, coffee stop, bike-friendly stay, workshop.</span></button></div>`; return; }
  if(!picks){ $("pkList").innerHTML=`<div class="note">Loading…</div>`; try{ picks=await loadPicks(); }catch(e){ $("pkList").innerHTML=`<div class="errmsg">Couldn't load the routes. Check your connection.</div>`; return; } }
  const mine=settings.vehicle||"bike", vn=v=>(VEHICLES[v]||"").replace(/^\S+\s/,"");
  const list=picks.filter(r=>r.kind===(pkTab==="riders"?"rider":"pick")).sort((a,b)=>(b.vehicles.includes(mine)-a.vehicles.includes(mine)));
  $("pkList").innerHTML=list.length?list.map(r=>{ const n=r.trip.days.length, fits=r.vehicles.includes(mine);
    return `<div class="rrow pk"><div><div class="rt">${esc(r.title)}${r.draft?` <span class="drafttag">Draft</span>`:""}</div>${r.founder?`<div class="fdr">Ridden by the founder${r.founder.year?` · ${r.founder.year}`:""} · ${esc(r.founder.ride)}</div>`:""}<div class="note">${esc(r.region)} · ${n} day${n>1?"s":""} · ${r.vehicles.map(v=>esc(vn(v))).join(", ")}${r.ratings?` · ★ ${r.stars} (${r.ratings})`:""}</div>${r.blurb?`<div class="pkb">${esc(r.blurb)}</div>`:""}${fits?"":`<div class="warnt">Not suggested for a ${esc(vn(mine).toLowerCase())}.</div>`}</div>
      <div class="ract"><button class="btn small" type="button" data-pkopen="${esc(r.id)}">Open</button></div></div>`; }).join("")
    :pkTab==="riders"?`<div class="note">No rider routes shared yet. Be the first: plan a road you love, save it and share it.</div><div class="btns"><button class="btn small" type="button" data-pktab="add">Add yours</button></div>`:`<div class="note">Nothing here yet.</div>`;
}
function renderPkTabs(){ document.querySelectorAll("[data-pktab]").forEach(b=>b.classList.toggle("on",b.dataset.pktab===pkTab)); }
$("picksDlg").addEventListener("click",e=>{
  if(e.target===$("picksDlg")||e.target.closest("[data-pkclose]")){ $("picksDlg").close(); return; }
  const tb=e.target.closest("[data-pktab]"); if(tb){ openPicks(tb.dataset.pktab); return; }
  const o=e.target.closest("[data-pkopen]"); if(!o) return; const r=picks.find(x=>x.id===o.dataset.pkopen); if(!r) return;
  $("picksDlg").close();
  if(r.dbId){ openRoute(r.dbId); return; }
  openPick(r);
});
function openPick(r){
  const t=JSON.parse(JSON.stringify(r.trip)); t.sugV=5; t.days.forEach(d=>{ d.fresh=true; d.legs=d.legs||[]; d.vias=d.vias||[]; d.style=d.style||"default"; });
  t.pick=r.id; if(r.founder) t.founder={year:r.founder.year,ride:r.founder.ride,url:(r.founder.posts[0]||{}).u||"",page:r.draft?"":"/routes/"+r.id+"/",tips:r.founder.tips||[]};
  applyTrip(t,{style:r.style},r.title);
}
// the founder's note on a trip opened from his picks
function founderLine(){
  const f=trip.founder; if(!f) return "";
  return `<div class="fdrbox"><b>Ridden by the founder${f.year?" in "+f.year:""}</b> · ${esc(f.ride)}${f.tips&&f.tips.length?`<ul>${f.tips.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}<div>${f.page?`<a href="${esc(f.page)}">About this route</a> · `:""}${f.url?`<a href="${esc(f.url)}" target="_blank" rel="noopener">Read the story on onetrackmind.co.za</a>`:""}</div></div>`;
}
// /?pick=<id> opens that pick (links from the route pages)
{ const m=location.search.match(/[?&]pick=([\w-]+)/); if(m){ history.replaceState(null,"",location.pathname+(/[?&]drafts=1/.test(location.search)?"?drafts=1":""));
  setTimeout(async()=>{ try{ picks=picks||await loadPicks(); const r=picks.find(x=>x.id===m[1]); if(r) openPick(r); }catch(e){} },300); } }
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-picks]")) openPicks("picks"); });
