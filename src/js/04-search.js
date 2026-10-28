/* place search: our own town list first (typo-tolerant), then the worldwide search */
const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[^a-z]/g,"");
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[n];}
let townsP=null;
function allTowns(){
  if(!townsP) townsP=Promise.all(Object.keys(COUNTRY_BOX).map(cc=>fetch(`/data/${cc}/towns.json`).then(r=>r.ok?r.json():[]).catch(()=>[]).then(rows=>rows.map(r=>({name:r[2],lat:r[0],lon:r[1],place:r[3],sub:r[4]||cc.toUpperCase(),n:norm(r[2])})))))
    .then(a=>a.flat());
  return townsP;
}
const RANK={city:0,town:1,village:2,hamlet:3};
async function searchPlaces(q,c,signal){
  const nq=norm(q); const out=[];
  const towns=await allTowns();
  if(towns.length&&nq.length>=3){
    const tol=nq.length>7?2:1;
    towns.map(t=>{const pre=lev(nq,t.n.slice(0,nq.length));const full=lev(nq,t.n);return {t,d:Math.min(pre+0.5*(t.n.length>nq.length),full)};})
      .filter(x=>x.d<=tol).sort((a,b)=>a.d-b.d||(RANK[a.t.place]??4)-(RANK[b.t.place]??4)).slice(0,5)
      .forEach(x=>out.push({name:x.t.name,sub:[x.t.place,x.t.sub].filter(Boolean).join(", "),lat:x.t.lat,lon:x.t.lon}));
  }
  const variants=[...new Set([q,q.replace(/\d+/g,""),q.replace(/\s+/g,"")])].filter(v=>v.trim().length>=3);
  const res=await Promise.all(variants.map(v=>fetch(`${PHOTON}?q=${encodeURIComponent(v)}&limit=6&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&location_bias_scale=0.5`,{signal}).then(r=>r.json()).catch(()=>({features:[]}))));
  res.flatMap(j=>j.features||[]).forEach(f=>{const p=f.properties;const [lon,lat]=f.geometry.coordinates;
    const stay=p.osm_key==="tourism"&&/^(hotel|motel|guest_house|hostel|chalet|apartment|camp_site|caravan_site|alpine_hut|wilderness_hut)$/.test(p.osm_value||"");
    out.push({name:p.name||p.street||q,sub:[stay?"🛏 place to stay":"",p.city||p.county,p.state,p.country].filter(x=>x&&x!==p.name).join(", "),lat,lon,stay});});
  const seen=new Set(); return out.filter(r=>{const k=norm(r.name)+Math.round(r.lat*20)+","+Math.round(r.lon*20);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8);
}
