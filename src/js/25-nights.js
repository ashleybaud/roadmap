/* ---------- night stops: a one-way trip over several days gets its nights picked for you ----------
   Route the whole way once, cut it into equal days, and put each night in the best town near the cut
   (a city or town on the route, so there's fuel and somewhere to sleep). Your own night stops are kept;
   change any suggested one and it's yours. Suggestions are redone only when the trip itself changes. */
function nightSig(){
  const p=x=>x&&x.lat!=null?x.lat.toFixed(3)+","+x.lon.toFixed(3):"-";
  return ["v3",p(trip.start),trip.round?"round":p(trip.end),nDays(),settings.vehicle,settings.style,...trip.days.slice(0,-1).map(d=>d.to&&!d.to.autoNight?p(d.to):"")].join("|");
}
async function autoNights(){
  const n=nDays(); if(n<2||trip.round||!trip.start||trip.start.lat==null||!trip.end||trip.end.lat==null){ delete trip.nightSig; return false; }
  const sig=nightSig(), fresh=trip.nightSig!==sig;
  // nothing to do unless the trip changed or a night is empty that you didn't empty yourself
  if(!fresh&&!trip.days.slice(0,-1).some(d=>!d.to&&!d.noAutoNight)) return false;
  if(fresh) trip.days.slice(0,-1).forEach(d=>{ delete d.noAutoNight; if(d.to&&d.to.autoNight){ d.to=null; d.legs=[]; } });
  trip.days.forEach(d=>{ const k=d.vias.length; d.vias=d.vias.filter(v=>!v.autoNight); if(d.vias.length!==k) d.legs=[]; }); // a suggested night that slid into a day when days were removed
  const towns=(await allTowns()).filter(t=>t.place==="city"||t.place==="town"||t.place==="village");
  // only towns with somewhere to sleep (our own list of stays): count beds within 5 km of each town
  const beds=(await Promise.all(Object.keys(COUNTRY_BOX).map(cc=>fetch(`/data/${cc}/sleep.json`).then(r=>r.ok?r.json():[]).catch(()=>[])))).flat().map(r=>({lat:r[0],lon:r[1]}));
  const bedsNear=t=>{ let n=0; for(const b of beds) if(Math.abs(b.lat-t.lat)<0.05&&Math.abs(b.lon-t.lon)<0.06&&hav(b,t)<=5) n++; return n; };
  let changed=false, a=0;
  while(a<n-1){
    if(trip.days[a].to||trip.days[a].noAutoNight){ a++; continue; }
    let b=a; while(b<n-1&&!trip.days[b].to&&!trip.days[b].noAutoNight) b++;          // days a..b-1 have no night stop; day b ends at a known place
    const A=dayFrom(a), B=dayTo(b); if(!A||!B||A.lat==null||B.lat==null){ a=b+1; continue; }
    const r=(await routeLeg(A,B,{fast:true}))[0], g=r.geom, cum=[0];
    for(let i=1;i<g.length;i++) cum.push(cum[i-1]+hav(g[i-1],g[i]));
    const total=cum[cum.length-1], parts=b-a+1, seg=total/parts, step=Math.max(1,Math.floor(g.length/3000));
    for(let i=1;i<parts;i++){
      const want=seg*i, lo=want-seg*0.2, hi=want+seg*0.2;
      const near=[]; for(let j=0;j<g.length;j+=step) if(cum[j]>=lo&&cum[j]<=hi) near.push(j);
      let best=null, bs=1e9;
      towns.forEach(t=>{
        if(Math.abs(t.lat-g[near[0]||0].lat)>4) return;
        let off=1e9, km=0; for(const j of near){ const d=Math.abs(g[j].lat-t.lat)<0.3&&Math.abs(g[j].lon-t.lon)<0.35?hav(g[j],t):1e9; if(d<off){ off=d; km=cum[j]; } }
        if(off>25) return;
        const nb=beds.length?bedsNear(t):1; if(!nb) return; // no beds, no night stop
        const s=Math.abs(km-want)/seg+(RANK[t.place]??3)*0.12+(off<=3?0:off/15)-Math.min(nb,10)*0.01+(nb<3?0.15:0); if(s<bs){ bs=s; best=t; } });
      if(best){ trip.days[a+i-1].to=pt(best.name,best.lat,best.lon,{autoNight:true}); trip.days[a+i-1].legs=[]; trip.days[a+i-1].fresh=true; changed=true; }
    }
    a=b+1;
  }
  trip.nightSig=nightSig(); save();
  return changed;
}
