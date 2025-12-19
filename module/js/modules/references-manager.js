// js/modules/references-manager.js

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    // Handle all footnote markers (sup elements with footnote class or links)
    this.app.ui.passageText
      .querySelectorAll('sup.footnote, sup.footnote a, a.footnote')
      .forEach((el) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openFootnoteFromMarker(el);
        });
      });

    // Handle cross-reference markers
    this.app.ui.passageText
      .querySelectorAll('sup.crossref, sup.crossref a, a.crossref')
      .forEach((el) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openCrossRefFromMarker(el);
        });
      });
  }

  makeFootnotesClickable() {
    // Alias for attachHandlers
    this.attachHandlers();
  }

  openFootnoteFromMarker(marker) {
    // Get the link element (might be the marker itself or a child)
    const link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    if (!link) {
      console.warn('No link found in footnote marker');
      return;
    }

    // Get the href (footnote ID)
    const href = link.getAttribute('href');
    if (!href) {
      console.warn('No href found in footnote link');
      return;
    }

    // Find the footnote content by ID
    const footnoteId = href.startsWith('#') ? href.substring(1) : href;
    const footnoteElement = document.getElementById(footnoteId);

    if (!footnoteElement) {
      console.warn(`Footnote element not found: ${footnoteId}`);
      return;
    }

    // Extract footnote content
    let footnoteContent = footnoteElement.innerHTML;

    // If the footnote element is a paragraph, get its content
    if (footnoteElement.tagName === 'P') {
      footnoteContent = footnoteElement.innerHTML;
    }

    // Clean up the content (remove back-reference links)
    footnoteContent = footnoteContent.replace(/<a[^>]*class="[^"]*backref[^"]*"[^>]*>.*?<\/a>/gi, '');

    // Display in modal
    this.showFootnoteModal(footnoteContent);
  }

  openCrossRefFromMarker(marker) {
    // Get the link element
    const link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    if (!link) {
      console.warn('No link found in cross-ref marker');
      return;
    }

    // Get the href (cross-ref ID)
    const href = link.getAttribute('href');
    if (!href) {
      console.warn('No href found in cross-ref link');
      return;
    }

    // Find the cross-ref content by ID
    const crossrefId = href.startsWith('#') ? href.substring(1) : href;
    const crossrefElement = document.getElementById(crossrefId);

    if (!crossrefElement) {
      console.warn(`Cross-reference element not found: ${crossrefId}`);
      return;
    }

    // Extract cross-ref content
    let crossrefContent = crossrefElement.innerHTML;

    // Clean up the content
    crossrefContent = crossrefContent.replace(/<a[^>]*class="[^"]*backref[^"]*"[^>]*>.*?<\/a>/gi, '');

    // Display in modal
    this.showCrossRefModal(crossrefContent);
  }

  showFootnoteModal(content) {
    if (!this.app.ui.referencesModal) {
      console.error('References modal not found');
      return;
    }

    // Show footnotes section, hide cross-references
    if (this.app.ui.footnotesSection) {
      this.app.ui.footnotesSection.style.display = 'block';
    }
    if (this.app.ui.crossReferencesSection) {
      this.app.ui.crossReferencesSection.style.display = 'none';
    }

    // Set content
    if (this.app.ui.footnotesContent) {
      this.app.ui.footnotesContent.innerHTML = content;
    }

    // Open modal
    this.app.ui.openModal(this.app.ui.referencesModal);
  }

  showCrossRefModal(content) {
    if (!this.app.ui.referencesModal) {
      console.error('References modal not found');
      return;
    }

    // Show cross-references section, hide footnotes
    if (this.app.ui.crossReferencesSection) {
      this.app.ui.crossReferencesSection.style.display = 'block';
    }
    if (this.app.ui.footnotesSection) {
      this.app.ui.footnotesSection.style.display = 'none';
    }

    // Set content
    if (this.app.ui.crossReferencesContent) {
      this.app.ui.crossReferencesContent.innerHTML = content;
    }

    // Open modal
    this.app.ui.openModal(this.app.ui.referencesModal);
  }
}
