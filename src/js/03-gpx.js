function parseGpx(text){
  const doc=new DOMParser().parseFromString(text,"application/xml");
  let nodes=[...doc.getElementsByTagName("trkpt")]; if(!nodes.length) nodes=[...doc.getElementsByTagName("rtept")];
  return nodes.map(n=>({lat:+n.getAttribute("lat"),lon:+n.getAttribute("lon")})).filter(p=>isFinite(p.lat)&&isFinite(p.lon));
}
