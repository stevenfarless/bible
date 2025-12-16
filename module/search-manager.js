// ==================== 
// Search Functionality
// ==================== 

export class SearchManager {
  constructor(bibleApi, passageRenderer) {
    this.bibleApi = bibleApi;
    this.passageRenderer = passageRenderer;
    
    this.timeout = null;
    this.selectedIndex = -1;
    this.resultItems = null;
    this.page = 1;
    this.lastQuery = '';
    this.hasMore = false;
    this.currentResults = [];
    this.expandedTestaments = new Set();
    this.expandedBooks = new Set();
  }

  isPassageReference(query) {
    const patterns = [
      /^[1-3]?\s*[a-z]+\s+\d+/i,
      /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
    ];
    return patterns.some((pattern) => pattern.test(query.trim()));
  }

  handleSearch(query, searchResultsElement, callback) {
    clearTimeout(this.timeout);
    this.lastQuery = query;
    this.page = 1;
    this.currentResults = [];

    if (!query.trim()) {
      searchResultsElement.innerHTML = '';
      this.selectedIndex = -1;
      this.resultItems = null;
      return;
    }

    this.timeout = setTimeout(async () => {
      if (this.isPassageReference(query)) {
        await this.handlePassageReference(query, searchResultsElement, callback);
      } else {
        this.page = 1;
        await this.performKeywordSearch(query, false, searchResultsElement);
      }
    }, 300);
  }

  async handlePassageReference(reference, searchResultsElement, callback) {
    const data = await this.bibleApi.fetchPassage(reference);
    if (data && data.passages && data.passages.length > 0) {
      const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
      const preview = this.stripHTML(data.passages[0]).substring(0, 200);
      
      searchResultsElement.innerHTML = `
        <div class="search-result-item" data-reference="${safeCanonical}">
          <div class="search-result-reference">${safeCanonical}</div>
          <div class="search-result-text">${preview}...</div>
        </div>
      `;

      const item = searchResultsElement.querySelector('.search-result-item');
      if (item && callback) {
        item.addEventListener('click', () => callback(safeCanonical));
      }

      this.refreshResultItems(searchResultsElement, true);
    } else {
      searchResultsElement.innerHTML = '<div class="no-results">No results found</div>';
      this.resultItems = null;
      this.selectedIndex = -1;
    }
  }

  async performKeywordSearch(query, append, searchResultsElement) {
    const data = await this.bibleApi.searchPassages(query, this.page);
    
    if (!data || !data.results || data.results.length === 0) {
      if (!append) {
        searchResultsElement.innerHTML = '<div class="no-results">No results found</div>';
      }
      this.hasMore = false;
      return;
    }

    if (append) {
      this.currentResults = [...this.currentResults, ...data.results];
    } else {
      this.currentResults = data.results;
    }

    this.hasMore = data.results.length === 100;
    this.renderSearchResults(searchResultsElement, !append);
  }

  renderSearchResults(searchResultsElement, autoSelectFirst) {
    // Implementation for rendering grouped search results
    // This would include the testament/book grouping logic
  }

  handleKeydown(e, searchResultsElement, onEnterCallback) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return 'close';
    }

    if (!this.resultItems || this.resultItems.length === 0) return null;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(this.selectedIndex + 1, this.resultItems.length - 1);
      this.setSelectedIndex(next, true);
      return 'navigate';
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(this.selectedIndex - 1, 0);
      this.setSelectedIndex(prev, true);
      return 'navigate';
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      this.activateSelected(onEnterCallback);
      return 'activate';
    }

    return null;
  }

  refreshResultItems(searchResultsElement, autoSelectFirst = false) {
    this.resultItems = Array.from(
      searchResultsElement.querySelectorAll('.search-result-item')
    );

    if (!this.resultItems.length) {
      this.selectedIndex = -1;
      return;
    }

    if (autoSelectFirst) {
      this.setSelectedIndex(0, false);
    } else {
      if (this.selectedIndex < 0 || this.selectedIndex >= this.resultItems.length) {
        this.selectedIndex = -1;
      } else {
        this.setSelectedIndex(this.selectedIndex, false);
      }
    }
  }

  setSelectedIndex(index, scrollIntoView = false) {
    if (!this.resultItems || this.resultItems.length === 0) {
      this.selectedIndex = -1;
      return;
    }

    const clamped = Math.max(0, Math.min(index, this.resultItems.length - 1));
    this.selectedIndex = clamped;

    this.resultItems.forEach((el, i) => {
      if (i === clamped) el.classList.add('selected');
      else el.classList.remove('selected');
    });

    const selectedEl = this.resultItems[clamped];
    if (selectedEl && scrollIntoView) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  activateSelected(callback) {
    if (!this.resultItems || this.selectedIndex < 0 || 
        this.selectedIndex >= this.resultItems.length) return;
    
    const selectedEl = this.resultItems[this.selectedIndex];
    if (selectedEl && callback) callback(selectedEl);
  }

  stripHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  reset() {
    this.selectedIndex = -1;
    this.resultItems = null;
    this.page = 1;
    this.lastQuery = '';
    this.hasMore = false;
    this.currentResults = [];
  }
}
