// js/modules/references-manager.js

/**
 * References Manager
 * Handles footnotes and cross-references in Bible passages
 */
export class ReferencesManager {
    constructor(app) {
        this.app = app;
        this.eventHandlers = [];
    }

    attachHandlers() {
        if (!this.app.ui || !this.app.ui.passageText) {
            return;
        }

        this.clearHandlers();

        const footnoteMarkers = this.app.ui.passageText.querySelectorAll(
            'sup.footnote a, a.fn'
        );

        footnoteMarkers.forEach((link) => {
            link.style.cursor = 'pointer';
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openFootnoteFromMarker(link);
            };
            link.addEventListener('click', handler);
            this.eventHandlers.push({ element: link, event: 'click', handler });
        });

        const crossrefMarkers = this.app.ui.passageText.querySelectorAll(
            'sup.crossref a'
        );

        crossrefMarkers.forEach((link) => {
            link.style.cursor = 'pointer';
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openCrossRefFromMarker(link);
            };
            link.addEventListener('click', handler);
            this.eventHandlers.push({ element: link, event: 'click', handler });
        });
    }

    makeFootnotesClickable() {
        this.attachHandlers();
    }

    openFootnoteFromMarker(link) {
        if (!link) {
            return;
        }

        const href = link.getAttribute('href');
        if (!href) {
            console.warn('No href found in footnote link');
            return;
        }

        const footnoteId = href.startsWith('#') ? href.substring(1) : href;

        const match = footnoteId.match(/^f(\d+)-/);
        if (!match) {
            console.warn('Could not parse footnote ID:', footnoteId);
            return;
        }

        const footnoteNumber = parseInt(match[1], 10);
        console.log('Looking for footnote number:', footnoteNumber);

        const footnotesSection = this.app.ui.passageText.querySelector('.footnotes, .notes');

        if (!footnotesSection) {
            console.warn('Footnotes section not found');
            const titleContent = link.getAttribute('title');
            if (titleContent) {
                const decodedContent = this.decodeHTMLEntities(titleContent);
                const noteContent = this.extractNoteContent(decodedContent);
                const sanitizedContent = this._sanitizeHtml(noteContent);
                this.showFootnoteModal(sanitizedContent);
                return;
            }
            this.showFootnoteModal('<p>Footnote content not available.</p>');
            return;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = footnotesSection.innerHTML;
        
        const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(h => h.remove());
        
        const paragraph = tempDiv.querySelector('p');
        if (!paragraph) {
            console.warn('No paragraph found in footnotes section');
            this.showFootnoteModal('<p>Footnote content not available.</p>');
            return;
        }

        const htmlContent = paragraph.innerHTML;
        const footnoteEntries = htmlContent.split(/<br\s*\/?>/i).filter(entry => entry.trim());
        
        console.log(`Found ${footnoteEntries.length} footnote entries`);

        const footnoteIndex = footnoteNumber - 1;
        if (footnoteIndex < 0 || footnoteIndex >= footnoteEntries.length) {
            console.warn('Footnote index out of range:', footnoteIndex);
            this.showFootnoteModal('<p>Footnote content not available.</p>');
            return;
        }

        let footnoteContent = footnoteEntries[footnoteIndex].trim();

        footnoteContent = footnoteContent.replace(/<span[^>]*class="footnote"[^>]*>.*?<\/span>/gi, '');
        footnoteContent = footnoteContent.replace(/<span[^>]*class="footnote-ref"[^>]*>.*?<\/span>/gi, '');
        footnoteContent = footnoteContent.trim();

        const temp = document.createElement('div');
        temp.innerHTML = footnoteContent;
        const noteElement = temp.querySelector('note');

        if (noteElement) {
            const noteClass = noteElement.getAttribute('class');
            const noteText = noteElement.innerHTML;
            let label = '';

            if (noteClass === 'translation') {
                label = '<strong>Translation Note:</strong> ';
            } else if (noteClass === 'alternative') {
                label = '<strong>Alternative Reading:</strong> ';
            } else if (noteClass === 'explanation') {
                label = '<strong>Explanation:</strong> ';
            } else if (noteClass === 'variant') {
                label = '<strong>Textual Variant:</strong> ';
            }

            footnoteContent = `<p>${label}${noteText}</p>`;
        } else if (footnoteContent.trim()) {
            footnoteContent = `<p>${footnoteContent}</p>`;
        }

        console.log('Final footnote content:', footnoteContent);

        const sanitizedContent = this._sanitizeHtml(footnoteContent);
        this.showFootnoteModal(sanitizedContent);
    }

    openCrossRefFromMarker(link) {
        if (!link) {
            return;
        }

        const href = link.getAttribute('href');
        if (!href) {
            console.warn('No href found in cross-ref link');
            return;
        }

        const crossrefId = href.startsWith('#') ? href.substring(1) : href;

        const match = crossrefId.match(/^cr(\d+)-/);
        if (!match) {
            console.warn('Could not parse cross-ref ID:', crossrefId);
            return;
        }

        const crossrefNumber = parseInt(match[1], 10);

        const crossrefsSection = this.app.ui.passageText.querySelector('.crossrefs, .cross-references');

        if (!crossrefsSection) {
            this.showCrossRefModal('<p>Cross-reference content not available.</p>');
            return;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = crossrefsSection.innerHTML;
        
        const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(h => h.remove());
        
        const paragraph = tempDiv.querySelector('p');
        if (!paragraph) {
            this.showCrossRefModal('<p>Cross-reference content not available.</p>');
            return;
        }

        const htmlContent = paragraph.innerHTML;
        const crossrefEntries = htmlContent.split(/<br\s*\/?>/i).filter(entry => entry.trim());

        const crossrefIndex = crossrefNumber - 1;
        if (crossrefIndex < 0 || crossrefIndex >= crossrefEntries.length) {
            this.showCrossRefModal('<p>Cross-reference content not available.</p>');
            return;
        }

        let crossrefContent = crossrefEntries[crossrefIndex].trim();

        crossrefContent = crossrefContent.replace(/<span[^>]*class="footnote"[^>]*>.*?<\/span>/gi, '');
        crossrefContent = crossrefContent.replace(/<span[^>]*class="footnote-ref"[^>]*>.*?<\/span>/gi, '');
        
        crossrefContent = crossrefContent.trim();

        if (crossrefContent.trim()) {
            crossrefContent = `<p>${crossrefContent}</p>`;
        }

        const sanitizedContent = this._sanitizeHtml(crossrefContent);
        this.showCrossRefModal(sanitizedContent);
    }

    decodeHTMLEntities(text) {
        if (!text) {
            return '';
        }
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    extractNoteContent(htmlString) {
        if (!htmlString) {
            return '';
        }

        const temp = document.createElement('div');
        temp.innerHTML = htmlString;
        const noteElement = temp.querySelector('note');

        if (!noteElement) {
            return temp.textContent || htmlString;
        }

        let content = noteElement.innerHTML;
        const noteClass = noteElement.getAttribute('class');
        let label = '';

        if (noteClass === 'translation') {
            label = '<strong>Translation Note:</strong> ';
        } else if (noteClass === 'alternative') {
            label = '<strong>Alternative Reading:</strong> ';
        } else if (noteClass === 'explanation') {
            label = '<strong>Explanation:</strong> ';
        }

        return `<p>${label}${content}</p>`;
    }

    showFootnoteModal(content) {
        if (!this.app.ui || !this.app.ui.referencesModal) {
            console.error('References modal not found');
            return;
        }

        if (this.app.ui.footnotesSection) {
            this.app.ui.footnotesSection.style.display = 'block';
        }

        if (this.app.ui.crossReferencesSection) {
            this.app.ui.crossReferencesSection.style.display = 'none';
        }

        if (this.app.ui.footnotesContent) {
            this.app.ui.footnotesContent.innerHTML = content;
        }

        this.app.ui.openModal(this.app.ui.referencesModal);
    }

    showCrossRefModal(content) {
        if (!this.app.ui || !this.app.ui.referencesModal) {
            console.error('References modal not found');
            return;
        }

        if (this.app.ui.crossReferencesSection) {
            this.app.ui.crossReferencesSection.style.display = 'block';
        }

        if (this.app.ui.footnotesSection) {
            this.app.ui.footnotesSection.style.display = 'none';
        }

        if (this.app.ui.crossReferencesContent) {
            this.app.ui.crossReferencesContent.innerHTML = content;
        }

        this.app.ui.openModal(this.app.ui.referencesModal);
    }

    _sanitizeHtml(html) {
        if (!html) {
            return '';
        }

        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['p', 'span', 'br', 'strong', 'em', 'sup', 'sub', 'a', 'div', 'note', 'i', 'b'],
                ALLOWED_ATTR: ['class', 'id', 'href', 'title', 'sub-class'],
            });
        }

        const div = document.createElement('div');
        div.innerHTML = html;

        const dangerousElements = div.querySelectorAll('script, iframe, object, embed, link, style');
        dangerousElements.forEach(el => el.remove());

        const allElements = div.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return div.innerHTML;
    }

    _escapeHtml(text) {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearHandlers() {
        this.eventHandlers.forEach(({ element, event, handler }) => {
            if (element && handler) {
                element.removeEventListener(event, handler);
            }
        });
        this.eventHandlers = [];
    }

    destroy() {
        this.clearHandlers();
    }
}
