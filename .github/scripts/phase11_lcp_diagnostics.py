from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        """    _dbgUserAction(msg) {
        _logUserAction(msg);
    }

    _firebaseModuleUrl() {
""",
        """    _dbgUserAction(msg) {
        _logUserAction(msg);
    }

    _recordPassagePaintDiagnostics(source) {
        const dbg = this._dbg;
        if (!dbg) return;

        dbg.passageRenderSource = source;
        dbg.fontsStatusAtPassageReady = document.fonts?.status ?? 'unsupported';

        const firstParagraph = () => this.passageText?.querySelector('.passage-para');
        const recordParagraph = (label) => {
            const para = firstParagraph();
            if (!para) return;

            if (!dbg.t_first_para_found) dbg.t_first_para_found = ms();

            const rect = para.getBoundingClientRect();
            dbg[`firstParaRect_${label}`] = `${Math.round(rect.width)}x${Math.round(rect.height)} @ ${Math.round(rect.top)}`;
            if (!dbg.t_first_para_sized && rect.width > 0 && rect.height > 0) {
                dbg.t_first_para_sized = ms();
            }
        };

        recordParagraph('immediate');

        requestAnimationFrame(() => {
            dbg.t_passage_next_frame = ms();
            recordParagraph('nextFrame');
            requestAnimationFrame(() => {
                dbg.t_passage_second_frame = ms();
                recordParagraph('secondFrame');
                this._dbgEvent(`passage paint diagnostics (${source}): first paragraph ${dbg.firstParaRect_secondFrame ?? 'not found'}`);
            });
        });

        if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
                dbg.t_fonts_ready = ms();
                dbg.fontsStatusAfterReady = document.fonts.status;
                recordParagraph('fontsReady');
                this._dbgEvent(`fonts ready after passage render (${source})`);
            }).catch((err) => {
                this._dbgEvent(`fonts ready failed (${source}) — ${err?.message || err}`);
            });
        }
    }

    _firebaseModuleUrl() {
""",
    ),
    (
        """            if (this.passageTitle) this.passageTitle.textContent = title || '';
            if (this.passageText) {
                this.passageText.innerHTML = html;
                this.originalPassageHtml   = html;
                this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
            }
            document.body.classList.add('passage-ready');
            updateNavigationState(this);
""",
        """            if (this.passageTitle) this.passageTitle.textContent = title || '';
            if (this.passageText) {
                this.passageText.innerHTML = html;
                this._dbg.t_passage_html_inserted = ms();
                this.originalPassageHtml   = html;
                this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
            }
            document.body.classList.add('passage-ready');
            this._dbg.t_passage_ready_added = ms();
            this._recordPassagePaintDiagnostics('cache restore');
            updateNavigationState(this);
""",
    ),
    (
        """        this.passageTitle.textContent = title;
        this.passageText.innerHTML = data.passages[0];
        this.originalPassageHtml   = this.passageText.innerHTML;
        this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
        document.body.classList.add('passage-ready');

        this.updateCopyright();
""",
        """        this.passageTitle.textContent = title;
        this.passageText.innerHTML = data.passages[0];
        this._dbg.t_passage_html_inserted = ms();
        this.originalPassageHtml   = this.passageText.innerHTML;
        this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
        document.body.classList.add('passage-ready');
        this._dbg.t_passage_ready_added = ms();
        this._recordPassagePaintDiagnostics('loadPassage');

        this.updateCopyright();
""",
    ),
    (
        """        `  passageFetchEnd:      ${ts(dbg.t_passage_fetch_end)}  (${dbg.passageFetchMs != null ? dbg.passageFetchMs + 'ms' : 'n/a'})`,
        `  revealApp (2nd):      ${ts(dbg.t_reveal_second)}`,
""",
        """        `  passageFetchEnd:      ${ts(dbg.t_passage_fetch_end)}  (${dbg.passageFetchMs != null ? dbg.passageFetchMs + 'ms' : 'n/a'})`,
        `  passageHtmlInserted: ${ts(dbg.t_passage_html_inserted)}`,
        `  passageReadyClass:   ${ts(dbg.t_passage_ready_added)}`,
        `  firstParaFound:      ${ts(dbg.t_first_para_found)}`,
        `  firstParaSized:      ${ts(dbg.t_first_para_sized)}`,
        `  passageNextFrame:    ${ts(dbg.t_passage_next_frame)}`,
        `  passageSecondFrame:  ${ts(dbg.t_passage_second_frame)}`,
        `  fontsReady:          ${ts(dbg.t_fonts_ready)}`,
        `  revealApp (2nd):      ${ts(dbg.t_reveal_second)}`,
""",
    ),
    (
        """        '=== active font ===',
        `  localStorage font: ${storedFont}`,
        `  computed (passage): ${computedFont}`,
        `  computed (body): ${bodyFont}`,
""",
        """        '=== LCP diagnostics ===',
        `  passage render source: ${dbg.passageRenderSource ?? 'n/a'}`,
        `  fonts status at passage ready: ${dbg.fontsStatusAtPassageReady ?? 'n/a'}`,
        `  fonts status after ready: ${dbg.fontsStatusAfterReady ?? 'n/a'}`,
        `  first paragraph immediate: ${dbg.firstParaRect_immediate ?? 'n/a'}`,
        `  first paragraph next frame: ${dbg.firstParaRect_nextFrame ?? 'n/a'}`,
        `  first paragraph second frame: ${dbg.firstParaRect_secondFrame ?? 'n/a'}`,
        `  first paragraph fonts ready: ${dbg.firstParaRect_fontsReady ?? 'n/a'}`,
        '',
        '=== active font ===',
        `  localStorage font: ${storedFont}`,
        `  computed (passage): ${computedFont}`,
        `  computed (body): ${bodyFont}`,
""",
    ),
]

for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('Expected Phase 11 replacement anchor was not found.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
