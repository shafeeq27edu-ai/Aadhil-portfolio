let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000;

function mapRepo(r) {
  return {
    id: r.id || r.databaseId,
    name: r.name,
    description: r.description,
    language: r.language || (r.primaryLanguage && r.primaryLanguage.name) || null,
    stargazers_count: r.stargazers_count ?? r.stargazerCount ?? 0,
    forks_count: r.forks_count ?? r.forkCount ?? 0,
    updated_at: r.updated_at || r.updatedAt,
    html_url: r.html_url || r.url
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq27edu-ai';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  try {
    const now = Date.now();
    if (cache && (now - lastFetchTime < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json(cache);
    }

    let result;

    // Try GraphQL first (pinned repos + all repos in one query)
    if (token) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 6000);
        const query = `query($u:String!) {
          user(login:$u) {
            pinnedItems(first:6, types:REPOSITORY) {
              nodes { ... on Repository {
                databaseId name description primaryLanguage{name}
                stargazerCount forkCount updatedAt url
              }}
            }
            repositories(first:100, orderBy:{field:UPDATED_AT,direction:DESC}) {
              nodes {
                databaseId name description primaryLanguage{name}
                stargazerCount forkCount updatedAt url
              }
            }
          }
        }`;
        const gqlRes = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query, variables: { u: username } }),
          signal: c.signal,
        });
        clearTimeout(t);
        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          if (gqlData.data && gqlData.data.user) {
            const user = gqlData.data.user;
            result = {
              pinned: (user.pinnedItems.nodes || []).map(mapRepo),
              all: (user.repositories.nodes || []).map(mapRepo),
            };
          }
        }
      } catch (e) {
        console.warn('GraphQL repos failed, falling back to REST:', e.message);
      }
    }

    // REST fallback
    if (!result) {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6000);
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const restRes = await fetch(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
        { method: 'GET', headers, signal: c.signal }
      );
      clearTimeout(t);
      if (!restRes.ok) throw new Error(`GitHub REST ${restRes.status}`);
      const data = await restRes.json();
      const nonForks = data.filter(r => !r.fork).map(mapRepo);
      result = { pinned: [], all: nonForks };
    }

    cache = result;
    lastFetchTime = Date.now();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching repos:', error.message || error);
    if (cache) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(200).json(cache);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to fetch repositories' });
  }
}
