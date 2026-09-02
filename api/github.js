// In-memory cache to survive hot reloads/serverless invocations if possible
let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq27edu-ai';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  // If token is missing, we log it but return fallback to prevent UI crash
  if (!token) {
    console.warn('GITHUB_TOKEN is missing. Returning fallback data.');
    return returnFallback(res);
  }

  const query = `
    query($userName:String!) {
      user(login: $userName){
        followers {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  try {
    const now = Date.now();
    if (cache && (now - lastFetchTime < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json(cache);
    }

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { userName: username },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    const userNode = data.data.user;
    const followers = userNode.followers.totalCount;
    const weeks = userNode.contributionsCollection.contributionCalendar.weeks;
    const total = userNode.contributionsCollection.contributionCalendar.totalContributions;

    const result = { total, followers, weeks, fallback: false };
    
    // Update cache
    cache = result;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=43200');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching GitHub contributions:', error.message || error);
    // If we have stale cache, serve it
    if (cache) {
      console.log('Serving stale cache due to error');
      return res.status(200).json(cache);
    }
    // Otherwise serve clean empty state
    return returnFallback(res);
  }
}

function returnFallback(res) {
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).json({ 
    total: 0,
    followers: 0,
    weeks: [],
    fallback: true
  });
}
