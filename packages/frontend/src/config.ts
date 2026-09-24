export const API_BASE = import.meta.env.DEV
  ? ''
  : ((import.meta.env.VITE_API_BASE_URL as string) || 'https://line-bot-farm-api.chingfon-lee.workers.dev');
