/**
 * =====================================================
 * 🎬 HERO VIDEO BACKGROUND - YouTube API Integration
 * =====================================================
 * Loops video segment (0:04 → 0:58) seamlessly
 */

const YT_CONFIG = {
    videoId: 'FUziZg9jcyM',
    startTime: 3,
    endTime: 48,
    checkInterval: 300,
    preSeekBuffer: 0.4
};

let ytPlayer = null;

/**
 * YouTube IFrame API Ready Callback
 * Initializes player with optimized parameters
 */
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('ytPlayer', {
        videoId: YT_CONFIG.videoId,
        playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            loop: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            start: YT_CONFIG.startTime,
            end: YT_CONFIG.endTime
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
};

/**
 * Player Ready Handler
 * @param {Object} event - YouTube player event
 */
function onPlayerReady(event) {
    event.target.setVolume(0);
    event.target.playVideo();
}

/**
 * Player State Change Handler
 * Ensures seamless looping
 * @param {Object} event - YouTube player event
 */
function onPlayerStateChange(event) {
    const { ENDED, PAUSED } = YT.PlayerState;
    
    if (event.data === ENDED || event.data === PAUSED) {
        event.target.seekTo(YT_CONFIG.startTime);
        event.target.playVideo();
    }
}

/**
 * Seamless Loop Checker
 * Prevents visible jump at end of segment
 */
const loopChecker = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    
    const currentTime = ytPlayer.getCurrentTime();
    const threshold = YT_CONFIG.endTime - YT_CONFIG.preSeekBuffer;
    
    if (currentTime >= threshold) {
        ytPlayer.seekTo(YT_CONFIG.startTime);
        ytPlayer.playVideo();
    }
}, YT_CONFIG.checkInterval);

/**
 * =====================================================
 * 🎨 LOADING SCREEN & HERO ANIMATIONS
 * =====================================================
 */

const LOADER_DELAY = 1500;

window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('hidden');
            initHeroAnimations();
        }
    }, LOADER_DELAY);
});

/**
 * Initializes Hero Section Entrance Animations
 * Staggered GSAP timeline for smooth reveal
 */
function initHeroAnimations() {
    const elements = [
        { selector: '.hero-badge', delay: 0.3 },
        { selector: '.hero-title', delay: 0.5 },
        { selector: '.hero-subtitle', delay: 0.7 },
        { selector: '.hero-cta', delay: 0.9 }
    ];

    elements.forEach(({ selector, delay }) => {
        const element = document.querySelector(selector);
        if (element) {
            gsap.to(selector, {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay,
                ease: 'power3.out'
            });
        }
    });
}

/**
 * =====================================================
 * 🧭 NAVIGATION
 * =====================================================
 */

const navbar = document.getElementById('navbar');
const SCROLL_THRESHOLD = 50;

/**
 * Sticky Navbar on Scroll
 */
window.addEventListener('scroll', () => {
    if (!navbar) return;
    
    if (window.scrollY > SCROLL_THRESHOLD) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}, { passive: true });

/**
 * Mobile Menu Toggle
 */
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    // Close menu when clicking nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
}

function toggleMobileMenu() {
    navLinks.classList.toggle('active');
    const icon = mobileMenuBtn.querySelector('i');
    
    if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    }
}

function closeMobileMenu() {
    navLinks.classList.remove('active');
    const icon = mobileMenuBtn.querySelector('i');
    
    if (icon) {
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
    }
}

/**
 * Active Navigation Link on Scroll
 * Highlights current section in navbar
 */
const sections = document.querySelectorAll('section[id]');
const NAV_OFFSET = 100;

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - NAV_OFFSET;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            updateActiveNavLink(sectionId);
        }
    });
}, { passive: true });

function updateActiveNavLink(activeId) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        
        if (link.getAttribute('href') === `#${activeId}`) {
            link.classList.add('active');
        }
    });
}

/**
 * =====================================================
 * 🎭 SCROLL ANIMATIONS - GSAP ScrollTrigger
 * =====================================================
 */

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    
    gsap.utils.toArray('.reveal').forEach(element => {
        gsap.to(element, {
            scrollTrigger: {
                trigger: element,
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out'
        });
    });
}

/**
 * =====================================================
 * 📦 CATALOGUE FILTERING SYSTEM
 * =====================================================
 */

const catalogueTabs = document.querySelectorAll('.catalogue-tab');
const productCards = document.querySelectorAll('.product-card');

catalogueTabs.forEach(tab => {
    tab.addEventListener('click', () => filterProducts(tab));
});

/**
 * Filters products based on selected category
 * @param {HTMLElement} activeTab - Clicked tab element
 */
function filterProducts(activeTab) {
    // Update active tab
    catalogueTabs.forEach(tab => tab.classList.remove('active'));
    activeTab.classList.add('active');
    
    const filter = activeTab.dataset.filter;
    
    // Filter and animate products
    productCards.forEach(card => {
        const category = card.dataset.category;
        const shouldShow = filter === 'all' || category === filter;
        
        if (shouldShow) {
            card.style.display = 'flex';
            
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(card, 
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
                );
            }
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * =====================================================
 * 📧 CONTACT FORM HANDLER
 * =====================================================
 */

const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', handleContactFormSubmit);
}

/**
 * Handles contact form submission with visual feedback
 * @param {Event} event - Form submit event
 */
function handleContactFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    
    // Loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Success state
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Message envoyé !';
        submitBtn.style.background = '#22c55e';
        
        // Reset form after delay
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
            event.target.reset();
        }, 3000);
    }, 1500);
}

/**
 * =====================================================
 * 🔗 SMOOTH SCROLL FOR ANCHOR LINKS
 * =====================================================
 */

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', handleSmoothScroll);
});

/**
 * Smooth scrolls to anchor target
 * @param {Event} event - Click event
 */
function handleSmoothScroll(event) {
    event.preventDefault();
    
    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * =====================================================
 * 💬 WHATSAPP INTEGRATION
 * =====================================================
 */

const WHATSAPP_NUMBER = '212661317773';

document.querySelectorAll('.wa-btn').forEach(btn => {
    btn.addEventListener('click', handleWhatsAppClick);
});

/**
 * Opens WhatsApp with pre-filled message about product
 * @param {Event} event - Click event
 */
function handleWhatsAppClick(event) {
    const productInfo = this.closest('.product-info');
    const productTitle = productInfo?.querySelector('h3')?.textContent.trim() || 'votre produit';
    
    const message = `Bonjour, je souhaite plus de détails sur : ${productTitle}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * =====================================================
 * 🧹 CLEANUP ON PAGE UNLOAD
 * =====================================================
 */

window.addEventListener('beforeunload', () => {
    // Clear YouTube loop checker
    if (loopChecker) {
        clearInterval(loopChecker);
    }
    
    // Pause video to free resources
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        ytPlayer.pauseVideo();
    }
});

/**
 * =====================================================
 * 🛡️ ERROR HANDLING
 * =====================================================
 */

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // You can add error tracking service here (e.g., Sentry)
});

/**
 * =====================================================
 * 📱 PERFORMANCE OPTIMIZATION
 * =====================================================
 */

// Debounce helper for scroll events
function debounce(func, wait = 20) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Lazy load images (if needed)
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
    });
}

/**
 * =====================================================
 * 🎯 CONSOLE BRANDING (Optional)
 * =====================================================
 */

console.log(
    '%c🔥 Site développé avec passion',
    'color: #E63946; font-size: 16px; font-weight: bold; text-shadow: 2px 2px 0 rgba(0,0,0,0.1);'
);