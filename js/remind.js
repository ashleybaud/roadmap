/* "Remind me" on events: a small form (email, which reminders, newsletter tick-box) posted to /api/remind.
   Any button with data-remind="<event id>" data-name data-start data-end [data-book="YYYY-MM-DD"] opens it. Nothing is sent until they confirm by email. */
(function () {
  var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], W = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var day = function (s) { var d = new Date(s + "T12:00:00Z"); return W[d.getUTCDay()] + " " + d.getUTCDate() + " " + M[d.getUTCMonth()]; };
  var add = function (s, n) { var d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var t = new Date(), today = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  var dlg = null, cur = null;
  function open(b) {
    cur = b.dataset;
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "rmd"; dlg.setAttribute("aria-labelledby", "rmdT"); document.body.appendChild(dlg);
      dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("[data-rmclose]")) dlg.close(); });
      dlg.addEventListener("submit", send); }
    var k = [["4m", "Four months out", add(cur.start, -120)], ["book", "When booking opens", cur.book || ""], ["week", "The week before", add(cur.start, -7)]];
    var rows = k.filter(function (x) { return x[2]; }).map(function (x) {
      var past = x[0] !== "week" && x[2] < today;
      return '<label' + (past ? ' class="off"' : "") + '><input type="checkbox" name="k" value="' + x[0] + '"' + (past ? " disabled" : " checked") + "><span>" + x[1] + " · " + day(x[2]) + (past ? " (passed)" : "") + "</span></label>";
    }).join("");
    var when = cur.start === cur.end ? day(cur.start) : day(cur.start) + " – " + day(cur.end);
    dlg.innerHTML = '<form novalidate><h2 id="rmdT">Remind me</h2><p class="rmw"><b>' + esc(cur.name) + "</b><br>" + esc(when) + "</p>" + rows +
      '<input type="email" name="email" placeholder="Your email" autocomplete="email" aria-label="Your email" required>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<label><input type="checkbox" name="news"><span>Also send me The OneTrackMind Week, every Monday</span></label>' +
      '<div class="rmb"><button type="submit" class="btn">Remind me</button><button type="button" class="btnline" data-rmclose>Cancel</button></div>' +
      '<p class="rmm" aria-live="polite"></p><p class="rmn">We email you a link to confirm first. Our best effort to get the dates right. Always check with the organiser before you book.</p></form>';
    try { var em = localStorage.getItem("otm-email"); if (em) dlg.querySelector("[name=email]").value = em; } catch (e) {}
    dlg.showModal();
  }
  function send(e) {
    e.preventDefault();
    var f = e.target, m = f.querySelector(".rmm"), em = f.email.value.trim(), kinds = [].slice.call(f.querySelectorAll("[name=k]:checked")).map(function (x) { return x.value; });
    if (!kinds.length) { m.textContent = "Tick at least one reminder."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { m.textContent = "That email doesn't look right."; return; }
    var b = f.querySelector("[type=submit]"); b.disabled = true; m.textContent = "Sending…";
    fetch("/api/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: em, event: cur.remind, kinds: kinds, news: f.news.checked, website: f.website.value }) })
      .then(function (r) { return r.json().then(function (j) { return [r.ok, j]; }); })
      .then(function (x) { if (x[0]) { try { localStorage.setItem("otm-email", em); } catch (e) {} f.querySelector(".rmb").innerHTML = '<button type="button" class="btn" data-rmclose>Done</button>'; m.textContent = "Almost done: tap the link in the email we just sent."; } else { b.disabled = false; m.textContent = x[1].error || "Something went wrong. Try again."; } })
      .catch(function () { b.disabled = false; m.textContent = "No connection. Try again."; });
  }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-remind]"); if (!b) return; e.preventDefault(); open(b); });
})();
