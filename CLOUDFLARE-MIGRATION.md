# StrideEleven: staged frontend separation (not production-ready)

## Goal
Serve the PWA immediately from Cloudflare Pages while Render wakes in the background.
The API and Strava OAuth must remain same-origin from the browser's perspective.

## Safe staging
- Branch: `feature/cloudflare-frontend-splash`; **do not merge to main** until validated.
- Cloudflare Pages Git repository: `Jizmo11/PitchPulse`; production branch for this Pages project: this feature branch during testing.
- Build command: `sh scripts/build-pages.sh`.
- Build output directory: `dist`.
- Pages Functions: `/api/*` and `/auth/*` proxy to Render, forwarding cookies and OAuth redirects.
- Set Cloudflare Pages environment variable `RENDER_ORIGIN=https://strideeleven-preview.onrender.com` for the test deployment.
- Do not publish the repository root as the static asset directory: Python backend files must remain private.

## OAuth setup required BEFORE testing Strava
1. Obtain the Cloudflare Pages preview hostname and confirm it is the hostname users will open.
2. On the **preview Render service only**, configure `STRAVA_REDIRECT_URI` to `https://<pages-hostname>/auth/strava/callback`.
3. Confirm the corresponding callback domain is permitted in the Strava application's authorization settings. Strava's app domain restrictions may require a custom domain or an appropriate test app.
4. Keep `PITCHPULSE_SECRET_KEY`, Strava client secrets and tokens only on Render. Never expose them as Pages variables.
5. OAuth callback must be delivered through the Pages proxy so its HttpOnly cookie is set on the Pages hostname.
6. Test `/api/status`, connect, callback, `/api/activities`, GPS streams, disconnect, and reconnect.

## Rollout cautions
- The existing production Render service is set to auto-deploy from `main`; do not merge during testing.
- The preview Render service is pinned to `rebrand/strideeleven` with auto-deploy disabled. The feature branch changes are only for Pages unless preview is deliberately updated.
- Cloudflare Pages and Render have different browser storage origins. Export an app backup on the old origin and restore it on the new origin before switching the installed Android PWA.
- Confirm service worker offline behavior, cache versions, splash visibility, Dribl, GPS maps, and PWA installation on Android.
- The backend still sleeps on Render's free tier. This design removes Render's cold-start screen, not the backend wake-up delay.
- Changing the production Render OAuth redirect URI before switching the app would break OAuth on the existing origin. Coordinate the cutover carefully.
- The Pages proxy sends X-Forwarded-Host to support Flask's ProxyFix and same-origin logout checks. Verify host trust and CSRF protections before any wider/public release.
