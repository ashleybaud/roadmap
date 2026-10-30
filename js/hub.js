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
          '<div class="cdb"><a class="btn" href="/events/' + esc(big.id) + '/">Plan it ›</a>' + (big.tickets ? '<a class="btnline" href="' + esc(big.tickets) + '" target="_blank" rel="noopener sponsored">Tickets ›</a>' : "") + '</div>' +
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

    // FOMO: Book ahead (1 to 6 months out, the big ones first) or This month
    var box = $("fomo");
    if (!box) return;
    var view = store("otm-evview2") || "soon", reg = store("otm-evcome") || "";
    function draw() {
      var a30 = add(today, 30), a183 = add(today, 183), inReg = function (e) { return !reg || region(e.country) === reg; }, L;
      if (view === "ahead") {
        var pool = EV.filter(function (e) { return e.start >= a30 && e.start <= a183 && inReg(e); });
        var seen = {}, pick = [];
        [1, 2, 3].forEach(function (t) { pool.forEach(function (e) { if ((e.tier || 2) === t && !seen[e.id] && pick.length < 12) { seen[e.id] = 1; pick.push(e); } }); });
        L = pick.sort(function (a, b) { return a.start.localeCompare(b.start); });
      } else L = EV.filter(function (e) { return e.start <= a30 && inReg(e); }).sort(function (a, b) { return a.start.localeCompare(b.start) || (a.tier || 2) - (b.tier || 2); }).slice(0, 12);
      $("fomoView").innerHTML = [["soon", "Coming up"], ["ahead", "Book ahead"]].map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === view ? "on" : "") + '">' + x[1] + "</button>"; }).join("");
      $("fomoReg").innerHTML = REG.map(function (x) { return '<button type="button" data-r="' + x[0] + '" class="' + (x[0] === reg ? "on" : "") + '">' + x[1] + "</button>"; }).join("");
      // keep the grid's rows full: a big card takes two places; drop the last small ones until the count fits the columns
      var w = window.innerWidth, cols = w > 1000 ? 4 : w > 560 ? 2 : 1, now = new Date(today + "T12:00:00"), slot = function (e) { var d = Math.round((new Date(e.start + "T12:00:00") - now) / 864e5); return d <= 7 && cols > 1 ? 2 : 1; };
      while (L.length > cols) { var used = L.reduce(function (a, e) { return a + slot(e); }, 0); if (used % cols === 0) break; var i = L.length - 1; while (i > 0 && slot(L[i]) === 2) i--; L.splice(i, 1); }
      $("fomoList").innerHTML = L.length ? L.map(function (e) {
        var d = new Date(e.start + "T12:00:00"), dd = Math.round((d - new Date(today + "T12:00:00")) / 864e5), t = dd <= 7 ? 1 : dd <= 45 ? 2 : 3, live = e.start <= today, /* the closer it is, the bigger it shows */ yr = d.getFullYear() !== new Date().getFullYear() ? " " + String(d.getFullYear()).slice(2) : "";
        return '<a class="evcard t' + t + '" href="/events/' + esc(e.id) + '/"><span class="evdate"><b>' + d.getDate() + "</b><i>" + M[d.getMonth()] + yr + "</i></span><span>" + (e.genre ? '<span class="eg">' + esc(GEN[e.genre] || "") + "</span>" : "") + '<span class="en">' + esc(clean(e.name)) + '</span><span class="ew">' + esc(e.city || e.venue || "") + ", " + esc(e.country || "") + (e.confirmed ? "" : " · to confirm") + "</span>" + (live ? '<span class="ef">On now</span>' : dd <= 7 ? '<span class="ef">' + (dd <= 1 ? (dd === 1 ? 'Tomorrow' : 'Today') : 'In ' + dd + ' days') + '</span>' : e.tier === 1 && e.tickets ? '<span class="ef">Tickets on sale. Book early ›</span>' : "") + "</span></a>";
      }).join("") : '<p class="note">Nothing ' + (view === "ahead" ? "in the next six months" : "in the next month") + " there yet.</p>";
    }
    box.addEventListener("click", function (e) {
      var v = e.target.closest("[data-v]"), g = e.target.closest("[data-r]");
      if (v) { view = v.dataset.v; store("otm-evview2", view); draw(); }
      if (g) { reg = g.dataset.r; store("otm-evcome", reg); draw(); }
    });
    draw();
  });
})();
