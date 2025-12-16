// ==================== 
// Modal Management
// ==================== 

export class ModalManager {
  constructor() {
    this.modals = new Map();
  }

  registerModal(name, modalElement) {
    this.modals.set(name, modalElement);
  }

  open(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('active');
    document.body.style.overflow = '';
  }

  setupDragResize(modalElement) {
    const content = modalElement.querySelector('.modal-content');
    const header = modalElement.querySelector('.modal-header');
    const body = modalElement.querySelector('.modal-body');

    if (!content || !header || !body) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    let startScrollTop = 0;

    // Touch events (mobile)
    const handleTouchStart = (e) => {
      if (!header.contains(e.target)) return;
      isDragging = true;
      startY = e.touches[0].clientY;
      startHeight = content.offsetHeight;
      startScrollTop = body.scrollTop;
      content.classList.add('dragging');
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      let newHeight = startHeight + deltaY;
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.9;
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      content.style.height = `${newHeight}px`;
      e.preventDefault();
    };

    const handleTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      content.classList.remove('dragging');
      const endY = e.changedTouches[0].clientY;
      const totalDragDistance = endY - startY;

      if (totalDragDistance > 150 && startScrollTop === 0) {
        this.close(modalElement);
        setTimeout(() => {
          content.style.height = '50vh';
        }, 300);
      }
    };

    header.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Mouse events (desktop)
    let isMouseDragging = false;
    let mouseStartY = 0;
    let mouseStartHeight = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.close-btn')) return;
      isMouseDragging = true;
      mouseStartY = e.clientY;
      mouseStartHeight = content.offsetHeight;
      content.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isMouseDragging) return;
      const deltaY = mouseStartY - e.clientY;
      let newHeight = mouseStartHeight + deltaY;
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.9;
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      content.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', (e) => {
      if (!isMouseDragging) return;
      isMouseDragging = false;
      content.classList.remove('dragging');
      const endY = e.clientY;
      const totalDragDistance = endY - mouseStartY;

      if (totalDragDistance > 150) {
        this.close(modalElement);
        setTimeout(() => {
          content.style.height = '50vh';
        }, 300);
      }
    });
  }

  setupClickOutsideClose(modalElement) {
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) this.close(modalElement);
    });
  }
}
