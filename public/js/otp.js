document.addEventListener('DOMContentLoaded', () => {
    const flashTrigger = document.querySelector('[data-flash-message]');
    if (flashTrigger) {
        const message = flashTrigger.dataset.flashMessage;
        if (message) {
            const toast = document.createElement('div');
            toast.className = 'flash-toast';
            toast.textContent = message;

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'flash-toast-close';
            closeButton.setAttribute('aria-label', 'Close notification');
            closeButton.textContent = '×';
            toast.appendChild(closeButton);

            const removeToast = () => {
                toast.classList.add('flash-toast-hide');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            };

            closeButton.addEventListener('click', removeToast);
            setTimeout(removeToast, 5000);

            document.body.appendChild(toast);
        }
    }

    const form = document.querySelector('[data-otp-form]');
    const inputs = Array.from(document.querySelectorAll('[data-otp-inputs] .otp-input'));
    const hiddenCode = document.querySelector('[data-otp-code]');

    if (!form || inputs.length === 0 || !hiddenCode) {
        return;
    }

    const syncHiddenCode = () => {
        hiddenCode.value = inputs.map((input) => input.value).join('');
    };

    inputs.forEach((input, index) => {
        input.addEventListener('input', (event) => {
            const value = event.target.value.replace(/\D/g, '');
            event.target.value = value;

            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            syncHiddenCode();
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !event.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (event) => {
            event.preventDefault();
            const paste = (event.clipboardData || window.clipboardData).getData('text');
            const digits = paste.replace(/\D/g, '').slice(0, inputs.length);

            digits.split('').forEach((digit, digitIndex) => {
                if (inputs[digitIndex]) {
                    inputs[digitIndex].value = digit;
                }
            });

            const nextIndex = Math.min(digits.length, inputs.length - 1);
            inputs[nextIndex].focus();
            syncHiddenCode();
        });
    });

    form.addEventListener('submit', () => {
        syncHiddenCode();
    });
});
