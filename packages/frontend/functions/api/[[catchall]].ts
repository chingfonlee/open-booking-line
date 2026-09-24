export const onRequest: PagesFunction<{ BACKEND_API_URL?: string }> = async (context) => {
  const backendBase = (context.env.BACKEND_API_URL || '').replace(/\/$/, '');
  if (!backendBase) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Cloudflare Pages Proxy: 未配置 BACKEND_API_URL 環境變數，請於 Pages 後台設定 Worker 網址，或於前端 .env 設定 VITE_API_BASE_URL。'
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(context.request.url);
  const targetUrl = backendBase + url.pathname + url.search;
  
  // 建立代理請求，完整轉發 Method, Headers 與 Body
  const headers = new Headers(context.request.headers);
  const backendHost = new URL(backendBase).host;
  headers.set('host', backendHost);

  const init: RequestInit = {
    method: context.request.method,
    headers: headers,
    redirect: 'follow'
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.request.method.toUpperCase())) {
    init.body = context.request.body;
    // @ts-ignore
    init.duplex = 'half';
  }

  return fetch(targetUrl, init);
};
