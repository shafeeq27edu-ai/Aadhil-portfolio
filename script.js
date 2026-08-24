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
});
