// ==================== 
// Event Listener Attachments
// ==================== 

import { toggleTheme, updateThemeIcon, changeColorTheme } from './ui.js';

export function attachEventListeners(app) {
  // Header
  app.searchToggleBtn.addEventListener('click', () => app.toggleSearch());
  app.helpBtn.addEventListener('click', () => app.openModal(app.helpModal));
  app.settingsBtn.addEventListener('click', () => app.openModal(app.settingsModal));

  // Search
  app.closeSearchBtn.addEventListener('click', () => app.toggleSearch());
  app.searchInput.addEventListener('input', (e) => app.handleSearch(e.target.value));
  app.searchInput.addEventListener('keydown', (e) => {
    const result = app.searchManager.handleKeydown(
      e, 
      app.searchResults, 
      (el) => el.click()
    );
    if (result === 'close') app.toggleSearch();
  });

  // Navigation
  app.prevChapterBtn.addEventListener('click', () => app.navigateChapter(-1));
  app.nextChapterBtn.addEventListener('click', () => app.navigateChapter(1));
  app.bookSelector.addEventListener('click', () => 
    app.navigationManager.openBookModal(app)
  );
  app.chapterSelector.addEventListener('click', () => 
    app.navigationManager.openChapterModal(app)
  );
  app.verseSelector.addEventListener('click', () => 
    app.navigationManager.openVerseModal(app)
  );

  // Modal close buttons
  app.closeBookModal.addEventListener('click', () => app.closeModal(app.bookModal));
  app.closeChapterModal.addEventListener('click', () => app.closeModal(app.chapterModal));
  app.closeVerseModal.addEventListener('click', () => app.closeModal(app.verseModal));
  app.closeHelpModal.addEventListener('click', () => app.closeModal(app.helpModal));
  app.closeSettingsModal.addEventListener('click', () => app.closeModal(app.settingsModal));
  app.closeReferencesModal.addEventListener('click', () => app.closeModal(app.referencesModal));
  app.closeLoginModal.addEventListener('click', () => app.closeModal(app.loginModal));
  app.closeSignupModal.addEventListener('click', () => app.closeModal(app.signupModal));
  app.closeUserMenuModal.addEventListener('click', () => app.closeModal(app.userMenuModal));

  // Settings
  app.saveApiKeyBtn?.addEventListener('click', () => app.saveApiKey());
  app.verseNumbersToggle.addEventListener('change', () => 
    app.settingsManager.toggleSetting('showVerseNumbers')
  );
  app.headingsToggle.addEventListener('change', () => 
    app.settingsManager.toggleSetting('showHeadings')
  );
  app.footnotesToggle.addEventListener('change', () => 
    app.settingsManager.toggleSetting('showFootnotes')
  );
  
  const crossReferencesToggle = document.getElementById('crossReferencesToggle');
  if (crossReferencesToggle) {
    crossReferencesToggle.addEventListener('change', () => 
      app.settingsManager.toggleSetting('showCrossReferences')
    );
  }

  app.verseByVerseToggle.addEventListener('change', () => 
    app.settingsManager.toggleVerseByVerse()
  );
  app.fontSizeSlider.addEventListener('input', (e) => 
    app.settingsManager.updateFontSize(e.target.value)
  );

  // Theme
  app.themeToggleBtn.addEventListener('click', () => toggleTheme(app));
  
  const themeSelector = document.getElementById('themeSelector');
  const lightModeToggle = document.getElementById('lightModeToggle');
  
  if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
      changeColorTheme(app, e.target.value);
    });
  }
  
  if (lightModeToggle) {
    lightModeToggle.addEventListener('change', () => {
      toggleTheme(app);
    });
  }

  // User button
  app.userBtn.addEventListener('click', () => app.handleUserButtonClick());

  // Auth modal switching
  document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    app.closeModal(app.loginModal);
    app.openModal(app.signupModal);
  });

  document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    app.closeModal(app.signupModal);
    app.openModal(app.loginModal);
  });

  // Auth form submissions
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const result = await app.authManager.handleLogin(email, password);
    if (result.success) {
      app.closeModal(app.loginModal);
    } else {
      alert(result.error);
    }
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const result = await app.authManager.handleSignup(email, password);
    if (result.success) {
      app.closeModal(app.signupModal);
    } else {
      alert(result.error);
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await app.authManager.handleLogout();
    app.closeModal(app.userMenuModal);
  });

  // Scroll tracking + auto-hide chrome
  window.addEventListener('scroll', () => {
    app.chromeController.handleScroll(app.searchContainer);
    
    clearTimeout(app.scrollTimeout);
    app.scrollTimeout = setTimeout(() => {
      if (app.saveReadingPosition) {
        app.saveReadingPosition();
      }
    }, 500);
  }, { passive: true });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (app.handleKeyboardShortcuts) {
      app.handleKeyboardShortcuts(e);
    }
  });
}
