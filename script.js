const PINNED_REPOS = ['UrbanSheild-2.0-AI-', 'Trackr', 'agenta'];

document.addEventListener("DOMContentLoaded", () => {
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

    if (sections.length > 0 && navLinks.length > 0) {
        const observerOptions = { root: null, rootMargin: "0px", threshold: 0.2 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    navLinks.forEach((link) => link.classList.remove("active"));
                    const activeId = entry.target.getAttribute("id");
                    const activeLink = document.querySelector(`.index-nav ul li a[href="#${activeId}"]`);
                    if (activeLink) activeLink.classList.add("active");
                }
            });
        }, observerOptions);

        sections.forEach((section) => observer.observe(section));
        window.addEventListener('scroll', () => {
            if (window.scrollY < 100) {
                navLinks.forEach(link => link.classList.remove("active"));
                const heroLink = document.querySelector('.index-nav ul li a[href="#hero"]');
                if (heroLink) heroLink.classList.add("active");
            }
        });
    }

    // --- GitHub Heatmap Fetch & Render ---
    const ghHeatmap = document.getElementById('gh-heatmap');
    const ghMonths = document.getElementById('gh-heatmap-months');
    const totalSpan = document.getElementById('gh-total-contribs');
    
    if (ghHeatmap && ghMonths) {
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'gh-tooltip';
        document.body.appendChild(tooltip);

        // Fetch data
        fetch('/api/github')
            .then(res => res.json())
            .then(data => {
                if(data.error) throw new Error(data.error);
                
                if (totalSpan) totalSpan.textContent = `${data.total || 0} contributions in the last year`;

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
                        
                        // Tooltip logic
                        square.addEventListener('mouseenter', (e) => {
                            const rect = square.getBoundingClientRect();
                            const dateStr = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            tooltip.textContent = `${count} contributions on ${dateStr}`;
                            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                            tooltip.style.top = rect.top + window.scrollY + 'px';
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
                ghHeatmap.innerHTML = '<div style="grid-column: span 52; color: #737373; font-size: 12px;">Failed to load data. Check /api/github endpoint.</div>';
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
            <a href="${repo.html_url}" class="pinned-repo-card card" target="_blank" rel="noopener noreferrer">
                <div class="pinned-repo-title">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path></svg>
                    ${repo.name}
                </div>
                <div class="pinned-repo-desc">${repo.description || 'No description provided.'}</div>
                <div class="pinned-repo-meta">
                    ${repo.language ? `<span><span class="gh-dot" style="background:${getLangColor(repo.language)}"></span>${repo.language}</span>` : ''}
                    ${repo.stargazers_count > 0 ? `<span>⭐ ${repo.stargazers_count}</span>` : ''}
                    ${repo.forks_count > 0 ? `<span><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path></svg> ${repo.forks_count}</span>` : ''}
                    <span>${formatDate(repo.updated_at)}</span>
                </div>
            </a>
        `;
    }

    if (pinnedGrid) {
        fetch('/api/repos')
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                allRepos = data;
                
                // Determine which 3 to show
                let pinned = [];
                if (PINNED_REPOS && PINNED_REPOS.length > 0) {
                    pinned = PINNED_REPOS.map(name => allRepos.find(r => r.name === name)).filter(Boolean);
                }
                
                // Fallback to top 3 recently updated if config is missing/invalid
                if (pinned.length < 3) {
                    const remaining = allRepos.filter(r => !pinned.includes(r)).slice(0, 3 - pinned.length);
                    pinned = pinned.concat(remaining);
                }
                
                pinnedGrid.innerHTML = pinned.map(r => getRepoCardHTML(r)).join('');
                
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
                pinnedGrid.innerHTML = '<div class="text-xs text-[#52525b] py-8 text-center" style="grid-column: 1 / -1;">Failed to load repositories.</div>';
            });
    }

    // Modal Interaction Logic
    function renderModalList(reposToRender) {
        if (!modalList) return;
        if (reposToRender.length === 0) {
            modalList.innerHTML = '<div class="text-xs text-[#52525b] py-8 text-center">No repositories found.</div>';
            return;
        }
        modalList.innerHTML = reposToRender.map(r => getRepoCardHTML(r)).join('');
    }

    if (viewAllBtn && modalOverlay && modalClose) {
        viewAllBtn.addEventListener('click', () => {
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            searchInput.focus();
        });

        modalClose.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
        
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
});
