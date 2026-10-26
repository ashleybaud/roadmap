/* ---------- good to know: per-day notes, worst first ----------
   Built only from data the app has: arrival times, opening hours, sunset, weather, fuel, towns,
   hospitals, river crossings, passes, cash machines at stops, clock changes, public holidays.
   Levels: bad (red), warn (orange), info (plain). Sections: dest (destination), stops, route. */

// South African public holidays for a year (Sunday holidays move to Monday)
function zaHolidays(y){
  var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  var em=Math.floor((h+l-7*m+114)/31), ed=((h+l-7*m+114)%31)+1, easter=new Date(y,em-1,ed,12);
  var off=(n)=>{var x=new Date(easter); x.setDate(x.getDate()+n); return ymd(x);};
  var fixed=[["01-01","New Year's Day"],["03-21","Human Rights Day"],["04-27","Freedom Day"],["05-01","Workers' Day"],["06-16","Youth Day"],["08-09","National Women's Day"],["09-24","Heritage Day"],["12-16","Day of Reconciliation"],["12-25","Christmas Day"],["12-26","Day of Goodwill"]];
  var out={}; out[off(-2)]="Good Friday"; out[off(1)]="Family Day";
  fixed.forEach(function(fx){ var s=y+"-"+fx[0], dt=new Date(s+"T12:00:00"); out[s]=fx[1]; if(dt.getDay()===0){ dt.setDate(dt.getDate()+1); out[ymd(dt)]=fx[1]+" (observed)"; } });
  return out;
}
function holidayOn(dateStr){ return zaHolidays(+dateStr.slice(0,4))[dateStr]||null; }

// names that suggest park or reserve gates with closing times
var GATE_RX=/national park|rest camp|nature reserve|game reserve|transfrontier|\bnp\b/i;
// border posts between South Africa and Namibia (hours as published; confirm before travelling)
var BORDERS=[
  {name:"Vioolsdrif / Noordoewer",lat:-28.766,lon:17.629,hours:"24 hours"},
  {name:"Nakop / Ariamsvlei",lat:-28.105,lon:19.996,hours:"24 hours"},
  {name:"Onseepkans / Velloorsdrif",lat:-28.75,lon:19.30,hours:"08:00–16:30"},
  {name:"Sendelingsdrif (pont)",lat:-28.12,lon:16.89,hours:"08:00–16:30, pont depends on the river"},
  {name:"Rietfontein / Klein Menasse",lat:-26.75,lon:20.03,hours:"08:00–16:30"},
  {name:"Mata-Mata (Kgalagadi)",lat:-25.77,lon:19.99,hours:"08:00–16:30, park rules apply"}];

function openAt(t,date,min){ var h=t&&t.hours; if(!h) return null; return ohOpen(h,date,((min%1440)+1440)%1440); }
// best answer for a group of places: open if any is open, closed if all known are closed, else unknown
function groupOpen(list,date,min){ var st=list.map(function(x){return openAt(x.tags,date,min);}); if(st.some(function(s){return s===true;})) return true; if(st.length&&st.every(function(s){return s===false;})) return false; return null; }

function goodToKnow(k){
  var pd=plan&&plan.days[k]; if(!pd) return [];
  var out=[], add=function(lvl,sec,text){ out.push({lvl:lvl,sec:sec,text:text}); };
  var last=pd.pts.length-1, to=pd.pts[last], date=dayDate(k), dateStr=addDays(trip.startDate,k);
  var arrive=arrMin(k,last), s=sunMin(k), w=dayWx(k), lastDay=k===nDays()-1;
  var at=function(m){ return fmtT(m)+(m>=1440?" (after midnight)":""); };

  // ---- destination
  if(s!=null){
    if(s<arrive) add("bad","dest","You arrive at "+to.name+" about "+at(arrive)+", after sunset ("+fmtT(s)+"). Leave earlier or shorten the day.");
    else if(s-arrive<60) add("warn","dest","You arrive at "+to.name+" about "+fmtT(arrive)+", "+Math.round(s-arrive)+" min before sunset ("+fmtT(s)+").");
    else add("info","dest","Arrive at "+to.name+" about "+fmtT(arrive)+" if you leave at "+fmtT(toMin(settings.leave))+". Sunset "+fmtT(s)+".");
  }
  if(GATE_RX.test(to.name)) add("warn","dest",to.name+" may be behind park or reserve gates that close in the evening. Confirm the gate time; you arrive about "+fmtT(arrive)+".");
  var av=placesOk?stopAvail(to):null;
  if(av){
    if(!av.fuel.length) add(lastDay?"info":"warn","dest","No fuel on our map in "+to.name+(lastDay?".":". Fill up before you get there."));
    else {
      var fo=groupOpen(av.fuel,date,arrive);
      if(fo===false) add("warn","dest","Fuel in "+to.name+" is closed when you arrive ("+fmtT(arrive)+")"+(av.fuel[0].tags.hours?": "+av.fuel[0].tags.hours:"")+".");
      if(!lastDay){ var nd=dayDate(k+1), lv=toMin(settings.leave), to2=groupOpen(av.fuel,nd,lv);
        if(to2===false) add("warn","dest","Fuel in "+to.name+" isn't open at "+fmtT(lv)+" tomorrow. Fill up tonight.");
        else if(to2===null&&fo!==false) add("info","dest","Fuel in "+to.name+": hours unknown"+(av.fuel[0].tags.phone?", phone "+av.fuel[0].tags.phone:"")+". Fill up tonight to be safe."); }
    }
    if(!lastDay){
      if(!av.food.length) add("info","dest","No restaurant or café on our map within 1 km of "+to.name+". Check where you're staying does meals.");
      else { var fd=groupOpen(av.food,date,arrive+30); if(fd===false) add("warn","dest","Food places near "+to.name+" look closed by "+fmtT(arrive+30)+". Check where you're staying does meals."); }
      if(av.shop.length){ var so=groupOpen(av.shop,date,arrive); if(so===false) add("info","dest","Shops in "+to.name+" are closed when you arrive."); }
      if(!av.cash.length) add("info","dest","No cash machine on our map in "+to.name+".");
    }
  }
  var nw=lastDay?null:dayWx(k+1);
  if(nw&&!nw.none&&nw.tmin<=5) add(nw.tmin<=0?"warn":"info","dest","Cold night: "+Math.round(nw.tmin)+"°C. Pack warm layers"+(nw.tmin<=0?" and watch for ice when you leave":"")+".");
  if(meds&&meds.length){ var hs=meds.filter(function(m){return m.type==="hospital";}).map(function(m){return {m:m,d:hav(m,to)};}).sort(function(a,b){return a.d-b.d;})[0];
    if(hs) add(hs.d>100?"warn":"info","dest","Nearest hospital to "+to.name+": "+(hs.m.name||"Hospital")+", "+Math.round(hs.d)+" km"+(hs.m.phone?", "+hs.m.phone:"")+"."); }

  // ---- stops along the way
  var hol=holidayOn(dateStr);
  if(hol) add("warn","stops",hol+" in South Africa. Shops and fuel in small towns may keep shorter hours.");
  else if(date.getDay()===0) add("info","stops","Sunday: shops and fuel in small towns may close early or not open.");
  var unknown=[];
  pd.pts.forEach(function(p,j){ if(j===0||j===last) return; var a=placesOk?stopAvail(p):null; if(!a||!a.fuel.length) return;
    var t=arrMin(k,j), st=groupOpen(a.fuel,date,t);
    if(st===false) add("warn","stops","Fuel in "+p.name+" is closed when you pass (about "+fmtT(t)+")"+(a.fuel[0].tags.hours?": "+a.fuel[0].tags.hours:"")+".");
    else if(st===null) unknown.push(p.name+(a.fuel[0].tags.phone?" ("+a.fuel[0].tags.phone+")":"")); });
  if(unknown.length) add("info","stops","Fuel hours unknown at "+unknown.join(", ")+". Phone ahead on remote stretches.");
  if(placesOk&&!pd.pts.some(function(p){return stopAvail(p).cash.length;})) add("info","stops","No cash machine at any stop today. Small-town fuel and farm stalls may be cash only.");

  // ---- route and weather
  var f=rangeFuel(pd.a,pd.b); if(f) add("warn","route",f.text+". Small towns may still have fuel: ask locally or carry extra.");
  var mins=dayMinutes(k); if(mins>+settings.maxHours*60) add("warn","route",VEH().Ing+" time "+fmtDur(mins)+", over your "+settings.maxHours+"h limit.");
  if(w&&!w.none){
    if(w.code>=95) add("warn","route","Thunderstorms forecast.");
    if(w.gust>=80) add("bad","route","Wind gusts to "+Math.round(w.gust)+" km/h."); else if(w.gust>=60) add("warn","route","Strong wind, gusts to "+Math.round(w.gust)+" km/h.");
    if(w.tmax>=42) add("bad","route","Extreme heat: "+Math.round(w.tmax)+"°C. Leave early, carry lots of water."); else if(w.tmax>=37) add("warn","route","Hot: "+Math.round(w.tmax)+"°C. Carry extra water.");
    if(w.rain>=25) add("bad","route","Heavy rain: "+Math.round(w.rain)+" mm. Gravel and river crossings may be impassable."); else if(w.rain>=8&&w.prob>=50) add("warn","route","Rain likely: "+Math.round(w.rain)+" mm. Gravel gets slippery.");
    if(w.tmin<=2) add("warn","route","Near freezing in the morning: "+Math.round(w.tmin)+"°C. Watch for ice early.");
  } else if(w&&w.none) add("info","route","Weather forecast available from "+fmtDate(new Date(w.opens+"T12:00:00"))+".");
  var fdn=dayFords(k); if(fdn) add(w&&!w.none&&w.rain>=5?"warn":"info","route",fdn+" river crossing"+(fdn>1?"s":"")+" on the route"+(w&&!w.none&&w.rain>=5?", with rain forecast. Check levels before crossing.":"."));
  var m=dayMed(k); if(m&&m.far>120) add("warn","route","Remote: parts of the day are up to "+fmtFar(m.far)+" km from a hospital. Emergency from a mobile: 112.");
  // longest stretch with no town within 5 km of the route
  if(townList){ var ts=stopTowns().filter(function(t){return t.off<=5&&t.km>pd.a+1&&t.km<pd.b-1;}).map(function(t){return t.km;});
    var marks=[pd.a].concat(ts,[pd.b]).sort(function(a,b){return a-b;}), gap=0, ga=0;
    for(var i=1;i<marks.length;i++) if(marks[i]-marks[i-1]>gap){ gap=marks[i]-marks[i-1]; ga=marks[i-1]; }
    if(gap>=120) add("info","route","Longest stretch with no town: "+Math.round(gap)+" km, from km "+Math.round(ga-pd.a)+". Carry water."); }
  var passes=pois.filter(function(p){return p.kind==="pass"&&p.off<=1&&p.km>=pd.a&&p.km<=pd.b;}).sort(function(a,b){return a.km-b.km;});
  if(passes.length) add("info","route","Passes: "+passes.slice(0,6).map(function(p){return p.name+" (km "+Math.round(p.km-pd.a)+")";}).join(", ")+(passes.length>6?" and more":"")+".");
  BORDERS.forEach(function(b){ var near=plan.geom.some(function(g,ix){return plan.cum[ix]>=pd.a&&plan.cum[ix]<=pd.b&&ix%5===0&&hav(g,b)<8;});
    if(near) add("warn","route","Border post "+b.name+": "+b.hours+". Passport, bike papers and a letter of authority if the bike isn't in your name."); });
  if(w&&w.tz) add("info","route","Clocks change today: "+utc(w.tz.from)+" to "+utc(w.tz.to)+".");

  var rank={bad:0,warn:1,info:2};
  return out.sort(function(a,b){return rank[a.lvl]-rank[b.lvl];});
}
var GTK_SEC={dest:"At your destination",stops:"Stops along the way",route:"The route and weather"};
var gtkOpen=new Set();
function gtkHtml(k){
  var g=goodToKnow(k); if(!g.length) return "";
  var key=g.filter(function(x){return x.lvl!=="info";}), more=g.length-key.length, open=gtkOpen.has(k);
  var list=open?g:key;
  var body=["dest","stops","route"].map(function(sec){ var it=list.filter(function(x){return x.sec===sec;}); if(!it.length) return "";
    return '<div class="gsec"><div class="gsh">'+GTK_SEC[sec]+'</div>'+it.map(function(x){return '<div class="g'+x.lvl+'">'+esc(x.text)+'</div>';}).join("")+'</div>'; }).join("");
  return '<section class="gtk"><h3 class="detailh">Good to know'+(key.length?' <span class="gcount">'+key.length+'</span>':'')+'</h3>'
    +(body||'<div class="note">Nothing that needs attention.</div>')
    +(more?'<button class="linkbtn" type="button" data-gtk="'+k+'">'+(open?"Show less":"Show "+more+" more")+'</button>':'')+'</section>';
}
function gtkCount(k){ return goodToKnow(k).filter(function(x){return x.lvl!=="info";}).length; }
