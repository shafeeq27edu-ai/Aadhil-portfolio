document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. Particle Canvas ---
    const canvas = document.getElementById("particle-canvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        let particles = [];
        
        const config = {
            particleCount: 60, // Fixed to 60 as requested
            particleColor: "#f59e0b",
            lineColor: "rgba(6, 182, 212, ",
            particleSize: 1.5,
            connectionDistance: 150,
            speed: 0.3
        };

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * config.speed;
                this.vy = (Math.random() - 0.5) * config.speed;
                this.size = Math.random() * config.particleSize + 0.5;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = config.particleColor;
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < config.particleCount; i++) {
                particles.push(new Particle());
            }
        }

        function drawConnections() {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p1 = particles[i];
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < config.connectionDistance) {
                        const opacity = 1 - (distance / config.connectionDistance);
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `${config.lineColor}${opacity * 0.5})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            drawConnections();
            requestAnimationFrame(animate);
        }

        window.addEventListener("resize", () => {
            resizeCanvas();
            initParticles();
        });

        resizeCanvas();
        initParticles();
        animate();
    }

    // --- 2. Scroll Reveal Animation ---
    const revealElements = document.querySelectorAll(".reveal");
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // --- 3. DSA Heatmap Generation ---
    const heatmapContainer = document.getElementById("calendar-heatmap");
    if (heatmapContainer) {
        // Desktop: 53 cols. Mobile: 26 cols.
        // We'll generate 53 columns anyway, CSS handles display/scroll.
        const totalWeeks = 53;
        const daysPerWeek = 7;
        const totalDays = totalWeeks * daysPerWeek;
        
        for (let i = 0; i < totalDays; i++) {
            const cell = document.createElement("div");
            cell.classList.add("day-cell");
            
            // Random realistic data: higher density towards the end (recent weeks)
            const weekIndex = Math.floor(i / daysPerWeek);
            const recencyFactor = weekIndex / totalWeeks; // 0.0 to 1.0
            
            let level = 0;
            const rand = Math.random();
            
            // Increase probability of higher levels based on recency
            if (rand < 0.1 + (recencyFactor * 0.4)) {
                // Higher chance for some activity
                const activityIntensity = Math.random() + recencyFactor;
                if (activityIntensity > 1.6) level = 4;
                else if (activityIntensity > 1.2) level = 3;
                else if (activityIntensity > 0.8) level = 2;
                else level = 1;
            }
            
            cell.classList.add(`bg-lvl-${level}`);
            heatmapContainer.appendChild(cell);
        }
    }
});
