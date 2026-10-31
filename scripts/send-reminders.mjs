// Sends the "Remind me" emails that are due today. Run daily by the TASK=news job (.gitlab-ci.yml).
// The site does the sending (it holds the database and the Resend key); this only asks it to, with the REMIND_SECRET shared by both.
// Usage: REMIND_SECRET=... node scripts/send-reminders.mjs   (SITE=... to point at another copy of the site)
const SITE = process.env.SITE || "https://onetrackmind.online", key = process.env.REMIND_SECRET;
if (!key) { console.log("reminders: REMIND_SECRET isn't set, nothing sent"); process.exit(0); }
try {
  const r = await fetch(`${SITE}/api/remind/send`, { method: "POST", headers: { Authorization: `Bearer ${key}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`reminders: the site said ${r.status} ${j.error || ""}`); process.exit(0); }
  console.log(`reminders: ${j.sent || 0} sent`);
} catch (e) { console.log("reminders: couldn't reach the site,", e.message); }
