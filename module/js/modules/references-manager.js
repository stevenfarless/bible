// js/modules/references-manager.js

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    console.log('🔍 Attaching footnote handlers...');

    // Handle all footnote markers (sup elements with footnote class or links)
    const footnoteMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.footnote, sup.footnote a, a.footnote, sup[class*="footnote"]'
    );
    
    console.log(`Found ${footnoteMarkers.length} footnote markers`);

    footnoteMarkers.forEach((el, index) => {
      console.log(`Footnote ${index}:`, el.outerHTML);
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📝 Footnote clicked:', el);
        this.openFootnoteFromMarker(el);
      });
    });

    // Handle cross-reference markers
    const crossrefMarkers = this.app.ui.passageText.querySelectorAll(
      'sup.crossref, sup.crossref a, a.crossref, sup[class*="crossref"]'
    );
    
    console.log(`Found ${crossrefMarkers.length} cross-reference markers`);

    crossrefMarkers.forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📖 Cross-ref clicked:', el);
        this.openCrossRefFromMarker(el);
      });
    });

    // Also log all elements with IDs that might be footnotes
    const allFootnoteElements = this.app.ui.passageText.querySelectorAll('[id^="f"]');
    console.log(`Found ${allFootnoteElements.length} potential footnote content elements:`, allFootnoteElements);
  }

  makeFootnotesClickable() {
    this.attachHandlers();
  }

  openFootnoteFromMarker(marker) {
    console.log('🔎 Opening footnote from marker:', marker);

    // Get the link element (might be the marker itself or a child)
    let link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    // If still no link, check if this element has a data attribute
    if (!link && marker.hasAttribute('data-note-id')) {
      const noteId = marker.getAttribute('data-note-id');
      console.log('Found note ID from data attribute:', noteId);
      this.openFootnoteById(noteId);
      return;
    }

    if (!link) {
      console.warn('❌ No link found in footnote marker, trying parent');
      // Try parent element
      link = marker.parentElement;
      if (link && link.tagName !== 'A') {
        console.error('❌ Could not find link element');
        return;
      }
    }

    // Get the href (footnote ID)
    const href = link.getAttribute('href');
    if (!href) {
      console.warn('❌ No href found in footnote link');
      return;
    }

    console.log('✅ Found href:', href);

    // Extract ID
    const footnoteId = href.startsWith('#') ? href.substring(1) : href;
    this.openFootnoteById(footnoteId);
  }

  openFootnoteById(footnoteId) {
    console.log(`🔍 Looking for footnote with ID: ${footnoteId}`);

    // Try multiple strategies to find the footnote content
    let footnoteElement = null;

    // Strategy 1: Direct ID match
    footnoteElement = document.getElementById(footnoteId);
    if (footnoteElement) {
      console.log('✅ Found footnote by ID:', footnoteElement);
    }

    // Strategy 2: Look within passage text
    if (!footnoteElement) {
      footnoteElement = this.app.ui.passageText.querySelector(`#${footnoteId}`);
      if (footnoteElement) {
        console.log('✅ Found footnote in passage text:', footnoteElement);
      }
    }

    // Strategy 3: Look for data-id attribute
    if (!footnoteElement) {
      footnoteElement = this.app.ui.passageText.querySelector(`[data-id="${footnoteId}"]`);
      if (footnoteElement) {
        console.log('✅ Found footnote by data-id:', footnoteElement);
      }
    }

    // Strategy 4: Look for .footnote-content class with matching ID
    if (!footnoteElement) {
      footnoteElement = this.app.ui.passageText.querySelector(`.footnote-content[id="${footnoteId}"]`);
      if (footnoteElement) {
        console.log('✅ Found footnote by .footnote-content:', footnoteElement);
      }
    }

    if (!footnoteElement) {
      console.error(`❌ Footnote element not found: ${footnoteId}`);
      console.log('All elements in passage:', this.app.ui.passageText.innerHTML);
      this.showFootnoteModal('<p>Footnote content not available.</p>');
      return;
    }

    // Extract footnote content
    let footnoteContent = footnoteElement.innerHTML;
    console.log('📄 Footnote content:', footnoteContent);

    // If the footnote element is a paragraph, get its content
    if (footnoteElement.tagName === 'P' || footnoteElement.tagName === 'DIV') {
      footnoteContent = footnoteElement.innerHTML;
    }

    // Clean up the content (remove back-reference links)
    footnoteContent = footnoteContent.replace(/<a[^>]*class="[^"]*backref[^"]*"[^>]*>.*?<\/a>/gi, '');

    // Display in modal
    this.showFootnoteModal(footnoteContent);
  }

  openCrossRefFromMarker(marker) {
    console.log('🔎 Opening cross-ref from marker:', marker);

    // Similar logic to footnotes
    let link = marker.tagName === 'A' ? marker : marker.querySelector('a');
    
    if (!link) {
      console.error('❌ No link found in cross-ref marker');
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      console.warn('❌ No href found in cross-ref link');
      return;
    }

    const crossrefId = href.startsWith('#') ? href.substring(1) : href;
    const crossrefElement = document.getElementById(crossrefId) || 
                           this.app.ui.passageText.querySelector(`#${crossrefId}`);

    if (!crossrefElement) {
      console.warn(`❌ Cross-reference element not found: ${crossrefId}`);
      this.showCrossRefModal('<p>Cross-reference content not available.</p>');
      return;
    }

    let crossrefContent = crossrefElement.innerHTML;
    crossrefContent = crossrefContent.replace(/<a[^>]*class="[^"]*backref[^"]*"[^>]*>.*?<\/a>/gi, '');

    this.showCrossRefModal(crossrefContent);
  }

  showFootnoteModal(content) {
    if (!this.app.ui.referencesModal) {
      console.error('❌ References modal not found');
      return;
    }

    console.log('📖 Showing footnote modal with content:', content);

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
      console.error('❌ References modal not found');
      return;
    }

    console.log('📖 Showing cross-ref modal with content:', content);

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
