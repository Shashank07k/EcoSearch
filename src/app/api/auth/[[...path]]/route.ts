// Preview-host adapter. Express owns auth, JWTs and all security logic.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path?: string[] }> };

async function proxy(request: Request, context: Context) {
  try {
    const { path = [] } = await context.params;
    if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
      return Response.json({ success: false, error: { status: 400, message: 'Invalid auth path' } }, { status: 400 });
    }
    const target = new URL(process.env.ECOSEARCH_BACKEND_URL || 'http://127.0.0.1:5000');
    target.pathname = `/api/auth${path.length ? `/${path.map(encodeURIComponent).join('/')}` : ''}`;
    const response = await fetch(target, {
      method: request.method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...extractAuth(request) },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      cache: 'no-store',
    });
    const data: unknown = await response.json();
    return Response.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ success: false, error: { status: 503, message: 'The authentication service is temporarily unavailable. Please try again shortly.' } }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}

function extractAuth(request: Request): Record<string, string> {
  const authorization = request.headers.get('authorization');
  return authorization ? { authorization } : {};
}

export { proxy as GET, proxy as POST };
