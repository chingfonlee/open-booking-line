export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = 'https://line-bot-farm-api.your-subdomain.workers.dev' + url.pathname + url.search;
  return fetch(new Request(targetUrl, context.request));
};
