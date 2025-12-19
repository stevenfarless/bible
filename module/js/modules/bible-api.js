// js/modules/bible-api.js

/**
 * ESV Bible API Wrapper
 * Handles all communication with the ESV API
 */
export class BibleApi {
  constructor(baseUrl, getApiKey, getState) {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('Invalid baseUrl provided to BibleApi');
    }

    this.baseUrl = baseUrl;
    this.getApiKey = getApiKey;
    this.getState = getState;
    this.requestTimeout = 10000; // 10 seconds
  }

  /**
   * Fetch a passage from the ESV API
   * @param {string} reference - Bible reference (e.g., "John 3:16")
   * @returns {Promise<Object|null>} Passage data or null on error
   */
  async fetchPassage(reference) {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      console.error('No API key available');
      return null;
    }

    if (!reference || typeof reference !== 'string') {
      console.error('Invalid reference provided');
      return null;
    }

    const state = this.getState();

    // Build query parameters based on user settings
    const params = new URLSearchParams({
      q: reference,
      'include-headings': state.showHeadings || false,
      'include-verse-numbers': state.showVerseNumbers !== false,
      'include-short-copyright': false,
      'include-passage-references': false,
      'include-footnotes': state.showFootnotes || false,
      'include-footnote-body': state.showFootnotes || false,
      'include-cross-references': state.showCrossReferences || false,
      'include-selahs': true,
      'indent-poetry': true,
      'indent-paragraphs': 0,
      'indent-declares': 0,
    });

    try {
      const response = await this._fetchWithTimeout(
        `${this.baseUrl}/passage/html/?${params}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'ESV-Bible-Reader/1.0',
          },
        },
        this.requestTimeout
      );

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching passage:', error);
      return null;
    }
  }

  /**
   * Search for passages by keyword or phrase
   * @param {string} query - Search query (keywords or reference)
   * @param {number} page - Page number for pagination (default: 1)
   * @returns {Promise<Object|null>} Search results or null on error
   */
  async searchPassages(query, page = 1) {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      console.error('No API key available');
      return null;
    }

    if (!query || typeof query !== 'string') {
      console.error('Invalid query provided');
      return null;
    }

    if (!Number.isInteger(page) || page < 1) {
      page = 1;
    }

    const params = new URLSearchParams({
      q: query,
      'page-size': 100,
      page: String(page),
    });

    try {
      const response = await this._fetchWithTimeout(
        `${this.baseUrl}/passage/search?${params}`,
        {  // ← Opening brace
          method: 'GET',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'ESV-Bible-Reader/1.0',
          },
        },
        this.requestTimeout
      );


      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching passages:', error);
      return null;
    }
  }

  /**
   * Fetch with timeout
   * @private
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async _fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(
          `Request timeout after ${timeoutMs}ms`
        );
      }
      throw error;
    }
  }

  /**
   * Validate an API key by making a test request
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  async validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    try {
      const response = await this._fetchWithTimeout(
        `${this.baseUrl}/passage/html/?q=John%201:1`,
        {  // ← Opening brace
          method: 'GET',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Accept': 'application/json',
          },
        },
        5000
      );


      return response.ok;
    } catch (error) {
      console.error('API key validation error:', error);
      return false;
    }
  }
}
