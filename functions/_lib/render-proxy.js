// Cloudflare Pages Functions: keep API and OAuth on the same public origin.
// Set RENDER_ORIGIN to the dedicated Render backend URL (no trailing slash).
export async function proxyToRender(context) {
  const { request, env } = context;
  const raw = env.RENDER_ORIGIN;
  if (!raw) return new Response('Backend not configured', { status: 503 });
  let backend;
  try {
    backend = new URL(raw);
    if (backend.protocol !== 'https:' || backend.username || backend.password ||
        backend.pathname !== '/' || backend.search || backend.hash) throw new Error('invalid');
  } catch {
    return new Response('Invalid backend configuration', { status: 503 });
  }
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, backend);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-proto');
  headers.set('X-Forwarded-Host', incoming.host);
  headers.set('X-Forwarded-Proto', 'https');
  // Do not follow OAuth redirects server-side: the browser must receive cookies.
  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual'
  });
  const resultHeaders = new Headers(response.headers);
  const location = resultHeaders.get('Location');
  if (location) {
    const resolved = new URL(location, backend);
    if (resolved.origin === backend.origin) {
      resultHeaders.set('Location', incoming.origin + resolved.pathname + resolved.search + resolved.hash);
    }
  }
  resultHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers: resultHeaders });
}
