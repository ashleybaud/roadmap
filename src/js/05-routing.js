const cache=new Map();
function decode6(str){let i=0,lat=0,lon=0;const out=[];while(i<str.length){let b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);lat+=r&1?~(r>>1):r>>1;sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);lon+=r&1?~(r>>1):r>>1;out.push({lat:lat/1e6,lon:lon/1e6});}return out;}
const STYLE={rough:{use_highways:0,use_primary:0.2,use_trails:1},mixed:{use_highways:0.5,use_primary:0.5,use_trails:0.5},tar:{use_highways:1,use_primary:1,use_trails:0}};
const lineKm=g=>{let k=0;for(let i=1;i<g.length;i++)k+=hav(g[i-1],g[i]);return k;};
/* one leg: own GPX track, or motorcycle routing with up to 3 ways; falls back to car routing */
async function routeLeg(a,b,lg){
  if(lg&&lg.track){const geom=lg.track.map(([la,lo])=>({lat:la,lon:lo}));const km=lineKm(geom);return [{km,min:km/30*60,geom}];}
  const style=lg&&lg.fast?"tar":settings.style;
  const alts=!!(lg&&lg.alts);
  const key=style+(alts?"|alts":"")+"|"+[a,b].map(p=>p.lon.toFixed(5)+","+p.lat.toFixed(5)).join(";");
  if(cache.has(key)) return cache.get(key);
  let out;
  try{
    const body={locations:[a,b].map(p=>({lat:p.lat,lon:p.lon,type:"break"})),costing:"motorcycle",costing_options:{motorcycle:STYLE[style]||STYLE.rough},...(alts?{alternates:2}:{}),units:"kilometers",directions_type:"none"};
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
