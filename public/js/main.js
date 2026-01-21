// Character counter for review textarea
document.addEventListener('DOMContentLoaded', function() {
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
});
