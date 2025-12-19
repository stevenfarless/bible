// js/modules/references-manager.js

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    // Handle all footnote markers (sup elements with footnote class or links)
    const footnoteMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.footnote, sup.footnote a, a.footnote, a.fn'
    );

    footnoteMarkers.forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openFootnoteFromMarker(el);
      });
    });

    // Handle cross-reference markers
    const crossrefMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.crossref, sup.crossref a, a.crossref'
    );

    crossrefMarkers.forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openCrossRefFromMarker(el);
      });
    });
  }

  makeFootnotesClickable() {
    this.attachHandlers();
  }

  openFootnoteFromMarker(marker) {
    // Get the link element (might be the marker itself or a child)
    let link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    if (!link) {
      console.warn('No link found in footnote marker');
      return;
    }

    // ESV API stores footnote content in the title attribute!
    const titleContent = link.getAttribute('title');
    
    if (!titleContent) {
      console.warn('No title attribute found in footnote link');
      return;
    }

    // The title contains HTML-encoded content like:
    // <note class="alternative">Or <i>from above</i>...</note>
    
    // Decode HTML entities and extract the note content
    const decodedContent = this.decodeHTMLEntities(titleContent);
    
    // Extract the text from the <note> element
    const noteContent = this.extractNoteContent(decodedContent);
    
    // Display in modal
    this.showFootnoteModal(noteContent);
  }

  openCrossRefFromMarker(marker) {
    let link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    if (!link) {
      console.warn('No link found in cross-ref marker');
      return;
    }

    const titleContent = link.getAttribute('title');
    
    if (!titleContent) {
      console.warn('No title attribute found');
      return;
    }

    const decodedContent = this.decodeHTMLEntities(titleContent);
    const noteContent = this.extractNoteContent(decodedContent);
    
    this.showCrossRefModal(noteContent);
  }

  decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  extractNoteContent(htmlString) {
    // Create a temporary element to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = htmlString;
    
    // Get the note element
    const noteElement = temp.querySelector('note');
    
    if (!noteElement) {
      // If no note element, return the text content
      return temp.textContent || htmlString;
    }

    // Get the note's HTML content (preserves formatting like <i> tags)
    let content = noteElement.innerHTML;
    
    // Get the note type for styling
    const noteClass = noteElement.getAttribute('class');
    const subClass = noteElement.getAttribute('sub-class');
    
    // Add a label based on the note type
    let label = '';
    if (noteClass === 'translation') {
      label = '<strong>Translation Note:</strong> ';
    } else if (noteClass === 'alternative') {
      label = '<strong>Alternative Reading:</strong> ';
    } else if (noteClass === 'explanation') {
      label = '<strong>Explanation:</strong> ';
    } else if (noteClass === 'variant') {
      label = '<strong>Manuscript Variant:</strong> ';
    }
    
    return `<p>${label}${content}</p>`;
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
