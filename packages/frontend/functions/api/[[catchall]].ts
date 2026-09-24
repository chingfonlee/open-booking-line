export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = 'https://line-bot-farm-api.chingfon-lee.workers.dev' + url.pathname + url.search;
  
  // 建立代理請求，完整轉發 Method, Headers 與 Body
  const headers = new Headers(context.request.headers);
  headers.set('host', 'line-bot-farm-api.chingfon-lee.workers.dev');

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
