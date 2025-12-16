// ==================== 
// Auto-hide Chrome (Header + Nav)
// ==================== 

export class ChromeController {
    constructor() {
        this.hidden = false;
        this.scrollLastY = window.scrollY || 0;
        this.delta = 2;
        this.scrollTicking = false;
        this.suspend = false;
    }

    show() {
        if (!this.hidden) return;
        document.body.classList.remove('chrome-hidden');
        this.hidden = false;
    }

    hide() {
        if (this.hidden) return;
        document.body.classList.add('chrome-hidden');
        this.hidden = true;
    }

    handleScroll(searchContainer) {
        if (this.scrollTicking) return;
        this.scrollTicking = true;

        if (this.suspend) {
            this.scrollLastY = window.scrollY || window.pageYOffset || 0;
            this.scrollTicking = false;
            return;
        }

        window.requestAnimationFrame(() => {
            const y = window.scrollY || window.pageYOffset || 0;
            const delta = y - this.scrollLastY;
            const modalOpen = !!document.querySelector('.modal.active');
            const searchOpen = !!searchContainer?.classList.contains('active');

            if (y <= 0 || modalOpen || searchOpen) {
                this.show();
                this.scrollLastY = y;
                this.scrollTicking = false;
                return;
            }

            if (delta > this.delta) this.hide();
            if (delta < -this.delta) this.show();

            this.scrollLastY = y;
            this.scrollTicking = false;
        });
    }

    suspendAutoHide() {
        this.suspend = true;
        document.body.classList.add('chrome-no-transition');
        this.show();
    }

    resumeAutoHide() {
        this.scrollLastY = window.scrollY || window.pageYOffset || 0;
        this.suspend = false;
        document.body.classList.remove('chrome-no-transition');
    }
}
