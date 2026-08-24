document.addEventListener("DOMContentLoaded", () => {
    // --- Sidebar Intersection Observer ---
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".index-nav ul li a");

    if (sections.length > 0 && navLinks.length > 0) {
        const observerOptions = {
            root: null,
            rootMargin: "0px",
            threshold: 0.2 // Trigger when 20% of section is visible (better for small sections)
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
    }

    // --- GitHub Real Data Fetch ---
    const ghCountEl = document.getElementById('github-count');
    const osListEl = document.getElementById('os-list');

    if (ghCountEl && osListEl) {
        fetch('https://api.github.com/users/shafeeq27edu-ai/events/public?per_page=10')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                ghCountEl.textContent = data.length + '+ recent activities';
                
                osListEl.innerHTML = ''; // Clear placeholder
                
                // Filter for PR or Push events to simulate OS contributions
                const prEvents = data.filter(e => e.type === 'PullRequestEvent' || e.type === 'PushEvent');
                const displayEvents = prEvents.length > 0 ? prEvents.slice(0, 4) : data.slice(0, 4);

                displayEvents.forEach(event => {
                    const repoName = event.repo.name;
                    let title = event.type;
                    
                    if (event.payload && event.payload.commits && event.payload.commits.length > 0) {
                        title = event.payload.commits[0].message.split('\n')[0];
                    } else if (event.payload && event.payload.pull_request) {
                        title = event.payload.pull_request.title;
                    }

                    // For demo, we'll set status based on event type
                    let status = "Merged";
                    if (event.type === 'PullRequestEvent') {
                        status = event.payload.action === 'closed' ? 'Closed' : 'Open';
                        if (event.payload.pull_request && event.payload.pull_request.merged) {
                            status = "Merged";
                        }
                    }

                    // Create DOM elements
                    const item = document.createElement('div');
                    item.className = 'os-item';
                    
                    item.innerHTML = `
                        <div class="pr-dot">&bull;</div>
                        <div class="pr-middle">
                            <h4 class="pr-title">${title}</h4>
                            <p class="pr-repo">${repoName}</p>
                        </div>
                        <div class="status-badge ${status === 'Merged' ? 'live' : status === 'Building' ? 'building' : 'closed'}">
                            ${status}
                        </div>
                    `;
                    
                    osListEl.appendChild(item);
                });

                if (displayEvents.length === 0) {
                    osListEl.innerHTML = '<div class="os-placeholder">No recent PRs or pushes found.</div>';
                }
            })
            .catch(err => {
                console.error("GitHub fetch error:", err);
                ghCountEl.textContent = 'Connect GitHub';
                osListEl.innerHTML = '<div class="os-placeholder">Connect GitHub to see activity</div>';
            });
    }
});
