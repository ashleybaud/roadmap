/* ---------- accounts: sign in with an email link, save routes, feedback ----------
   Everything here switches itself off until the server says accounts are ready (database + email set up). */
const acct={ready:false,user:null,routes:null};
async function api(path,opt){
  const o=Object.assign({headers:{}},opt||{}); if(o.body&&typeof o.body!=="string"){ o.body=JSON.stringify(o.body); o.headers["Content-Type"]="application/json"; }
  const r=await fetch(path,o); let j=null; try{ j=await r.json(); }catch(e){}
  if(!r.ok) throw new Error((j&&j.error)||"Couldn't reach OneTrackMind. Check your connection.");
  return j||{};
}
async function loadMe(){
  try{ const j=await api("/api/auth/me"); acct.ready=!!(j&&j.ready); acct.user=j&&j.user||null; acct.admin=!!(j&&j.admin); }catch(e){ acct.ready=false; acct.user=null; }
  const b=$("acctBtn"); b.hidden=!acct.ready; b.textContent=acct.user?"My routes":"Sign in"; $("addBtn").hidden=!acct.ready;
  if(typeof refreshReview==="function") refreshReview();
  renderAll();
}
function saveRouteBtn(){ return acct.ready?`<button class="btn small ghost" type="button" data-saveroute>${trip.savedId&&acct.user?"Update saved route":"Save route"}</button>`:""; }
const tripKm=()=>plan?Math.round(plan.days.reduce((t,d)=>t+(d?d.km:0),0)):null;
function defaultTitle(){ const n=nDays(), last=dayTo(n-1); return `${trip.start&&trip.start.name||"Trip"}${last&&!trip.round?" to "+last.name:trip.round?" round trip":""}, ${n} day${n>1?"s":""}`; }
function tripSummary(){ const n=trip.days.slice(0,-1).map(d=>d.to&&d.to.name).filter(Boolean); return `${tripKm()||"?"} km · ${VEHICLES[settings.vehicle]||""} · ${styleName()}${n.length?" · nights: "+n.join(", "):""}`; }

/* the dialog has three faces: sign in, saving this trip, and your routes */
function openAcct(mode,msg){ acctMode=mode||(acct.user?"routes":"signin"); renderAcct(msg); if(!$("acctDlg").open) $("acctDlg").showModal(); if(acctMode==="routes") loadRoutes(); }
let acctMode="signin";
function renderAcct(msg){
  const B=$("aBody"), m=msg?`<div class="${msg.err?"errmsg":"okmsg"}">${esc(msg.text)}</div>`:"";
  if(acctMode==="signin"){
    $("aTitle").textContent="Sign in";
    B.innerHTML=`${m}<p class="note" style="margin:0">${esc(acct.why||"Save your routes and open them on any device.")} We'll email you a link to sign in. No password.</p>
      <form id="aForm" class="dlgwrap"><div class="field"><label class="lbl" for="aEmail">Your email</label><input id="aEmail" type="email" autocomplete="email" required></div>
      <div class="btns" style="justify-content:flex-end"><button class="btn" type="submit">Email me a link</button></div></form>
      <p class="note" style="margin:0">We keep your email and the routes you save, nothing else. See <a href="/privacy.html" target="_blank">privacy</a>.</p>`;
    $("aForm").onsubmit=async e=>{ e.preventDefault(); const email=$("aEmail").value.trim(), btn=e.target.querySelector("button"); btn.disabled=true; btn.textContent="Sending…";
      try{ await api("/api/auth/start",{method:"POST",body:{email,back:"/"}}); acctMode="sent"; acct.sentTo=email; renderAcct(); }
      catch(err){ btn.disabled=false; btn.textContent="Email me a link"; renderAcct({err:1,text:err.message}); $("aEmail").value=email; } };
    setTimeout(()=>$("aEmail")&&$("aEmail").focus(),50);
  } else if(acctMode==="sent"){
    $("aTitle").textContent="Check your email";
    B.innerHTML=`<p style="margin:0">We sent a sign-in link to <b>${esc(acct.sentTo)}</b>. Open it on this device. It works once and expires in 20 minutes.</p><p class="note" style="margin:0">Nothing after a few minutes? Check spam, or <button class="linkbtn" type="button" data-again>try again</button>. Your trip stays on this device while you sign in.</p>`;
  } else if(acctMode==="save"){
    $("aTitle").textContent=trip.savedId?"Update saved route":"Save route";
    B.innerHTML=`${m}<form id="sForm" class="dlgwrap"><div class="field"><label class="lbl" for="sTitle">Name</label><input id="sTitle" type="text" maxlength="120" value="${esc(trip.savedTitle||defaultTitle())}"></div>
      <p class="note" style="margin:0">${esc(tripSummary())}. Only you can see it.</p>
      <div class="btns" style="justify-content:flex-end">${trip.savedId?`<button class="btn ghost" type="button" data-saveas>Save as a new route</button>`:""}<button class="btn" type="submit">${trip.savedId?"Update":"Save"}</button></div></form>`;
    $("sForm").onsubmit=e=>{ e.preventDefault(); saveRoute(!!trip.savedId); };
  } else {
    $("aTitle").textContent="My routes";
    const R=acct.routes;
    B.innerHTML=`${m}${plan?`<div class="btns"><button class="btn small" type="button" data-saveroute>${trip.savedId?"Update this route":"Save this trip"}</button></div>`:""}
      <div class="rlist">${R==null?`<div class="note">Loading…</div>`:R.length?R.map(r=>`<div class="rrow"><div><div class="rt">${esc(r.title)}</div><div class="note">${r.km?r.km.toLocaleString()+" km · ":""}${r.days} day${r.days>1?"s":""}${r.vehicle?" · "+esc((VEHICLES[r.vehicle]||"").replace(/^\S+\s/,"")):""} · ${esc(new Date(r.updated).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}))}</div></div>
        <div class="ract">${acct.admin?`<button class="btn small ghost" type="button" data-rpick="${r.id}:${r.pick?0:1}">${r.pick?"Unpick":"Make pick"}</button>`:r.visibility==="public"?`<span class="note">Public</span>`:r.visibility==="review"?`<span class="note" title="We check every shared route before other riders see it">Waiting for approval</span>`:`<button class="btn small ghost" type="button" data-rpub="${r.id}" title="Let other riders find and rate it">Share publicly</button>`}<button class="btn small" type="button" data-ropen="${r.id}">Open</button><button class="icon" type="button" title="Delete" data-rdel="${r.id}">✕</button></div></div>`).join(""):`<div class="note">Nothing saved yet. Plan a trip, then tap Save route.</div>`}</div>
      <div class="acctline"><span class="note">Signed in as <b>${esc(acct.user.email)}</b></span><span class="btns"><button class="linkbtn" type="button" data-signout>Sign out</button><button class="linkbtn" type="button" data-delacct>${acct.delArm?"Tap again to delete your account and routes":"Delete account"}</button></span></div>`;
  }
}
async function loadRoutes(){ try{ acct.routes=(await api("/api/routes")).routes; }catch(e){ acct.routes=[]; renderAcct({err:1,text:e.message}); return; } if(acctMode==="routes") renderAcct(); }
async function saveRoute(update){
  const body={title:($("sTitle")&&$("sTitle").value.trim())||defaultTitle(),trip:JSON.parse(JSON.stringify(trip)),settings,km:tripKm(),summary:tripSummary(),region:trip.start&&trip.start.lat<-16&&trip.start.lat>-35?"za":"",grade:(()=>{ const G=tripGrade(); return G?{km:G.km.map(x=>Math.round(x)),top:G.top}:null; })()};
  delete body.trip.savedId; delete body.trip.savedTitle;
  try{
    if(update) await api("/api/routes/"+trip.savedId,{method:"PUT",body});
    else { const j=await api("/api/routes",{method:"POST",body}); trip.savedId=j.id; }
    trip.savedTitle=body.title; save(); acct.routes=null; acctMode="routes"; renderAcct({text:update?"Route updated.":"Route saved."}); loadRoutes(); renderDetails();
  }catch(e){ if(/Sign in/.test(e.message)){ acct.user=null; acct.why="Sign in to save this route."; openAcct("signin"); return; } renderAcct({err:1,text:e.message}); }
}
// put a trip into the planner (with Undo): from your saved routes or a pick
function applyTrip(nt,st,label){
  snapTrip(true); const prev=JSON.parse(JSON.stringify(trip)), prevS=Object.assign({},settings);
  Object.keys(trip).forEach(x=>delete trip[x]); Object.assign(trip,nt);
  if(trip.sugV!==5){ trip.days.forEach(d=>{ d.vias=(d.vias||[]).filter(v=>!v.auto); d.legs=[]; d.fresh=true; delete d.noMore; }); trip.sugV=5; }
  if(!trip.startDate||trip.startDate<tomorrow){ trip.startDate=tomorrow; } trip.endDate=addDays(trip.startDate,trip.days.length-1);
  if(st) ["vehicle","style","range","maxHours","leave","pace","breakMin"].forEach(k=>{ if(st[k]!=null&&st[k]!=="") settings[k]=st[k]; });
  store.set("rr2-settings",settings); SET_FIELDS.forEach(k=>$(k).value=settings[k]); showStyle();
  ui.tab="ov"; plan=null; fp=null; if(typeof gpxCache!=="undefined") gpxCache=null; changed();
  const tt=$("toast"); tt.innerHTML=`Opened ${esc(label)}. <button type="button" class="linkbtn">Undo</button>`; tt.hidden=false;
  tt.querySelector("button").onclick=()=>{ Object.keys(trip).forEach(x=>delete trip[x]); Object.assign(trip,prev); Object.assign(settings,prevS); store.set("rr2-settings",settings); SET_FIELDS.forEach(k=>$(k).value=settings[k]); showStyle(); tt.hidden=true; plan=null; changed(); };
  clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,10000);
}
async function openRoute(id){
  try{
    const r=(await api("/api/routes/"+id)).route; if(!r||!r.trip) throw new Error("That route couldn't be opened.");
    $("acctDlg").close(); applyTrip(Object.assign({},r.trip,r.mine?{savedId:r.id,savedTitle:r.title}:{sharedId:r.id}),r.settings,r.title);
  }catch(e){ renderAcct({err:1,text:e.message}); $("status").textContent=e.message; }
}
$("acctBtn").addEventListener("click",()=>{ acct.why=""; openAcct(); });
$("acctDlg").addEventListener("click",async e=>{
  const t=e.target;
  if(t===$("acctDlg")||t.closest("[data-aclose]")){ $("acctDlg").close(); return; }
  if(t.closest("[data-again]")){ acctMode="signin"; renderAcct(); return; }
  if(t.closest("[data-saveas]")){ saveRoute(false); return; }
  if(t.closest("[data-saveroute]")){ acctMode="save"; renderAcct(); return; }
  const o=t.closest("[data-ropen]"); if(o){ openRoute(o.dataset.ropen); return; }
  const pk=t.closest("[data-rpick]"); if(pk){ const [id,v]=pk.dataset.rpick.split(":"); try{ await api("/api/routes/"+id,{method:"PUT",body:{pick:+v}}); acct.routes=null; loadRoutes(); picks=null; }catch(err){ renderAcct({err:1,text:err.message}); } return; }
  const pb=t.closest("[data-rpub]"); if(pb){ if(pb.dataset.arm!=="1"){ pb.dataset.arm="1"; pb.textContent="Share? Tap again"; return; } try{ await api("/api/routes/"+pb.dataset.rpub,{method:"PUT",body:{visibility:"public"}}); acct.routes=null; loadRoutes(); $("status").textContent=acct.admin?"Shared.":"Sent for approval. Other riders see it once we've checked it."; }catch(err){ renderAcct({err:1,text:err.message}); } return; }
  const d=t.closest("[data-rdel]"); if(d){ if(d.dataset.arm!=="1"){ d.dataset.arm="1"; d.textContent="Delete?"; d.classList.add("btn","small"); return; }
    try{ await api("/api/routes/"+d.dataset.rdel,{method:"DELETE"}); if(trip.savedId===d.dataset.rdel){ delete trip.savedId; delete trip.savedTitle; save(); renderDetails(); } acct.routes=acct.routes.filter(r=>r.id!==d.dataset.rdel); renderAcct({text:"Route deleted."}); }catch(err){ renderAcct({err:1,text:err.message}); } return; }
  if(t.closest("[data-signout]")){ try{ await api("/api/auth/logout",{method:"POST"}); }catch(err){} acct.user=null; acct.routes=null; $("acctDlg").close(); loadMe(); $("status").textContent="Signed out."; return; }
  if(t.closest("[data-delacct]")){ if(!acct.delArm){ acct.delArm=true; renderAcct(); return; }
    try{ await api("/api/account",{method:"DELETE"}); acct.delArm=false; acct.user=null; acct.routes=null; delete trip.savedId; delete trip.savedTitle; save(); $("acctDlg").close(); loadMe(); $("status").textContent="Your account and saved routes are deleted."; }catch(err){ renderAcct({err:1,text:err.message}); } return; }
});
document.addEventListener("click",e=>{ if(!e.target.closest("#details [data-saveroute]")) return;
  if(!acct.user){ acct.why="Sign in to save this route. Your trip stays on this device while you do."; openAcct("signin"); return; }
  openAcct("save"); });
// back from the email link
if(/[?&]signedin=1/.test(location.search)){ history.replaceState(null,"",location.pathname); setTimeout(()=>{ if(acct.user){ const tt=$("toast"); tt.innerHTML=`You're signed in as <b>${esc(acct.user.email)}</b>. If OneTrackMind is open in another tab, you can close that one.`; tt.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,12000); } },1500); }
// signed in from the email in another tab? notice it when this tab is looked at again
{ let lastCheck=0; const recheck=()=>{ if(document.visibilityState!=="visible"||acct.user||!acct.ready||Date.now()-lastCheck<3000) return; lastCheck=Date.now();
    api("/api/auth/me").then(j=>{ if(j&&j.user){ acct.user=j.user; acct.admin=!!j.admin; $("acctBtn").textContent="My routes"; if(typeof refreshReview==="function") refreshReview(); if($("acctDlg").open&&acctMode==="sent"){ $("acctDlg").close(); } renderAll(); $("status").textContent=`Signed in as ${j.user.email}.`; } }).catch(()=>{}); };
  document.addEventListener("visibilitychange",recheck); window.addEventListener("focus",recheck); }

/* ---------- feedback and suggested changes: stored and emailed to us; plain email if the server can't take it ---------- */
let fbAt=null;
function openFeedback(kind,at){
  fbAt=at||null; $("fKind").value=kind||"feedback"; $("fMsg").textContent=""; $("fMsg").className="note"; $("fSend").disabled=false;
  $("fWhere").hidden=!at; if(at) $("fWhere").textContent=`About ${at.name||"this place"} (${(+at.lat).toFixed(4)}, ${(+at.lon).toFixed(4)})`;
  $("fEmailRow").hidden=!!acct.user; $("fTitle").textContent=kind==="fix"?"Suggest a change":"Send feedback";
  $("fText").placeholder=kind==="fix"?"What's wrong, and what's right? E.g. the fuel station closed, the road is washed away, this place has fuel.":"What worked, what didn't, what you'd change";
  $("fbDlg").showModal(); setTimeout(()=>$("fText").focus(),50);
}
$("feedback").addEventListener("click",()=>openFeedback("feedback"));
$("fbDlg").addEventListener("click",e=>{ if(e.target===$("fbDlg")||e.target.closest("[data-fclose]")) $("fbDlg").close(); });
$("fKind").addEventListener("change",()=>{ $("fTitle").textContent=$("fKind").value==="fix"?"Suggest a change":"Send feedback"; });
$("fbForm").addEventListener("submit",async e=>{
  e.preventDefault(); const text=$("fText").value.trim(); if(text.length<3){ $("fText").focus(); return; }
  const data=$("fTrip").checked?{trip:JSON.parse(JSON.stringify(trip)),settings,screen:innerWidth+"x"+innerHeight,ua:navigator.userAgent}:null;
  $("fSend").disabled=true; $("fMsg").textContent="Sending…";
  try{
    await api("/api/feedback",{method:"POST",body:{kind:$("fKind").value,text,page:location.pathname+location.search,data,email:$("fEmail").value.trim(),lat:fbAt&&fbAt.lat,lon:fbAt&&fbAt.lon}});
    $("fText").value=""; $("fbDlg").close(); $("status").textContent="Thanks. We read every one.";
  }catch(err){
    const body=`${text}\n\n---\n${fbAt?`About: ${fbAt.name} ${fbAt.lat},${fbAt.lon}\n`:""}Trip: ${tripLabel(trip)}`;
    $("fMsg").innerHTML=`Couldn't send from here. <a href="mailto:feedback@onetrackmind.online?subject=${encodeURIComponent("OneTrackMind "+($("fKind").value==="fix"?"suggested change":"feedback"))}&body=${encodeURIComponent(body)}">Send it by email instead</a>.`;
    $("fSend").disabled=false;
  }
});
document.addEventListener("click",e=>{ const f=e.target.closest&&e.target.closest("[data-fixat]"); if(!f) return; const [lat,lon,...n]=f.dataset.fixat.split(","); openFeedback("fix",{lat:+lat,lon:+lon,name:n.join(",")}); });
loadMe();
