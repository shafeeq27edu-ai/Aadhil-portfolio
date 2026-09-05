# ⚡ Shafeeq Aadhil — Developer Portfolio

> "not just another dev portfolio—this is peak lore. step inside and witness the sauce 🔥"

A dark, tactical portfolio site featuring live GitHub activity, open source contributions, competitive programming stats, and project showcases — all wired to real APIs.

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | HTML, CSS (vanilla), JavaScript (vanilla) |
| **APIs** | Vercel Serverless Functions (Node.js) |
| **Data Sources** | GitHub GraphQL API, GitHub REST API, LeetCode GraphQL, Codeforces API |
| **Hosting** | Vercel |
| **Font** | Inter (Google Fonts) |

## 📂 Project Structure

```
├── index.html          # Single-page portfolio
├── style.css           # All styles (dark tactical theme)
├── script.js           # Client-side logic (heatmaps, modals, PR tabs)
├── api/
│   ├── github.js       # GitHub contribution heatmap (GraphQL)
│   ├── repos.js        # Public repos list (REST)
│   └── codolio.js      # LeetCode + Codeforces stats
├── Pictures/
│   └── banner.png      # Hero banner image
└── .env.local          # GitHub PAT (not committed)
```

## 🚀 Local Development

1. Clone the repo:
   ```bash
   git clone https://github.com/shafeeq27edu-ai/Aadhil-portfolio.git
   cd Aadhil-portfolio
   ```

2. Create `.env.local` with your GitHub token:
   ```
   GITHUB_TOKEN=your_github_pat_here
   ```

3. Install Vercel CLI & run:
   ```bash
   npm i -g vercel
   vercel dev
   ```

4. Open `http://localhost:3000`

## ✨ Features

- 🟢 **Live GitHub Heatmap** — real contribution graph via GraphQL
- 📌 **Pinned Repositories** — configurable top repos with modal to browse all
- 🔓 **Open Source PRs** — filterable tabs (All / Open / Merged / Closed)
- ⚔️ **Competitive Programming** — LeetCode & Codeforces stats via Codolio
- 🎯 **Scroll Reveal Animations** — sections animate in on scroll
- 🌑 **Dark Tactical Theme** — film grain overlay, amber accents, spotlight hover

## 📄 License

MIT — built by [Shafeeq Aadhil](https://github.com/shafeeq27edu-ai)
