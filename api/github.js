const USERNAME = 'shafeeq27edu-ai';
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 6000;
const DAY_MS = 86400000;
const EVENTS_WINDOW_DAYS = 90;

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
    partial: false,
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

// Last resort: public events cover the last 90 days from api.github.com,
// which stays reachable when github.com HTML routes are blocked.
async function fetchFromEvents() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const cutoff = Date.now() - EVENTS_WINDOW_DAYS * DAY_MS;

  try {
    const counts = new Map();
    let url = `https://api.github.com/users/${USERNAME}/events/public?per_page=100`;

    for (let page = 0; page < 3 && url; page += 1) {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'aadhil-portfolio/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`GitHub events API returned ${response.status}`);
      }

      const events = await response.json();
      if (!Array.isArray(events) || events.length === 0) break;

      let reachedCutoff = false;
      for (const event of events) {
        const createdAt = Date.parse(event.created_at);
        if (!Number.isFinite(createdAt)) continue;
        if (createdAt < cutoff) {
          reachedCutoff = true;
          continue;
        }

        const date = new Date(createdAt).toISOString().slice(0, 10);
        const commits = event.type === 'PushEvent' ? event.payload && event.payload.commits : null;
        const amount = Array.isArray(commits) && commits.length > 0 ? commits.length : 1;
        counts.set(date, (counts.get(date) || 0) + amount);
      }

      if (reachedCutoff) break;

      const link = response.headers.get('link') || '';
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      url = next ? next[1] : null;
    }

    if (counts.size === 0) {
      throw new Error('GitHub events API returned no activity');
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const days = [];
    for (let offset = EVENTS_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
      days.push({ date, count: counts.get(date) || 0 });
    }

    return {
      ...buildPayload(days, null, 'events'),
      partial: true,
      windowDays: EVENTS_WINDOW_DAYS,
    };
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
    // GraphQL gives the full year when the token is valid; the public page and
    // the events API cover the unauthenticated case. Whichever highest-priority
    // source resolves first wins.
    const sources = [];
    if (token) sources.push(fetchFromGraphQL(token));
    sources.push(fetchFromHTML());
    sources.push(fetchFromEvents());

    const outcomes = await Promise.allSettled(sources);
    const payload = outcomes.find((outcome) => outcome.status === 'fulfilled');

    if (!payload) {
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') {
          console.warn(`GitHub source failed: ${outcome.reason && outcome.reason.message ? outcome.reason.message : outcome.reason}`);
        }
      }
      throw new Error('All GitHub data sources failed');
    }

    cache = payload.value;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(payload.value);
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
