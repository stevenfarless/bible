// js/modules/references-manager.js

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    // Handle all footnote markers (links inside sup.footnote)
    const footnoteMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.footnote a, a.fn'
    );

    footnoteMarkers.forEach((link) => {
      link.style.cursor = 'pointer';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openFootnoteFromMarker(link);
      });
    });

    // Handle cross-reference markers
    const crossrefMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.crossref a'
    );

    crossrefMarkers.forEach((link) => {
      link.style.cursor = 'pointer';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openCrossRefFromMarker(link);
      });
    });
  }

  makeFootnotesClickable() {
    // Alias for attachHandlers
    this.attachHandlers();
  }

  openFootnoteFromMarker(link) {
    // Get the href which points to the footnote body at the bottom
    const href = link.getAttribute('href');
    
    if (!href) {
      console.warn('No href found in footnote link');
      return;
    }

    // Remove the # to get the ID
    const footnoteId = href.startsWith('#') ? href.substring(1) : href;
    
    console.log('Looking for footnote with ID:', footnoteId);
    
    // Find the footnote body element (ESV puts these at the bottom of the passage)
    const footnoteBody = document.getElementById(footnoteId);
    
    if (!footnoteBody) {
      console.warn(`Footnote body not found: ${footnoteId}`);
      
      // Fallback: try to get from title attribute
      const titleContent = link.getAttribute('title');
      if (titleContent) {
        console.log('Using title attribute as fallback');
        const decodedContent = this.decodeHTMLEntities(titleContent);
        const noteContent = this.extractNoteContent(decodedContent);
        this.showFootnoteModal(noteContent);
        return;
      }
      
      this.showFootnoteModal('<p>Footnote content not available.</p>');
      return;
    }

    console.log('Found footnote body:', footnoteBody);

    // Get the HTML content of the footnote
    let content = footnoteBody.innerHTML;
    
    // Remove the back-reference link (the arrow that links back to the text)
    content = content.replace(/<a[^>]*href="#fb[^"]*"[^>]*>.*?<\/a>/gi, '');
    
    // Wrap in a paragraph if not already wrapped
    if (!content.trim().startsWith('<p')) {
      content = `<p>${content}</p>`;
    }
    
    console.log('Footnote content:', content);
    
    this.showFootnoteModal(content);
  }

  openCrossRefFromMarker(link) {
    const href = link.getAttribute('href');
    
    if (!href) {
      console.warn('No href found in cross-ref link');
      return;
    }

    const crossrefId = href.startsWith('#') ? href.substring(1) : href;
    const crossrefBody = document.getElementById(crossrefId);
    
    if (!crossrefBody) {
      console.warn(`Cross-reference body not found: ${crossrefId}`);
      this.showCrossRefModal('<p>Cross-reference content not available.</p>');
      return;
    }

    let content = crossrefBody.innerHTML;
    
    // Remove the back-reference link
    content = content.replace(/<a[^>]*href="#cb[^"]*"[^>]*>.*?<\/a>/gi, '');
    
    // Wrap in a paragraph if not already wrapped
    if (!content.trim().startsWith('<p')) {
      content = `<p>${content}</p>`;
    }
    
    this.showCrossRefModal(content);
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

    console.log('Showing footnote modal');

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
      console.log('Set footnote content to:', content);
    }

    // Open modal
    this.app.ui.openModal(this.app.ui.referencesModal);
  }

  showCrossRefModal(content) {
    if (!this.app.ui.referencesModal) {
      console.error('References modal not found');
      return;
    }

    console.log('Showing cross-ref modal');

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
