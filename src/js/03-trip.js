/* "Make a trip of it": the same five tiles everywhere (event pages, Founder's fav's, the planner, the newsletter).
   Stay, Flights, Car hire, Tickets and tours, Data. Plain partner links: Travelpayouts Drive and Stay22 turn them into paying links on the site.
   Shared by the browser (window.OTMtrip) and the page builder (require). */
(function (g) {
  var AIR = null;
  var rad = function (x) { return x * Math.PI / 180; };
  var km = function (a, b) { var s = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(s)); };
  // the main airports people actually fly into; one of these within 260 km wins over a closer small one (Malpensa, not Linate)
  var HUB = "JNB CPT DUR PLZ GRJ ELS BFN WDH MPM GBE NBO CMN RAK TNG CAI LHR LGW MAN BHX EDI GLA ABZ DUB IOM CDG NCE LYS MRS TLS BOD NTE FRA MUC DUS CGN STR HAM BER NUE LEJ AMS BRU VIE GRZ SZG ZRH GVA MXP FCO VCE BLQ FLR PSA NAP VRN TRN CTA PMO CAG MAD BCN VLC AGP SVQ PMI LPA LIS FAO OPO PRG BUD WAW KRK ZAG LJU ATH IST SAW ARN GOT CPH OSL HEL RIX TLL VNO DOH BAH AUH DXB JED RUH GYD SIN KUL BKK HKT BFV CGK DPS LOP HKG MFM PVG PEK NRT HND NGO KIX ICN DEL BOM MEL SYD ADL DRW PER BNE AKL GRU GIG EZE SCL MEX YUL YYZ YVR LAS MCO LAX SAN PHX DFW IAH AUS ATL CLT IND DTW ORD MDW MIA FLL JFK EWR LGA BOS SEA PDX SFO SJC OAK SMF DEN SLC MCI BNA PIT BWI DCA IAD TPA MSP MKE STL CLE CMH CVG RDU MSY SAT HOU ABQ TUS ONT SNA BUR LGB RIC ORF PHL BDL PVD BUF ROC SYR ALB GSP JAX".split(" ");
  // the airport to fly into: the nearest main one within 260 km, else the nearest big one within 250 km, else a smaller one within 150 km
  function airport(lat, lon, list) {
    list = list || AIR || []; var hub = null, hd = 1e9;
    for (var j = 0; j < list.length; j++) if (HUB.indexOf(list[j][0]) >= 0) { var dh = km([lat, lon], [list[j][2], list[j][3]]); if (dh < hd) { hd = dh; hub = list[j]; } }
    if (hub && hd <= 260) return { iata: hub[0], name: hub[1], km: Math.round(hd) };
    var big = null, small = null, bd = 1e9, sd = 1e9;
    for (var i = 0; i < list.length; i++) { var a = list[i], d = km([lat, lon], [a[2], a[3]]); if (a[4]) { if (d < bd) { bd = d; big = a; } } else if (d < sd) { sd = d; small = a; } }
    var a2 = bd <= 250 || !small || sd > 150 ? big : small; return a2 ? { iata: a2[0], name: a2[1], km: Math.round(a2 === big ? bd : sd) } : null;
  }
  var ESIM = { "united states": "united-states", usa: "united-states", uk: "united-kingdom", "united kingdom": "united-kingdom", "isle of man": "united-kingdom", turkiye: "turkey", czechia: "czech-republic", "united arab emirates": "united-arab-emirates", "saudi arabia": "saudi-arabia", "south africa": "south-africa", "new zealand": "new-zealand", korea: "south-korea", "south korea": "south-korea" };
  var esimUrl = function (c) { var k = String(c || "").toLowerCase().trim(); if (!k) return "https://www.airalo.com/"; return "https://www.airalo.com/" + (ESIM[k] || k.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-")) + "-esim"; };
  var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var add = function (s, n) { var d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var dm = function (s) { var d = new Date(s + "T12:00:00Z"); return d.getUTCDate() + " " + M[d.getUTCMonth()]; };
  var span = function (a, b) { var x = new Date(a + "T12:00:00Z"), y = new Date(b + "T12:00:00Z"); return x.getUTCMonth() === y.getUTCMonth() ? x.getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b); };
  /* o: { place, town, country, lat, lon, from, to (dates, optional), tickets, tours, air: [name, IATA] (optional), bike, home } */
  function tiles(o) {
    var a = o.air && o.air[1] ? { iata: o.air[1], name: o.air[0] } : airport(o.lat, o.lon), when = o.from && o.to ? span(o.from, o.to) : "", T = [];
    var where = o.town || o.place, abroad = !!o.country && (o.home ? o.country !== o.home : o.country !== "South Africa");
    var bk = "https://www.booking.com/searchresults.html?latitude=" + o.lat + "&longitude=" + o.lon + "&radius=30" + (o.from ? "&checkin=" + o.from + "&checkout=" + o.to : "");
    T.push({ k: "stay", ic: "🛏", t: "Stay", d: "Beds within 30 km of " + o.place + (when ? ", " + when : ""), p: "Booking.com", u: bk, b: "See places" });
    if (a) T.push({ k: "fly", ic: "✈", t: "Flights", d: "To " + a.name + (o.from ? ", in " + dm(o.from) + ", out " + dm(o.to) : ""), p: "Kiwi.com", u: "https://www.kiwi.com/deep?to=" + a.iata + (o.from ? "&departure=" + o.from + "&return=" + o.to : ""), b: "Find flights" });
    if (a && !o.bike) T.push({ k: "car", ic: "🚗", t: "Car hire", d: "Pick up at " + a.name + " airport" + (when ? ", " + when : ""), p: "Discover Cars", u: "https://www.discovercars.com/", b: "Compare cars" });
    var tq = o.tours || where;
    if (o.tickets) T.push({ k: "tix", ic: "🎟", t: "Tickets & tours", d: "Official tickets, plus tours and things to do around " + where, p: "Official site · GetYourGuide", u: o.tickets, b: "Get tickets", u2: "https://www.getyourguide.com/s/?q=" + encodeURIComponent(tq) + (o.from ? "&date_from=" + o.from + "&date_to=" + o.to : ""), b2: "Tours" });
    else T.push({ k: "tix", ic: "🎟", t: "Tours & tickets", d: o.tours ? o.tours : "Tours and things to do around " + where, p: "GetYourGuide", u: "https://www.getyourguide.com/s/?q=" + encodeURIComponent(tq) + (o.from ? "&date_from=" + o.from + "&date_to=" + o.to : ""), b: "See tours" });
    if (abroad) T.push({ k: "data", ic: "📶", t: "Data", d: "An eSIM for " + (o.country || "where you are going") + ", so your phone works when you land", p: "Airalo", u: esimUrl(o.country), b: "Get an eSIM", alt: 1 });
    return T;
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  // the block on the site (styles in .trip / .tt)
  function html(o, head) {
    var T = tiles(o);
    return '<section class="trip">' + (head === false ? "" : '<div class="triplab">' + esc(head || "") + '</div><h2>Make a trip of it</h2>' + (o.from ? '<p class="tripsub">Everything for ' + esc(span(o.from, o.to)) + ', already filled in.</p>' : "")) +
      '<div class="tiles">' + T.map(function (t) { return '<div class="tt' + (t.alt ? " alt" : "") + '"><span class="ic" aria-hidden="true">' + t.ic + '</span><b>' + esc(t.t) + '</b><span class="d">' + esc(t.d) + '</span><span class="p">' + esc(t.p) + '</span><a href="' + esc(t.u) + '" target="_blank" rel="noopener sponsored">' + esc(t.b) + ' ›</a>' + (t.u2 ? '<a class="t2" href="' + esc(t.u2) + '" target="_blank" rel="noopener sponsored">' + esc(t.b2) + ' ›</a>' : "") + '</div>'; }).join("") +
      '</div><p class="tripf">Some of these links pay OneTrackMind a small fee, at no cost to you.</p></section>';
  }
  var T = { tiles: tiles, html: html, airport: airport, setAirports: function (l) { AIR = l; }, span: span };
  if (typeof module !== "undefined" && module.exports) module.exports = T; else g.OTMtrip = T;
})(typeof window !== "undefined" ? window : globalThis);
