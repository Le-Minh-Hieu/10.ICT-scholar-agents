import fs from 'fs/promises';

async function main() {
  const resp = await fetch('https://www.forexfactory.com/calendar', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  });

  console.log('[STATUS]', resp.status);
  console.log('[STATUS_TEXT]', resp.statusText);

  const html = await resp.text();

  console.log('[HTML_LENGTH]', html.length);

  console.log('[HAS_CALENDAR_TABLE]', html.includes('calendar__table'));

  console.log(
    '[HAS_CLOUDFLARE]',
    html.includes('Just a moment') ||
      html.includes('_cf_chl_opt') ||
      html.includes('Verify you are human')
  );

  await fs.mkdir('tmp', { recursive: true });

  await fs.writeFile('tmp/ff_calendar.html', html, 'utf8');

  console.log('[OUTPUT]', 'tmp/ff_calendar.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

