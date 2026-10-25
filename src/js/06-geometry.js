function simplify(pts,eps){
  if(pts.length<3) return pts;
  const perp=(p,a,b)=>{const k=Math.cos(rad(a.lat))*111320,x=q=>[(q.lon-a.lon)*k,(q.lat-a.lat)*110540];const P=x(p),B=x(b),L=Math.hypot(B[0],B[1])||1;return Math.abs(P[0]*B[1]-P[1]*B[0])/L;};
  const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];
  while(st.length){const [s,e]=st.pop();let mi=-1,md=0;for(let i=s+1;i<e;i++){const d=perp(pts[i],pts[s],pts[e]);if(d>md){md=d;mi=i;}}if(md>eps){keep[mi]=1;st.push([s,mi],[mi,e]);}}
  return pts.filter((_,i)=>keep[i]);
}
/* where along the whole trip (km) a point sits, and how far off the route it is */
function locate(p,geom,cum){
  const st=Math.max(2,Math.floor(geom.length/800)); let bi=0,bd=Infinity;
  for(let i=0;i<geom.length;i+=st){const d=hav(p,geom[i]);if(d<bd){bd=d;bi=i;}}
  const lo=Math.max(0,bi-st), hi=Math.min(geom.length-1,bi+st);
  for(let i=lo;i<=hi;i++){const d=hav(p,geom[i]);if(d<bd){bd=d;bi=i;}}
  return {km:cum[bi],off:bd};
}

/* a road ridden on two days (out and back) passes the same towns twice: match a place to each day's own stretch */
function locateDays(p,geom,cum,max){
  const days=plan&&plan.days?plan.days.filter(Boolean):[];
  if(days.length<2){ const r=locate(p,geom,cum); return [r]; }
  if(!plan._dayIdx){ const bs=km=>{let lo=0,hi=cum.length-1; while(lo<hi){const m=(lo+hi)>>1; if(cum[m]<km) lo=m+1; else hi=m;} return lo;};
    plan._dayIdx=days.map(d=>[bs(d.a),Math.max(bs(d.a),bs(d.b))]); }
  let out=[];
  plan._dayIdx.forEach(([lo,hi])=>{ const st=Math.max(2,Math.floor((hi-lo)/400)); let bi=lo,bd=Infinity;
    for(let i=lo;i<=hi;i+=st){const d=hav(p,geom[i]);if(d<bd){bd=d;bi=i;}}
    for(let i=Math.max(lo,bi-st);i<=Math.min(hi,bi+st);i++){const d=hav(p,geom[i]);if(d<bd){bd=d;bi=i;}}
    out.push({km:cum[bi],off:bd}); });
  const best=out.reduce((x,y)=>y.off<x.off?y:x);
  out=out.filter(r=>r.off<=max).filter((r,i,a)=>!a.slice(0,i).some(o=>Math.abs(o.km-r.km)<1));
  return out.length?out:[best];
}
