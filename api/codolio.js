let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq_27';

  try {
    const now = Date.now();
    if (cache && (now - lastFetchTime < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json(cache);
    }

    // LeetCode GraphQL request for user stats
    const lcQuery = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

    const [lcRes, cfRes] = await Promise.allSettled([
      fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
        },
        body: JSON.stringify({ query: lcQuery, variables: { username } }),
      }),
      fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    ]);

    let leetcode = null;
    let codeforces = null;

    if (lcRes.status === 'fulfilled' && lcRes.value.ok) {
      const lcData = await lcRes.value.json();
      if (lcData.data && lcData.data.matchedUser) {
        const stats = lcData.data.matchedUser.submitStats.acSubmissionNum;
        const getCount = (diff) => {
          const item = stats.find(s => s.difficulty === diff);
          return item ? item.count : 0;
        };
        leetcode = {
          totalSolved: getCount('All'),
          easySolved: getCount('Easy'),
          mediumSolved: getCount('Medium'),
          hardSolved: getCount('Hard'),
        };
      }
    } else if (lcRes.status === 'fulfilled' && !lcRes.value.ok) {
      console.error('LeetCode API failed:', await lcRes.value.text());
    }

    if (cfRes.status === 'fulfilled' && cfRes.value.ok) {
      const cfData = await cfRes.value.json();
      if (cfData.status === 'OK' && cfData.result && cfData.result.length > 0) {
        const user = cfData.result[0];
        codeforces = {
          rating: user.rating || 0,
          maxRating: user.maxRating || 0,
          rank: user.rank || 'Unrated',
          maxRank: user.maxRank || 'Unrated',
        };
      }
    } else if (cfRes.status === 'fulfilled' && !cfRes.value.ok) {
      console.error('Codeforces API failed:', await cfRes.value.text());
    }

    const result = {
      leetcode,
      codeforces,
      fallback: false
    };

    cache = result;
    lastFetchTime = Date.now();

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching stats:', error.message || error);
    if (cache) {
      return res.status(200).json(cache);
    }
    return res.status(200).json({ 
      leetcode: null, 
      codeforces: null,
      fallback: true
    });
  }
}
