/* ---------- terrain grading ----------
   Every stretch gets a terrain grade from the OpenStreetMap tags BRouter reports for it, on a scale riders know from 4x4 trails:
   Race (tar) · Pre-jeep (graded gravel) · Jeep (rough tracks) · Pre-single (rocks, steep, sand, river crossings) · Single (bike-only single track or serious 4x4).
   0 = surface not on the map. What a grade means depends on the vehicle (vehNote), and so does the speed (gradeSpeed).
   A day's grade = the km at each grade (the bar) and its hardest grade with at least 1 km of it (the badge). */
const GRADES=[
  {g:0,short:"?",name:"Surface unknown",text:"The map doesn't say what this road is. Often gravel in the countryside.",col:"#C9CEC5"},
  {g:1,short:"Race",name:"Race",text:"Tar and smooth roads. Any car, any bike.",col:"#7A847D"},
  {g:2,short:"Pre-jeep",name:"Pre-jeep",text:"Graded gravel and good dirt roads. Fine in any car, cruising on a bike.",col:"#D9A441"},
  {g:3,short:"Jeep",name:"Jeep",text:"Rough tracks: corrugations, loose stones, ruts. Slow in a car, clearance helps; fun on a bike.",col:"#D9702B"},
  {g:4,short:"Pre-single",name:"Pre-single",text:"Rocks, steep climbs, sand, river crossings. 4x4 (low range at times) or an adventure bike. Not for cars.",col:"#B3261E"},
  {g:5,short:"Single",name:"Single",text:"Bike-only single track or serious 4x4 terrain. Experienced riders and drivers only.",col:"#2A0F0D"},
];
// what a grade means for the vehicle in Settings
const VEH_NOTE={car:["","any car","any car","slow, clearance helps","not for cars","not for cars"],jeep:["","easy","easy","fine","low range at times","experienced only"],bike:["","easy","cruising","fun","adventure bike","experienced only"]};
const vehNote=g=>(VEH_NOTE[settings.vehicle]||VEH_NOTE.bike)[g]||"";
// speed by grade and vehicle (km/h); tar uses the road type instead
const GRADE_KMH={bike:[0,0,65,50,35,20],jeep:[0,0,60,35,15,8],car:[0,0,60,30,10,5]};
function gradeSpeed(g,veh){ const t=GRADE_KMH[veh]||GRADE_KMH.bike; return g>=2?t[g]:0; }
function wayGrade(w){
  const tag=k=>{ const m=w.match(new RegExp("(?:^|\\s)"+k+"=([^\\s]+)")); return m?m[1]:""; };
  const h=tag("highway"), s=tag("surface"), tt=(tag("tracktype").match(/\d/)||[])[0], sm=tag("smoothness");
  if(tag("sac_scale")||h==="path"||h==="bridleway"||tt==="5"||/very_horrible|impassable/.test(sm)) return 5;
  if(tt==="4"||tag("4wd_only")==="yes"||tag("ford")==="yes"||/^(very_bad|horrible)$/.test(sm)||/^(sand|mud|rock)$/.test(s)) return 4;
  if(/^(paved|asphalt|concrete|paving_stones|sett|chipseal|metal)/.test(s)) return /^(bad)$/.test(sm)?2:1;
  if(tt==="3"||/^(dirt|earth|ground|grass|pebblestone|unpaved)$/.test(s)&&h==="track"||/^(dirt|earth|ground|grass)$/.test(s)||sm==="bad") return 3;
  if(/^(gravel|fine_gravel|compacted|unpaved|pebblestone)$/.test(s)||tt==="1"||tt==="2") return 2;
  if(h==="track") return 3;
  if(/^(motorway|trunk|primary|secondary)(_link)?$/.test(h)) return 1; // big roads without a surface tag are almost always sealed
  if(/^(residential|living_street|service|tertiary)(_link)?$/.test(h)) return 1;
  return 0; // e.g. an unclassified country road with no surface on the map
}
// km at each grade for some legs, plus the hardest grade with at least 1 km
function gradeKm(legs){
  const km=[0,0,0,0,0,0]; (legs||[]).forEach(L=>(L.grades||[[0,L.km,0]]).forEach(([a,b,g])=>km[g]+=Math.max(0,b-a)));
  const tot=km.reduce((t,x)=>t+x,0); let top=0; for(let g=5;g>=1;g--) if(km[g]>=1){ top=g; break; }
  return {km,tot,top};
}
function gradeTitle(G){ return GRADES.filter(x=>G.km[x.g]>=0.5).map(x=>`${x.name}${x.g?` (${vehNote(x.g)})`:""}: ${Math.round(G.km[x.g])} km`).join("\n"); }
function gradeBar(G,big){
  if(!G||!G.tot) return "";
  const segs=[1,2,3,4,5,0].filter(g=>G.km[g]>0).map(g=>`<i style="flex:${G.km[g].toFixed(2)};background:${GRADES[g].col}"></i>`).join("");
  const unp=G.km[2]+G.km[3]+G.km[4]+G.km[5], pc=Math.round(unp/G.tot*100);
  return `<span class="gradebar ${big?"big":""}" title="${esc(gradeTitle(G))}"><span class="gbadge g${G.top}" title="Hardest: ${esc(GRADES[G.top].name)}${G.top?`, ${esc(vehNote(G.top))}`:""}">${G.top?GRADES[G.top].short:"?"}</span><span class="gstrip">${segs}</span><span class="gpc">${pc}% gravel${G.km[0]>=1?` · ${Math.round(G.km[0])} km unknown`:""}</span></span>`;
}
const dayGrade=k=>plan&&plan.days[k]?gradeKm(plan.days[k].legs):null;
const tripGrade=()=>plan?gradeKm(plan.days.filter(Boolean).flatMap(d=>d.legs)):null;
// map layer: the route coloured by grade
function drawGradeLayer(sel){
  plan.days.forEach((d,k)=>{ if(!d||(sel&&sel!==d)) return;
    d.legs.forEach(lg=>(lg.grades||[]).forEach(([a,b,g])=>{ const s=seg(lg.a+a,lg.a+b); if(s.length>1) L.polyline(s.map(p=>[p.lat,p.lon]),{color:GRADES[g].col,weight:6,opacity:.95,lineCap:"butt"}).bindTooltip(`${GRADES[g].name}${g?` · ${vehNote(g)}`:""}`,{sticky:true}).addTo(layer); })); });
}
function gradeKeyHtml(){ return GRADES.slice(1).concat(GRADES[0]).map(x=>`<div><span class="gbadge g${x.g}">${x.short}</span> ${x.text}</div>`).join(""); }
$("gradeKey").innerHTML=gradeKeyHtml();

/* ---------- warnings from the grade, for the vehicle in Settings ---------- */
function gradeWarnFor(k){
  const pd=plan&&plan.days[k]; if(!pd) return []; const out=[], veh=settings.vehicle||"bike";
  const at=g=>{ for(const lg of pd.legs) for(const [a,b,gg] of (lg.grades||[])) if(gg>=g&&b-a>=0.3) return Math.round(lg.a+a-pd.a); return null; };
  const G=gradeKm(pd.legs), km=g=>Math.round(G.km[g]), hard=km(4)+km(5);
  if(veh==="car"&&hard>=1) out.push({lvl:"bad",text:`Not for a car: ${hard} km of Pre-single or Single from about km ${at(4)}. Pick a 4x4 in Settings, or switch that stretch to the quick way.`});
  else if(veh==="car"&&km(3)>=5) out.push({lvl:"warn",text:`${km(3)} km of Jeep track from about km ${at(3)}: slow going, high clearance helps.`});
  if(veh!=="car"&&km(5)>=1) out.push({lvl:"warn",text:`${km(5)} km of Single from about km ${at(5)}: experienced ${veh==="bike"?"riders":"drivers"} only.`});
  if(veh==="jeep"&&km(4)>=3) out.push({lvl:"info",text:`${km(4)} km of Pre-single: low range likely in places.`});
  return out;
}

/* ---------- elevation: climb, highest point, steep stretches, cold at height ---------- */
// BRouter gives a height for every point; other routers don't, so days routed elsewhere show nothing
function dayElev(k){
  const pd=plan&&plan.days[k]; if(!pd) return null;
  const pts=[]; plan.geom.forEach((g,i)=>{ if(plan.cum[i]>=pd.a-0.01&&plan.cum[i]<=pd.b+0.01&&g.ele!=null) pts.push({e:g.ele,km:plan.cum[i]}); });
  if(pts.length<10||pts.length<(plan.geom.filter((g,i)=>plan.cum[i]>=pd.a&&plan.cum[i]<=pd.b).length)*0.8) return null;
  let up=0,dn=0,ref=pts[0].e,top=pts[0],low=pts[0];
  pts.forEach(p=>{ const d=p.e-ref; if(d>=8){ up+=d; ref=p.e; } else if(d<=-8){ dn-=d; ref=p.e; } if(p.e>top.e) top=p; if(p.e<low.e) low=p; }); // ignore small wobbles in the height data
  let steep=0, steepKm=null, j=0;
  for(let i=0;i<pts.length;i++){ while(j<pts.length&&pts[j].km-pts[i].km<0.5) j++; if(j>=pts.length) break; const gr=Math.abs(pts[j].e-pts[i].e)/((pts[j].km-pts[i].km)*1000)*100; if(gr>steep){ steep=gr; steepKm=pts[i].km; } }
  return {up:Math.round(up),dn:Math.round(dn),top:Math.round(top.e),topKm:top.km-pd.a,low:Math.round(low.e),end:pts[pts.length-1].e,steep,steepKm:steepKm!=null?steepKm-pd.a:null,pts,a:pd.a,b:pd.b};
}
const fmtM=m=>Math.round(m).toLocaleString("en-ZA").replace(/\u00a0/g," ");
function elevLine(k){ const E=dayElev(k); if(!E) return ""; return `<span class="elevline" title="Climb and descent for the day, and the highest point">⛰ ↑ ${fmtM(E.up)} m · ↓ ${fmtM(E.dn)} m · top ${fmtM(E.top)} m</span>`; }
// a small height profile, coloured by grade
function elevProfile(k){
  const E=dayElev(k); if(!E) return ""; const W=600,H=90,pad=4, span=Math.max(1,E.b-E.a), lo=Math.min(E.low,E.top-50), hi=E.top+20;
  const x=km=>pad+(km-E.a)/span*(W-2*pad), y=e=>H-pad-(e-lo)/(hi-lo)*(H-2*pad-12);
  const pd=plan.days[k], gAt=km=>{ for(const lg of pd.legs) for(const [a,b,g] of (lg.grades||[])) if(km>=lg.a+a-0.01&&km<=lg.a+b+0.01) return g; return 0; };
  const step=Math.max(1,Math.floor(E.pts.length/300)), P=E.pts.filter((p,i)=>i%step===0||i===E.pts.length-1);
  let segs="", cur=null, buf=[];
  P.forEach(p=>{ const g=gAt(p.km); if(g!==cur&&buf.length){ segs+=`<polyline points="${buf.join(" ")}" fill="none" stroke="${GRADES[cur].col}" stroke-width="3"/>`; buf=[buf[buf.length-1]]; } cur=g; buf.push(`${x(p.km).toFixed(1)},${y(p.e).toFixed(1)}`); });
  if(buf.length>1) segs+=`<polyline points="${buf.join(" ")}" fill="none" stroke="${GRADES[cur].col}" stroke-width="3"/>`;
  const area=`${x(E.a)},${H-pad} `+P.map(p=>`${x(p.km).toFixed(1)},${y(p.e).toFixed(1)}`).join(" ")+` ${x(E.b)},${H-pad}`;
  return `<div class="elevprof" title="Height along the day, coloured by grade"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Height profile"><polygon points="${area}" fill="var(--chip)"/>${segs}<text x="${x(E.a+E.topKm)}" y="10" font-size="10" text-anchor="middle" fill="var(--muted)">${fmtM(E.top)} m</text></svg></div>`;
}
function elevFor(k){
  const E=dayElev(k); if(!E) return []; const out=[];
  if(E.steep>=12&&E.steepKm!=null) out.push({lvl:E.steep>=18?"warn":"info",text:`Steep: about ${Math.round(E.steep)}% over 500 m near km ${Math.round(E.steepKm)}.${E.steep>=18?" Low gear, and take it slow on loose surface.":""}`});
  const w=typeof dayWx==="function"?dayWx(k):null;
  if(w&&!w.none&&w.tmin!=null&&E.top>=800){ const t=w.tmin-0.0065*(E.top-E.end); // about 6.5°C colder per 1,000 m higher
    if(t<=2) out.push({lvl:t<=0?"warn":"info",text:`Highest point ${fmtM(E.top)} m at km ${Math.round(E.topKm)}: about ${Math.round(t)}°C at dawn${t<=0?". Ice likely on shaded bends early in the day; leave later":", cold early in the day"}.`}); }
  if(E.top>=2500) out.push({lvl:"info",text:`Up to ${fmtM(E.top)} m: engines lose about a quarter of their power up there, and you tire faster.`});
  return out;
}
