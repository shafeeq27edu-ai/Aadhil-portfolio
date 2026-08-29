export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const username = 'shafeeq_27';

  try {
    // Fetch LeetCode and Codeforces stats in parallel
    const [lcRes, cfRes] = await Promise.allSettled([
      fetch(`https://leetcode-stats-api.herokuapp.com/${username}`),
      fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    ]);

    let leetcode = null;
    let codeforces = null;

    if (lcRes.status === 'fulfilled' && lcRes.value.ok) {
      const lcData = await lcRes.value.json();
      if (lcData.status === 'success') {
        leetcode = {
          totalSolved: lcData.totalSolved,
          easySolved: lcData.easySolved,
          mediumSolved: lcData.mediumSolved,
          hardSolved: lcData.hardSolved,
          totalQuestions: lcData.totalQuestions,
          easyTotal: lcData.totalEasy,
          mediumTotal: lcData.totalMedium,
          hardTotal: lcData.totalHard,
        };
      }
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
    }

    // Set cache headers: cache on CDN for 1 hour
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    return res.status(200).json({
      leetcode,
      codeforces
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Failed to fetch coding stats' });
  }
}
