// js/modules/reading-state.js

import { getAllBooks, getChapterCount } from './bible-structure.js';

export function initializeState() {
  return {
    currentBook: 'John',
    currentChapter: 3,
    selectedVerse: null,
    fontSize: 18,
    showVerseNumbers: true,
    showHeadings: true,
    showFootnotes: false,
    showCrossReferences: false,
    showRedLetters: false,
    verseByVerse: false,
    colorTheme: 'dracula',
    lightMode: false,
  };
}

export function navigateChapter(app, direction) {
  const books = getAllBooks();
  const currentBookIndex = books.indexOf(app.state.currentBook);
  const currentChapter = app.state.currentChapter;
  const maxChapter = getChapterCount(app.state.currentBook);

  if (direction === 1) {
    // Next chapter
    if (currentChapter < maxChapter) {
      app.state.selectedVerse = null;
      app.loadPassage(app.state.currentBook, currentChapter + 1);
    } else if (currentBookIndex < books.length - 1) {
      const nextBook = books[currentBookIndex + 1];
      app.state.selectedVerse = null;
      app.loadPassage(nextBook, 1);
    }
  } else if (direction === -1) {
    // Previous chapter
    if (currentChapter > 1) {
      app.state.selectedVerse = null;
      app.loadPassage(app.state.currentBook, currentChapter - 1);
    } else if (currentBookIndex > 0) {
      const prevBook = books[currentBookIndex - 1];
      const prevBookMaxChapter = getChapterCount(prevBook);
      app.state.selectedVerse = null;
      app.loadPassage(prevBook, prevBookMaxChapter);
    }
  }
}

export function scrollToVerse(app, verseNumber) {
  app.state.selectedVerse = verseNumber;
  if (app.ui.currentVerseSpan) {
    app.ui.currentVerseSpan.textContent = verseNumber;
  }
  applyVerseGlow(app);
}

// Fixed glow for poetry-format verses
export function applyVerseGlow(app) {
  // Restore original HTML first
  if (!app.originalPassageHtml) return;
  
  app.ui.passageText.innerHTML = app.originalPassageHtml;

  if (app.state.selectedVerse === null) return;

  // Special handling for verse 1
  if (app.state.selectedVerse === 1) {
    const firstParagraph = app.ui.passageText.querySelector('p');
    if (firstParagraph) {
      // Find verse 2 to split verse 1 precisely
      const verse2 = firstParagraph.querySelector('.verse-num');
      if (verse2) {
        const verse1Block = document.createElement('div');
        verse1Block.classList.add('selected-verse-glow');

        let foundVerse2 = false;
        const nodes = Array.from(firstParagraph.childNodes);
        nodes.forEach((node) => {
          if (node === verse2) {
            foundVerse2 = true;
            return;
          }
          if (!foundVerse2) {
            verse1Block.appendChild(node.cloneNode(true));
          }
        });

        firstParagraph.parentNode.insertBefore(verse1Block, firstParagraph);
        firstParagraph.style.display = 'none'; // Hide original temporarily
      } else {
        firstParagraph.classList.add('selected-verse-glow');
      }

      firstParagraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Find the verse number element
  const verseNums = app.ui.passageText.querySelectorAll('.verse-num');
  let targetVerseNum = null;

  for (const vn of verseNums) {
    if (vn.textContent.trim() === app.state.selectedVerse.toString()) {
      targetVerseNum = vn;
      break;
    }
  }

  if (!targetVerseNum) return;

  // Check if this is a poetry line-group verse
  const parentParagraph = targetVerseNum.closest('p');
  if (!parentParagraph) return;

  const lineSpans = parentParagraph.querySelectorAll('span.line, span.indent.line');

  // POETRY MODE: If we have line spans, this is poetry
  if (lineSpans.length > 0) {
    // Find which line contains our verse number
    let verseLineSpan = null;
    for (const span of lineSpans) {
      if (span.contains(targetVerseNum)) {
        verseLineSpan = span;
        break;
      }
    }

    if (!verseLineSpan) return;

    // Get the id attribute from the verse's line span
    const verseId = verseLineSpan.id;
    if (!verseId) return;

    // Collect all line spans with the same id (they belong to this verse)
    const verseLines = [];
    for (const span of lineSpans) {
      if (span.id === verseId) {
        verseLines.push(span);
      }
    }

    if (verseLines.length === 0) return;

    // Create a wrapper div for the glow
    const glowWrapper = document.createElement('div');
    glowWrapper.classList.add('selected-verse-glow');

    // Clone all verse lines into the glow wrapper
    verseLines.forEach((line, index) => {
      const clonedLine = line.cloneNode(true);
      glowWrapper.appendChild(clonedLine);
      if (index < verseLines.length - 1) {
        glowWrapper.appendChild(document.createElement('br'));
      }
    });

    // Insert the glow wrapper before the first line
    verseLines[0].parentNode.insertBefore(glowWrapper, verseLines[0]);

    // Hide the original lines AND their br tags
    verseLines.forEach((line) => {
      line.style.display = 'none';
      // Also hide the br tag that follows this span
      const nextSibling = line.nextSibling;
      if (nextSibling && nextSibling.nodeName === 'BR') {
        nextSibling.style.display = 'none';
      }
    });

    glowWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // PROSE MODE: Use the original paragraph-splitting logic
  const beforeP = document.createElement('p');
  const selectedBlock = document.createElement('div');
  const afterP = document.createElement('p');
  selectedBlock.classList.add('selected-verse-glow');

  let mode = 'before';
  const nodes = Array.from(parentParagraph.childNodes);

  nodes.forEach((node) => {
    if (node === targetVerseNum) {
      mode = 'selected';
      selectedBlock.appendChild(node);
      return;
    }

    if (mode === 'selected') {
      // Check if we hit the next verse number
      if (node.nodeType === 1 && node.classList.contains('verse-num')) {
        mode = 'after';
        afterP.appendChild(node);
        return;
      }
    }

    if (mode === 'before') {
      beforeP.appendChild(node);
    } else if (mode === 'selected') {
      selectedBlock.appendChild(node);
    } else {
      afterP.appendChild(node);
    }
  });

  const parent = parentParagraph.parentNode;
  if (beforeP.childNodes.length > 0) {
    parent.insertBefore(beforeP, parentParagraph);
  }
  parent.insertBefore(selectedBlock, parentParagraph);
  if (afterP.childNodes.length > 0) {
    parent.insertBefore(afterP, parentParagraph);
  }
  parent.removeChild(parentParagraph);

  selectedBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
