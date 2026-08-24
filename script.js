document.addEventListener("DOMContentLoaded", () => {
    // --- Mouse Spotlight on Cards ---
    document.querySelectorAll('.card').forEach(c => {
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

    // --- GitHub White-Grey Graph & Stats ---
    (async function() {
        const statsEl = document.getElementById('gh-stats');
        if (!statsEl) return;
        try {
            const [user, prs] = await Promise.all([
                fetch('https://api.github.com/users/shafeeq27edu-ai').then(r => r.json()),
                fetch('https://api.github.com/search/issues?q=author:shafeeq27edu-ai+type:pr+state:open').then(r => r.json())
            ]);
            
            const openCount = prs.total_count || 0;
            
            statsEl.innerHTML = `
                <span class="flex items-center gap-1.5 text-xs text-muted font-mono stats-mono">
                    <span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>
                    ${user.public_repos} Public Repos
                </span>
                <span class="flex items-center gap-1.5 text-xs text-muted font-mono stats-mono">
                    <span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>
                    ${user.followers} Follower
                </span>
                <span class="flex items-center gap-1.5 text-xs text-muted font-mono stats-mono">
                    <span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>
                    ${openCount} Open PRs
                </span>
                <span class="flex items-center gap-1.5 text-xs text-muted font-mono stats-mono">
                    <span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>
                    Agenta-AI Contributor
                </span>
            `;
        } catch(e) {
            statsEl.innerHTML = '<span class="text-xs text-muted">GitHub stats unavailable</span>';
        }
    })();

    // --- Open Source (Search API) ---
    (async function() {
        const listEl = document.getElementById('os-list');
        const countEl = document.getElementById('os-count');
        const tabs = document.querySelectorAll('.os-tab');
        if (!listEl || !countEl) return;
        
        try {
            const res = await fetch('https://api.github.com/search/issues?q=author:shafeeq27edu-ai+type:pr+sort:created-desc&per_page=20');
            const data = await res.json();
            
            if (!data.items) {
                listEl.innerHTML = '<div class="text-xs text-muted py-6 text-center">No PRs found.</div>';
                return;
            }
            
            // Filter out fork-internal PRs (shafeeq27edu-ai/*), keep upstream only
            const prs = data.items
                .map(pr => {
                    const repo = pr.repository_url.replace('https://api.github.com/repos/', '');
                    
                    let status = 'Open';
                    let color = '#22c55e';
                    if (pr.state === 'closed') {
                        if (pr.pull_request && pr.pull_request.merged_at) {
                            status = 'Merged'; 
                            color = '#a855f7';
                        } else {
                            status = 'Closed'; 
                            color = '#ef4444';
                        }
                    }
                    
                    return {
                        title: pr.title,
                        repo,
                        number: pr.number,
                        status,
                        color,
                        url: pr.html_url,
                        category: status.toLowerCase()
                    };
                })
                .filter(pr => !pr.repo.startsWith('shafeeq27edu-ai/'));
            
            countEl.textContent = prs.length + ' public PRs';
            
            function render(filter) {
                let filtered = prs;
                if (filter !== 'all') {
                    filtered = prs.filter(p => p.category === filter);
                }
                
                if (filtered.length === 0) {
                    listEl.innerHTML = '<div class="text-xs text-muted py-6 text-center">No PRs in this category.</div>';
                    return;
                }
                
                listEl.innerHTML = filtered.map(pr => `
                    <div class="flex gap-3 py-3 border-b border-[#1a1a1a] items-start group" style="display:flex; gap:0.75rem; padding:0.75rem 0; border-bottom:1px solid #1a1a1a; align-items:flex-start;">
                        <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="width:8px; height:8px; border-radius:50%; margin-top:6px; flex-shrink:0; background:${pr.color}"></div>
                        <div class="flex-1 min-w-0" style="flex:1; min-width:0; display:flex; flex-direction:column;">
                            <a href="${pr.url}" target="_blank" rel="noopener" class="text-sm text-white group-hover:underline block truncate pr-title" style="color:#fff; font-size:0.875rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pr.title}</a>
                            <span class="text-xs text-muted font-mono stats-mono pr-repo" style="color:#52525b; font-size:0.75rem; font-family:var(--font-mono);">${pr.repo} #${pr.number}</span>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-medium" style="font-size:10px; padding:2px 8px; border-radius:9999px; border:1px solid ${pr.color}33; color:${pr.color}; background:${pr.color}11; flex-shrink:0; font-weight:500;">
                            ${pr.status}
                        </span>
                    </div>
                `).join('');
            }
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => {
                        t.classList.remove('bg-[#1a1a1a]', 'text-white', 'active');
                        t.classList.add('text-muted');
                    });
                    tab.classList.add('bg-[#1a1a1a]', 'text-white', 'active');
                    tab.classList.remove('text-muted');
                    render(tab.dataset.filter);
                });
            });
            
            render('all');
            
        } catch (err) {
            countEl.textContent = 'Unable to load';
            listEl.innerHTML = '<div class="text-xs text-muted py-6 text-center">GitHub API unavailable. <a href="https://github.com/shafeeq27edu-ai" target="_blank" rel="noopener noreferrer" class="text-white underline">View directly ↗</a></div>';
        }
    })();
});
