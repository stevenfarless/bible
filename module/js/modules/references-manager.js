// js/modules/references-manager.js

export class ReferencesManager {
    constructor(app) {
        this.app = app;
    }

    attachHandlers() {
        const links = this.app.ui.elements.passageText.querySelectorAll('a.fn');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleReferenceClick(link);
            });
        });
    }

    makeFootnotesClickable() {
        const superscripts = this.app.ui.elements.passageText.querySelectorAll('sup.footnote');
        superscripts.forEach((sup) => {
            sup.style.cursor = 'pointer';
            sup.addEventListener('click', (e) => {
                e.preventDefault();
                const footnoteNumber = sup.textContent.trim();
                const verseRef = this.getVerseReferenceForElement(sup);
                this.showFootnoteModal(footnoteNumber, verseRef);
            });
        });
    }

    handleReferenceClick(link) {
        const href = link.getAttribute('href');
        if (!href) return;

        const ui = this.app.ui.elements;
        ui.footnotesSection.style.display = 'none';
        ui.crossReferencesSection.style.display = 'none';
        ui.footnotesContent.innerHTML = '';
        ui.crossReferencesContent.innerHTML = '';

        if (href.startsWith('#f')) {
            const footnoteId = href.substring(1);
            this.loadFootnote(footnoteId, link);
        }

        this.app.ui.openModal(ui.referencesModal);
    }

    loadFootnote(footnoteId, clickedLink) {
        const verseRef = this.getVerseReferenceForElement(clickedLink);
        const footnoteElement = this.app.ui.elements.passageText.querySelector(`#${footnoteId}`);

        if (footnoteElement) {
            const footnoteSpan = footnoteElement.closest('.footnote');
            if (!footnoteSpan) {
                this.showFootnoteError(verseRef);
                return;
            }

            let footnoteText = '';
            let currentNode = footnoteSpan.nextSibling;

            while (currentNode) {
                if (currentNode.nodeName === 'BR' || (currentNode.nodeType === 1 && currentNode.classList.contains('footnote'))) {
                    break;
                }
                if (currentNode.nodeType === 1 && currentNode.classList.contains('footnote-ref')) {
                    currentNode = currentNode.nextSibling;
                    continue;
                }
                if (currentNode.nodeType === 1 && currentNode.tagName === 'NOTE') {
                    footnoteText += currentNode.textContent.trim();
                    break;
                }
                if (currentNode.nodeType === 3) {
                    footnoteText += currentNode.textContent;
                }
                currentNode = currentNode.nextSibling;
            }

            this.app.ui.elements.footnotesContent.innerHTML = `
                <div class="footnote-item">
                    <div class="footnote-ref-display" style="color: var(--secondary-color); font-size: 0.9em; margin-bottom: 0.5rem; font-weight: 600;">${verseRef}</div>
                    <div class="footnote-text">${footnoteText.trim() || 'Footnote text not found.'}</div>
                </div>
            `;
            this.app.ui.elements.footnotesSection.style.display = 'block';
        } else {
            this.showFootnoteError(verseRef);
        }
    }

    showFootnoteError(verseRef) {
        this.app.ui.elements.footnotesContent.innerHTML = `
            <div class="footnote-item">
                <div class="footnote-ref-display">${verseRef}</div>
                <div class="footnote-text">Footnote not found. Enable "Show footnotes" in settings and reload.</div>
            </div>
        `;
        this.app.ui.elements.footnotesSection.style.display = 'block';
    }

    showFootnoteModal(footnoteNumber, verseRef) {
        const allSups = this.app.ui.elements.passageText.querySelectorAll('sup.footnote');
        let footnoteText = '';

        allSups.forEach((sup) => {
            const link = sup.querySelector('a.fn');
            if (!link) return;
            if (link.textContent.trim() === footnoteNumber) {
                const title = link.getAttribute('title');
                if (title) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = title;
                    const decoded = tempDiv.textContent || tempDiv.innerText || '';
                    const noteMatch = decoded.match(/<note[^>]*>(.*?)<\/note>/s);
                    footnoteText = noteMatch ? noteMatch[1] : decoded;
                    // Preserve tempDiv.innerHTML if needed for italics
                    if (noteMatch) { tempDiv.innerHTML = noteMatch[1]; footnoteText = tempDiv.innerHTML; }
                }
            }
        });

        if (!footnoteText) footnoteText = 'Footnote content not available. Enable "Show footnotes" to view.';

        const ui = this.app.ui.elements;
        ui.footnotesSection.style.display = 'block';
        ui.crossReferencesSection.style.display = 'none';
        ui.footnotesContent.innerHTML = `
            <div class="footnote-item">
                <div class="footnote-ref-display" style="color: var(--secondary-color); font-weight:600">${verseRef} [${footnoteNumber}]</div>
                <div class="footnote-text">${footnoteText}</div>
            </div>
        `;
        this.app.ui.openModal(ui.referencesModal);
    }

    getVerseReferenceForElement(element) {
        let currentElement = element;
        while (currentElement) {
            const verseNum = currentElement.querySelector?.('.verse-num');
            if (verseNum) {
                return `${this.app.state.currentBook} ${this.app.state.currentChapter}:${verseNum.textContent.trim()}`;
            }
            currentElement = currentElement.previousElementSibling;
            if (!currentElement || /^H[23]/.test(currentElement.tagName)) break;
        }

        // Fallback to parent
        const parent = element.closest('p, div');
        if (parent) {
            const verses = parent.querySelectorAll('.verse-num');
            for (let i = verses.length - 1; i >= 0; i--) {
                if (parent.contains(verses[i]) && (verses[i].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    return `${this.app.state.currentBook} ${this.app.state.currentChapter}:${verses[i].textContent.trim()}`;
                }
            }
        }
        return `${this.app.state.currentBook} ${this.app.state.currentChapter}`;
    }
}
