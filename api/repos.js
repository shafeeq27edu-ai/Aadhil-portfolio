let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq27edu-ai';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const now = Date.now();
    if (cache && (now - lastFetchTime < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json(cache);
    }

    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    
    const mappedRepos = data.map(repo => ({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      html_url: repo.html_url
    }));

    cache = mappedRepos;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(mappedRepos);
  } catch (error) {
    console.error('Error fetching repos:', error.message || error);
    if (cache) {
      return res.status(200).json(cache);
    }
    return res.status(200).json([]);
  }
}
