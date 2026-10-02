/**
 * Utility to extract search parameters whether they come directly in window.location.search
 * or wrapped inside LIFF's `liff.state` redirect parameter.
 * 
 * Example cases handled:
 * 1. Standard URL: ?view=admin&filter=confirmed
 * 2. LIFF state URL: ?liff.state=%3Fview%3Dadmin%26filter%3Dconfirmed
 * 3. LIFF state without leading ?: ?liff.state=view%3Dadmin%26filter%3Dconfirmed
 */
export function getLiffSearchParams(): URLSearchParams {
  const currentParams = new URLSearchParams(window.location.search);
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
