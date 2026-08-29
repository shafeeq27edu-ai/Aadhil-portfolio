export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq27edu-ai';
  const token = process.env.GITHUB_TOKEN;
  
  // We can proceed without token for public repos, but it's much better to use it
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Set cache headers: cache on CDN for 1 hour
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    // Map data to smaller footprint before sending to client
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

    return res.status(200).json(mappedRepos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    return res.status(500).json({ error: 'Failed to fetch repositories' });
  }
}
