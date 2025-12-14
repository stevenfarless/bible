export class BibleApi {
    constructor(baseUrl, getApiKey, getState) {
        this.baseUrl = baseUrl;
        this.getApiKey = getApiKey;
        this.getState = getState;
    }

    async fetchPassage(reference) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.error('No API key available');
            return null;
        }

        const state = this.getState();

        const params = new URLSearchParams({
            q: reference,
            'include-headings': state.showHeadings,
            'include-verse-numbers': state.showVerseNumbers,
            'include-short-copyright': false,
            'include-passage-references': false,
            'include-footnotes': state.showFootnotes,
            'include-footnote-body': state.showFootnotes,  // This must match showFootnotes to get footnote text!
            'include-cross-references': state.showCrossReferences || false,
            'include-selahs': true,
            'indent-poetry': true,
            'indent-paragraphs': 0,
            'indent-declares': 0
        });

        try {
            // ✅ FIXED: Added leading slash
            const response = await fetch(`${this.baseUrl}/passage/html/?${params}`, {
                headers: {
                    'Authorization': `Token ${apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching passage:', error);
            return null;
        }
    }

    async searchPassages(query) {
        const apiKey = this.getApiKey();
        if (!apiKey) return null;

        const params = new URLSearchParams({
            q: query,
            'page-size': 20
        });

        try {
            // ✅ FIXED: Added leading slash
            const response = await fetch(`${this.baseUrl}/passage/search/?${params}`, {
                headers: {
                    'Authorization': `Token ${apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error searching passages:', error);
            return null;
        }
    }
}
