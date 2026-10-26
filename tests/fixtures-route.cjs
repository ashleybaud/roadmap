// a ~600 km test track through real West Coast / Hantam towns, points every ~1 km
const towns=[[-33.4608,18.7271],[-32.9035,18.7563],[-32.1786,18.8916],[-31.6094,18.7392],[-31.3747,19.1131],[-31.4707,19.776]];
const R=6371, rad=x=>x*Math.PI/180, hav=(a,b)=>2*R*Math.asin(Math.sqrt(Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2));
let pts=[]; for(let i=1;i<towns.length;i++){ const a=towns[i-1],b=towns[i],n=Math.max(2,Math.round(hav(a,b))); for(let j=0;j<n;j++) pts.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]); }
pts.push(towns[towns.length-1]);
module.exports=`<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Test West Coast</name><trkseg>${pts.map(p=>`<trkpt lat="${p[0].toFixed(5)}" lon="${p[1].toFixed(5)}"/>`).join("")}</trkseg></trk></gpx>`;
