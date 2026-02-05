// Character counter for review textarea
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe cards and sections
    document.querySelectorAll('.service-card, .category-card, .why-card, .step-card, .stat-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    const textarea = document.querySelector('textarea[name="comment"]');
    if (textarea) {
        const counter = textarea.parentElement.querySelector('small');
        textarea.addEventListener('input', function() {
            const length = this.value.length;
            counter.textContent = `${length}/400 characters`;
        });
    }
    
    // Star rating interaction
    const stars = document.querySelectorAll('.stars input[type="radio"]');
    stars.forEach(star => {
        star.addEventListener('change', function() {
            const labels = document.querySelectorAll('.stars label');
            labels.forEach((label, index) => {
                if (index < this.value) {
                    label.style.color = '#f39c12';
                } else {
                    label.style.color = '#ddd';
                }
            });
        });
    });

    // Flash message auto-hide
    const flashMessages = document.querySelectorAll('.flash-toast, .error-message, .success-message');
    flashMessages.forEach(msg => {
        setTimeout(() => {
            msg.style.opacity = '0';
            msg.style.transform = 'translateY(-20px)';
            setTimeout(() => msg.remove(), 300);
        }, 5000);
    });

    // Add ripple effect to buttons
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-small, .btn-view').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Toggle user status without redirect
    document.querySelectorAll('.js-user-toggle').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();

            if (this.dataset.loading === 'true') {
                return;
            }
            this.dataset.loading = 'true';

            const currentAction = this.dataset.action;
            const targetUrl = this.getAttribute('href');

            try {
                await fetch(targetUrl, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const newStatus = currentAction === 'disable' ? 'frozen' : 'active';
                const nextAction = newStatus === 'active' ? 'disable' : 'enable';
                const userId = this.dataset.userId;

                const updateButton = (btn) => {
                    btn.dataset.action = nextAction;
                    btn.textContent = nextAction === 'disable' ? 'Disable' : 'Enable';
                    btn.setAttribute(
                        'href',
                        nextAction === 'disable' ? btn.dataset.disableHref : btn.dataset.enableHref
                    );
                    btn.classList.remove('btn-warning', 'btn-success');
                    btn.classList.add(nextAction === 'disable' ? 'btn-warning' : 'btn-success');
                };

                const updateStatus = (badge) => {
                    badge.classList.remove('status-active', 'status-frozen');
                    badge.classList.add(newStatus === 'frozen' ? 'status-frozen' : 'status-active');
                    badge.textContent = newStatus;
                };

                if (userId) {
                    document
                        .querySelectorAll(`.js-user-toggle[data-user-id="${userId}"]`)
                        .forEach(updateButton);
                    document
                        .querySelectorAll(`.js-user-status[data-user-id="${userId}"]`)
                        .forEach(updateStatus);
                } else {
                    updateButton(this);
                    const row = this.closest('tr');
                    const statusBadge = row ? row.querySelector('.js-user-status, .status-badge') : null;
                    if (statusBadge) {
                        updateStatus(statusBadge);
                    }
                }
            } catch (error) {
                console.error('Failed to toggle user status', error);
            } finally {
                this.dataset.loading = 'false';
            }
        });
    });

    // Navbar scroll effect
    let lastScroll = 0;
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.boxShadow = '0 4px 30px rgba(102, 126, 234, 0.5)';
        } else {
            navbar.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
        }
        
        lastScroll = currentScroll;
    });

    // Form validation enhancement
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                if (!this.value.trim()) {
                    this.style.borderColor = '#EF4444';
                } else {
                    this.style.borderColor = '#10B981';
                }
            });
            
            input.addEventListener('focus', function() {
                this.style.borderColor = '#667eea';
            });
        });
    });
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

