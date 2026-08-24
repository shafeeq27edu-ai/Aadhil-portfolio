document.addEventListener("DOMContentLoaded", () => {
    // --- Sidebar Intersection Observer ---
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".index-nav ul li a");

    if (sections.length > 0 && navLinks.length > 0) {
        const observerOptions = {
            root: null,
            rootMargin: "0px",
            threshold: 0.2
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    navLinks.forEach((link) => {
                        link.classList.remove("active");
                    });

                    const activeId = entry.target.getAttribute("id");
                    const activeLink = document.querySelector(`.index-nav ul li a[href="#${activeId}"]`);
                    if (activeLink) {
                        activeLink.classList.add("active");
                    }
                }
            });
        }, observerOptions);

        sections.forEach((section) => {
            observer.observe(section);
        });

        // Specific fix for scrolling back to top (hero section)
        window.addEventListener('scroll', () => {
            if (window.scrollY < 100) {
                navLinks.forEach(link => link.classList.remove("active"));
                const heroLink = document.querySelector('.index-nav ul li a[href="#hero"]');
                if (heroLink) heroLink.classList.add("active");
            }
        });
    }

    // --- GitHub Real Data Fetch: Overall Stats ---
    const ghStatsEl = document.getElementById('gh-stats-total');
    if (ghStatsEl) {
        fetch('https://api.github.com/users/shafeeq27edu-ai')
            .then(res => res.json())
            .then(data => {
                ghStatsEl.textContent = `${data.public_repos} Public Repos | ${data.followers} Followers`;
            })
            .catch(() => {
                ghStatsEl.textContent = 'Active on GitHub';
            });
    }

    // --- GitHub Real Data Fetch: Open Source PRs ---
    fetch('https://api.github.com/users/shafeeq27edu-ai/events/public?per_page=20')
        .then(r => r.json())
        .then(events => {
            const list = document.getElementById('os-list');
            const prs = [];
            
            if (!list) return;

            events.forEach(e => {
                if (e.type === 'PullRequestEvent' && e.payload && e.payload.pull_request) {
                    const pr = e.payload.pull_request;
                    const repo = e.repo.name; // e.g. Agenta-AI/agenta
                    const action = e.payload.action; // opened, closed
                    let status = 'Open';
                    let statusColor = '#22c55e'; // default green
                    
                    if (pr.merged_at) { status = 'Merged'; statusColor = '#a855f7'; } // purple
                    else if (pr.state === 'closed') { status = 'Closed'; statusColor = '#ef4444'; } // red
                    else if (action === 'opened') { status = 'Open'; statusColor = '#22c55e'; } // green
                    
                    // Avoid duplicates
                    if (!prs.find(p => p.number === pr.number && p.repo === repo)) {
                        prs.push({
                            title: pr.title || 'Untitled PR',
                            repo: repo,
                            number: pr.number,
                            status: status,
                            statusColor: statusColor,
                            url: pr.html_url
                        });
                    }
                }
            });
            
            // Render
            if (prs.length === 0) {
                list.innerHTML = '<div class="text-xs text-muted py-4 text-center">No public PRs found.</div>';
                return;
            }
            
            window.allPRs = prs; // Store for filtering
            renderPRs(prs);
            
            const osCountEl = document.getElementById('os-count');
            if (osCountEl) osCountEl.textContent = prs.length + ' public PRs';
        })
        .catch(() => {
            const list = document.getElementById('os-list');
            if (list) list.innerHTML = '<div class="text-xs text-muted py-4 text-center">Unable to load contributions.</div>';
        });

    function renderPRs(prs) {
        const list = document.getElementById('os-list');
        if (!list) return;

        list.innerHTML = prs.map(pr => `
            <div class="os-item">
                <div style="width:8px; height:8px; border-radius:50%; margin-top:6px; background-color:${pr.statusColor}"></div>
                <div class="flex-1 min-w-0" style="display:flex; flex-direction:column;">
                    <a href="${pr.url}" target="_blank" class="pr-title block truncate hover:underline" style="color:#fff; font-size:0.875rem;">${pr.title}</a>
                    <span class="pr-repo" style="color:#52525b; font-size:0.75rem;">${pr.repo} #${pr.number}</span>
                </div>
                <span style="font-size:10px; padding:2px 8px; border-radius:9999px; border:1px solid ${pr.statusColor}33; color:${pr.statusColor}; background:${pr.statusColor}11;">
                    ${pr.status}
                </span>
            </div>
        `).join('');
    }

    // OS Filter Tabs
    const filterTabs = document.querySelectorAll('.os-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const filter = e.target.getAttribute('data-filter');
            if (!window.allPRs) return;
            
            if (filter === 'All') {
                renderPRs(window.allPRs);
            } else {
                const filtered = window.allPRs.filter(pr => pr.status === filter);
                if (filtered.length > 0) {
                    renderPRs(filtered);
                } else {
                    const list = document.getElementById('os-list');
                    if (list) list.innerHTML = `<div class="text-xs text-muted py-4 text-center">No ${filter.toLowerCase()} PRs found.</div>`;
                }
            }
        });
    });
});
