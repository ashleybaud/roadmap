/* ---------- plan a whole trip from a GPX file ----------
   The file's line is followed exactly (no re-routing). The trip keeps the line in trip.gpx;
   every stretch whose two ends sit on the line uses that piece of it, so adding stops or
   moving a night stop along the line still follows the file. */

// all tracks in a file, each as one list of points; routes if there are no tracks
function gpxTracks(text){
  var doc=new DOMParser().parseFromString(text,"application/xml"), out=[];
  var pt=function(n){ return {lat:+n.getAttribute("lat"),lon:+n.getAttribute("lon")}; }, ok=function(p){ return isFinite(p.lat)&&isFinite(p.lon); };
  [].slice.call(doc.getElementsByTagName("trk")).forEach(function(t){ var p=[].slice.call(t.getElementsByTagName("trkpt")).map(pt).filter(ok); if(p.length>1) out.push(p); });
  if(!out.length) [].slice.call(doc.getElementsByTagName("rte")).forEach(function(r){ var p=[].slice.call(r.getElementsByTagName("rtept")).map(pt).filter(ok); if(p.length>1) out.push(p); });
  var name=(doc.querySelector("trk > name, rte > name, metadata > name")||{}).textContent||"";
  return {tracks:out,name:name.trim()};
}
// one line from the file: tracks that follow on from each other are joined (a multi-day file); otherwise the longest
function gpxLine(tracks){
  if(!tracks.length) return [];
  var joined=tracks[0].slice(), chain=true;
  for(var i=1;i<tracks.length;i++){ if(hav(joined[joined.length-1],tracks[i][0])<5) joined=joined.concat(tracks[i]); else { chain=false; break; } }
  if(chain) return joined;
  return tracks.map(function(t){ return {t:t,km:lineKm(t)}; }).sort(function(a,b){ return b.km-a.km; })[0].t;
}
function densify(pts,maxKm){ var out=[pts[0]]; for(var i=1;i<pts.length;i++){ var a=pts[i-1],b=pts[i],n=Math.floor(hav(a,b)/maxKm); for(var j=1;j<=n;j++) out.push({lat:a.lat+(b.lat-a.lat)*j/(n+1),lon:a.lon+(b.lon-a.lon)*j/(n+1)}); out.push(b); } return out; }
var gpxCache=null;
function gpxPts(){ if(!trip.gpx) return null; if(!gpxCache||gpxCache.src!==trip.gpx.pts){ gpxCache={src:trip.gpx.pts,pts:trip.gpx.pts.map(function(a){return {lat:a[0],lon:a[1]};})}; } return gpxCache.pts; }
// first place, from index `from` on, where the line comes within 5 km of p, then the closest point of that pass
function gpxApproach(P,p,from){
  for(var i=from;i<P.length;i++){ if(hav(P[i],p)<5){ var j=i; while(j+1<P.length&&hav(P[j+1],p)<=hav(P[j],p)) j++; return j; } }
  return -1;
}
// for each day and stretch: the piece of the file's line to follow, or null to route it
function gpxSlices(){
  var P=gpxPts(); if(!P) return null; var cur=0, out=[];
  trip.days.forEach(function(d,k){ var pts=dayPts(k), row=[]; out.push(row); if(!pts) return;
    for(var j=0;j<pts.length-1;j++){ var ia=gpxApproach(P,pts[j],cur); if(ia<0){ row.push(null); continue; }
      var ib=gpxApproach(P,pts[j+1],ia+1); if(ib<0||ib-ia<1){ row.push(null); continue; }
      row.push(trip.gpx.pts.slice(ia,ib+1)); cur=ib; } });
  return out;
}

async function planFromGpx(file){
  var parsed; try{ parsed=gpxTracks(await file.text()); }catch(e){ parsed={tracks:[]}; }
  var line=gpxLine(parsed.tracks);
  if(line.length<2){ $("status").textContent="That file has no track or route in it."; return; }
  line=densify(simplify(line,15),1); // straight stretches keep a point every km, so towns and stops along them are found
  var cum=[0]; for(var i=1;i<line.length;i++) cum.push(cum[i-1]+hav(line[i-1],line[i]));
  var total=cum[cum.length-1]; if(total<1){ $("status").textContent="That track is too short to plan."; return; }
  $("status").textContent="Reading "+file.name+"…";
  var towns=(townList||await allTowns().catch(function(){return [];})).filter(function(t){return t.place!=="hamlet";});
  var sleep=[]; try{ sleep=(await localKind("sleep",Object.keys(COUNTRY_BOX)))||[]; }catch(e){}
  var nearTown=function(p,maxKm){ var best=null,bd=maxKm; towns.forEach(function(t){ if(Math.abs(t.lat-p.lat)>0.2) return; var d=hav(t,p); if(d<bd){bd=d;best=t;} }); return best; };
  var dayKm=Math.max(80,(+settings.maxHours||8)*TRACK_KMH*0.85), n=Math.max(1,Math.ceil(total/dayKm));
  var step=Math.max(1,Math.floor(line.length/3000)), nights=[];
  for(var q=1;q<n;q++){
    var ideal=total*q/n, best=null, bs=Infinity;
    [0.2,0.35].forEach(function(f){ if(best) return; var win=f*total/n;
    towns.forEach(function(t){
      var lo=ideal-win, hi=ideal+win, bd=6, bk=0;
      for(var i=0;i<line.length;i+=step){ if(cum[i]<lo||cum[i]>hi) continue; var d=hav(line[i],t); if(d<bd){bd=d;bk=cum[i];} }
      if(bd>5) return;
      var stay=sleep.some(function(r){ return Math.abs(r[0]-t.lat)<0.05&&hav({lat:r[0],lon:r[1]},t)<=3; });
      var sc=Math.abs(bk-ideal)/win+(stay?0:0.6)+(t.place==="city"||t.place==="town"?0:0.3)+bd/10;
      if(sc<bs){ bs=sc; best={name:t.name,lat:t.lat,lon:t.lon}; } }); });
    if(!best){ var ix=cum.findIndex(function(c){return c>=ideal;}), p=line[Math.max(0,ix)], nt=nearTown(p,40); best={name:nt?"Near "+nt.name:"Night "+q,lat:+p.lat.toFixed(5),lon:+p.lon.toFixed(5)}; }
    nights.push(best);
  }
  var a=line[0], b=line[line.length-1], round=hav(a,b)<3;
  var nameOf=function(p,fallback){ var t=nearTown(p,10); return t?t.name:fallback; };
  var prev=JSON.parse(JSON.stringify(trip)); snapTrip(true);
  var start=trip.startDate&&trip.startDate>=tomorrow?trip.startDate:tomorrow;
  var nt={startDate:start,endDate:addDays(start,n-1),round:round,sugV:5,
    start:pt(nameOf(a,"Start"),+a.lat.toFixed(5),+a.lon.toFixed(5)),
    end:round?null:pt(nameOf(b,"Finish"),+b.lat.toFixed(5),+b.lon.toFixed(5)),
    days:[], gpx:{name:file.name,title:parsed.name,pts:line.map(function(p){return [+p.lat.toFixed(5),+p.lon.toFixed(5)];})}};
  for(var k=0;k<n;k++) nt.days.push({to:k<n-1?pt(nights[k].name,nights[k].lat,nights[k].lon):null,style:"default",vias:[],legs:[],fresh:true});
  Object.keys(trip).forEach(function(x){ delete trip[x]; }); Object.assign(trip,nt);
  ui.tab="ov"; plan=null; fp=null; gpxCache=null; changed();
  $("status").textContent="Planned "+file.name+": "+Math.round(total).toLocaleString()+" km in "+n+" day"+(n>1?"s":"")+". Move any night stop to change the days.";
  var tt=$("toast"); tt.innerHTML='Trip planned from '+esc(file.name)+'. <button type="button" class="linkbtn">Undo</button>'; tt.hidden=false;
  tt.querySelector("button").onclick=function(){ Object.keys(trip).forEach(function(x){ delete trip[x]; }); Object.assign(trip,prev); tt.hidden=true; gpxCache=null; changed(); };
  clearTimeout(toastT); toastT=setTimeout(function(){ tt.hidden=true; },10000);
}
function gpxBar(){
  if(trip.gpx) return '<div class="gpxbar note">Following <b>'+esc(trip.gpx.title||trip.gpx.name)+'</b> exactly. <button class="linkbtn" type="button" data-ungpx>Stop following it</button></div>';
  return '<div class="gpxbar note"><button type="button" class="linkbtn" data-picks>Find a route</button> · Got a route already? <label class="linkbtn gpxbtn" title="Load any route from a friend or your GPS. It\'s split into days with night stops and fuel.">Plan from a GPX file<input type="file" accept=".gpx,application/gpx+xml" data-tripgpx hidden></label></div>';
}
