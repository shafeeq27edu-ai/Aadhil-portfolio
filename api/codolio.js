const USERNAME = 'shafeeq_27';
const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 6000;
const DAY_MS = 86400000;
const WINDOW_WEEKS = 26;

let cache = null;
let lastFetchTime = 0;

function dateKeyFromTimestamp(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function mergeCalendars(rawCalendars) {
  const merged = new Map();

  for (const raw of rawCalendars) {
    if (!raw) continue;
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;

    for (const [timestamp, count] of Object.entries(parsed)) {
      const date = dateKeyFromTimestamp(timestamp);
      const value = Number(count);
      if (!date || !Number.isFinite(value) || value <= 0) continue;
      merged.set(date, (merged.get(date) || 0) + value);
    }
  }

  return merged;
}

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

function buildWindow(merged, todayUTC) {
  const weekday = new Date(todayUTC).getUTCDay();
  const currentSunday = todayUTC - weekday * DAY_MS;
  const startUTC = currentSunday - (WINDOW_WEEKS - 1) * 7 * DAY_MS;

  const days = [];
  for (let time = startUTC; time <= todayUTC; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({ date, count: merged.get(date) || 0 });
  }

  const maxCount = days.reduce((max, day) => Math.max(max, day.count), 0);
  const thresholds = levelThresholds(maxCount);
  for (const day of days) day.level = levelFor(day.count, thresholds);

  return {
    weeks: WINDOW_WEEKS,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.filter((day) => day.count > 0).length,
    maxCount,
    thresholds,
    days,
  };
}

async function fetchLeetCode() {
  const currentYear = new Date().getUTCFullYear();
  const query = `
    query userActivity($username: String!, $current: Int!, $previous: Int!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        current: userCalendar(year: $current) { submissionCalendar }
        previous: userCalendar(year: $previous) { submissionCalendar }
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com',
      },
      body: JSON.stringify({
        query,
        variables: { username: USERNAME, current: currentYear, previous: currentYear - 1 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LeetCode returned ${response.status}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length) {
      throw new Error(`LeetCode error: ${data.errors[0].message}`);
    }

    const user = data.data && data.data.matchedUser;
    if (!user) throw new Error('LeetCode returned no user');

    const stats = user.submitStatsGlobal.acSubmissionNum;
    const countFor = (difficulty) => {
      const entry = stats.find((item) => item.difficulty === difficulty);
      return entry ? entry.count : 0;
    };

    const merged = mergeCalendars([
      user.current && user.current.submissionCalendar,
      user.previous && user.previous.submissionCalendar,
    ]);

    const entries = Array.from(merged, ([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const yearPrefix = `${currentYear}-`;
    const yearDays = entries.filter((entry) => entry.date.startsWith(yearPrefix));
    const lastActive = entries.length ? entries[entries.length - 1].date : null;

    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const fetchedAt = new Date().toISOString();

    return {
      leetcode: {
        username: USERNAME,
        totalSolved: countFor('All'),
        easySolved: countFor('Easy'),
        mediumSolved: countFor('Medium'),
        hardSolved: countFor('Hard'),
        year: currentYear,
        yearTotal: yearDays.reduce((sum, entry) => sum + entry.count, 0),
        yearActiveDays: yearDays.length,
        lastActive,
        window: buildWindow(merged, todayUTC),
        fetchedAt,
        source: 'leetcode',
      },
      fetchedAt,
      fallback: false,
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
    return res.status(200).json(cache);
  }

  try {
    const result = await fetchLeetCode();
    cache = result;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching LeetCode activity:', error.message || error);

    if (cache) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ...cache, stale: true });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fallback: true, error: 'Failed to fetch LeetCode data', leetcode: null });
  }
}
