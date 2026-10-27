const OSRM="https://router.project-osrm.org/route/v1/driving/";
const PHOTON="https://photon.komoot.io/api/";
/* routing and map tiles: Stadia Maps (paid, authorised by domain); free servers only as a fallback */
const ROUTER="https://api.stadiamaps.com/route/v1";
const TILES={url:"https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",attribution:'© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:18};
const OVERPASS="/api/places";
const TYPES=[
  {id:"view",n:"Viewpoints",c:"#2F5BA8",on:true},
  {id:"pass",n:"Mountain passes",c:"#6B4E9B",on:true},
  {id:"sight",n:"Sights & history",c:"#9A6A33",on:true},
  {id:"food",n:"Food & coffee",c:"#B3261E",on:false},
  {id:"camp",n:"Campsites",c:"#0B6E4F",on:false}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const rad=d=>d*Math.PI/180;
const hav=(a,b)=>{const dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);const h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.sqrt(h));};
const fmtT=m=>{m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(((m%60)+60)%60).padStart(2,"0");};
const fmtDur=m=>{m=Math.round(m);return Math.floor(m/60)+"h"+String(m%60).padStart(2,"0");};
const toMin=t=>{const [h,m]=(t||"0:0").split(":").map(Number);return h*60+m;};

const TRACK_KMH=45; // average speed assumed on a followed GPX track (no router to ask)
// car routing: Jeep / 4x4 takes jeep tracks; an ordinary car keeps to roads (graded gravel only on "road less travelled")
const STYLE_CAR={rough:{use_highways:0,use_tracks:0.8},mixed:{use_highways:0.5,use_tracks:0.3},tar:{use_highways:1,use_tracks:0}};
const STYLE_SEDAN={rough:{use_highways:0.2,use_tracks:0},mixed:{use_highways:0.6,use_tracks:0,exclude_unpaved:false},tar:{use_highways:1,use_tracks:0,exclude_unpaved:true}};
const VEHICLES={bike:"🏍 Motorbike",jeep:"🚙 Jeep / 4x4",car:"🚗 Car"};
// words that depend on what you travel on
const VEH=()=>settings.vehicle==="car"||settings.vehicle==="jeep"?{ing:"driving",Ing:"Driving",noun:"drive",who:"driver",thing:"car"}:{ing:"riding",Ing:"Riding",noun:"ride",who:"rider",thing:"bike"};

/* ---------- referral partners: fill in an id once a partner approves you; links work (without commission) until then ----------
   wrap: the network's deep-link template, {URL} = the partner page, URL-encoded (e.g. CJ: "https://www.anrdoezrs.net/click-PID-AID?url={URL}") */
const PARTNERS={
  booking:{aid:"",wrap:""},          // Booking.com: aid from Booking/Stay22, or CJ deep link in wrap
  discovercars:{a_aid:"",wrap:""},   // car and 4x4 hire (Travelpayouts)
  hostelworld:{wrap:""},             // backpackers (Travelpayouts)
  getyourguide:{partner_id:"",wrap:""}
};
function partnerUrl(p,url){ const P=PARTNERS[p]||{}; return P.wrap?P.wrap.replace("{URL}",encodeURIComponent(url)):url; }
function bookingUrl(q,inDate,outDate,lat,lon){ const u=new URL("https://www.booking.com/searchresults.html");
  u.searchParams.set("ss",q); if(lat!=null){ u.searchParams.set("latitude",lat); u.searchParams.set("longitude",lon); }
  if(inDate){ u.searchParams.set("checkin",inDate); u.searchParams.set("checkout",outDate); } u.searchParams.set("group_adults","2"); u.searchParams.set("no_rooms","1");
  if(PARTNERS.booking.aid) u.searchParams.set("aid",PARTNERS.booking.aid); return partnerUrl("booking",u.toString()); }
function carHireUrl(place,from,to){ const u=new URL("https://www.discovercars.com/"); if(PARTNERS.discovercars.a_aid) u.searchParams.set("a_aid",PARTNERS.discovercars.a_aid); return partnerUrl("discovercars",u.toString()); }
function hostelUrl(town){ return partnerUrl("hostelworld","https://www.hostelworld.com/search?search_keywords="+encodeURIComponent(town)); }
