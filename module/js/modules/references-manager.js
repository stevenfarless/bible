// js/modules/references-manager.js
// Responsibility: footnote + cross-reference modal wiring

export class ReferencesManager {
  constructor(app) {
    this.app = app;
  }

  attachHandlers() {
    if (!this.app.ui.passageText) return;

    // Footnote markers
    this.app.ui.passageText
      .querySelectorAll('.footnote, .footnote-marker')
      .forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.openFootnote(el);
        });
      });

    // Cross-reference markers
    this.app.ui.passageText
      .querySelectorAll('.crossref, .cross-ref-marker')
      .forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.openCrossRefs(el);
        });
      });
  }

  makeFootnotesClickable() {
    // Some ESV HTML marks footnote markers with <sup> or <a> elements
    this.attachHandlers();
  }

  openFootnote(el) {
    const id = el.getAttribute('data-note-id') || el.getAttribute('href') || '';
    if (!id) return;

    const noteEl =
      this.app.ui.passageText.querySelector(id.startsWith('#') ? id : `#${id}`) ||
      this.app.ui.passageText.querySelector(`.footnote-content[data-id="${id}"]`);

    if (!noteEl) return;

    this.app.ui.footnotesSection.style.display = 'block';
    this.app.ui.crossReferencesSection.style.display = 'none';
    this.app.ui.footnotesContent.innerHTML = noteEl.innerHTML;

    this.app.ui.openModal(this.app.ui.referencesModal);
  }

  openCrossRefs(el) {
    const id =
      el.getAttribute('data-crossref-id') ||
      el.getAttribute('href') ||
      el.getAttribute('data-note-id') ||
      '';
    if (!id) return;

    const refEl =
      this.app.ui.passageText.querySelector(id.startsWith('#') ? id : `#${id}`) ||
      this.app.ui.passageText.querySelector(
        `.crossref-content[data-id="${id}"]`
      );

    if (!refEl) return;

    this.app.ui.crossReferencesSection.style.display = 'block';
    this.app.ui.footnotesSection.style.display = 'none';
    this.app.ui.crossReferencesContent.innerHTML = refEl.innerHTML;

    this.app.ui.openModal(this.app.ui.referencesModal);
  }
}
