/* ---------- phone navigation: Google Maps (whole day, with shaping points) and Waze (stop by stop) ---------- */
/* Google Maps app takes origin + 9 waypoints + destination per link. Longer days split into parts.
   Shaping points between the stops keep Google on our roads; it still picks the road between points. */
const GM_MAX=11;
const ll=p=>`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
function gmParts(k){
  const gd=gpxDay(k); if(!gd) return [];
  const pts=gd.rte, stops=pts.map((p,i)=>p.n?i:-1).filter(i=>i>=0), parts=[];
  let s=0; // index into stops
  while(s<stops.length-1){
    const e=Math.min(stops.length-1,s+GM_MAX-1), a=stops[s], b=stops[e];
    const fixed=stops.slice(s,e+1), shape=[]; for(let i=a+1;i<b;i++) if(!pts[i].n) shape.push(i);
    const room=GM_MAX-fixed.length, pick=[];
    for(let j=1;j<=room&&shape.length;j++){ const i=shape[Math.round(j*(shape.length+1)/(room+1))-1]; if(i!=null&&!pick.includes(i)) pick.push(i); }
    const idx=[...fixed,...pick].sort((x,y)=>x-y), mid=idx.slice(1,-1).map(i=>ll(pts[i]));
    parts.push({from:pts[a].n,to:pts[b].n,url:`https://www.google.com/maps/dir/?api=1&origin=${ll(pts[a])}&destination=${ll(pts[b])}${mid.length?"&waypoints="+mid.join("%7C"):""}&travelmode=driving`});
    s=e;
  }
  return parts;
}
function wazeStops(k){
  const gd=gpxDay(k); if(!gd) return [];
  const kmOf=p=>{ let best=null,bd=1e9; gd.rte.forEach(r=>{ const d=hav(r,p); if(d<bd){bd=d;best=r.km;} }); return best||0; };
  return gd.w.map(p=>({...p,km:kmOf(p)})).sort((a,b)=>a.km-b.km)
    .map(p=>({name:p.n,fuel:p.s==="Gas Station",url:`https://waze.com/ul?ll=${ll(p)}&navigate=yes`}));
}
function navButtons(k){
  const g=gmParts(k), w=wazeStops(k); if(!g.length) return "";
  return `${g.map((p,i)=>`<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.from)} to ${esc(p.to)}">Google Maps${g.length>1?` ${i+1}/${g.length}`:""}</a>`).join("")}`
    +`<details class="wazebox"><summary class="btn small ghost">Waze ▾</summary><div class="wazelist">${w.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${s.fuel?"⛽ ":""}${esc(s.name)}</a>`).join("")}<span class="note">Waze takes one stop at a time. Tap the next one when you get there.</span></div></details>`;
}
function navText(){
  if(!plan) return "";
  return plan.days.map((d,k)=>{ if(!d) return ""; const g=gmParts(k), w=wazeStops(k);
    return `${dayName(k)}\nGoogle Maps:\n${g.map((p,i)=>`  ${g.length>1?`Part ${i+1}: `:""}${p.from} to ${p.to}\n  ${p.url}`).join("\n")}\nWaze, stop by stop:\n${w.map(s=>`  ${s.name}: ${s.url}`).join("\n")}\n`; }).filter(Boolean).join("\n");
}
function navHtml(){
  const days=plan.days.map((d,k)=>{ if(!d) return ""; const g=gmParts(k), w=wazeStops(k);
    return `<h2>${esc(dayName(k))}</h2><p>${g.map((p,i)=>`<a class="gm" href="${esc(p.url)}">Google Maps${g.length>1?` part ${i+1}`:""}: ${esc(p.from)} to ${esc(p.to)}</a>`).join("")}</p><p class="w">Waze, one stop at a time:</p><ul>${w.map(s=>`<li><a href="${esc(s.url)}">${s.fuel?"⛽ ":""}${esc(s.name)}</a></li>`).join("")}</ul>`; }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(trip.start.name)} trip: phone navigation</title>
<style>body{font:17px/1.45 system-ui,sans-serif;margin:0 auto;max-width:640px;padding:16px;background:#fff;color:#111}h1{font-size:1.4rem}h2{font-size:1.15rem;margin:22px 0 6px}a.gm{display:block;padding:12px 14px;margin:6px 0;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600}.w{margin:10px 0 2px;color:#555}li{margin:6px 0}small{color:#666}</style></head>
<body><h1>${esc(trip.start.name)}, ${esc(trip.startDate)}: phone navigation</h1><p><small>Open this on your phone. Google Maps opens each day with its stops, Waze one stop at a time. They pick their own roads between points; for the exact line, load the GPX into your GPS or OsmAnd, Calimoto or Kurviger.</small></p>${days}<p><small>Planned with OneTrackMind: https://onetrackmind.online. Roads change. Check conditions before you go.</small></p></body></html>`;
}
function openNavDlg(){
  if(!plan||planStale){ $("status").textContent="Plan the trip first."; return; }
  $("navBody").innerHTML=plan.days.map((d,k)=>d?`<div class="navday"><span class="lbl">${esc(dayName(k))}</span><div class="btns">${navButtons(k)}</div></div>`:"").join("");
  $("navDlg").showModal();
}
document.addEventListener("click",e=>{ document.querySelectorAll(".wazebox[open]").forEach(x=>{ if(!x.contains(e.target)) x.open=false; }); });
document.addEventListener("click",e=>{
  const t=e.target.closest&&e.target; if(!t) return;
  if(t.closest("[data-navlinks]")){ openNavDlg(); return; }
  if(t.closest("[data-navclose]")){ $("navDlg").close(); return; }
  if(t.closest("[data-navshare]")){ const txt=navText();
    if(navigator.share) navigator.share({title:"Trip navigation",text:txt}).catch(()=>{});
    else (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{ $("status").textContent="Links copied. Paste them into WhatsApp or a note."; },()=>{});
    return; }
  if(t.closest("[data-navfile]")){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([navHtml()],{type:"text/html"})); a.download=`Phone-navigation-${trip.start.name}-${trip.startDate}`.replace(/[^\w]+/g,"-")+".html"; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000); return; }
});
/* returning riders with a trip on the go: on phones the hero shrinks to its headline so the planner is in view */
try{ if(trip&&trip.start&&trip.start.lat!=null) document.body.classList.add("hastrip"); }catch(e){}
