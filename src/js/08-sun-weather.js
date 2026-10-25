/* ---------- sunset (SunCalc method) ---------- */
function sunset(date,lat,lng){
  const dayMs=86400000,J1970=2440588,J2000=2451545,e=rad(23.4397),J0=0.0009;
  const toDays=d=>d.valueOf()/dayMs-0.5+J1970-J2000;
  const M=d=>rad(357.5291+0.98560028*d);
  const L=m=>m+rad(1.9148*Math.sin(m)+0.02*Math.sin(2*m)+0.0003*Math.sin(3*m))+rad(102.9372)+Math.PI;
  const lw=rad(-lng),phi=rad(lat),d=toDays(date),n=Math.round(d-J0-lw/(2*Math.PI));
  const ds=J0+lw/(2*Math.PI)+n,m=M(ds),l=L(m),dec=Math.asin(Math.sin(e)*Math.sin(l));
  const w=Math.acos((Math.sin(rad(-0.833))-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec)));
  const a=J0+(w+lw)/(2*Math.PI)+n, Jset=J2000+a+0.0053*Math.sin(m)-0.0069*Math.sin(2*l);
  return new Date((Jset+0.5-J1970)*dayMs);
}

