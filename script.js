// Intersection Observer Setup for Scroll Animations
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // stop observing once element is visible
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(element => {
        observer.observe(element);
    });

    // 3D Parallax effect on mouse movement for the avatar container
    const avatarContainer = document.querySelector('.avatar-container');
    
    // Only apply on non-touch devices
    if (window.matchMedia("(hover: hover)").matches && avatarContainer) {
        document.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth / 2 - e.pageX) / 40;
            const y = (window.innerHeight / 2 - e.pageY) / 40;
            
            avatarContainer.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${y}deg) scale(1.05)`;
        });
        
        document.addEventListener('mouseleave', () => {
            avatarContainer.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)`;
        });
    }
});
