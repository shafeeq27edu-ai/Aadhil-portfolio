export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq27edu-ai';
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'GitHub token is not configured on the server.' });
  }

  const query = `
    query($userName:String!) {
      user(login: $userName){
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
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    // Set cache headers: cache on CDN for 3 hours (10800s), stale-while-revalidate for 12 hours
    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=43200');
    
    // Extract the weeks array
    const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
    
    // We can also extract total contributions if needed
    const total = data.data.user.contributionsCollection.contributionCalendar.totalContributions;

    return res.status(200).json({ total, weeks });
  } catch (error) {
    console.error('Error fetching GitHub contributions:', error);
    return res.status(500).json({ error: 'Failed to fetch contributions' });
  }
}
