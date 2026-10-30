/* Home and Petrolhead pages: the countdown to the next big one, live campaigns, and the FOMO list (Book ahead / This month).
   Reads the same files the planner does: /data/events/events.json, /data/campaigns.json, /data/events/news.json. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ymd = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var add = function (s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
  var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var GEN = { f1: "F1", motogp: "MotoGP", superbike: "Superbikes", endurance: "Endurance and 24 hours", nascar: "NASCAR", indycar: "IndyCar", rally: "Rally", offroad: "Dakar and off-road", mx: "Motocross and Supercross", hillclimb: "Hill climbs", roadrace: "Road racing and the TT", timeattack: "Time attack", classics: "Classics and festivals", shows: "Motor shows", bikefest: "Bike festivals" };
  var REG = [["", "Everywhere"], ["za", "Southern Africa"], ["eu", "Europe"], ["us", "USA"], ["sa", "South America"], ["me", "Middle East"], ["as", "Asia"]];
  var REGOF = { za: ["South Africa", "Namibia", "Botswana", "Lesotho", "Zimbabwe", "Mozambique", "Eswatini", "Kenya"], us: ["United States", "USA", "Canada", "Mexico"], sa: ["Brazil", "Argentina", "Chile", "Paraguay", "Uruguay", "Colombia"], me: ["Qatar", "Bahrain", "Saudi Arabia", "United Arab Emirates", "Azerbaijan"], as: ["Japan", "China", "Macau", "Singapore", "Malaysia", "Thailand", "Indonesia", "India", "Australia", "New Zealand", "Korea"] };
  var region = function (c) { for (var k in REGOF) if (REGOF[k].indexOf(c) >= 0) return k; return "eu"; };
  var store = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var clean = function (n) { return n.replace(/\s*\(.*?\)/g, "").replace(/\s+20\d\d$/, ""); };
  var today = ymd(new Date());
  var J = function (u, d) { return fetch(u).then(function (r) { return r.ok ? r.json() : d; }).catch(function () { return d; }); };

  Promise.all([J("/data/events/events.json", []), J("/data/campaigns.json", { campaigns: [] }), J("/data/events/news.json", {})]).then(function (r) {
    var EV = r[0].filter(function (e) { return e.end >= today; }), CAMP = r[1].campaigns || [], NEWS = r[2] || {};

    // countdown to the next big one
    var cd = $("cd");
    if (cd) {
      var big = EV.filter(function (e) { return e.tier === 1 && e.start > today; }).sort(function (a, b) { return a.start.localeCompare(b.start); })[0];
      if (big) {
        var days = Math.round((new Date(big.start + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5), n = (NEWS[big.id] || [])[0];
        cd.innerHTML = '<div class="cdl"><span class="cdk">Next big one</span><b>' + esc(clean(big.name)) + '</b><span class="cdw">' + esc(big.city || big.venue || "") + ", " + esc(big.country || "") + '</span></div>' +
          '<div class="cdn"><b>' + days + '</b><span>day' + (days === 1 ? "" : "s") + ' to go</span></div>' +
          '<div class="cdb"><a class="btn" href="/plan/?ev=' + esc(big.id) + '&go=1">Take me there ›</a><a class="btnline" href="/events/' + esc(big.id) + '/">Read about it</a>' + (big.tickets ? '<a class="btnline" href="' + esc(big.tickets) + '" target="_blank" rel="noopener sponsored">Tickets ›</a>' : "") + '</div>' +
          (n ? '<p class="cdnews"><span>' + esc(n.source) + ':</span> <a href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(n.title) + ' ›</a></p>' : "");
        cd.hidden = false;
      }
    }

    // campaigns live today: two at most, gifts and long weekends first
    var cp = $("camps");
    if (cp) {
      var K = { gift: 0, longweekend: 1, holiday: 2, experience: 3, booking: 4 };
      var L = CAMP.filter(function (c) { return !c.hidden && c.from <= today && c.to >= today; }).sort(function (a, b) { return (K[a.kind] || 5) - (K[b.kind] || 5); }).slice(0, 2);
      cp.innerHTML = L.map(function (c) { return '<div class="camp"><b>' + esc(c.title) + '.</b> ' + esc(c.line) + ' <a href="' + esc(c.link) + '">' + esc(c.cta) + ' ›</a></div>'; }).join("");
    }

    // FOMO: one square per kind of racing. The next event in each square is twice the size; the rest are short rows.
    // "Near you" comes first: events in the visitor's own country (from their time zone), shown further ahead because they're easy to get to.
    var box = $("fomo");
    if (!box) return;
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var HOME = /^Africa\/(Johannesburg|Windhoek|Gaborone|Maseru|Mbabane)/.test(tz) ? ["South Africa", "Namibia", "Botswana", "Lesotho", "Eswatini"] : /^Europe\/(London|Dublin)/.test(tz) ? ["United Kingdom", "UK", "Isle of Man", "Ireland"] : /^America\/|^US\//.test(tz) ? ["United States", "USA", "Canada"] : /^Australia\//.test(tz) ? ["Australia"] : /^Europe\//.test(tz) ? null : [];
    var homeName = HOME && HOME[0] === "South Africa" ? "In South Africa" : HOME && HOME.length ? "Near you" : "In Europe";
    var isHome = function (e) { return HOME ? HOME.indexOf(e.country) >= 0 : region(e.country) === "eu"; };
    var GROUPS = [["home", homeName, "#E8A317"], ["f1", "F1", "#E5484D"], ["bikes", "Bikes", "#F08A24"], ["endurance", "Endurance, rally and hill climbs", "#4FB8D8"], ["us", "NASCAR and IndyCar", "#7EA3E6"], ["shows", "Shows and classics", "#B9A2E8"]];
    var groupOf = function (e) { var g = e.genre; return g === "f1" ? "f1" : /motogp|superbike|mx|roadrace|bikefest/.test(g) ? "bikes" : /endurance|rally|offroad|hillclimb|timeattack/.test(g) ? "endurance" : /nascar|indycar/.test(g) ? "us" : "shows"; };
    var view = store("otm-evview3") || "soon";
    var days = function (s) { return Math.round((new Date(s + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5); };
    var when = function (e) { var d = days(e.start); return e.start <= today ? "On now" : d === 1 ? "Tomorrow" : d <= 13 ? "In " + d + " days" : d <= 60 ? "In " + Math.round(d / 7) + " weeks" : "In " + Math.round(d / 30) + " months"; };
    function draw() {
      $("fomoView").innerHTML = [["soon", "Coming up"], ["ahead", "Book ahead"]].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === view ? "on" : "") + '">' + x[1] + "</button>"; }).join("");
      $("fomoReg").innerHTML = "";
      var from = view === "soon" ? today : add(today, 30), to = view === "soon" ? add(today, 30) : add(today, 183);
      var html = GROUPS.map(function (G) {
        // Coming up: the next four in each square, however far off, so no square is ever empty. Book ahead: from a month out, the big ones first.
        var L = EV.filter(function (e) { return (G[0] === "home" ? isHome(e) : !isHome(e) && groupOf(e) === G[0]) && e.end >= from && (view === "soon" || e.start <= to); })
          .sort(function (a, b) { return view === "ahead" ? (a.tier || 2) - (b.tier || 2) || a.start.localeCompare(b.start) : a.start.localeCompare(b.start); }).slice(0, 4);
        if (view === "ahead") L.sort(function (a, b) { return a.start.localeCompare(b.start); });
        if (!L.length) return "";
        var top = L[0], d = new Date(top.start + "T12:00:00");
        return '<div class="sq' + (G[0] === "home" ? " sqhome" : "") + '" style="--c:' + G[2] + '"><div class="sqh">' + esc(G[1]) + "</div>" +
          '<a class="sqtop" href="/events/' + esc(top.id) + '/"><span class="evdate"><b>' + d.getDate() + "</b><i>" + M[d.getMonth()] + "</i></span><span><b>" + esc(clean(top.name)) + '</b><span class="ew">' + esc(top.city || top.venue || "") + ", " + esc(top.country || "") + '</span><span class="ef">' + when(top) + (top.confirmed ? "" : " · date to confirm") + "</span></span></a>" +
          L.slice(1).map(function (e) { var x = new Date(e.start + "T12:00:00"); return '<a class="sqrow" href="/events/' + esc(e.id) + '/"><b>' + x.getDate() + " " + M[x.getMonth()] + "</b><span>" + esc(clean(e.name)) + "</span></a>"; }).join("") + "</div>";
      }).join("");
      $("fomoList").innerHTML = html || '<p class="note">Nothing on yet.</p>';
    }
    box.addEventListener("click", function (e) { var v = e.target.closest("[data-v]"); if (v) { view = v.dataset.v; store("otm-evview3", view); draw(); } });
    draw();
  });
})();
