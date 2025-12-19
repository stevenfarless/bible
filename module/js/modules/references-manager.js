// js/modules/references-manager.js

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    // Handle all footnote markers
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
    this.attachHandlers();
  }

  openFootnoteFromMarker(link) {
    const href = link.getAttribute('href');
    
    if (!href) {
      console.warn('No href found in footnote link');
      return;
    }

    const footnoteId = href.startsWith('#') ? href.substring(1) : href;
    
    console.log('Looking for footnote with ID:', footnoteId);
    
    // Strategy 1: Look for a paragraph or div containing the footnote ID
    let footnoteContent = null;
    
    // Try finding parent paragraph/div of the element with this ID
    const footnoteElement = document.getElementById(footnoteId);
    if (footnoteElement) {
      console.log('Found element with ID:', footnoteElement);
      
      // Check if parent has the actual content
      const parent = footnoteElement.parentElement;
      console.log('Parent element:', parent);
      
      if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        footnoteContent = parent.innerHTML;
        // Remove the back-reference link
        footnoteContent = footnoteContent.replace(/<a[^>]*href="#fb[^"]*"[^>]*>.*?<\/a>/gi, '');
      }
    }
    
    // Strategy 2: Look for footnotes section
    if (!footnoteContent) {
      const footnotesSection = this.app.ui.passageText.querySelector('.footnotes, .notes');
      console.log('Footnotes section:', footnotesSection);
      
      if (footnotesSection) {
        // Look for the specific footnote within the section
        const footnoteItem = footnotesSection.querySelector(`#${footnoteId}`)?.closest('p, li, div');
        if (footnoteItem) {
          footnoteContent = footnoteItem.innerHTML;
          footnoteContent = footnoteContent.replace(/<a[^>]*href="#fb[^"]*"[^>]*>.*?<\/a>/gi, '');
        }
      }
    }
    
    // Strategy 3: Fallback to title attribute
    if (!footnoteContent) {
      console.log('Trying title attribute fallback');
      const titleContent = link.getAttribute('title');
      if (titleContent) {
        const decodedContent = this.decodeHTMLEntities(titleContent);
        const noteContent = this.extractNoteContent(decodedContent);
        this.showFootnoteModal(noteContent);
        return;
      }
    }
    
    if (!footnoteContent || footnoteContent.trim() === '') {
      console.error('Could not find footnote content');
      this.showFootnoteModal('<p>Footnote content not available.</p>');
      return;
    }
    
    // Wrap in paragraph if needed
    if (!footnoteContent.trim().startsWith('<p')) {
      footnoteContent = `<p>${footnoteContent}</p>`;
    }
    
    console.log('Final footnote content:', footnoteContent);
    
    this.showFootnoteModal(footnoteContent);
  }

  openCrossRefFromMarker(link) {
    const href = link.getAttribute('href');
    
    if (!href) {
      console.warn('No href found in cross-ref link');
      return;
    }

    const crossrefId = href.startsWith('#') ? href.substring(1) : href;
    
    // Try to find parent element
    const crossrefElement = document.getElementById(crossrefId);
    let crossrefContent = null;
    
    if (crossrefElement) {
      const parent = crossrefElement.parentElement;
      if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        crossrefContent = parent.innerHTML;
        crossrefContent = crossrefContent.replace(/<a[^>]*href="#cb[^"]*"[^>]*>.*?<\/a>/gi, '');
      }
    }
    
    if (!crossrefContent || crossrefContent.trim() === '') {
      this.showCrossRefModal('<p>Cross-reference content not available.</p>');
      return;
    }
    
    if (!crossrefContent.trim().startsWith('<p')) {
      crossrefContent = `<p>${crossrefContent}</p>`;
    }
    
    this.showCrossRefModal(crossrefContent);
  }

  decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  extractNoteContent(htmlString) {
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
    if (!this.app.ui.referencesModal) {
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
}
