# GitLab setup for onetrackmind/roadmap

RoadMap lives on GitLab for good (decided 30 Oct 2026). GitHub is kept for the founder's other project only, so one host blocking an account never stops both.

## 1. Branches
- `main` is what's live. `events2` holds the current work: merge it into `main` when the founder says "go live".
- Settings → Repository → Protected branches: `main`, allowed to push: Maintainers.

## 2. Token for the scheduled jobs
- Settings → Access tokens → Add new token
  - Name: `otm-bot`, Role: Maintainer, Scopes: `api`, `write_repository`, Expiry: 1 year (calendar reminder to renew)
- Settings → CI/CD → Variables → Add variable
  - `PUSH_TOKEN` = that token (Masked, Protected)
  - `META_TOKEN` = the Facebook Page token (Masked, Protected)

## 3. Schedules (Build → Pipeline schedules → New schedule, target branch `main`, time zone UTC)
| Description | Cron | Variable |
|---|---|---|
| Newsletter, posts, Wall Planner | `30 3 * * 1` | TASK = newsletter |
| Race results | `0 4 * * 2,4,5` | TASK = results |
| Headlines and Remind me emails | `15 5 * * *` | TASK = news |
| Instagram and Facebook | `17 4 * * *` | TASK = social |
| Event dates check | `0 5 * * 1` | TASK = events-check |
| Map data | `17 2 1 * *` | TASK = data |

One-off jobs: Build → Pipelines → Run pipeline, variable TASK = blog-media, blog-poi or trip-lines.

## 4. Cloudflare Pages
- Pages project connected to `onetrackmind/roadmap` on GitLab. Production branch `main`; previews for other branches.
- Build command: none (the site is committed built). Output directory: `/`.
- Bindings, copied from the old `routeandrange` project: D1 `DB`, R2 `MEDIA`; variables `ADMIN_EMAILS`, `RESEND_API_KEY` (entered by the founder).
- "Remind me" emails: add a secret `REMIND_SECRET` (any long random text) on Cloudflare Pages, and the same value as a masked CI/CD variable `REMIND_SECRET` on GitLab. Until both are set, the daily job sends nothing.
- Custom domains: `onetrackmind.online`, `www.onetrackmind.online`, `onetrackmind.co.za`, `www.onetrackmind.co.za` moved from the old project once the preview is approved.
- Stadia Maps: add the new `*.pages.dev` address to the allowed domains.

## 5. Notifications
- The jobs open Issues for anything the founder must act on (newsletter ready, event dates to confirm). Turn on email for new issues: project bell icon → Custom → New issue.

## 6. Keep it calm (so no host flags the account)
- One Claude session per project. Push in batches when the founder is happy, not every few minutes.
- Fresh backup bundle after every round of work.
