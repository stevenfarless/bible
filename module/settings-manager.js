// ==================== 
// Settings Management
// ==================== 

export class SettingsManager {
  constructor(state, database) {
    this.state = state;
    this.database = database;
  }

  loadLocalSettings() {
    const saved = localStorage.getItem('bibleAppSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      Object.assign(this.state, settings);
    }
  }

  saveLocalSettings() {
    const settings = {
      showVerseNumbers: this.state.showVerseNumbers,
      showHeadings: this.state.showHeadings,
      showFootnotes: this.state.showFootnotes,
      showCrossReferences: this.state.showCrossReferences,
      verseByVerse: this.state.verseByVerse,
      fontSize: this.state.fontSize,
      currentBook: this.state.currentBook,
      currentChapter: this.state.currentChapter,
    };
    localStorage.setItem('bibleAppSettings', JSON.stringify(settings));
  }

  async saveToFirebase(userId) {
    if (!userId || !this.database) return;
    
    const settings = {
      showVerseNumbers: this.state.showVerseNumbers,
      showHeadings: this.state.showHeadings,
      showFootnotes: this.state.showFootnotes,
      showCrossReferences: this.state.showCrossReferences,
      verseByVerse: this.state.verseByVerse,
      fontSize: this.state.fontSize,
    };

    try {
      await window.firebaseDatabase.ref(`users/${userId}/settings`).set(settings);
    } catch (error) {
      console.error('Error saving settings to Firebase:', error);
    }
  }

  applySettings() {
    const passageText = document.getElementById('passageText');
    if (!passageText) return;

    // Apply all settings
    passageText.classList.toggle('hide-verse-numbers', !this.state.showVerseNumbers);
    passageText.classList.toggle('hide-headings', !this.state.showHeadings);
    passageText.classList.toggle('hide-footnotes', !this.state.showFootnotes);
    passageText.classList.toggle('hide-cross-references', !this.state.showCrossReferences);
    passageText.classList.toggle('verse-by-verse', this.state.verseByVerse);
    
    // Apply font size
    passageText.style.fontSize = `${this.state.fontSize}px`;

    // Update toggles in UI
    this.updateToggleStates();
  }

  updateToggleStates() {
    const toggles = {
      verseNumbersToggle: this.state.showVerseNumbers,
      headingsToggle: this.state.showHeadings,
      footnotesToggle: this.state.showFootnotes,
      crossReferencesToggle: this.state.showCrossReferences,
      verseByVerseToggle: this.state.verseByVerse,
    };

    for (const [id, checked] of Object.entries(toggles)) {
      const element = document.getElementById(id);
      if (element) element.checked = checked;
    }

    const fontSizeSlider = document.getElementById('fontSizeSlider');
    if (fontSizeSlider) fontSizeSlider.value = this.state.fontSize;
  }

  toggleSetting(setting) {
    this.state[setting] = !this.state[setting];
    this.applySettings();
    this.saveLocalSettings();
  }

  updateFontSize(size) {
    this.state.fontSize = parseInt(size);
    this.applySettings();
    this.saveLocalSettings();
  }

  toggleVerseByVerse() {
    this.state.verseByVerse = !this.state.verseByVerse;
    this.applySettings();
    this.saveLocalSettings();
  }
}
