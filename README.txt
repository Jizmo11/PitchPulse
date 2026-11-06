PitchPulse PWA v1 — Android-first prototype

WHAT IS INCLUDED
index.html, manifest.webmanifest, sw.js, icons. Local training, running, soccer and recovery entries use browser localStorage.

INSTALL WITHOUT A PC
1. Host the contents of this folder on an HTTPS static host (for example, a static-site host supporting ZIP upload or GitHub Pages). Do not just open index.html as a local file; service workers and installation require HTTPS or localhost.
2. Open the resulting HTTPS URL in Chrome on Android.
3. Chrome menu > Add to Home screen / Install app (wording varies).
4. Open PitchPulse from your home screen.

IMPORTANT
This archive is not a hosted URL and is not an APK. The PWA's local data is stored under the hosted website's origin, not automatically migrated from previous downloaded HTML prototypes. Clearing site data or uninstalling may delete local entries.
Strava OAuth and sync require a separately deployed secure backend and Strava API credentials. The old local development server is NOT safe to expose publicly. Do not put client secrets in frontend files or public repositories.
The current PWA has no live Strava connection and no background sync.
