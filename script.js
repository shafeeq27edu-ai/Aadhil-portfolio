const PINNED_REPOS = ['UrbanSheild-2.0-AI-', 'Trackr', 'agenta'];

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
    async function fetchWithRetryAndCache(url, cacheKey, ttl = 3600000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
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

        try {
            const data = await fetchOnce(8000);
            if (!data.error && !data.fallback && !data.partial) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            return data;
        } catch(err1) {
            console.warn(`Fetch ${url} failed:`, err1);
            if (err1.message !== 'TIMEOUT' && (!err1.message.startsWith('HTTP ') || err1.message.startsWith('HTTP 5'))) {
                console.warn(`Retrying fetch ${url}...`);
                try {
                    const data = await fetchOnce(8000);
                    if (!data.error && !data.fallback && !data.partial) localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
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

    // --- Mouse Spotlight on Cards ---
    document.querySelectorAll('.card, .project-card, .exp-card, .highlight-card').forEach(c => {
        c.onmousemove = e => { 
            const rect = c.getBoundingClientRect(); 
            c.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px'); 
            c.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px'); 
        };
    });

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

    // --- GitHub Heatmap Fetch & Render ---
    const ghHeatmap = document.getElementById('gh-heatmap');
    const ghMonths = document.getElementById('gh-heatmap-months');
    const totalSpan = document.getElementById('gh-total-contribs');
    
    const fallbackHTML = `
        <div style="grid-column: span 52; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; color: #8a8a8a; gap: 12px; grid-row: span 7;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
            <span style="font-size: 14px;">Couldn't load live data. <a href="https://github.com/shafeeq27edu-ai" target="_blank" style="color: #f59e0b; text-decoration: underline;">View on GitHub</a></span>
        </div>
    `;

    if (ghHeatmap && ghMonths) {
        // Create tooltip element — use fixed positioning for correct placement
        const tooltip = document.createElement('div');
        tooltip.className = 'gh-tooltip';
        document.body.appendChild(tooltip);

        // Fetch data
        fetchWithRetryAndCache('/api/github', 'gh_heatmap_cache', 3600000)
            .then(data => {
                if(data.error || data.fallback || !data.weeks || data.weeks.length === 0) {
                    ghHeatmap.innerHTML = fallbackHTML;
                    ghHeatmap.removeAttribute('role');
                    ghHeatmap.removeAttribute('aria-label');
                    return;
                }

                ghHeatmap.setAttribute('role', 'img');
                ghHeatmap.setAttribute('aria-label', `${data.total || 0} GitHub contributions in the last year`);

                if (data._stale && totalSpan) {
                    totalSpan.innerHTML = `${data.total || 0} contributions in the last year <span style="color:#f59e0b; font-size:12px; margin-left:8px;">(last updated ${new Date(data._lastUpdated).toLocaleDateString()})</span>`;
                } else if (totalSpan) {
                    totalSpan.textContent = `${data.total || 0} contributions in the last year`;
                }

                const weeks = data.weeks || [];
                const colors = ['#171717','#3d2a0b','#6b4a16','#b07824','#f59e0b'];
                
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                let currentMonth = -1;

                weeks.forEach((week, weekIndex) => {
                    if (week.contributionDays.length > 0) {
                        const firstDayDate = new Date(week.contributionDays[0].date);
                        const month = firstDayDate.getMonth();
                        if (month !== currentMonth) {
                            const monthSpan = document.createElement('span');
                            monthSpan.textContent = monthNames[month];
                            ghMonths.appendChild(monthSpan);
                            currentMonth = month;
                        } else if (weekIndex % 4 === 0) {
                            // Add empty span to keep grid alignment roughly okay
                            const emptySpan = document.createElement('span');
                            ghMonths.appendChild(emptySpan);
                        }
                    }

                    // For each day in the week
                    week.contributionDays.forEach(day => {
                        const count = day.contributionCount;
                        let colorIdx = 0;
                        if (count > 0 && count <= 3) colorIdx = 1;
                        else if (count > 3 && count <= 6) colorIdx = 2;
                        else if (count > 6 && count <= 9) colorIdx = 3;
                        else if (count > 9) colorIdx = 4;

                        const square = document.createElement('div');
                        square.className = 'day-square';
                        square.style.background = colors[colorIdx];
                        
                        // Tooltip logic — fixed positioning avoids scroll offset bugs
                        square.addEventListener('mouseenter', () => {
                            const rect = square.getBoundingClientRect();
                            const dateStr = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            tooltip.textContent = `${count} contributions on ${dateStr}`;
                            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                            tooltip.style.top = rect.top + 'px';
                            tooltip.classList.add('visible');
                        });
                        square.addEventListener('mouseleave', () => {
                            tooltip.classList.remove('visible');
                        });

                        ghHeatmap.appendChild(square);
                    });
                });
            })
            .catch(err => {
                console.error("Failed to load GitHub heatmap:", err);
                ghHeatmap.innerHTML = fallbackHTML;
                ghHeatmap.removeAttribute('role');
                ghHeatmap.removeAttribute('aria-label');
            });
    }
    
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
                    ${repo.stargazers_count > 0 ? `<span>⭐ ${repo.stargazers_count}</span>` : ''}
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
                    staleHint.style.gridColumn = '1 / -1';
                    staleHint.style.color = '#f59e0b';
                    staleHint.style.fontSize = '12px';
                    staleHint.style.textAlign = 'center';
                    staleHint.textContent = `⚠️ Showing cached repositories (last updated ${new Date(data._lastUpdated).toLocaleString()})`;
                    pinnedGrid.prepend(staleHint);
                }
                
                // Populate Modal initially
                renderModalList(allRepos);
                
                // Add mousemove effect to new cards
                document.querySelectorAll('.pinned-repo-card').forEach(c => {
                    c.onmousemove = e => { 
                        const rect = c.getBoundingClientRect(); 
                        c.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px'); 
                        c.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px'); 
                    };
                });
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
            window.location.href = 'mailto:aadhilxshafeeq@gmail.com?subject=Subscribe%20to%20Blog%20Updates';
        });
    }

    // --- Scroll Reveal Animations ---
    const revealSections = document.querySelectorAll('.section-reveal');
    if (revealSections.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    revealObserver.unobserve(entry.target); // Only animate once
                }
            });
        }, { root: null, rootMargin: '0px 0px -60px 0px', threshold: 0.1 });

        revealSections.forEach(section => revealObserver.observe(section));
    }

    // --- Codolio / LeetCode Stats & Heatmap ---
    (async function loadCodolio() {
        const lcGrid = document.getElementById('lc-heatmap');
        const codolioLoading = document.getElementById('codolio-loading');
        const codolioContent = document.getElementById('codolio-content');
        const statsEl = document.getElementById('codolio-stats');
        
        if (!lcGrid || !codolioLoading || !codolioContent || !statsEl) return;

        const amberColors = ['#171717','#3d2a0b','#6b4a16','#b07824','#f59e0b'];
        
        const codolioFallbackHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; color: #8a8a8a; gap: 12px; width: 100%;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                <span style="font-size: 14px;">Couldn't load live data. <a href="https://codolio.com/profile/shafeeq_27" target="_blank" style="color: #fbbf24; text-decoration: underline;">View Codolio Profile</a></span>
            </div>
        `;

        try {
            const data = await fetchWithRetryAndCache('/api/codolio', 'codolio_stats_cache', 3600000);
            
            if (data.fallback || data.error) {
                codolioLoading.innerHTML = codolioFallbackHTML;
                lcGrid.setAttribute('aria-label', 'LeetCode activity data unavailable.');
                return;
            }
            
            codolioLoading.style.display = 'none';
            codolioContent.style.display = 'block';
            
            // Build stats
            let statsHtml = '';
            if (data.leetcode) {
                statsHtml += `
                    <div class="gh-stat-card card">
                      <div class="gh-stat-header">
                        <span style="font-size:14px;">🚀</span>
                        <span class="gh-stat-title" style="color:#f59e0b;">LeetCode</span>
                      </div>
                      <div class="gh-stat-value">${data.leetcode.totalSolved} <span style="font-size:12px;color:#8a8a8a;font-weight:400;">Solved</span></div>
                    </div>
                `;
            }
            if (data.codeforces) {
                statsHtml += `
                    <div class="gh-stat-card card">
                      <div class="gh-stat-header">
                        <span style="font-size:14px;">📊</span>
                        <span class="gh-stat-title" style="color:#3b82f6;">Codeforces</span>
                      </div>
                      <div class="gh-stat-value">${data.codeforces.rating} <span style="font-size:12px;color:#8a8a8a;font-weight:400;">Rating</span></div>
                    </div>
                `;
            }
            statsEl.innerHTML = statsHtml;
            
            if (data._stale) {
                const staleHint = document.createElement('div');
                staleHint.style.gridColumn = '1 / -1';
                staleHint.style.color = '#f59e0b';
                staleHint.style.fontSize = '12px';
                staleHint.style.textAlign = 'center';
                staleHint.style.marginBottom = '16px';
                staleHint.textContent = `⚠️ Showing cached stats (last updated ${new Date(data._lastUpdated).toLocaleString()})`;
                statsEl.prepend(staleHint);
            }
            
            statsEl.querySelectorAll('.gh-stat-card').forEach(c => {
                c.onmousemove = e => { 
                    const rect = c.getBoundingClientRect(); 
                    c.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px'); 
                    c.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px'); 
                };
            });
            
            // Render LeetCode Heatmap
            const cal = data.leetcode ? data.leetcode.calendar : {};
            const totalSubmissions = Object.values(cal).reduce((sum, count) => sum + count, 0);
            lcGrid.setAttribute('aria-label', `LeetCode activity: ${totalSubmissions} submissions in the last 6 months`);

            const today = new Date();
            today.setHours(0,0,0,0);
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - 181);
            
            let dayIter = new Date(startDate);
            while(dayIter <= today) {
                const d = document.createElement('div');
                const dayStart = dayIter.getTime() / 1000;
                const dayEnd = dayStart + 86400;
                
                let count = 0;
                for (const ts in cal) {
                    if (ts >= dayStart && ts < dayEnd) {
                        count += cal[ts];
                    }
                }
                
                let colorIdx = 0;
                if (count > 0 && count <= 2) colorIdx = 1;
                else if (count > 2 && count <= 4) colorIdx = 2;
                else if (count > 4 && count <= 6) colorIdx = 3;
                else if (count > 6) colorIdx = 4;
                
                d.style.background = amberColors[colorIdx];
                lcGrid.appendChild(d);
                
                dayIter.setDate(dayIter.getDate() + 1);
            }

        } catch(e) {
            console.error('Codolio fetch error:', e);
            codolioLoading.innerHTML = codolioFallbackHTML;
            lcGrid.setAttribute('aria-label', 'LeetCode activity data unavailable.');
        }
    })();

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

        const prs = data && Array.isArray(data.prs) ? data.prs : [];
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
                        <svg style="color:#22c55e" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
                        <span class="gh-stat-title">Open PRs</span>
                      </div>
                      <div class="gh-stat-value">${openCount}</div>
                    </div>
                    
                    <div class="gh-stat-card">
                      <div class="gh-stat-header">
                        <svg style="color:#a855f7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>
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
        
        function render(filter) {
            let filtered = prs;
            if (filter !== 'all') filtered = prs.filter(p => p.category === filter);
            if (filtered.length === 0) { listEl.innerHTML = '<div class="loading-placeholder">No PRs in this category.</div>'; return; }
            
            listEl.innerHTML = filtered.map(pr => {
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
            
            // Add mousemove effect to new PR cards
            listEl.querySelectorAll('.pr-card').forEach(c => {
                c.onmousemove = e => { 
                    const rect = c.getBoundingClientRect(); 
                    c.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px'); 
                    c.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px'); 
                };
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
                render(tab.dataset.filter);
            });
        });
        render('all');
    })();
});
