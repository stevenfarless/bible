const MIN_HEIGHT = 200;
const MAX_HEIGHT_RATIO = 0.9;
const AXIS_THRESHOLD = 8;
const DISMISS_PULL = 90;

function addDragZone(content, side) {
    const zone = document.createElement('div');
    zone.className = `modal-drag-zone modal-drag-zone--${side}`;
    zone.setAttribute('aria-hidden', 'true');
    content.appendChild(zone);
    return zone;
}

function attachBottomSheetDrag(app, modal) {
    const content = modal.querySelector('.modal-content');
    const header = modal.querySelector('.modal-header');

    if (!content || !header) return;

    content.classList.add('modal-drag-resizable');

    const dragSources = [
        header,
        addDragZone(content, 'left'),
        addDragZone(content, 'right'),
    ];

    const drag = {
        pointerId: null,
        source: null,
        startX: 0,
        startY: 0,
        startHeight: 0,
        axis: null,
        dismissArmed: false,
    };

    function resetDrag() {
        content.classList.remove('dragging', 'dismiss-armed');
        drag.pointerId = null;
        drag.source = null;
        drag.axis = null;
        drag.dismissArmed = false;
    }

    function finishDrag(event, allowDismiss) {
        if (event.pointerId !== drag.pointerId) return;

        const shouldDismiss = allowDismiss && drag.dismissArmed;
        if (drag.source?.hasPointerCapture(event.pointerId)) {
            drag.source.releasePointerCapture(event.pointerId);
        }
        resetDrag();

        if (shouldDismiss) {
            app.closeModal(modal);
            setTimeout(() => {
                content.style.height = '';
            }, 320);
        }
    }

    function startDrag(event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest('.close-btn')) return;

        drag.pointerId = event.pointerId;
        drag.source = event.currentTarget;
        drag.startX = event.clientX;
        drag.startY = event.clientY;
        drag.startHeight = content.offsetHeight;
        drag.axis = null;
        drag.dismissArmed = false;

        drag.source.setPointerCapture(event.pointerId);
        content.classList.add('dragging');
        event.preventDefault();
    }

    function moveDrag(event) {
        if (event.pointerId !== drag.pointerId) return;

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;

        if (drag.axis === null) {
            if (Math.abs(dx) < AXIS_THRESHOLD && Math.abs(dy) < AXIS_THRESHOLD) return;
            drag.axis = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal';
            if (drag.axis === 'horizontal') {
                finishDrag(event, false);
                return;
            }
        }

        const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
        const requestedHeight = drag.startHeight - dy;
        const resizedHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, requestedHeight));
        const pullPastMinimum = Math.max(0, MIN_HEIGHT - requestedHeight);

        content.style.height = `${resizedHeight}px`;
        drag.dismissArmed = pullPastMinimum >= DISMISS_PULL;
        content.classList.toggle('dismiss-armed', drag.dismissArmed);
        event.preventDefault();
    }

    for (const source of dragSources) {
        source.addEventListener('pointerdown', startDrag);
        source.addEventListener('pointermove', moveDrag);
        source.addEventListener('pointerup', (event) => finishDrag(event, true));
        source.addEventListener('pointercancel', (event) => finishDrag(event, false));
    }
}

export function attachDragToResize(app) {
    if (app.settingsModal) attachBottomSheetDrag(app, app.settingsModal);
}
