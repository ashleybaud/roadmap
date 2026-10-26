const cache=new Map();
function decode6(str){let i=0,lat=0,lon=0;const out=[];while(i<str.length){let b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);lat+=r&1?~(r>>1):r>>1;sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);lon+=r&1?~(r>>1):r>>1;out.push({lat:lat/1e6,lon:lon/1e6});}return out;}
const STYLE={rough:{use_highways:0,use_primary:0.2,use_trails:1},mixed:{use_highways:0.5,use_primary:0.5,use_trails:0.5},tar:{use_highways:1,use_primary:1,use_trails:0}};
const lineKm=g=>{let k=0;for(let i=1;i<g.length;i++)k+=hav(g[i-1],g[i]);return k;};
/* BRouter: profiles that really prefer gravel (Road less travelled), mix it (Mixed) or avoid it (Tar),
   per vehicle. Profiles live in /routing/*.brf and are uploaded once per visit. Free public server = testing only. */
const BROUTER="https://brouter.de/brouter";
const brIds={};
async function brProfile(name,fresh){
  if(!fresh&&brIds[name]) return brIds[name];
  const txt=await (await fetch(`/routing/${name}.brf`)).text();
  const j=await (await fetch(BROUTER+"/profile",{method:"POST",body:txt})).json(); if(!j.profileid||j.error) throw new Error(j.error||"profile");
  return brIds[name]=j.profileid;
}
// time from the road types and surfaces BRouter reports, since its own times are for bicycles
const SPD={bike:{motorway:110,trunk:100,primary:90,secondary:80,tertiary:70,unclassified:60,res:35,gravel:65,track:40,rough:25},
  jeep:{motorway:110,trunk:100,primary:90,secondary:80,tertiary:70,unclassified:60,res:35,gravel:60,track:40,rough:20},
  car:{motorway:120,trunk:110,primary:100,secondary:90,tertiary:80,unclassified:70,res:35,gravel:60,track:30,rough:10}};
function brSpeed(w,veh){ const gs=gradeSpeed(wayGrade(w),veh); if(gs) return gs; // off tar: by terrain grade and vehicle
  const S=SPD[veh]||SPD.bike, h=(w.match(/highway=(\w+)/)||[])[1]||"", unp=/surface=(unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|sand|pebblestone|grass|mud)/.test(w);
  if(h==="track") return /tracktype=grade(4|5)/.test(w)?S.rough:S.track;
  if(unp) return S.gravel;
  const base=h.replace("_link",""); return S[base]||(/residential|living_street|service/.test(h)?S.res:50); }
async function brouterLeg(a,b,veh,style,alts){
  const name=`${veh}-${style}`; let pid=await brProfile(name);
  const get=async(idx)=>{ const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),12000);
    let r=await fetch(`${BROUTER}?lonlats=${a.lon.toFixed(5)},${a.lat.toFixed(5)}|${b.lon.toFixed(5)},${b.lat.toFixed(5)}&profile=${pid}&alternativeidx=${idx}&format=geojson`,{signal:ctl.signal}); clearTimeout(tm);
    let t=await r.text(); if(!t.startsWith("{")&&/profile/i.test(t)){ pid=await brProfile(name,true); return get(idx); }
    if(!t.startsWith("{")) throw new Error(t.slice(0,80));
    const f=JSON.parse(t).features[0], msgs=f.properties.messages||[], hd=msgs[0]||[], iD=hd.indexOf("Distance"), iW=hd.indexOf("WayTags");
    let min=0, grav=0, at=0; const grades=[]; msgs.slice(1).forEach(m=>{ const d=(+m[iD]||0)/1000, w=m[iW]||""; min+=d/brSpeed(w,veh)*60; if(/surface=(unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|sand)|highway=track/.test(w)&&!/surface=(paved|asphalt|concrete)/.test(w)) grav+=d;
      const g=wayGrade(w), last=grades[grades.length-1]; if(last&&last[2]===g) last[1]=at+d; else grades.push([at,at+d,g]); at+=d; });
    return {km:(+f.properties["track-length"]||0)/1000,min,gravelKm:grav,grades,geom:f.geometry.coordinates.map(([lo,la,el])=>el!=null?{lat:la,lon:lo,ele:el}:{lat:la,lon:lo})}; };
  const out=[await get(0)];
  if(alts) for(const i of [1,2]){ try{ const x=await get(i); if(Math.abs(x.km-out[0].km)>1) out.push(x); }catch(e){} }
  return out;
}
/* one leg: own GPX track, or motorcycle routing with up to 3 ways; falls back to car routing */
async function routeLeg(a,b,lg){
  if(lg&&lg.track){const geom=lg.track.map(([la,lo])=>({lat:la,lon:lo}));const km=lineKm(geom);return [{km,min:km/TRACK_KMH*60,geom}];}
  const style=lg&&lg.fast?"tar":settings.style;
  const alts=!!(lg&&lg.alts);
  const veh=settings.vehicle||"bike", car=veh!=="bike";
  const key=(car?veh+"|":"")+style+(alts?"|alts":"")+"|"+[a,b].map(p=>p.lon.toFixed(5)+","+p.lat.toFixed(5)).join(";");
  if(cache.has(key)) return cache.get(key);
  let out;
  try{ out=await brouterLeg(a,b,veh,style,alts); }catch(e){ out=null; } // road-surface aware routing first
  if(!out) try{
    const body={locations:[a,b].map(p=>({lat:p.lat,lon:p.lon,type:"break"})),costing:car?"auto":"motorcycle",costing_options:car?{auto:(veh==="jeep"?STYLE_CAR:STYLE_SEDAN)[style]||STYLE_CAR.rough}:{motorcycle:STYLE[style]||STYLE.rough},...(alts?{alternates:2}:{}),units:"kilometers",directions_type:"none"};
    const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),alts?15000:10000);
    const r=await fetch(ROUTER,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:ctl.signal}); clearTimeout(tm);
    const j=await r.json(); if(!j.trip) throw new Error(j.error||"no route");
    out=[j.trip,...(j.alternates||[]).map(x=>x.trip)].map(t=>({km:t.summary.length,min:t.summary.time/60,geom:decode6(t.legs[0].shape)}));
  }catch(e){
    const r=await fetch(OSRM+[a,b].map(p=>p.lon.toFixed(5)+","+p.lat.toFixed(5)).join(";")+"?overview=full&geometries=geojson"+(alts?"&alternatives=2":"")); if(!r.ok) throw new Error("route");
    const j=await r.json(); if(j.code!=="Ok") throw new Error(j.code);
    out=j.routes.map(x=>({km:x.distance/1000,min:x.duration/60,geom:x.geometry.coordinates.map(([lo,la])=>({lat:la,lon:lo}))}));
  }
  cache.set(key,out); return out;
}
