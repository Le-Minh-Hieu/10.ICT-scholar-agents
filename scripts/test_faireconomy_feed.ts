const FEED_URLS = [
  'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
];

async function tryUrl(url: string) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  // Helps diagnose rate limits/CDN behavior.
  const retryAfter = resp.headers?.get
    ? resp.headers.get('retry-after')
    : null;
  if (retryAfter) {
    console.log('[RETRY_AFTER_SECONDS]', retryAfter);
  }


  const status = resp.status;
  const statusText = resp.statusText;

  if (!resp.ok) {
    return { ok: false as const, url, status, statusText };
  }

  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false as const, url, status, statusText, reason: 'Not an array or empty' };
  }

  return { ok: true as const, url, status, statusText, events: data };
}

async function main() {
  for (const url of FEED_URLS) {
    try {
      const result = await tryUrl(url);
      if (!result.ok) {
        console.log('[STATUS]', result.status);
        console.log('[STATUS_TEXT]', result.statusText);
        console.log('[FEED_URL]', result.url);
        if ('reason' in result) console.log('[REASON]', (result as any).reason);
        continue;
      }

      const events: any[] = result.events;
      console.log('[FEED_URL_SUCCEEDED]', result.url);
      console.log('[STATUS]', result.status);
      console.log('[STATUS_TEXT]', result.statusText);
      console.log('[EVENT_COUNT]', events.length);

      const titles = events
        .slice(0, 10)
        .map((e) => e?.title)
        .filter(Boolean);

      console.log('[FIRST_10_TITLES]');
      for (const [i, t] of titles.entries()) {
        console.log(`${i + 1}. ${t}`);
      }

      return;
    } catch (err: any) {
      console.log('[FEED_URL_FAILED]', url);
      console.log('[ERROR]', String(err?.message || err));
    }
  }

  console.error('Unable to load FairEconomy feed from all URLs');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

