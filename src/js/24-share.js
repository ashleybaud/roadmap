/* ---------- Share this trip: one short link anyone can open, no account. They get the whole plan, then Google Maps / Waze or GPX. ---------- */
function shareText(url){
  const km=tripKm();
  return `${defaultTitle()}${km?`, ${km.toLocaleString()} km`:""}. Open the plan on your phone, then tap Google Maps / Waze to navigate, or GPX for your GPS:`;
}
let shareBusy=false;
async function shareLink(){
  const t=JSON.parse(JSON.stringify(trip)); delete t.savedId; delete t.savedTitle; delete t.sharedId;
  const j=await api("/api/share",{method:"POST",body:{title:defaultTitle(),trip:t,settings}}); track("share");
  const url=`${location.origin}/?s=${j.id}`; return {url,text:shareText(url)};
}
// straight into WhatsApp: the window opens on the tap (so it isn't blocked), then gets the link
async function shareWhatsApp(btn){
  if(!plan||planStale){ $("status").textContent="Plan the trip first, then share it."; return; }
  const w=window.open("","_blank"); const was=btn&&btn.textContent; if(btn) btn.textContent="Making the link…";
  try{ const {url,text}=await shareLink(), wa=`https://wa.me/?text=${encodeURIComponent(text+" "+url)}`; if(w) w.location.href=wa; else location.href=wa; }
  catch(e){ if(w) w.close(); $("status").textContent=e.message||"Couldn't make the link. Check your connection."; }
  finally{ if(btn) btn.textContent=was; }
}
async function shareTrip(btn){
  if(!plan||planStale){ $("status").textContent="Plan the trip first, then share it."; return; }
  if(shareBusy) return; shareBusy=true; const was=btn&&btn.textContent; if(btn) btn.textContent="Making the link…";
  try{
    const {url,text}=await shareLink();
    if(navigator.share){ try{ await navigator.share({title:defaultTitle(),text,url}); }catch(e){ if(e&&e.name!=="AbortError") showShare(url,text); } }
    else showShare(url,text);
  }catch(e){ $("status").textContent=e.message||"Couldn't make the link. Check your connection."; }
  finally{ shareBusy=false; if(btn) btn.textContent=was; }
}
function showShare(url,text){
  const tt=$("toast"), wa=`https://wa.me/?text=${encodeURIComponent(text+" "+url)}`;
  tt.innerHTML=`Your link: <b>${esc(url)}</b> <button type="button" class="linkbtn" data-copyshare>Copy</button> · <a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp it</a>`;
  tt.querySelector("[data-copyshare]").onclick=e=>{ (navigator.clipboard?navigator.clipboard.writeText(text+" "+url):Promise.reject()).then(()=>{ e.target.textContent="Copied"; },()=>{}); };
  tt.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,30000);
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-sharetrip]"); if(b){ e.preventDefault(); shareTrip(b); return; }
  const w=e.target.closest&&e.target.closest("[data-sharewa]"); if(w){ e.preventDefault(); shareWhatsApp(w); } });
// /?s=<id> opens a shared trip
{ const m=location.search.match(/[?&]s=([a-z0-9]{6,12})/); if(m){ history.replaceState(null,"",location.pathname);
  setTimeout(async()=>{ try{ const r=await api("/api/share/"+m[1]); track("shared_open");
    try{ localStorage.setItem("rr-welcome","1"); if($("welcome").open) $("welcome").close(); }catch(e){}
    applyTrip(r.trip,r.settings,r.title);
    const tt=$("toast"); tt.innerHTML=`Opened <b>${esc(r.title)}</b>. When it's planned, tap <b>Google Maps / Waze</b> to navigate, or <b>GPX</b> for your GPS. Change anything you like.`; tt.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>tt.hidden=true,20000);
    if(window.innerWidth<=1000) $("map").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){ $("status").textContent=e.message||"That link didn't open."; } },300); } }
