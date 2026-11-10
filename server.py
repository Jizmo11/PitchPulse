"""PitchPulse: same-origin Strava OAuth and manual activity sync.

Credentials are server-side; Strava tokens are encrypted in a Secure, HttpOnly
cookie. This single-device/browser design avoids relying on Render's ephemeral
filesystem. Disconnect removes the local cookie; revoke at Strava if needed.
"""
import base64
import hashlib
import os
import secrets
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
from cryptography.fernet import Fernet, InvalidToken
from flask import Flask, jsonify, redirect, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix

ROOT = Path(__file__).resolve().parent
SECRET = os.environ.get('PITCHPULSE_SECRET_KEY', '')
CLIENT_ID = os.environ.get('STRAVA_CLIENT_ID', '').strip()
CLIENT_SECRET = os.environ.get('STRAVA_CLIENT_SECRET', '').strip()
REDIRECT_URI = os.environ.get('STRAVA_REDIRECT_URI', '').strip()
ALLOWED_ATHLETE = os.environ.get('STRAVA_ATHLETE_ID', '').strip()
CONFIGURED = bool(SECRET and CLIENT_ID and CLIENT_SECRET and REDIRECT_URI)
if not SECRET or len(SECRET) < 32:
    raise RuntimeError('Set PITCHPULSE_SECRET_KEY to a random string of at least 32 characters')

app = Flask(__name__, static_folder=None)
app.secret_key = SECRET
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config.update(SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE='Lax', PERMANENT_SESSION_LIFETIME=600,
                  MAX_CONTENT_LENGTH=64 * 1024)
fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(SECRET.encode()).digest()))
COOKIE_NAME = 'pitchpulse_strava'
COOKIE_AGE = 60 * 60 * 24 * 30
STRAVA_API = 'https://www.strava.com/api/v3'


def token_cookie():
    encrypted = request.cookies.get(COOKIE_NAME)
    if not encrypted:
        return None
    try:
        import json
        obj = json.loads(fernet.decrypt(encrypted.encode(), ttl=COOKIE_AGE).decode())
        if not isinstance(obj, dict) or not obj.get('refresh_token'):
            return None
        return obj
    except (InvalidToken, ValueError, TypeError):
        return None


def set_cookie(response, obj):
    import json
    encrypted = fernet.encrypt(json.dumps(obj, separators=(',', ':')).encode()).decode()
    response.set_cookie(COOKIE_NAME, encrypted, max_age=COOKIE_AGE,
                        secure=True, httponly=True, samesite='Lax', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return response


def fail(message, status=400):
    response = jsonify(error=message)
    response.status_code = status
    response.headers['Cache-Control'] = 'no-store'
    return response


def strava_post(path, payload):
    try:
        resp = requests.post(f'https://www.strava.com/{path}', data=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except (requests.RequestException, ValueError) as exc:
        app.logger.warning('Strava token request failed: %s', type(exc).__name__)
        return None


def refresh_token(obj):
    if obj.get('expires_at', 0) > int(time.time()) + 120 and obj.get('access_token'):
        return obj
    data = strava_post('oauth/token', dict(client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET, grant_type='refresh_token',
        refresh_token=obj['refresh_token']))
    if not data or not data.get('access_token') or not data.get('refresh_token'):
        return None
    obj.update(access_token=data['access_token'], refresh_token=data['refresh_token'],
               expires_at=data.get('expires_at', 0))
    return obj


@app.after_request
def headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    resp.headers['X-Frame-Options'] = 'DENY'
    return resp


@app.get('/')
@app.get('/index.html')
def home():
    return send_from_directory(ROOT, 'index.html')


@app.get('/manifest.webmanifest')
def manifest():
    return send_from_directory(ROOT, 'manifest.webmanifest', mimetype='application/manifest+json')


@app.get('/v84.js')
def v84_script():
    return send_from_directory(ROOT, 'v84.js', mimetype='application/javascript')


@app.get('/running-performance.js')
def running_performance_script():
    return send_from_directory(ROOT, 'running-performance.js', mimetype='application/javascript')


@app.get('/backup.js')
def backup_script():
    return send_from_directory(ROOT, 'backup.js', mimetype='application/javascript')


@app.get('/sw.js')
def worker():
    return send_from_directory(ROOT, 'sw.js', mimetype='application/javascript')


@app.get('/icon-192.png')
@app.get('/icon-512.png')
@app.get('/favicon.png')
@app.get('/splash-strideeleven.jpg')
def branding_asset():
    return send_from_directory(ROOT, request.path.lstrip('/'))


@app.get('/health')
def health():
    return jsonify(ok=True)


@app.get('/api/status')
def status():
    obj = token_cookie()
    return jsonify(configured=CONFIGURED, connected=bool(obj),
                   athlete_name=obj.get('athlete_name', '') if obj else '')


@app.get('/auth/strava')
def connect():
    if not CONFIGURED:
        return fail('Strava integration not configured', 503)
    state = secrets.token_urlsafe(32)
    session['strava_oauth_state'] = state
    session.permanent = True
    url = 'https://www.strava.com/oauth/authorize?' + urlencode(dict(
        client_id=CLIENT_ID, response_type='code', redirect_uri=REDIRECT_URI,
        approval_prompt='auto', scope='read,activity:read_all', state=state))
    return redirect(url)


@app.get('/auth/strava/callback')
def callback():
    expected = session.pop('strava_oauth_state', None)
    state = request.args.get('state', '')
    if not expected or not state or not secrets.compare_digest(expected, state):
        return fail('Strava sign-in state mismatch. Start again from PitchPulse.', 403)
    if request.args.get('error'):
        return redirect('/?strava=denied')
    code = request.args.get('code', '')
    if not code:
        return fail('Strava did not return an authorization code')
    scopes = set(request.args.get('scope', '').split(','))
    if 'activity:read_all' not in scopes:
        return fail('Activity access was not granted. Reconnect and approve activity access.', 403)
    data = strava_post('oauth/token', dict(client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET, code=code, grant_type='authorization_code'))
    if not data or not data.get('access_token') or not data.get('refresh_token'):
        return fail('Strava connection failed. Please retry.', 502)
    athlete = data.get('athlete') or {}
    athlete_id = str(athlete.get('id', ''))
    if ALLOWED_ATHLETE and athlete_id != ALLOWED_ATHLETE:
        return fail('This Strava account is not authorised for this PitchPulse deployment.', 403)
    obj = dict(access_token=data['access_token'], refresh_token=data['refresh_token'],
               expires_at=data.get('expires_at', 0), athlete_id=athlete_id,
               athlete_name=' '.join(filter(None, [athlete.get('firstname'), athlete.get('lastname')])).strip())
    return set_cookie(redirect('/?strava=connected'), obj)


@app.get('/api/activities')
def activities():
    obj = token_cookie()
    if not obj:
        return fail('Not connected to Strava. Tap Connect Strava first.', 401)
    obj = refresh_token(obj)
    if not obj:
        return fail('Strava session expired. Reconnect your account.', 401)
    collected = []
    try:
        for page in range(1, 6):
            r = requests.get(f'{STRAVA_API}/athlete/activities',
                headers={'Authorization': 'Bearer ' + obj['access_token']},
                params={'page': page, 'per_page': 100}, timeout=20)
            if r.status_code == 429:
                return fail('Strava rate limit reached. Try syncing again later.', 429)
            r.raise_for_status()
            batch = r.json()
            if not isinstance(batch, list):
                return fail('Unexpected response from Strava', 502)
            collected.extend(batch)
            if len(batch) < 100:
                break
    except (requests.RequestException, ValueError):
        return fail('Unable to fetch activities from Strava. Try again later.', 502)
    response = jsonify(activities=collected)
    return set_cookie(response, obj)


@app.get('/api/activities/<int:activity_id>/streams')
def activity_streams(activity_id):
    """Private, same-origin GPS stream proxy; never persist coordinates on server."""
    obj = token_cookie()
    if not obj:
        return fail('Connect Strava first.', 401)
    obj = refresh_token(obj)
    if not obj:
        return fail('Strava session expired. Reconnect.', 401)
    try:
        # Verify the activity belongs to the connected athlete before fetching streams.
        detail = requests.get(f'{STRAVA_API}/activities/{activity_id}',
            headers={'Authorization': 'Bearer ' + obj['access_token']}, timeout=20)
        if detail.status_code == 429:
            return fail('Strava rate limit reached. Retry later.', 429)
        if detail.status_code in (401, 403, 404):
            return fail('Activity is unavailable to this Strava account.', 403)
        detail.raise_for_status()
        activity = detail.json()
        if str((activity.get('athlete') or {}).get('id', '')) != str(obj.get('athlete_id', '')):
            return fail('Activity does not belong to this athlete.', 403)
        if activity.get('sport_type') not in ('Soccer', 'Run'):
            return fail('GPS visualisation is available for Run and Soccer activities.', 400)
        r = requests.get(f'{STRAVA_API}/activities/{activity_id}/streams',
            headers={'Authorization': 'Bearer ' + obj['access_token']},
            params={'keys':'time,distance,velocity_smooth,latlng','key_by_type':'true'}, timeout=25)
        if r.status_code == 429:
            return fail('Strava rate limit reached. Retry later.', 429)
        if r.status_code in (401,403,404):
            return fail('GPS streams unavailable for this activity.', 404)
        r.raise_for_status()
        streams = r.json()
        if not isinstance(streams, dict):
            return fail('Unexpected Strava stream format.', 502)
        result = {}
        for key in ('time', 'distance', 'velocity_smooth', 'latlng'):
            item = streams.get(key) or {}
            data = item.get('data') if isinstance(item, dict) else None
            if isinstance(data, list):
                result[key] = data[:25000]
        if len(result.get('time', [])) < 2 or len(result.get('distance', [])) != len(result['time']):
            return fail('Timestamped distance data is unavailable for this recording.', 422)
        response = jsonify(streams=result, activity_id=activity_id,
                           elapsed_seconds=activity.get('elapsed_time'))
        response.headers['Cache-Control'] = 'no-store'
        return set_cookie(response, obj)
    except (requests.RequestException, ValueError):
        return fail('Unable to retrieve Strava GPS streams.', 502)


@app.post('/api/disconnect')
def disconnect():
    # Same-origin POST only: avoid cross-site logout requests.
    origin = request.headers.get('Origin', '')
    if not origin or origin != request.host_url.rstrip('/'):
        return fail('Invalid request origin', 403)
    response = jsonify(disconnected=True)
    response.delete_cookie(COOKIE_NAME, path='/', secure=True, httponly=True, samesite='Lax')
    response.headers['Cache-Control'] = 'no-store'
    return response



# Read-only Dribl fixture proxy. No arbitrary upstream URL or user-supplied host.
@app.get('/api/dribl/fixtures')
def dribl_fixtures():
    try:
        tenant_response = requests.get('https://mc-api.dribl.com/api/tenants',
            params={'mc_link':'csl.dribl.com','slug':'csl'}, timeout=12)
        if not tenant_response.ok:
            return fail('Dribl tenant lookup returned HTTP ' + str(tenant_response.status_code), 502)
        raw_tenant = tenant_response.json()
        def find_tenant(value):
            if isinstance(value, dict):
                if isinstance(value.get('id'), str) and value.get('id'):
                    return value['id']
                for key in ('data','tenant'):
                    if key in value:
                        found = find_tenant(value[key])
                        if found: return found
            if isinstance(value, list):
                for item in value:
                    found = find_tenant(item)
                    if found: return found
            return None
        tenant = find_tenant(raw_tenant)
        if not tenant:
            return fail('Dribl CSL tenant ID could not be resolved.', 502)
        params = {'date_range':'all','season':'k2Kp4R8KY5',
            'competition':'2PmjOYnjNZ','league':'njdyY34Ad5',
            'club':'8BdVrJ5dE5','tenant':tenant,'timezone':'Australia/Adelaide'}
        response = requests.get('https://mc-api.dribl.com/api/fixtures',
            params=params, timeout=20)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get('data'), list):
            return fail('Dribl returned an unexpected fixture format.', 502)
        result = jsonify(source='Dribl CSL',read_only=True,
            fixtures=payload['data'][:100],more=bool(payload.get('links',{}).get('next')) if isinstance(payload.get('links'),dict) else False)
        result.headers['Cache-Control']='no-store'
        return result
    except (requests.RequestException, ValueError, TypeError):
        return fail('Live Dribl fixture request failed. Please retry later.', 502)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=10000)
