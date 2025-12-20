// js/modules/bible-api.js

/**
 * ESV API Client
 * Handles all interactions with the ESV API
 */
export class BibleApi {
    constructor(baseUrl, getApiKey, getState) {
        this.baseUrl = baseUrl;
        this.getApiKey = getApiKey;
        this.getState = getState;
    }

    /**
     * Build query parameters based on current settings
     */
    getQueryParams() {
        const state = this.getState();

        return {
            'include-passage-references': false,
            'include-verse-numbers': state.showVerseNumbers,
            'include-first-verse-numbers': true,
            'include-footnotes': state.showFootnotes,
            'include-footnote-body': state.showFootnotes,
            'include-headings': state.showHeadings,
            'include-short-copyright': false,
            'include-passage-horizontal-lines': false,
            'include-heading-horizontal-lines': false,
            'horizontal-line-length': 55,
            'include-selahs': true,
            'indent-using': 'space',
            'indent-paragraphs': 0,
            'indent-poetry': true,
            'indent-poetry-lines': 4,
            'indent-declares': 40,
            'indent-psalm-doxology': 30,
            'line-length': 0,
        };
    }

    /**
     * Fetch a passage from the ESV API
     */
    async fetchPassage(reference) {
        const apiKey = this.getApiKey();

        if (!apiKey) {
            throw new Error('ESV API key not set');
        }

        const params = new URLSearchParams({
            q: reference,
            ...this.getQueryParams(),
        });

        const url = `${this.baseUrl}/passage/html/?${params}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Token ${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Search for passages containing keywords
     */
    async searchPassages(query, page = 1) {
        const apiKey = this.getApiKey();

        if (!apiKey) {
            throw new Error('ESV API key not set');
        }

        const params = new URLSearchParams({
            q: query,
            page: page,
            'page-size': 100,
        });

        const url = `${this.baseUrl}/passage/search/?${params}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Token ${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Search API error: ${response.status}`);
        }

        return await response.json();
    }
}
