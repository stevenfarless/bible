// ==================== 
// Passage Rendering
// ==================== 

export class PassageRenderer {
  constructor(bibleApi, state) {
    this.bibleApi = bibleApi;
    this.state = state;
    this.originalPassageHtml = null;
  }

  async loadPassage(book, chapter, app, restoreScroll = false) {
    // Save reading position before loading new passage
    if (!restoreScroll && app.saveReadingPosition) {
      app.saveReadingPosition();
    }

    // Update state
    this.state.currentBook = book;
    this.state.currentChapter = chapter;
    
    if (app.navigationManager) {
      app.navigationManager.updateNavigationState(app);
    }

    // Build reference string
    const reference = `${book} ${chapter}`;

    // Show loading state
    if (app.passageText) {
      app.passageText.innerHTML = 'Loading passage...';
    }

    // Fetch passage from API
    const data = await this.bibleApi.fetchPassage(reference);
    
    if (!data) {
      if (app.chromeController) {
        app.chromeController.resumeAutoHide();
      }
      return;
    }

    // Update UI with passage content
    if (app.passageTitle) {
      app.passageTitle.textContent = reference;
    }
    
    if (app.passageText) {
      app.passageText.innerHTML = data.passages[0];
    }

    // Cache original HTML for highlight logic
    this.originalPassageHtml = data.passages[0];

    // Attach click handlers
    if (app.attachFootnoteHandlers) {
      app.attachFootnoteHandlers();
    }
    
    if (app.makeFootnotesClickable) {
      app.makeFootnotesClickable();
    }

    // Update copyright
    if (app.copyright) {
      app.copyright.textContent = 
        'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
        'copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. ' +
        'Used by permission. All rights reserved.';
    }

    // Reset verse selector
    if (app.currentVerseSpan) {
      app.currentVerseSpan.textContent = '1';
    }

    // Handle chrome auto-hide during scroll
    if (app.chromeController) {
      app.chromeController.suspendAutoHide();
    }

    // Handle scroll position
    if (restoreScroll && app.lastScrollPosition) {
      window.scrollTo(0, app.lastScrollPosition);
    } else {
      window.scrollTo(0, 0);
    }

    // Re-enable chrome logic after scroll
    requestAnimationFrame(() => {
      if (app.chromeController) {
        app.chromeController.resumeAutoHide();
      }
    });

    // Save reading position after loading
    if (app.saveReadingPosition) {
      app.saveReadingPosition();
    }
  }

  stripHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
}
