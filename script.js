const PINNED_REPOS = ['UrbanSheild-2.0-AI-', 'Trackr', 'Mozhi'];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeUrl(value) {
    if (!value) return '#';
    try {
        const url = new URL(String(value), window.location.origin);
        if (url.protocol === 'https:' || url.protocol === 'http:') return escapeHtml(url.href);
    } catch (e) {}
    return '#';
}

document.addEventListener("DOMContentLoaded", () => {
    // --- Resilient Fetch Helper ---
    async function fetchWithRetryAndCache(url, cacheKey, ttl = 3600000, options = {}) {
        const { force = false } = options;
        const cached = localStorage.getItem(cacheKey);
        if (cached && !force) {
            try {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < ttl) return parsed.data;
            } catch(e) {}
        }
        
        const fetchOnce = async (timeoutMs) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (e) {
                clearTimeout(id);
                if (e.name === 'AbortError') throw new Error('TIMEOUT');
                throw e;
            }
        };

        const isComplete = (data) => data && !data.error && !data.fallback && !data.partial && !data.degraded && !data.stale;

        try {
            const data = await fetchOnce(8000);
            if (isComplete(data)) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            return data;
        } catch(err1) {
            console.warn(`Fetch ${url} failed:`, err1);
            if (err1.message !== 'TIMEOUT' && (!err1.message.startsWith('HTTP ') || err1.message.startsWith('HTTP 5'))) {
                console.warn(`Retrying fetch ${url}...`);
                try {
                    const data = await fetchOnce(8000);
                    if (isComplete(data)) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
                    return data;
                } catch(err2) {
                    console.error(`Fetch ${url} failed after retry.`, err2);
                }
            }
            if (cached) {
                try { 
                    const parsed = JSON.parse(cached);
                    if (parsed.data && typeof parsed.data === 'object') {
                        parsed.data._stale = true;
                        parsed.data._lastUpdated = parsed.timestamp;
                    }
                    return parsed.data; 
                } catch(e) {}
            }
            throw err1;
        }
    }

    // --- Build log masthead date ---
    const buildlogDate = document.getElementById('buildlog-date');
    if (buildlogDate) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        buildlogDate.textContent = `${now.getUTCFullYear()}.${pad(now.getUTCMonth() + 1)}.${pad(now.getUTCDate())}`;
        buildlogDate.dateTime = now.toISOString().slice(0, 10);
    }

    // --- Sidebar Intersection Observer ---
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".index-nav ul li a");

    function setActiveNav(link) {
        navLinks.forEach((item) => {
            item.classList.remove("active");
            item.removeAttribute("aria-current");
        });
        if (link) {
            link.classList.add("active");
            link.setAttribute("aria-current", "location");
        }
    }

    if (sections.length > 0 && navLinks.length > 0) {
        const observerOptions = { root: null, rootMargin: "-20% 0px -60% 0px", threshold: 0 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const activeId = entry.target.getAttribute("id");
                    setActiveNav(document.querySelector(`.index-nav ul li a[href="#${activeId}"]`));
                }
            });
        }, observerOptions);

        sections.forEach((section) => observer.observe(section));

        // Bottom-of-page fallback: activate the last section
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 50)) {
                setActiveNav(navLinks[navLinks.length - 1]);
            }
        }, { passive: true });
    }

    // --- Heatmap Helpers (shared by GitHub and LeetCode) ---
    const HEATMAP_COLORS = ['#171717', '#3d2a0b', '#6b4a16', '#b07824', '#f59e0b'];
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAY_MS = 86400000;
    const WEEK_MS = 7 * DAY_MS;

    function dateKeyToUTC(key) {
        const [year, month, day] = key.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    }

    function formatDayLabel(key) {
        return new Date(dateKeyToUTC(key)).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
        });
    }

    function relativeTime(iso) {
        const then = Date.parse(iso);
        if (!Number.isFinite(then)) return '';
        const minutes = Math.floor((Date.now() - then) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    function setUpdatedLabel(element, fetchedAt, stale = false) {
        if (!element) return;
        if (!fetchedAt) {
            element.textContent = '';
            delete element.dataset.fetchedAt;
            return;
        }
        element.dataset.fetchedAt = fetchedAt;
        element.dataset.stale = stale ? 'true' : 'false';
        element.textContent = `${stale ? 'Cached' : 'Updated'} ${relativeTime(fetchedAt)}`;
    }

    function heatmapTooltip() {
        let tooltip = document.querySelector('.heatmap-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'heatmap-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    function levelFromCount(count, thresholds) {
        if (count <= 0) return 0;
        if (count <= thresholds[0]) return 1;
        if (count <= thresholds[1]) return 2;
        if (count <= thresholds[2]) return 3;
        return 4;
    }

    function renderHeatmap({ grid, months, days, tooltip, noun, maxWeeks = 53 }) {
        if (!grid) return null;

        const clean = (Array.isArray(days) ? days : [])
            .filter(day => day && /^\d{4}-\d{2}-\d{2}$/.test(day.date || ''))
            .map(day => ({
                date: day.date,
                count: Math.max(0, Number(day.count) || 0),
                level: Number.isInteger(day.level) ? Math.max(0, Math.min(4, day.level)) : null,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (!clean.length) return null;

        const firstMs = dateKeyToUTC(clean[0].date);
        const lastMs = dateKeyToUTC(clean[clean.length - 1].date);
        const alignedStart = firstMs - new Date(firstMs).getUTCDay() * DAY_MS;
        const weeks = Math.min(maxWeeks, Math.floor((lastMs - alignedStart) / WEEK_MS) + 1);

        const maxCount = clean.reduce((max, day) => Math.max(max, day.count), 0);
        const thresholds = maxCount <= 4
            ? [1, 2, 3, 4]
            : [1, Math.ceil(maxCount * 0.25), Math.ceil(maxCount * 0.5), Math.ceil(maxCount * 0.75)];

        const root = grid.closest('.heatmap');
        if (root) root.style.setProperty('--weeks', String(weeks));
        if (months) months.style.setProperty('--weeks', String(weeks));

        const fragment = document.createDocumentFragment();
        let total = 0;
        let activeDays = 0;

        for (const day of clean) {
            const time = dateKeyToUTC(day.date);
            const column = Math.floor((time - alignedStart) / WEEK_MS) + 1;
            const row = new Date(time).getUTCDay() + 1;
            if (column < 1 || column > weeks) continue;

            const level = day.level === null ? levelFromCount(day.count, thresholds) : day.level;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.style.gridColumn = String(column);
            cell.style.gridRow = String(row);
            cell.style.background = HEATMAP_COLORS[level];
            cell.setAttribute('aria-hidden', 'true');
            cell.dataset.tip = `${day.count} ${noun}${day.count === 1 ? '' : 's'} on ${formatDayLabel(day.date)}`;

            cell.addEventListener('mouseenter', () => {
                const rect = cell.getBoundingClientRect();
                tooltip.textContent = cell.dataset.tip;
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top}px`;
                tooltip.classList.add('visible');
            });
            cell.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

            fragment.appendChild(cell);
            total += day.count;
            if (day.count > 0) activeDays += 1;
        }

        grid.replaceChildren(fragment);

        // On narrow screens the grid scrolls horizontally; open on the most recent weeks.
        const scroller = grid.closest('.heatmap-scroll');
        if (scroller && scroller.scrollWidth > scroller.clientWidth && scroller.scrollLeft === 0) {
            scroller.scrollLeft = scroller.scrollWidth;
        }

        if (months) {
            const monthFragment = document.createDocumentFragment();
            let lastMonth = -1;
            let lastLabelColumn = -4;

            for (let column = 1; column <= weeks; column += 1) {
                const columnStart = alignedStart + (column - 1) * WEEK_MS;
                const month = new Date(columnStart).getUTCMonth();
                if (month === lastMonth) continue;
                lastMonth = month;
                if (column - lastLabelColumn < 4) continue;

                const label = document.createElement('span');
                label.textContent = MONTH_NAMES[month];
                label.style.gridColumn = String(column);
                monthFragment.appendChild(label);
                lastLabelColumn = column;
            }

            months.replaceChildren(monthFragment);
        }

        return {
            weeks,
            total,
            activeDays,
            startDate: clean[0].date,
            endDate: clean[clean.length - 1].date,
            summary: `${total} ${noun}s across ${activeDays} active days, ${formatDayLabel(clean[0].date)} to ${formatDayLabel(clean[clean.length - 1].date)}`,
        };
    }

    // --- GitHub Heatmap Fetch & Render ---
    const GH_FALLBACK = `
        <div class="heatmap-fallback">
            <span>Live GitHub activity is unavailable right now.</span>
            <a href="https://github.com/shafeeq27edu-ai" target="_blank" rel="noopener noreferrer">View on GitHub &nearr;</a>
        </div>
    `;

    async function loadGitHubHeatmap(force = false, bustCache = false) {
        const grid = document.getElementById('gh-heatmap');
        const months = document.getElementById('gh-heatmap-months');
        const totalEl = document.getElementById('gh-total-contribs');
        const updatedEl = document.getElementById('gh-updated');
        if (!grid) return;

        try {
            const url = bustCache ? `/api/github?refresh=${Date.now()}` : '/api/github';
            const data = await fetchWithRetryAndCache(url, 'gh_heatmap_v2', 120000, { force });

            if (!data || data.fallback || !Array.isArray(data.days) || !data.days.length) {
                throw new Error('No contribution data returned');
            }

            const rendered = renderHeatmap({
                grid,
                months,
                days: data.days,
                tooltip: heatmapTooltip(),
                noun: 'contribution',
            });
            if (!rendered) throw new Error('Contribution data could not be rendered');

            grid.setAttribute('role', 'img');
            grid.setAttribute('aria-label', `GitHub contributions: ${rendered.summary}`);
            grid.removeAttribute('aria-busy');

            if (totalEl) totalEl.textContent = `${rendered.total} contributions · last year`;
            setUpdatedLabel(updatedEl, data.fetchedAt, data.stale);
        } catch (error) {
            console.error('Failed to load GitHub heatmap:', error);
            grid.style.setProperty('--weeks', '53');
            grid.removeAttribute('role');
            grid.removeAttribute('aria-label');
            grid.removeAttribute('aria-busy');
            if (months) months.replaceChildren();
            grid.innerHTML = GH_FALLBACK;
            if (totalEl) totalEl.textContent = 'Unavailable';
            if (updatedEl) updatedEl.textContent = '';
        }
    }

    loadGitHubHeatmap();
    
    // --- Pinned Repositories Fetch & Modal ---
    const pinnedGrid = document.getElementById('pinned-repos-grid');
    const modalOverlay = document.getElementById('repo-modal-overlay');
    const modalClose = document.getElementById('repo-modal-close');
    const modalList = document.getElementById('repo-modal-list');
    const searchInput = document.getElementById('repo-search-input');
    const viewAllBtn = document.getElementById('view-all-repos-btn');
    
    let allRepos = [];
    
    // Format date string (e.g. "Updated Aug 14")
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    // Get language color dot mapping
    function getLangColor(lang) {
        const colors = {
            'TypeScript': '#3b82f6',
            'JavaScript': '#f1e05a',
            'Python': '#f59e0b',
            'HTML': '#e34c26',
            'CSS': '#563d7c',
            'Jupyter Notebook': '#DA5B0B'
        };
        return colors[lang] || '#a3a3a3';
    }

    // Generate Repo Card HTML
    function getRepoCardHTML(repo) {
        return `
            <a href="${safeUrl(repo.html_url)}" class="pinned-repo-card card" target="_blank" rel="noopener noreferrer">
                <div class="pinned-repo-title">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
                    ${escapeHtml(repo.name)}
                </div>
                <div class="pinned-repo-desc">${escapeHtml(repo.description || 'No description provided.')}</div>
                <div class="pinned-repo-meta">
                    ${repo.language ? `<span><span class="gh-dot" style="background:${getLangColor(repo.language)}"></span>${escapeHtml(repo.language)}</span>` : ''}
                    ${repo.stargazers_count > 0 ? `<span><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.819 6.372a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path></svg> ${repo.stargazers_count}</span>` : ''}
                    ${repo.forks_count > 0 ? `<span><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path></svg> ${repo.forks_count}</span>` : ''}
                    <span>${formatDate(repo.updated_at)}</span>
                </div>
            </a>
        `;
    }

    if (pinnedGrid) {
        fetchWithRetryAndCache('/api/repos', 'gh_repos_cache', 3600000)
            .then(data => {
                if (data.error) throw new Error(data.error);
                if (!Array.isArray(data.all)) {
                    localStorage.removeItem('gh_repos_cache');
                    throw new Error('Unexpected repositories response');
                }

                allRepos = data.all;

                // Prefer repos pinned on GitHub, then the local fallback list, then recent repos.
                let pinned = Array.isArray(data.pinned) ? data.pinned.slice(0, 3) : [];
                if (pinned.length < 3 && PINNED_REPOS.length > 0) {
                    const localPinned = PINNED_REPOS
                        .map(name => allRepos.find(r => r.name === name))
                        .filter(r => r && !pinned.some(p => p.name === r.name));
                    pinned = pinned.concat(localPinned);
                }
                if (pinned.length < 3) {
                    const remaining = allRepos.filter(r => !pinned.some(p => p.name === r.name));
                    pinned = pinned.concat(remaining.slice(0, 3 - pinned.length));
                }
                
                pinnedGrid.innerHTML = pinned.map(r => getRepoCardHTML(r)).join('');
                
                if (data._stale) {
                    const staleHint = document.createElement('div');
                    staleHint.className = 'stale-hint';
                    staleHint.textContent = `Showing cached repositories · last synced ${new Date(data._lastUpdated).toLocaleString()}`;
                    pinnedGrid.prepend(staleHint);
                }
                
                // Populate Modal initially
                renderModalList(allRepos);
            })
            .catch(err => {
                console.error("Failed to load repos:", err);
                pinnedGrid.innerHTML = '<div class="loading-placeholder">Couldn\'t load live data. <a href="https://github.com/shafeeq27edu-ai" target="_blank" style="color: #f59e0b; text-decoration: underline;">View on GitHub</a></div>';
            });
    }

    // Modal Interaction Logic
    function renderModalList(reposToRender) {
        if (!modalList) return;
        if (reposToRender.length === 0) {
            modalList.innerHTML = '<div class="loading-placeholder">No repositories found.</div>';
            return;
        }
        modalList.innerHTML = reposToRender.map(r => getRepoCardHTML(r)).join('');
    }

    let lastFocusedElement = null;

    function getFocusableElements(container) {
        return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter((el) => !el.disabled && el.offsetParent !== null);
    }

    function openModal() {
        lastFocusedElement = document.activeElement;
        modalOverlay.inert = false;
        modalOverlay.setAttribute('aria-hidden', 'false');
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        if (searchInput) searchInput.focus();
        else modalClose.focus();
    }

    function closeModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        modalOverlay.setAttribute('aria-hidden', 'true');
        modalOverlay.inert = true;
    }

    if (viewAllBtn && modalOverlay && modalClose) {
        viewAllBtn.addEventListener('click', openModal);

        modalClose.addEventListener('click', closeModal);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Keep keyboard focus inside the open dialog
        modalOverlay.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || !modalOverlay.classList.contains('active')) return;
            const focusable = getFocusableElements(modalOverlay);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (!modalOverlay.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                closeModal();
            }
        });
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = allRepos.filter(r => 
                    r.name.toLowerCase().includes(term) || 
                    (r.description && r.description.toLowerCase().includes(term)) ||
                    (r.language && r.language.toLowerCase().includes(term))
                );
                renderModalList(filtered);
            });
        }
    }

    // --- Subscribe Button Handler ---
    const subscribeBtn = document.querySelector('.btn-subscribe');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            window.location.href = 'mailto:shafeeq27.edu@gmail.com?subject=Subscribe%20to%20Blog%20Updates';
        });
    }

    // --- LeetCode Stats & Heatmap ---
    const LC_FALLBACK = `
        <div class="heatmap-fallback">
            <span>Live LeetCode activity is unavailable right now.</span>
            <a href="https://codolio.com/profile/shafeeq_27" target="_blank" rel="noopener noreferrer">View Codolio profile &nearr;</a>
        </div>
    `;

    async function loadLeetCode(force = false, bustCache = false) {
        const grid = document.getElementById('lc-heatmap');
        const months = document.getElementById('lc-heatmap-months');
        const loading = document.getElementById('codolio-loading');
        const content = document.getElementById('codolio-content');
        const statsEl = document.getElementById('codolio-stats');
        const totalEl = document.getElementById('lc-total-submissions');
        const updatedEl = document.getElementById('lc-updated');

        if (!grid || !loading || !content || !statsEl) return;

        try {
            const url = bustCache ? `/api/codolio?refresh=${Date.now()}` : '/api/codolio';
            const data = await fetchWithRetryAndCache(url, 'codolio_stats_v2', 120000, { force });
            const leetcode = data && data.leetcode;

            if (!leetcode || !leetcode.window || !Array.isArray(leetcode.window.days)) {
                throw new Error('No LeetCode data returned');
            }

            const rendered = renderHeatmap({
                grid,
                months,
                days: leetcode.window.days,
                tooltip: heatmapTooltip(),
                noun: 'submission',
                maxWeeks: leetcode.window.weeks,
            });
            if (!rendered) throw new Error('LeetCode data could not be rendered');

            loading.style.display = 'none';
            content.style.display = 'block';

            statsEl.replaceChildren();
            const cards = [
                {
                    label: 'Problems solved',
                    value: String(leetcode.totalSolved),
                    meta: `Easy ${leetcode.easySolved} · Medium ${leetcode.mediumSolved} · Hard ${leetcode.hardSolved}`,
                },
                {
                    label: `Submissions · ${leetcode.year}`,
                    value: String(leetcode.yearTotal),
                    meta: `${leetcode.yearActiveDays} active days`,
                },
                {
                    label: 'Last submission',
                    value: leetcode.lastActive ? formatDayLabel(leetcode.lastActive) : '—',
                    meta: 'Synced from LeetCode',
                },
            ];

            for (const card of cards) {
                const box = document.createElement('div');
                box.className = 'gh-stat-card card';

                const header = document.createElement('div');
                header.className = 'gh-stat-header';
                const title = document.createElement('span');
                title.className = 'gh-stat-title';
                title.textContent = card.label;
                header.appendChild(title);

                const value = document.createElement('div');
                value.className = 'gh-stat-value';
                value.textContent = card.value;

                const meta = document.createElement('div');
                meta.className = 'gh-stat-meta';
                meta.textContent = card.meta;

                box.append(header, value, meta);
                statsEl.appendChild(box);
            }

            grid.setAttribute('role', 'img');
            grid.setAttribute('aria-label', `LeetCode submissions: ${rendered.summary}`);
            grid.removeAttribute('aria-busy');

            if (totalEl) totalEl.textContent = `${rendered.total} submissions`;
            setUpdatedLabel(updatedEl, leetcode.fetchedAt, data.stale);
        } catch (error) {
            console.error('Failed to load LeetCode activity:', error);
            loading.style.display = 'block';
            loading.style.height = 'auto';
            loading.classList.remove('skeleton-box');
            loading.innerHTML = LC_FALLBACK;
            content.style.display = 'none';

            grid.removeAttribute('role');
            grid.removeAttribute('aria-label');
            grid.removeAttribute('aria-busy');
            if (months) months.replaceChildren();
            if (totalEl) totalEl.textContent = 'Unavailable';
            if (updatedEl) updatedEl.textContent = '';
        }
    }

    loadLeetCode();

    // --- Heatmap refresh + revalidation ---
    document.querySelectorAll('[data-heatmap-refresh]').forEach(button => {
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            button.disabled = true;
            button.classList.add('is-busy');
            try {
                if (button.dataset.heatmapRefresh === 'github') {
                    await loadGitHubHeatmap(true, true);
                } else {
                    await loadLeetCode(true, true);
                }
            } finally {
                button.disabled = false;
                button.classList.remove('is-busy');
            }
        });
    });

    let lastRevalidation = Date.now();
    const revalidateActivity = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - lastRevalidation < 120000) return;
        lastRevalidation = Date.now();
        loadGitHubHeatmap(true);
        loadLeetCode(true);
    };
    document.addEventListener('visibilitychange', revalidateActivity);
    window.addEventListener('online', revalidateActivity);
    setInterval(revalidateActivity, 300000);

    setInterval(() => {
        document.querySelectorAll('.heatmap-updated[data-fetched-at]').forEach((element) => {
            setUpdatedLabel(element, element.dataset.fetchedAt, element.dataset.stale === 'true');
        });
    }, 60000);

    // --- GitHub Open Source PRs & Stats ---
    (async function loadGitHubPRs() {
        const listEl = document.getElementById('os-list');
        const countEl = document.getElementById('os-count');
        const ghStatsEl = document.getElementById('gh-stats');
        const tabs = document.querySelectorAll('.os-tab');

        if (!listEl) return;

        let data = null;
        try {
            data = await fetchWithRetryAndCache('/api/prs', 'gh_prs_cache_v4', 3600000);
        } catch (err) {
            console.error('GitHub PRs fetch error:', err);
        }

        const prs = (data && Array.isArray(data.prs) ? data.prs : []).slice().sort((a, b) => {
            const priority = { merged: 0, open: 1, closed: 2 };
            return (priority[a.category] ?? 3) - (priority[b.category] ?? 3);
        });
        const user = data && data.user ? data.user : null;
        const totalCount = data && Number.isFinite(data.totalCount) ? data.totalCount : prs.length;

        if (user) {
            const openCount = prs.filter(p => p.category === 'open').length;
            const mergedCount = prs.filter(p => p.category === 'merged').length;
            if (ghStatsEl) {
                ghStatsEl.innerHTML = `
                    <div class="gh-stat-card">
                      <div class="gh-stat-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <span class="gh-stat-title">Public Repos</span>
                      </div>
                      <div class="gh-stat-value">${escapeHtml(user.public_repos)}</div>
                    </div>
                    
                    <div class="gh-stat-card">
                      <div class="gh-stat-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <span class="gh-stat-title">Followers</span>
                      </div>
                      <div class="gh-stat-value">${escapeHtml(user.followers)}</div>
                    </div>
                    
                    <div class="gh-stat-card">
                      <div class="gh-stat-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
                        <span class="gh-stat-title">Open PRs</span>
                      </div>
                      <div class="gh-stat-value">${openCount}</div>
                    </div>
                    
                    <div class="gh-stat-card">
                      <div class="gh-stat-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>
                        <span class="gh-stat-title">Merged PRs</span>
                      </div>
                      <div class="gh-stat-value">${mergedCount}</div>
                    </div>
                `;
            }
        } else if (ghStatsEl) {
            ghStatsEl.innerHTML = '<span class="loading-placeholder">Stats unavailable</span>';
        }

        if (countEl) countEl.textContent = data ? `${totalCount} public PRs` : 'PRs unavailable';
        
        const expandBtn = document.getElementById('os-expand');
        const INITIAL_COUNT = 3;
        let activeFilter = 'all';
        let showAll = false;

        function render(filter) {
            let filtered = prs;
            if (filter !== 'all') filtered = prs.filter(p => p.category === filter);
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="loading-placeholder">No PRs in this category.</div>';
                if (expandBtn) expandBtn.hidden = true;
                return;
            }

            const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);
            listEl.innerHTML = visible.map(pr => {
                let icon = '';
                let badgeClass = '';
                if (pr.category === 'open') {
                    badgeClass = 'open';
                    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>';
                } else if (pr.category === 'merged') {
                    badgeClass = 'merged';
                    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>';
                } else {
                    badgeClass = 'closed';
                    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                }
                
                return `
                <a href="${safeUrl(pr.url)}" class="pr-card card" target="_blank" rel="noopener noreferrer">
                    <div class="pr-header">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
                      <span class="pr-repo">${escapeHtml(pr.repo)}</span>
                      <span>#${escapeHtml(pr.number)}</span>
                    </div>
                    <div class="pr-title">${escapeHtml(pr.title)}</div>
                    <div class="pr-badge ${badgeClass}">
                      ${icon} ${escapeHtml(pr.status)}
                    </div>
                </a>
                `;
            }).join('');
            
            if (expandBtn) {
                if (filtered.length > INITIAL_COUNT) {
                    expandBtn.hidden = false;
                    expandBtn.textContent = showAll
                        ? 'Show latest 3'
                        : `View all ${filtered.length} pull requests`;
                    expandBtn.setAttribute('aria-expanded', String(showAll));
                } else {
                    expandBtn.hidden = true;
                }
            }
        }

        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                showAll = !showAll;
                render(activeFilter);
            });
        }
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-pressed', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-pressed', 'true');
                activeFilter = tab.dataset.filter;
                showAll = false;
                render(activeFilter);
            });
        });
        render('all');
    })();
});
