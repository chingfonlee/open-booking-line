const urls = [
  'https://xingnong-starter-demo.netlify.app',
  'https://xingnong-line-booking-demo.netlify.app'
];

async function check() {
  const results = await Promise.all(urls.map(async u => {
    const res = await fetch(u);
    const text = await res.text();
    const title = (text.match(/<title>(.*?)<\/title>/) || [])[1];
    const forbiddenRegex = /Management|Dispatch|Starter|管理版|派工版|接單版|方案|升級|已排程|確定排程|派工人員|機具|施工中|NT\$500/;
    const hasForbidden = forbiddenRegex.test(text);
    return { url: u, status: res.status, title, hasForbiddenKeywords: hasForbidden };
  }));
  console.table(results);
}

check();
