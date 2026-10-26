/* ---------- route grading ----------
   Grade of each stretch of road, from the OpenStreetMap tags BRouter reports for it.
   G1 tar · G2 good gravel, any car · G3 rough gravel · G4 4x4 / adventure bike · G5 expert. 0 = surface not on the map.
   A day's grade = the km at each grade (the bar) and its hardest grade with at least 1 km of it (the badge). */
const GRADES=[
  {g:0,short:"?",name:"Surface unknown",text:"The map doesn't say what this road is. Often gravel in the countryside.",col:"#C9CEC5"},
  {g:1,short:"G1",name:"Tar",text:"Sealed road.",col:"#7A847D"},
  {g:2,short:"G2",name:"Good gravel",text:"Graded gravel. Fine in any car, easy on any bike.",col:"#D9A441"},
  {g:3,short:"G3",name:"Rough gravel",text:"Corrugations, loose stones, ruts. Take it slower; road tyres struggle.",col:"#D9702B"},
  {g:4,short:"G4",name:"4x4 / adventure",text:"Rocks, sand, steep climbs, river crossings. High clearance or an adventure bike and some skill.",col:"#B3261E"},
  {g:5,short:"G5",name:"Expert",text:"Technical: big rocks, deep sand, steep and loose. Experienced riders and proper 4x4s only.",col:"#2A0F0D"},
];
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
function gradeTitle(G){ return GRADES.filter(x=>G.km[x.g]>=0.5).map(x=>`${x.short==="?"?"Unknown":x.short} ${x.name}: ${Math.round(G.km[x.g])} km`).join("\n"); }
function gradeBar(G,big){
  if(!G||!G.tot) return "";
  const segs=[1,2,3,4,5,0].filter(g=>G.km[g]>0).map(g=>`<i style="flex:${G.km[g].toFixed(2)};background:${GRADES[g].col}"></i>`).join("");
  const unp=G.km[2]+G.km[3]+G.km[4]+G.km[5], pc=Math.round(unp/G.tot*100);
  return `<span class="gradebar ${big?"big":""}" title="${esc(gradeTitle(G))}"><span class="gbadge g${G.top}" title="Hardest: ${esc(GRADES[G.top].name)}">${G.top?GRADES[G.top].short:"G?"}</span><span class="gstrip">${segs}</span><span class="gpc">${pc}% gravel${G.km[0]>=1?` · ${Math.round(G.km[0])} km unknown`:""}</span></span>`;
}
const dayGrade=k=>plan&&plan.days[k]?gradeKm(plan.days[k].legs):null;
const tripGrade=()=>plan?gradeKm(plan.days.filter(Boolean).flatMap(d=>d.legs)):null;
// map layer: the route coloured by grade
function drawGradeLayer(sel){
  plan.days.forEach((d,k)=>{ if(!d||(sel&&sel!==d)) return;
    d.legs.forEach(lg=>(lg.grades||[]).forEach(([a,b,g])=>{ const s=seg(lg.a+a,lg.a+b); if(s.length>1) L.polyline(s.map(p=>[p.lat,p.lon]),{color:GRADES[g].col,weight:6,opacity:.95,lineCap:"butt"}).bindTooltip(`${GRADES[g].short==="?"?"":GRADES[g].short+" "}${GRADES[g].name}`,{sticky:true}).addTo(layer); })); });
}
function gradeKeyHtml(){ return GRADES.slice(1).concat(GRADES[0]).map(x=>`<div><span class="gbadge g${x.g}">${x.short==="?"?"?":x.short}</span> <b>${x.name}.</b> ${x.text}</div>`).join(""); }
$("gradeKey").innerHTML=gradeKeyHtml();
