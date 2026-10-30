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
    if (hub && hd <= 260) return { iata: hub[0], name: hub[1], km: Math.round(hd), lat: hub[2], lon: hub[3] };
    var big = null, small = null, bd = 1e9, sd = 1e9;
    for (var i = 0; i < list.length; i++) { var a = list[i], d = km([lat, lon], [a[2], a[3]]); if (a[4]) { if (d < bd) { bd = d; big = a; } } else if (d < sd) { sd = d; small = a; } }
    var a2 = bd <= 250 || !small || sd > 150 ? big : small; return a2 ? { iata: a2[0], name: a2[1], km: Math.round(a2 === big ? bd : sd), lat: a2[2], lon: a2[3] } : null;
  }
  var ESIM = { "united states": "united-states", usa: "united-states", uk: "united-kingdom", "united kingdom": "united-kingdom", "isle of man": "united-kingdom", turkiye: "turkey", czechia: "czech-republic", "united arab emirates": "united-arab-emirates", "saudi arabia": "saudi-arabia", "south africa": "south-africa", "new zealand": "new-zealand", korea: "south-korea", "south korea": "south-korea" };
  var esimUrl = function (c) { var k = String(c || "").toLowerCase().trim(); if (!k) return "https://www.airalo.com/"; return "https://www.airalo.com/" + (ESIM[k] || k.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-")) + "-esim"; };
  var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var add = function (s, n) { var d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var dm = function (s) { var d = new Date(s + "T12:00:00Z"); return d.getUTCDate() + " " + M[d.getUTCMonth()]; };
  var span = function (a, b) { var x = new Date(a + "T12:00:00Z"), y = new Date(b + "T12:00:00Z"); return x.getUTCMonth() === y.getUTCMonth() ? x.getUTCDate() + "–" + dm(b) : dm(a) + " – " + dm(b); };
  // our flight search (flights.onetrackmind.online): from Cape Town by default (changeable on the page), dates only when they're still ahead
  var ddmm = function (d) { return d.slice(8, 10) + d.slice(5, 7); };
  function flightUrl(to, from, back, orig) {
    var o = orig && orig !== to ? orig : to === "CPT" ? "JNB" : "CPT", today = new Date().toISOString().slice(0, 10);
    if (!from || from <= today) return "https://flights.onetrackmind.online/?origin_iata=" + o + "&destination_iata=" + to;
    return "https://flights.onetrackmind.online/?flightSearch=" + o + ddmm(from) + to + ddmm(back) + "1";
  }
  /* o: { place, town, country, lat, lon, from, to (dates, optional), tickets, tours, air: [name, IATA] (optional), bike, home } */
  function tiles(o) {
    var a = o.air && o.air[1] ? { iata: o.air[1], name: o.air[0] } : airport(o.lat, o.lon), when = o.from && o.to ? span(o.from, o.to) : "", T = [];
    var where = o.town || o.place, abroad = !!o.country && (o.home ? o.country !== o.home : o.country !== "South Africa");
    var bk = "https://www.booking.com/searchresults.html?latitude=" + o.lat + "&longitude=" + o.lon + "&radius=30" + (o.from ? "&checkin=" + o.from + "&checkout=" + o.to : "");
    T.push({ k: "stay", t: "Stay", d: "Beds within 30 km of " + o.place + (when ? ", " + when : ""), p: "Booking.com", u: bk, b: "See places" });
    if (a) { var org = a.iata === "CPT" ? "JNB" : "CPT"; var W = [
      "https://tpembd.com/content?currency=zar&trs=593333&shmarker=797995&show_hotels=false&powered_by=false&locale=en&searchUrl=flights.onetrackmind.online&primary_override=%230F5874&color_button=%23E8A317&color_icons=%230F5874&dark=%23262626&light=%23FFFFFF&secondary=%230F5874&special=%23C4C4C4&color_focused=%230F5874&border_radius=10&plain=false&origin=" + org + "&destination=" + a.iata + "&promo_id=7879&campaign_id=100",
      "https://tpembd.com/content?currency=zar&trs=593333&shmarker=797995&color_button=%23E8A317&target_host=flights.onetrackmind.online&locale=en&powered_by=false&origin=" + org + "&destination=" + a.iata + "&with_fallback=true&non_direct_flights=true&min_lines=5&border_radius=10&color_background=%23FFFFFF&color_text=%23000000&color_border=%23FFFFFF&promo_id=2811&campaign_id=100"]; }
    if (a) T.push({ w: W, k: "fly", t: "Flights", d: "To " + a.name + " (" + a.iata + ")" + (o.from ? ", in " + dm(o.from) + ", out " + dm(o.to) : ""), p: "Our flight search: airlines and booking sites compared", u: flightUrl(a.iata, o.from, o.to), b: "Find flights" });
    if (a && !o.bike) T.push({ k: "car", t: "Car hire", d: "Pick up at " + a.name + " airport (" + a.iata + ")" + (when ? ", " + when : ""), p: "Discover Cars", u: "https://www.discovercars.com/", b: "Compare cars" });
    var tq = o.tours || where;
    if (o.tickets) T.push({ k: "tix", t: "Tickets & tours", d: "Official tickets, plus tours and things to do around " + where, p: "Official site · GetYourGuide", u: o.tickets, b: "Get tickets", u2: "https://www.getyourguide.com/s/?q=" + encodeURIComponent(tq) + (o.from ? "&date_from=" + o.from + "&date_to=" + o.to : ""), b2: "Tours" });
    else T.push({ k: "tix", t: "Tours & tickets", d: o.tours ? o.tours : "Tours and things to do around " + where, p: "GetYourGuide", u: "https://www.getyourguide.com/s/?q=" + encodeURIComponent(tq) + (o.from ? "&date_from=" + o.from + "&date_to=" + o.to : ""), b: "See tours" });
    if (abroad) T.push({ k: "data", t: "Data", d: "An eSIM for " + (o.country || "where you are going") + ", so your phone works when you land", p: "Airalo", u: esimUrl(o.country), b: "Get an eSIM", alt: 1 });
    T.sort(function (x, y) { return "fly stay car tix data".indexOf(x.k) - "fly stay car tix data".indexOf(y.k); });
    return T;
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  // how it works, who we work with, and what we're not: under every block
  var HOW = '<div class="triphow"><div><b>You search here</b>Everything is filled in for you. Prices are live from the company you pick.</div><div><b>You pay them, not us</b>You book and pay on their site. We never see your card.</div><div><b>We get a small fee</b>If you book, they pay us a few percent. Same price to you. It keeps OneTrackMind free.</div></div>' +
    '<p class="tripf"><b>Who we work with.</b> We\'re picky. Only names we\'d hand our own money to: Booking.com, Agoda, Expedia and Hotels.com for beds, airlines and the big booking sites for flights, Discover Cars for car hire, GetYourGuide for tours and Airalo for eSIMs. If one lets us down, it goes. <a href="/partners/">The full list and how we earn ›</a></p>' +
    '<p class="tripf">OneTrackMind is not a travel agent. Bookings, payments, changes and refunds are between you and the company you book with, on their terms. Prices and availability are theirs and can change.</p>';
  // the block on the site: tabs, one panel each (styles in src/house.css)
  var HS = typeof module !== "undefined" && module.exports ? require("./02-house.js") : g.OTMhouse;
  var uid = 0;
  // tabs + the partners' live widgets (loaded into the open tab, only after OK on the cookie notice)
  var LOADER = 'window.otmTabs||(window.otmTabs=1,(function(){function ok(){try{return localStorage.getItem("otm-consent")==="yes"}catch(e){return false}}' +
    'function load(p){if(!p||!ok())return;p.querySelectorAll(".twid:not([data-done])").forEach(function(w){w.setAttribute("data-done","1");w.innerHTML="";JSON.parse(w.getAttribute("data-w")).forEach(function(u){var d=document.createElement("div");w.appendChild(d);var s=document.createElement("script");s.async=true;s.charset="utf-8";s.src=u;d.appendChild(s)});setTimeout(function(){if(w.offsetHeight<90)w.hidden=true},12000)})}' +
    'function first(){document.querySelectorAll(".trip").forEach(function(t){load(t.querySelector(".tpanel:not([hidden])"))})}' +
    'document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".ttab");if(!b)return;var s=b.closest(".trip");s.querySelectorAll(".ttab").forEach(function(x){x.setAttribute("aria-selected",String(x===b))});s.querySelectorAll(".tpanel").forEach(function(p){p.hidden=p.id!==b.getAttribute("aria-controls")});load(document.getElementById(b.getAttribute("aria-controls")))});' +
    'document.addEventListener("otm-consent",first);if(document.readyState!=="loading")first();else document.addEventListener("DOMContentLoaded",first)})())';
  function html(o, head) {
    var T = tiles(o), id = "trip" + (++uid) + Math.random().toString(36).slice(2, 6), I = function (k, n) { return HS ? HS.icon(k, n) : ""; };
    return '<section class="trip" data-trip="' + id + '">' + (head === false ? "" : '<div class="triplab">' + esc(head || "") + '</div><h2>Make a trip of it</h2>' + (o.unconfirmed ? '<p class="tripsub tripwarn">The organiser hasn\'t confirmed these dates yet, so nothing is filled in. Check the official site before you book anything.</p>' : o.from ? '<p class="tripsub">Everything for ' + esc(HS ? HS.range(o.from, o.to) : span(o.from, o.to)) + ', already filled in.</p>' : "")) +
      '<div class="ttabs" role="tablist">' + T.map(function (t, i) { return '<button type="button" class="ttab" role="tab" id="' + id + t.k + '" aria-controls="' + id + t.k + 'p" aria-selected="' + (i === 0) + '">' + I(t.k, 18) + '<span>' + esc(t.t) + '</span></button>'; }).join("") + '</div>' +
      '<div class="tpanels">' + T.map(function (t, i) { return '<div class="tpanel" role="tabpanel" id="' + id + t.k + 'p" aria-labelledby="' + id + t.k + '"' + (i ? " hidden" : "") + '><h3>' + I(t.k, 22) + esc(t.t) + '</h3><p class="d">' + esc(t.d) + '</p><p class="p">' + esc(t.p) + '</p>' + (t.w ? '<div class="twid" data-w="' + esc(JSON.stringify(t.w)) + '"><p class="twnote">Live prices show here once you tap OK on the cookie notice. The button below works either way.</p></div>' : "") + '<div class="acts"><a href="' + esc(t.u) + '" target="_blank" rel="noopener sponsored">' + esc(t.b) + I("out", 16) + '</a>' + (t.u2 ? '<a class="t2" href="' + esc(t.u2) + '" target="_blank" rel="noopener sponsored">' + esc(t.b2) + I("out", 16) + '</a>' : "") + '</div></div>'; }).join("") + '</div>' + HOW +
      '<scr' + 'ipt>' + LOADER + '<\/script></section>';
  }
  // the planner adds blocks after load, where inline scripts don't run
  if (typeof document !== "undefined" && !window.otmTabs) { try { (0, eval)(LOADER); } catch (e) {} }
  if (false) document.addEventListener("click", function (e) { if (window.otmTabs) return; var b = e.target.closest && e.target.closest(".ttab"); if (!b) return; var s = b.closest(".trip"); s.querySelectorAll(".ttab").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); }); s.querySelectorAll(".tpanel").forEach(function (p) { p.hidden = p.id !== b.getAttribute("aria-controls"); }); });
  var T = { flightUrl: flightUrl, tiles: tiles, html: html, airport: airport, setAirports: function (l) { AIR = l; }, span: span };
  if (typeof module !== "undefined" && module.exports) module.exports = T; else g.OTMtrip = T;
})(typeof window !== "undefined" ? window : globalThis);
