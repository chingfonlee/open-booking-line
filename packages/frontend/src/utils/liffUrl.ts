/**
 * Utility to extract search parameters whether they come directly in window.location.search
 * or wrapped inside LIFF's `liff.state` redirect parameter.
 * 
 * Example cases handled:
 * 1. Standard URL: ?view=admin&filter=confirmed
 * 2. LIFF state URL: ?liff.state=%3Fview%3Dadmin%26filter%3Dconfirmed
 * 3. LIFF state without leading ?: ?liff.state=view%3Dadmin%26filter%3Dconfirmed
 */
export function getLiffSearchParams(urlStr?: string): URLSearchParams {
  let searchStr = '';
  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      searchStr = parsed.search;
    } catch {
      searchStr = urlStr.includes('?') ? urlStr.slice(urlStr.indexOf('?')) : '';
    }
  } else if (typeof window !== 'undefined') {
    searchStr = window.location.search;
  }

  const currentParams = new URLSearchParams(searchStr);
  const liffState = currentParams.get('liff.state');
  
  if (liffState) {
    try {
      const decodedState = decodeURIComponent(liffState);
      const queryPart = decodedState.startsWith('?') ? decodedState.slice(1) : decodedState;
      const stateParams = new URLSearchParams(queryPart);
      
      // Merge: query params inside liffState take precedence, but keep any existing non-empty params
      currentParams.forEach((value, key) => {
        if (!stateParams.has(key) && key !== 'liff.state') {
          stateParams.append(key, value);
        }
      });
      return stateParams;
    } catch {
      return currentParams;
    }
  }
  
  return currentParams;
}

/**
 * 產生安全合法的 LINE Login redirectUri。
 * 徹底剔除 LINE OAuth 保留與內部狀態參數（liff.state, liffClientId, code, state, error 等），
 * 並將 liff.state 內部承載的業務參數（例如 view=admin, filter=to_contact, tab=settings）還原為乾淨的標準 Query String。
 * 防止將包含 liff.state 的網址傳入 liff.login() 導致 LINE OAuth 伺服器報 HTTP 400 Bad Request。
 */
export function getCleanRedirectUri(customUrl?: string): string {
  if (typeof window === 'undefined' && !customUrl) return '';
  try {
    const rawUrl = customUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!rawUrl) return '';
    const url = new URL(rawUrl);
    const searchParams = getLiffSearchParams(rawUrl);
    
    // 嚴格刪除所有 LINE / OAuth 內部保留與暫態參數
    const OAUTH_RESERVED_KEYS = [
      'liff.state',
      'liff.referrer',
      'liffClientId',
      'code',
      'state',
      'error',
      'error_description',
      'friendship_status_changed'
    ];
    
    OAUTH_RESERVED_KEYS.forEach(key => {
      searchParams.delete(key);
      url.searchParams.delete(key);
    });

    const cleanQuery = searchParams.toString();
    url.search = cleanQuery ? `?${cleanQuery}` : '';
    url.hash = ''; // 清除可能包含的 client-side hash
    
    return url.toString();
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return '';
  }
}
