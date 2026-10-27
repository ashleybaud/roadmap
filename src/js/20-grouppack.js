/* ---------- group ride pack: every GPX format in one zip, for the tour leader to hand out ---------- */
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
const crc32=b=>{ let c=~0; for(let i=0;i<b.length;i++) c=CRC_T[(c^b[i])&255]^(c>>>8); return (~c)>>>0; };
function makeZip(files){ // [{name,text}] → Blob (stored, no compression: GPX files are small)
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const u16=v=>[v&255,(v>>>8)&255], u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  files.forEach(f=>{ const name=enc.encode(f.name), data=enc.encode(f.text), crc=crc32(data);
    const head=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
    parts.push(head,name,data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);
    off+=head.length+name.length+data.length; });
  const cdSize=central.reduce((t,x)=>t+x.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdSize),...u32(off),...u16(0)]);
  return new Blob([...parts,...central,end],{type:"application/zip"});
}
function groupPack(){
  if(!plan||planStale){ $("status").textContent="Plan the trip first."; return; }
  const ks=plan.days.map((d,i)=>d?i:-1).filter(i=>i>=0), days=ks.map(gpxDay).filter(Boolean); if(!days.length) return;
  const base=`${trip.start.name} ${trip.startDate}`.replace(/[^\w]+/g,"-").replace(/-+$/,"");
  const fname=d=>d.name.replace(/[^\w]+/g,"-").replace(/-+$/,"")+".gpx";
  const SETS=[["1-Garmin-and-BMW-Navigator","garmin"],["2-BMW-Motorrad-Connected-app","bmw"],["3-Everything-else","any"]];
  const files=[];
  SETS.forEach(([dir,dev])=>{ files.push({name:`${dir}/Whole-trip-${base}.gpx`,text:gpxText(days,dev)}); days.forEach(d=>files.push({name:`${dir}/${fname(d)}`,text:gpxText([d],dev)})); });
  files.push({name:"4-Phone-Google-Maps-and-Waze.html",text:navHtml()});
  files.push({name:"READ-ME-FIRST.txt",text:`${trip.start.name}, ${trip.startDate} to ${trip.endDate}. ${days.length} day${days.length>1?"s":""}.
Planned with OneTrackMind: https://onetrackmind.online

Pick the folder for your bike or GPS. Each folder has the whole trip in one file and a file per day.

1-Garmin-and-BMW-Navigator
   Garmin Zumo, XT, Montana, BMW Navigator. Route (turn by turn) plus the exact track.
2-BMW-Motorrad-Connected-app
   BMW's phone app. Route only, 50 points or fewer per day.
3-Everything-else
   Ducati Link, KTM / Husqvarna / GasGas, Harley Boom! Box (USB), and phone apps:
   OsmAnd, Organic Maps, Calimoto, Kurviger, Scenic. The exact track plus stops.
   Triumph, Honda, Yamaha: their apps don't import GPX. Use one of the phone apps above.

4-Phone-Google-Maps-and-Waze.html
   No GPS? Open this on your phone. One tap opens each day in Google Maps with
   its stops; Waze goes stop by stop. They choose their own roads between points,
   so for gravel and back roads the GPX files above follow the line exactly.

Waypoints in every file: stops, night stops (Lodging) and fuel towns (Gas Station).
Roads change. Check conditions before you go.
`});
  const a=document.createElement("a"); a.href=URL.createObjectURL(makeZip(files)); a.download=`Group-ride-${base}.zip`; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
  $("status").textContent=`Saved Group-ride-${base}.zip: every GPX format, with a read-me. Share it with the group.`;
}
document.addEventListener("click",e=>{ if(e.target.closest&&e.target.closest("[data-grouppack]")) groupPack(); });
