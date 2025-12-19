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
    
    // Extract the footnote number from the ID (e.g., "f1-1" -> 1, "f2-1" -> 2)
    const match = footnoteId.match(/^f(\d+)-/);
    if (!match) {
      console.warn('Could not parse footnote ID:', footnoteId);
      return;
    }
    
    const footnoteNumber = parseInt(match[1], 10);
    console.log('Looking for footnote number:', footnoteNumber);
    
    // Find the footnotes section
    const footnotesSection = this.app.ui.passageText.querySelector('.footnotes, .notes');
    
    if (!footnotesSection) {
      console.warn('Footnotes section not found');
      // Fallback to title attribute
      const titleContent = link.getAttribute('title');
      if (titleContent) {
        const decodedContent = this.decodeHTMLEntities(titleContent);
        const noteContent = this.extractNoteContent(decodedContent);
        this.showFootnoteModal(noteContent);
        return;
      }
      this.showFootnoteModal('<p>Footnote content not available.</p>');
      return;
    }
    
    // Split the footnotes section by <br> tags to get individual footnotes
    const footnotesHTML = footnotesSection.innerHTML;
    const footnoteEntries = footnotesHTML.split(/<br\s*\/?>/i);
    
    console.log('Found', footnoteEntries.length, 'footnote entries');
    
    // Get the specific footnote (array is 0-indexed, so subtract 1)
    const footnoteIndex = footnoteNumber - 1;
    
    if (footnoteIndex < 0 || footnoteIndex >= footnoteEntries.length) {
      console.warn('Footnote index out of range:', footnoteIndex);
      this.showFootnoteModal('<p>Footnote content not available.</p>');
      return;
    }
    
    let footnoteContent = footnoteEntries[footnoteIndex].trim();
    
    // Remove the back-reference link and empty spans
    footnoteContent = footnoteContent.replace(/<a[^>]*href="#fb[^"]*"[^>]*>.*?<\/a>/gi, '');
    footnoteContent = footnoteContent.replace(/<span class="footnote"><\/span>\s*/g, '');
    
    // Parse the note to add styling
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
        label = '<strong>Manuscript Variant:</strong> ';
      }
      
      footnoteContent = `<p>${label}${noteText}</p>`;
    } else {
      // If no note element, wrap the content
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
    
    // Similar logic for cross-references
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
    
    const crossrefsHTML = crossrefsSection.innerHTML;
    const crossrefEntries = crossrefsHTML.split(/<br\s*\/?>/i);
    
    const crossrefIndex = crossrefNumber - 1;
    
    if (crossrefIndex < 0 || crossrefIndex >= crossrefEntries.length) {
      this.showCrossRefModal('<p>Cross-reference content not available.</p>');
      return;
    }
    
    let crossrefContent = crossrefEntries[crossrefIndex].trim();
    crossrefContent = crossrefContent.replace(/<a[^>]*href="#cb[^"]*"[^>]*>.*?<\/a>/gi, '');
    crossrefContent = crossrefContent.replace(/<span class="crossref"><\/span>\s*/g, '');
    
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
