/* ---------- rider reports and route ratings (need accounts switched on) ---------- */
const REP_ICON={fuel_ok:"⛽",no_fuel:"⛽",road_closed:"⛔",washaway:"🌊",bad_road:"〰",graded:"✓",roadworks:"🚧",river_high:"≈",animals:"🐄",danger:"⚠",good_stay:"🛏"};
const REP_LVL={no_fuel:"warn",road_closed:"bad",washaway:"bad",bad_road:"warn",roadworks:"info",river_high:"bad",animals:"warn",danger:"bad",fuel_ok:"info",graded:"info",good_stay:"info"};
let reps={key:"",list:[],kinds:null};
// load reports for the trip's area once per worked-out route
async function loadReports(){
  if(!acct.ready||!plan||!plan.geom.length) return;
  let s=90,w=180,n=-90,e=-180; plan.geom.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const key=[s,w,n,e].map(x=>x.toFixed(2)).join(","); if(key===reps.key) return; reps.key=key;
  try{ const j=await api(`/api/reports?s=${(s-0.1).toFixed(3)}&w=${(w-0.1).toFixed(3)}&n=${(n+0.1).toFixed(3)}&e=${(e+0.1).toFixed(3)}`); reps.kinds=j.kinds; reps.list=j.reports||[]; plan._rep=null; renderAll(); }catch(err){ reps.key=""; }
}
// reports within 2 km of the route, with where they are along it
function repsOnRoute(){
  if(!plan||!reps.list.length) return [];
  if(plan._rep) return plan._rep;
  return plan._rep=reps.list.map(r=>{ const h=locateDays(r,plan.geom,plan.cum,3).sort((a,b)=>a.off-b.off)[0]; return h&&h.off<=2?Object.assign({},r,{km:h.km,off:h.off}):null; }).filter(Boolean);
}
const ago=d=>{ const n=Math.round((Date.now()-Date.parse(d+"T12:00:00"))/864e5); return n<=0?"today":n===1?"yesterday":n<30?n+" days ago":Math.round(n/30)+" month"+(n>=60?"s":"")+" ago"; };
function reportsFor(k){
  const pd=plan&&plan.days[k]; if(!pd) return [];
  return repsOnRoute().filter(r=>r.km>=pd.a-0.5&&r.km<=pd.b+0.5).map(r=>({lvl:REP_LVL[r.kind]||"info",text:`Rider report, ${ago(r.seen_on)} at km ${Math.max(0,Math.round(r.km-pd.a))}: ${r.label}${r.text?". "+r.text:""}`}));
}
function drawReports(sel){
  repsOnRoute().forEach(r=>{ if(sel&&!(r.km>=sel.a-0.5&&r.km<=sel.b+0.5)) return; const lv=REP_LVL[r.kind];
    L.marker([r.lat,r.lon],{icon:L.divIcon({className:"",html:`<div class="repmk ${lv==="bad"?"bad":r.kind==="fuel_ok"||r.kind==="graded"||r.kind==="good_stay"?"good":""}">${REP_ICON[r.kind]||"•"}</div>`,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:900})
      .bindTooltip(`${r.label}, ${ago(r.seen_on)}${r.text?": "+r.text:""}`).addTo(layer); });
}

/* report dialog */
let repAt=null, repKind="";
function openReport(at){
  if(!acct.user){ acct.why="Sign in to report the road. It takes a minute and helps every rider after you."; openAcct("signin"); return; }
  repAt=at; repKind=""; $("rpMsg").textContent=""; $("rpText").value=""; $("rpDate").value=ymd(new Date()); $("rpDate").max=ymd(new Date());
  $("rpWhere").textContent=at?`At ${at.name||"this place"}`:"Pick a place, or use where you are now.";
  const K=reps.kinds||{fuel_ok:"Fuel available",no_fuel:"No fuel",road_closed:"Road closed",washaway:"Washaway or flood damage",bad_road:"Bad surface: corrugations, ruts, sand",graded:"Freshly graded",roadworks:"Roadworks or stop-go",river_high:"River crossing high",animals:"Animals on the road",danger:"Danger: crime or unsafe stop",good_stay:"Good place to stay or eat"};
  $("rpKinds").innerHTML=Object.entries(K).map(([k,v])=>`<button type="button" data-rk="${k}">${REP_ICON[k]||""} ${esc(v)}</button>`).join("");
  $("repDlg").showModal();
}
$("repDlg").addEventListener("click",e=>{
  if(e.target===$("repDlg")||e.target.closest("[data-rpclose]")){ $("repDlg").close(); return; }
  const b=e.target.closest("[data-rk]"); if(b){ repKind=b.dataset.rk; $("rpKinds").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); }
});
$("rpHere").addEventListener("click",()=>{ if(!navigator.geolocation){ $("rpMsg").textContent="This browser can't share your location."; return; }
  $("rpMsg").textContent="Finding you…"; navigator.geolocation.getCurrentPosition(p=>{ repAt={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),name:"where you are"}; $("rpWhere").textContent="At where you are now"; $("rpMsg").textContent=""; },()=>{ $("rpMsg").textContent="Location not shared."; },{enableHighAccuracy:true,timeout:15000}); });
$("repForm").addEventListener("submit",async e=>{ e.preventDefault();
  if(!repKind){ $("rpMsg").textContent="Pick what you saw."; return; } if(!repAt){ $("rpMsg").textContent="Where was it? Use where you are now, or report from a stop."; return; }
  $("rpMsg").textContent="Sending…";
  try{ await api("/api/reports",{method:"POST",body:{kind:repKind,text:$("rpText").value.trim(),lat:repAt.lat,lon:repAt.lon,seen_on:$("rpDate").value,route:trip.pick?"pick:"+trip.pick:trip.savedId||""}});
    $("repDlg").close(); reps.key=""; loadReports(); $("status").textContent="Thanks. Riders on this road will see it."; }
  catch(err){ $("rpMsg").textContent=err.message; } });
document.addEventListener("click",e=>{ const r=e.target.closest&&e.target.closest("[data-repat]"); if(!r) return; const [lat,lon,...n]=r.dataset.repat.split(","); openReport({lat:+lat,lon:+lon,name:n.join(",")}); });

/* ride reports (ratings grown up): a pick or a shared route */
const rateKey=()=>trip.pick?"pick:"+trip.pick:(trip.savedId||trip.sharedId||"");
const TICKS={goodgravel:"Good gravel",corrugations:"Corrugations",sand:"Sand",rocks:"Rocks",rivers:"River crossings",washaways:"Washaways",roadtyres:"Road tyres OK",twoup:"Two-up OK",need4x4:"Needs 4x4",lowrange:"Needs low range",towing:"Towing OK"};
let rating={key:"",data:null};
async function loadRating(){ const k=rateKey(); if(!acct.ready||!k||k===rating.key) return; rating={key:k,data:null};
  try{ rating.data=await api("/api/ratings?route="+encodeURIComponent(k)); renderDetails(); }catch(e){} }
const mediaUrl=k=>"/api/media/"+k;
function repHtml(r){
  const when=r.rode_on?new Date(r.rode_on).toLocaleDateString("en-GB",{month:"short",year:"numeric"}):"";
  return `<div class="rrep"><div><b>${"★".repeat(r.stars||0)}</b> · ${esc(r.name||"A rider")} · ${esc({bike:"Motorbike",jeep:"4x4",car:"Car"}[r.vehicle]||"")}${r.model?" ("+esc(r.model)+")":""} · ${when}${r.again===1?" · would ride it again":r.again===0?" · once was enough":""}</div>
    ${r.line?`<div>${esc(r.line)}</div>`:""}${(r.ticks||[]).length||r.fuel?`<div class="ticks" style="margin-top:4px">${(r.ticks||[]).map(t=>`<span>${esc(TICKS[t]||t)}</span>`).join("")}${r.fuel==="missing"?`<span>⛽ fuel missing</span>`:r.fuel==="ok"?`<span>⛽ fuel OK</span>`:""}</div>`:""}
    ${(r.photos||[]).length?`<div class="rph">${r.photos.map(k=>`<a href="${mediaUrl(k)}" target="_blank" rel="noopener"><img src="${mediaUrl(k)}" alt="Rider's photo" loading="lazy"></a>`).join("")}</div>`:""}</div>`;
}
function rateLine(){
  if(!acct.ready||!rateKey()) return ""; const d=rating.key===rateKey()?rating.data:null;
  const sum=d&&d.n?`<span>★ ${d.stars} from ${d.n} rider${d.n>1?"s":""}${d.grade?` · riders say ${GRADES[Math.round(d.grade)].name}`:""}</span>`:`<span class="note">No ride reports yet.</span>`;
  const reps=d&&d.reports&&d.reports.length?`<details class="rreps"><summary class="linkbtn">${d.reports.length} ride report${d.reports.length>1?"s":""} ›</summary>${d.reports.map(repHtml).join("")}</details>`:"";
  const pend=d&&d.mine&&d.mine.status==="pending"?` <span class="note">(yours is waiting for a quick check)</span>`:"";
  return `<div class="rateline">${sum}<button class="linkbtn" type="button" data-rate>${d&&d.mine?"Change your report":"Rode it? Send a ride report"}</button>${pend}</div>${reps}`;
}

/* Turnstile: an invisible "are you human" check, only when its site key is set up */
let tsLoad=null;
function humanToken(holder){
  if(!acct.turnstile) return Promise.resolve(null);
  tsLoad=tsLoad||new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async=true; s.onload=res; s.onerror=()=>rej(new Error("The human check didn't load. Check your connection.")); document.head.appendChild(s); });
  return tsLoad.then(()=>new Promise((res,rej)=>{ holder.innerHTML=""; const el=document.createElement("div"); holder.appendChild(el);
    window.turnstile.render(el,{sitekey:acct.turnstile,appearance:"interaction-only",callback:t=>res(t),"error-callback":()=>rej(new Error("The human check failed. Try again."))}); }));
}

/* photos: shrunk on the phone to ~1600 px, checked for size, light and focus, then uploaded */
async function prepPhoto(file){
  const bmp=await createImageBitmap(file,{imageOrientation:"from-image"}).catch(()=>null);
  if(!bmp) throw new Error("That file isn't a photo we can read.");
  if(Math.min(bmp.width,bmp.height)<700) throw new Error("Too small. Use the original photo.");
  const t=document.createElement("canvas"), tw=256, th=Math.round(256*bmp.height/bmp.width); t.width=tw; t.height=th;
  const tx=t.getContext("2d"); tx.drawImage(bmp,0,0,tw,th); const px=tx.getImageData(0,0,tw,th).data;
  const g=new Float32Array(tw*th); let sum=0; for(let i=0;i<tw*th;i++){ g[i]=0.299*px[i*4]+0.587*px[i*4+1]+0.114*px[i*4+2]; sum+=g[i]; }
  if(sum/(tw*th)<28) throw new Error("Too dark. Try another.");
  let lsum=0,lsq=0,n=0; for(let y=1;y<th-1;y++) for(let x=1;x<tw-1;x++){ const i=y*tw+x, l=g[i-1]+g[i+1]+g[i-tw]+g[i+tw]-4*g[i]; lsum+=l; lsq+=l*l; n++; }
  if(lsq/n-(lsum/n)**2<18) throw new Error("Too blurry. Try another.");
  const k=Math.min(1,1600/Math.max(bmp.width,bmp.height)), c=document.createElement("canvas"); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  let q=0.82, blob; do{ blob=await new Promise(r=>c.toBlob(r,"image/jpeg",q)); q-=0.1; }while(blob&&blob.size>650000&&q>0.4);
  return blob;
}
let rtStars=0, rtAgain=null, rtPh=[];
function drawPhotos(){ $("rtPhotos").innerHTML=rtPh.map((p,i)=>`<div class="ph${p.key?"":" busy"}"><img src="${p.url}" alt=""><button type="button" data-rmph="${i}" aria-label="Remove">×</button></div>`).join(""); $("rtAddPh").hidden=rtPh.length>=5; }
$("rtFiles").addEventListener("change",async e=>{ const files=[...e.target.files].slice(0,5-rtPh.length); e.target.value=""; $("rtPhMsg").textContent="";
  for(const f of files){ let blob; try{ blob=await prepPhoto(f); }catch(err){ $("rtPhMsg").textContent=`${f.name}: ${err.message}`; continue; }
    const p={url:URL.createObjectURL(blob),key:null}; rtPh.push(p); drawPhotos();
    try{ const r=await fetch("/api/photos",{method:"POST",headers:{"Content-Type":"image/jpeg"},body:blob,credentials:"same-origin"}); const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||"Upload failed."); p.key=j.key; }
    catch(err){ rtPh=rtPh.filter(x=>x!==p); $("rtPhMsg").textContent=err.message; }
    drawPhotos(); } });
function openRate(){
  if(!acct.user){ acct.why="Sign in to send a ride report. Reports only come from riders who've ridden it."; openAcct("signin"); return; }
  const m=rating.data&&rating.data.mine; rtStars=m?m.stars:0; rtAgain=m&&m.again!=null?m.again:null; rtPh=(m&&m.photos||[]).map(k=>({key:k,url:mediaUrl(k)})); $("rtMsg").textContent=""; $("rtPhMsg").textContent=acct.media?"":"Photos switch on soon. Send the report without them for now.";
  $("rtStars").innerHTML=[1,2,3,4,5].map(i=>`<button type="button" data-st="${i}" class="${i<=rtStars?"on":""}" aria-label="${i} star${i>1?"s":""}">★</button>`).join("");
  $("rtAgain").querySelectorAll("button").forEach(b=>b.classList.toggle("on",rtAgain!=null&&+b.dataset.again===rtAgain));
  $("rtGrade").innerHTML=GRADES.slice(1).map(x=>`<option value="${x.g}">${x.name} (${vehNote(x.g)})</option>`).join("");
  const G=tripGrade(); $("rtGrade").value=m?m.grade:(G&&G.top||2); $("rtDate").value=m?m.rode_on:""; $("rtDate").max=ymd(new Date()); $("rtVeh").value=m&&m.vehicle||settings.vehicle||"bike"; $("rtModel").value=m&&m.model||"";
  $("rtTicks").innerHTML=Object.entries(TICKS).map(([k,v])=>`<label><input type="checkbox" value="${k}" ${m&&(m.ticks||[]).includes(k)?"checked":""}> ${v}</label>`).join("");
  $("rtFuel").value=m&&m.fuel||""; $("rtLine").value=m&&m.line||""; $("rtCount").textContent=`${200-$("rtLine").value.length} left`;
  $("rtAddPh").hidden=!acct.media; drawPhotos(); if(!acct.media) $("rtAddPh").hidden=true;
  $("rateDlg").showModal();
}
$("rtLine").addEventListener("input",()=>{ $("rtCount").textContent=`${200-$("rtLine").value.length} left`; });
$("rateDlg").addEventListener("click",e=>{ if(e.target===$("rateDlg")||e.target.closest("[data-rtclose]")){ $("rateDlg").close(); return; }
  const s=e.target.closest("[data-st]"); if(s){ rtStars=+s.dataset.st; $("rtStars").querySelectorAll("button").forEach(b=>b.classList.toggle("on",+b.dataset.st<=rtStars)); return; }
  const a=e.target.closest("[data-again]"); if(a){ rtAgain=+a.dataset.again; $("rtAgain").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b===a)); return; }
  const r=e.target.closest("[data-rmph]"); if(r){ rtPh.splice(+r.dataset.rmph,1); drawPhotos(); } });
$("rateForm").addEventListener("submit",async e=>{ e.preventDefault();
  if(!$("rtDate").value){ $("rtMsg").textContent="When did you ride it?"; return; } if(!rtStars){ $("rtMsg").textContent="Pick 1 to 5 stars."; return; }
  if(rtPh.some(p=>!p.key)){ $("rtMsg").textContent="Wait for the photos to finish uploading."; return; }
  const btn=e.target.querySelector("button[type=submit]"); btn.disabled=true; $("rtMsg").textContent="Sending…";
  try{ const turnstile=await humanToken($("rtHuman"));
    const j=await api("/api/ratings",{method:"POST",body:{route:rateKey(),stars:rtStars,grade:+$("rtGrade").value,rode_on:$("rtDate").value,vehicle:$("rtVeh").value,model:$("rtModel").value,
      again:rtAgain==null?null:!!rtAgain,ticks:[...$("rtTicks").querySelectorAll("input:checked")].map(x=>x.value),fuel:$("rtFuel").value,line:$("rtLine").value,photos:rtPh.map(p=>p.key),turnstile}});
    $("rateDlg").close(); rating.key=""; loadRating(); $("status").textContent=j.status==="pending"?"Thanks. Your report goes live after a quick check.":"Thanks. Your report is live.";
    if(typeof track==="function") track("report"); }
  catch(err){ $("rtMsg").textContent=err.message; }
  btn.disabled=false; });
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-rate]")) openRate(); });

// after every render: fetch what's missing (cheap; each loads once per route)
{ const _ra=renderAll; renderAll=function(){ _ra(); if(acct.ready&&plan&&!planStale){ loadReports(); loadRating(); } }; }
