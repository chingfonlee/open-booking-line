export const onRequest: PagesFunction<{ BACKEND_API_URL?: string }> = async (context) => {
  const url = new URL(context.request.url);
  const backendBase = (context.env.BACKEND_API_URL || 'https://line-bot-farm-api.your-subdomain.workers.dev').replace(/\/$/, '');
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
