const USERNAME = 'shafeeq27edu-ai';
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 6000;

let cache = null;
let lastFetchTime = 0;

function levelThresholds(maxCount) {
  const max = Math.max(1, maxCount);
  if (max <= 4) return [1, 2, 3, 4];
  return [1, Math.ceil(max * 0.25), Math.ceil(max * 0.5), Math.ceil(max * 0.75)];
}

function levelFor(count, thresholds) {
  if (count <= 0) return 0;
  if (count <= thresholds[0]) return 1;
  if (count <= thresholds[1]) return 2;
  if (count <= thresholds[2]) return 3;
  return 4;
}

function buildPayload(rawDays, followers, source) {
  const unique = new Map();
  for (const day of rawDays) {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) continue;
    const count = Math.max(0, Number(day.count) || 0);
    const previous = unique.get(day.date);
    unique.set(day.date, previous === undefined ? count : Math.max(previous, count));
  }

  const days = Array.from(unique, ([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxCount = days.reduce((max, day) => Math.max(max, day.count), 0);
  const thresholds = levelThresholds(maxCount);
  for (const day of days) day.level = levelFor(day.count, thresholds);

  return {
    username: USERNAME,
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.filter((day) => day.count > 0).length,
    maxCount,
    thresholds,
    followers: followers === null || followers === undefined ? null : followers,
    days,
    startDate: days.length ? days[0].date : null,
    endDate: days.length ? days[days.length - 1].date : null,
    fetchedAt: new Date().toISOString(),
    source,
    fallback: false,
  };
}

async function fetchFromGraphQL(token) {
  const query = `
    query($userName:String!) {
      user(login: $userName){
        followers { totalCount }
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { contributionCount date } }
          }
        }
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { userName: USERNAME } }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL returned ${response.status}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length) {
      throw new Error(`GitHub GraphQL error: ${data.errors[0].message}`);
    }

    const user = data.data && data.data.user;
    if (!user) throw new Error('GitHub GraphQL returned no user');

    const weeks = user.contributionsCollection.contributionCalendar.weeks;
    const rawDays = weeks.flatMap((week) => week.contributionDays);
    return buildPayload(rawDays, user.followers.totalCount, 'graphql');
  } finally {
    clearTimeout(timeout);
  }
}

// Unauthenticated path: the public contributions page embeds exact per-day counts in tooltips.
async function fetchFromHTML() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(`https://github.com/users/${USERNAME}/contributions`, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'aadhil-portfolio/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub contributions page returned ${response.status}`);
    }

    const html = await response.text();
    const countsById = new Map();
    const tooltipPattern = /<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g;
    let match;
    while ((match = tooltipPattern.exec(html)) !== null) {
      const text = match[2].replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&');
      const count = text.match(/([\d,]+)\s+contributions?/i);
      countsById.set(match[1], count ? Number(count[1].replace(/,/g, '')) : 0);
    }

    const days = [];
    const cellPattern = /<td\b[^>]*>/g;
    while ((match = cellPattern.exec(html)) !== null) {
      const tag = match[0];
      const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
      if (!date) continue;

      const id = tag.match(/\bid="([^"]+)"/);
      const level = tag.match(/data-level="([0-4])"/);
      const count = id && countsById.has(id[1])
        ? countsById.get(id[1])
        : level ? Number(level[1]) : 0;

      days.push({ date: date[1], count });
    }

    if (days.length < 300) {
      throw new Error(`Unexpected contributions markup (${days.length} cells)`);
    }

    return buildPayload(days, null, 'html');
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const now = Date.now();
  if (cache && now - lastFetchTime < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json({ ...cache, source: 'cache' });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  try {
    let payload;
    if (token) {
      try {
        payload = await fetchFromGraphQL(token);
      } catch (error) {
        console.warn(`GitHub GraphQL unavailable (${error.message}); using public contributions page.`);
        payload = await fetchFromHTML();
      }
    } else {
      payload = await fetchFromHTML();
    }

    cache = payload;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error fetching GitHub contributions:', error.message || error);

    if (cache) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ...cache, source: 'stale', stale: true });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fallback: true, error: 'Failed to fetch GitHub data', days: [] });
  }
}
