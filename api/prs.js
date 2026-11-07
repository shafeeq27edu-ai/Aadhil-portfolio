const USERNAME = 'shafeeq27edu-ai';
const CACHE_TTL = 3600 * 1000;

let cache = null;
let lastFetchTime = 0;

function mapPr(pr) {
  let status = 'Open';
  let category = 'open';

  if (pr.state === 'closed') {
    if (pr.pull_request && pr.pull_request.merged_at) {
      status = 'Merged';
      category = 'merged';
    } else {
      status = 'Closed';
      category = 'closed';
    }
  }

  return {
    title: pr.title,
    repo: pr.repository_url.replace('https://api.github.com/repos/', ''),
    number: pr.number,
    status,
    category,
    url: pr.html_url,
  };
}

async function requestOnce(url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }
    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.name === 'AbortError' ? 'timeout' : 'network',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithAuth(url, token) {
  let result = await requestOnce(url, token);
  // A stale or invalid token must not take the section down.
  if (result.status === 401 && token) {
    result = await requestOnce(url, null);
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const now = Date.now();
  if (cache && now - lastFetchTime < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(cache);
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  const searchParams = new URLSearchParams({
    q: `author:${USERNAME} type:pr -user:${USERNAME}`,
    sort: 'created',
    order: 'desc',
    per_page: '50',
  });

  const [userResult, searchResult] = await Promise.all([
    requestWithAuth(`https://api.github.com/users/${USERNAME}`, token),
    requestWithAuth(`https://api.github.com/search/issues?${searchParams}`, token),
  ]);

  if (!userResult.ok && !searchResult.ok) {
    console.error('GitHub PRs unavailable:', userResult.status, searchResult.status);
    if (cache) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(200).json(cache);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Failed to fetch GitHub data' });
  }

  const prs = searchResult.ok && Array.isArray(searchResult.data.items)
    ? searchResult.data.items
        .map(mapPr)
        .filter(pr => !pr.repo.startsWith(`${USERNAME}/`))
    : [];

  const user = userResult.ok && userResult.data
    ? {
        public_repos: userResult.data.public_repos ?? 0,
        followers: userResult.data.followers ?? 0,
      }
    : null;

  const totalCount = searchResult.ok && Number.isFinite(searchResult.data.total_count)
    ? searchResult.data.total_count
    : prs.length;

  const partial = !userResult.ok || !searchResult.ok;
  const result = { user, totalCount, prs, partial };

  if (partial) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    cache = result;
    lastFetchTime = Date.now();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }

  return res.status(200).json(result);
}
