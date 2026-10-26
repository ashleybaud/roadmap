async function overpass(q){
  const ctl=new AbortController(); setTimeout(()=>ctl.abort(),40000);
  const r=await fetch(OVERPASS,{method:"POST",signal:ctl.signal,body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}});
  if(!r.ok) throw new Error("overpass "+r.status); return (await r.json()).elements||[];
}
function kindOf(t){
  if(t.amenity==="fuel") return "fuel";
  if(t.tourism==="viewpoint") return "view";
  if(t.mountain_pass==="yes") return "pass";
  if(t.tourism==="camp_site") return "camp";
  if(/^(restaurant|cafe|pub|fast_food)$/.test(t.amenity||"")) return "food";
  if(/^(hotel|guest_house|hostel|chalet|motel|apartment)$/.test(t.tourism||"")) return "sleep";
  return "sight";
}
/* route split into short chunks; each chunk's box (padded) is a fast indexed lookup */
function boxes(padKm){
  const out=[]; let chunk=[plan.geom[0]],startKm=0;
  for(let i=1;i<plan.geom.length;i++){chunk.push(plan.geom[i]); if(plan.cum[i]-startKm>=30||i===plan.geom.length-1){out.push(chunk);chunk=[plan.geom[i]];startKm=plan.cum[i];}}
  return out.map(c=>{let s=90,w=180,n=-90,e=-180;c.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
    const dLat=padKm/110.5,dLon=padKm/(111.3*Math.cos(rad((s+n)/2)));return `${(s-dLat).toFixed(4)},${(w-dLon).toFixed(4)},${(n+dLat).toFixed(4)},${(e+dLon).toFixed(4)}`;});
}
function toPlaces(els){
  const out=[],seen=new Set();
  els.forEach(e=>{
    const lat=e.lat??e.center?.lat, lon=e.lon??e.center?.lon; if(lat==null) return;
    const t=e.tags||{}, k=kindOf(t), id=e.type+e.id; if(seen.has(id)) return; seen.add(id);
    const p={id,lat,lon,name:t.name||t.brand||(k==="fuel"?"Fuel":""),kind:k,tags:t};
    Object.assign(p,locate(p,plan.geom,plan.cum)); out.push(p);
  });
  return out;
}
/* own data snapshot (refreshed monthly), falls back to the live service */
const COUNTRY_BOX={za:[-35.2,16.3,-22.0,33.1],na:[-29.1,11.6,-16.9,25.4]};
const fileCache=new Map();
async function localKind(kind,ccs){
  const rows=[];
  for(const cc of ccs){
    const key=cc+"/"+kind;
    if(!fileCache.has(key)) fileCache.set(key,fetch(`/data/${key}.json`).then(r=>r.ok?r.json():null).catch(()=>null));
    const d=await fileCache.get(key); if(!d) return null; rows.push(...d);
  }
  return rows;
}
function nearRoute(rows,kind,padKm){
  const bx=boxes(padKm).map(b=>b.split(",").map(Number));
  const out=[];
  rows.forEach((r,i)=>{
    const [lat,lon,name,type,phone,web,email,hours,extra]=r;
    if(!bx.some(([s,w,n,e])=>lat>=s&&lat<=n&&lon>=w&&lon<=e)) return;
    const k=kind==="sleep"&&type==="camp_site"?"camp":kind;
    const p={id:kind+i,lat,lon,name:name||(kind==="fuel"?"Fuel":""),kind:k,tags:{tourism:type,phone,website:web,email,hours,extra}};
    if(kind==="fuel"||kind==="med") locateDays(p,plan.geom,plan.cum,padKm).forEach(r=>out.push(Object.assign({},p,r)));
    else { Object.assign(p,locate(p,plan.geom,plan.cum)); out.push(p); }
  });
  return out;
}
async function loadLocal(my){
  const g=plan.geom; let s=90,w=180,n=-90,e=-180; g.forEach(p=>{s=Math.min(s,p.lat);n=Math.max(n,p.lat);w=Math.min(w,p.lon);e=Math.max(e,p.lon);});
  const ccs=Object.entries(COUNTRY_BOX).filter(([,b])=>!(b[0]>n||b[2]<s||b[1]>e||b[3]<w)).map(([c])=>c);
  if(!ccs.length) return null;
  const fuel=await localKind("fuel",ccs); if(!fuel) return null;
  if(my!==seq) return;
  const extra=await fetch("/data/extra-fuel.json").then(r=>r.ok?r.json():[]).catch(()=>[]);
  fuelRowsAll=[...fuel.map(r=>({lat:r[0],lon:r[1]})),...extra.map(x=>({lat:x.lat,lon:x.lon}))];
  fuelAll=[...nearRoute(fuel,"fuel",10),...extra.flatMap((x,k)=>locateDays(x,plan.geom,plan.cum,10).map(r=>Object.assign({id:"x"+k,lat:x.lat,lon:x.lon,name:x.name,kind:"fuel",note:x.note,tags:{}},r)))].filter(p=>p.off<=10);
  fuelStations=fuelAll.filter(p=>p.off<=5).sort((a,b)=>a.km-b.km); placesOk=true; render();
  const corridor=Math.max(1,+settings.corridor); let all=[];
  for(const k of ["view","pass","sight","food","camp"]){ const rows=await localKind(k,ccs); if(rows){ all.push(...nearRoute(rows,k,corridor)); if(k==="food") foodRowsAll=rows.map(r=>({lat:r[0],lon:r[1]})); } }
  if(plan) plan._cands=null;
  pois=all.filter(p=>p.off<=corridor+0.5);
  const stopPts=townPoints(); amen=[];
  for(const k of ["shop","toilets","cash","repair"]){ const rows=await localKind(k,ccs); if(!rows) continue;
    rows.forEach((r,i)=>{ const [lat,lon,name,type,phone,web,email,hours,extra]=r; const q={lat,lon}; if(!stopPts.some(s=>hav(s,q)<=1.2)) return;
      amen.push({id:k+i,lat,lon,name:name||"",kind:k,tags:{tourism:type,phone,website:web,email,hours,extra}}); }); }
  const med=await localKind("med",ccs); meds=med?nearRoute(med,"med",160).map(p=>Object.assign(p,{type:p.tags.tourism,phone:p.tags.phone})):null;
  const fd=await localKind("ford",ccs); fords=fd?nearRoute(fd,"ford",0.5).filter(p=>p.off<=0.1).filter((p,i,a)=>!a.slice(0,i).some(o=>Math.abs(o.km-p.km)<0.5)):null;
  const nights=townPoints();
  if(nights.length){
    const sl=[...(await localKind("sleep",ccs)||[]),...(await localKind("camp",ccs)||[]).map(r=>[r[0],r[1],r[2],"camp_site",r[4],r[5],r[6]])];
    stays=nights.map((nt,i)=>({night:nt,day:i+1,places:sl.map((r,j)=>({id:"s"+j,lat:r[0],lon:r[1],name:r[2],kind:"sleep",tags:{tourism:r[3],phone:r[4],website:r[5],email:r[6]}})).filter(p=>hav(p,nt)<=15).map(p=>Object.assign(p,{dist:hav(p,nt)},locate(p,plan.geom,plan.cum))).sort((a,b)=>a.dist-b.dist).slice(0,200)}));
  } else stays=[];
  return true;
}
async function loadPlaces(my){
  try{ const r=await loadLocal(my); if(r) return; }catch(e){}
  return loadRemote(my);
}
async function loadRemote(my){
  meds=null; fords=null; amen=[]; fuelRowsAll=null; foodRowsAll=null;
  const nights=townPoints();
  const fb=boxes(2.5), pb=boxes(Math.max(1,+settings.corridor));
  // 1. fuel first: it decides whether the ride works
  try{
    const els=await overpass(`[out:json][timeout:30];(${fb.map(b=>`nwr[amenity=fuel](${b});`).join("")});out center tags;`);
    if(my!==seq) return;
    fuelAll=toPlaces(els); fuelStations=fuelAll.filter(p=>p.off<=5).sort((a,b)=>a.km-b.km); placesOk=true;
  }catch(e){ placesOk=false; return false; }
  render();
  // 2. points of interest and places to sleep
  try{
    const sel=b=>`nwr[tourism~"^(viewpoint|attraction|museum|camp_site)$"][name](${b});node[mountain_pass=yes][name](${b});nwr[historic~"^(monument|ruins|archaeological_site|memorial|castle|fort)$"][name](${b});nwr[amenity~"^(restaurant|cafe|pub)$"][name](${b});`;
    const sleepQ=nights.map(n=>`nwr(around:15000,${n.lat},${n.lon})[tourism~"^(hotel|guest_house|hostel|chalet|motel|camp_site|apartment)$"][name];`).join("");
    const els=await overpass(`[out:json][timeout:40];(${pb.map(sel).join("")}${sleepQ});out center tags;`);
    if(my!==seq) return;
    const all=toPlaces(els);
    pois=all.filter(p=>p.kind!=="fuel"&&p.kind!=="sleep"&&p.off<=+settings.corridor+0.5);
    stays=nights.map((n,i)=>({night:n,day:i+1,places:all.filter(p=>(p.kind==="sleep"||p.kind==="camp")&&hav(p,n)<=15).map(p=>Object.assign({},p,{dist:hav(p,n)})).sort((a,b)=>a.dist-b.dist).slice(0,80)}));
  }catch(e){ $("status").textContent="Points of interest couldn't load. Fuel planning still works."; return "partial"; }
}

