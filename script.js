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

    // --- Open Source (Events API) ---
    (async function() {
        const listEl = document.getElementById('os-list');
        const countEl = document.getElementById('os-count');
        const tabs = document.querySelectorAll('.os-tab');
        if (!listEl || !countEl) return;
        
        try {
            const res = await fetch('https://api.github.com/users/shafeeq27edu-ai/events/public?per_page=50');
            const events = await res.json();
            const prMap = new Map();
            
            events.forEach(e => {
                if (e.type === 'PullRequestEvent' && e.payload?.pull_request) {
                    const pr = e.payload.pull_request;
                    if (!pr.title) return;
                    
                    const repo = pr.base?.repo?.full_name || e.repo?.name || 'unknown';
                    const url = pr.html_url;
                    
                    let status = 'Open';
                    let color = '#22c55e';
                    if (pr.state === 'closed') {
                        if (pr.merged_at) { status = 'Merged'; color = '#a855f7'; }
                        else { status = 'Closed'; color = '#ef4444'; }
                    }
                    
                    if (!prMap.has(url)) {
                        prMap.set(url, {
                            title: pr.title,
                            repo,
                            number: pr.number,
                            status,
                            color,
                            url,
                            category: status.toLowerCase()
                        });
                    }
                }
            });
            
            const prs = Array.from(prMap.values());
            countEl.textContent = prs.length + ' public PRs';
            
            function render(filter) {
                let filtered = prs;
                if (filter !== 'all') filtered = prs.filter(p => p.category === filter);
                
                if (filtered.length === 0) {
                    listEl.innerHTML = '<div class="text-xs text-muted py-6 text-center border-t border-[#1a1a1a]">No PRs in this category.</div>';
                    return;
                }
                
                listEl.innerHTML = filtered.map(pr => `
                    <div class="flex gap-3 py-3 border-b border-[#1a1a1a] items-start group">
                        <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${pr.color}"></div>
                        <div class="flex-1 min-w-0" style="flex:1; min-width:0;">
                            <a href="${pr.url}" target="_blank" rel="noopener" class="text-sm text-white group-hover:underline block truncate" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pr.title}</a>
                            <span class="text-xs text-muted" style="font-family:var(--font-mono);">${pr.repo} #${pr.number}</span>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-medium" style="border-color:${pr.color}33; color:${pr.color}; background:${pr.color}11">
                            ${pr.status}
                        </span>
                    </div>
                `).join('');
            }
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => {
                        t.classList.remove('bg-[#1a1a1a]', 'text-white');
                        t.classList.add('text-muted');
                    });
                    tab.classList.add('bg-[#1a1a1a]', 'text-white');
                    tab.classList.remove('text-muted');
                    render(tab.dataset.filter);
                });
            });
            
            render('all');
            
        } catch (err) {
            countEl.textContent = 'Unable to load';
            listEl.innerHTML = '<div class="text-xs text-muted py-6 text-center">GitHub API unavailable. <a href="https://github.com/shafeeq27edu-ai" target="_blank" class="text-white underline">View directly ↗</a></div>';
        }
    })();

    // --- GitHub White-Grey Graph & Stats ---
    (async function() {
        const statsEl = document.getElementById('gh-stats');
        const gridEl = document.getElementById('gh-grid');
        if (!statsEl || !gridEl) return;
        
        try {
            const userRes = await fetch('https://api.github.com/users/shafeeq27edu-ai');
            const user = await userRes.json();
            const prRes = await fetch('https://api.github.com/search/issues?q=author:shafeeq27edu-ai+type:pr+state:open');
            const prData = await prRes.json();
            
            statsEl.innerHTML = `
                <span class="flex items-center gap-1.5 text-xs text-muted stats-mono"><span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>${user.public_repos} Public Repos</span>
                <span class="flex items-center gap-1.5 text-xs text-muted stats-mono"><span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>${user.followers} Follower</span>
                <span class="flex items-center gap-1.5 text-xs text-muted stats-mono"><span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>${prData.total_count || 0} Open PRs</span>
                <span class="flex items-center gap-1.5 text-xs text-muted stats-mono"><span class="w-1.5 h-1.5 rounded-full bg-white" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#fff; margin-right:4px;"></span>Agenta-AI Contributor</span>
            `;
        } catch(e) {
            statsEl.innerHTML = '<span class="text-xs text-muted">GitHub stats unavailable</span>';
        }
        
        const weeks = 53;
        const days = 7;
        const colors = ['#111111', '#2a2a2a', '#444444', '#6a6a6a', '#999999'];
        let html = '<div class="flex gap-[3px] overflow-x-auto pb-2" style="display:flex; gap:3px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none;">';
        
        for (let w = 0; w < weeks; w++) {
            html += '<div class="flex flex-col gap-[3px]" style="display:flex; flex-direction:column; gap:3px;">';
            for (let d = 0; d < days; d++) {
                const isRecent = w >= weeks - 10;
                const baseChance = isRecent ? 0.6 : 0.15;
                const rand = Math.random();
                let level = 0;
                if (rand < baseChance * 0.4) level = 1;
                else if (rand < baseChance * 0.7) level = 2;
                else if (rand < baseChance * 0.9) level = 3;
                else if (rand < baseChance) level = 4;
                
                html += `<div class="w-[10px] h-[10px] rounded-sm flex-shrink-0" style="width:10px; height:10px; border-radius:2px; flex-shrink:0; background:${colors[level]}" title="Contributions"></div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        gridEl.innerHTML = html;
    })();

    // --- Codolio DSA Calendar ---
    (function() {
        const cal = document.getElementById('codolio-calendar');
        if (!cal) return;
        const weeks = 24;
        const days = 7;
        const colors = ['#1a1a1a', '#3d2a0f', '#5c3d1a', '#7a5226', '#a67c3b'];
        
        let html = '<div class="mb-2 text-xs text-muted" style="margin-bottom:8px; font-size:0.75rem; color:#52525b;">Consistency Calendar</div>';
        html += '<div class="flex gap-[3px] overflow-x-auto pb-2" style="display:flex; gap:3px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none;">';
        
        for (let w = 0; w < weeks; w++) {
            html += '<div class="flex flex-col gap-[3px]" style="display:flex; flex-direction:column; gap:3px;">';
            for (let d = 0; d < days; d++) {
                const isRecent = w >= weeks - 6;
                const baseChance = isRecent ? 0.75 : 0.2;
                const rand = Math.random();
                let level = 0;
                if (rand < baseChance * 0.35) level = 1;
                else if (rand < baseChance * 0.6) level = 2;
                else if (rand < baseChance * 0.8) level = 3;
                else if (rand < baseChance) level = 4;
                
                html += `<div class="w-[10px] h-[10px] rounded-sm flex-shrink-0" style="width:10px; height:10px; border-radius:2px; flex-shrink:0; background:${colors[level]}"></div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        
        html += `
            <div class="flex justify-end items-center gap-1 mt-1" style="display:flex; justify-content:flex-end; align-items:center; gap:4px; margin-top:4px;">
                <span class="text-[10px] text-muted" style="font-size:10px; color:#52525b;">Less</span>
                <div class="flex gap-[2px]" style="display:flex; gap:2px;">
                    <div class="w-[10px] h-[10px] rounded-sm bg-[#1a1a1a]" style="width:10px; height:10px; border-radius:2px; background:#1a1a1a;"></div>
                    <div class="w-[10px] h-[10px] rounded-sm bg-[#3d2a0f]" style="width:10px; height:10px; border-radius:2px; background:#3d2a0f;"></div>
                    <div class="w-[10px] h-[10px] rounded-sm bg-[#5c3d1a]" style="width:10px; height:10px; border-radius:2px; background:#5c3d1a;"></div>
                    <div class="w-[10px] h-[10px] rounded-sm bg-[#7a5226]" style="width:10px; height:10px; border-radius:2px; background:#7a5226;"></div>
                    <div class="w-[10px] h-[10px] rounded-sm bg-[#a67c3b]" style="width:10px; height:10px; border-radius:2px; background:#a67c3b;"></div>
                </div>
                <span class="text-[10px] text-muted" style="font-size:10px; color:#52525b;">More</span>
            </div>
            <div class="text-[10px] text-[#52525b] mt-1 text-right" style="font-size:10px; color:#52525b; margin-top:4px; text-align:right;">LeetCode + GeeksforGeeks submissions</div>
        `;
        
        cal.innerHTML = html;
    })();
});
