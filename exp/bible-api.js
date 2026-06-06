// bible-api.js
import { FIREBASE_DB_URL } from './config/firebase-config.js';
import { normaliseBookAlias } from './book-aliases.js';
import {
    idbGetBook, idbPutBook,
    idbGetSearchIndex, idbPutSearchIndex,
    idbIsDownloaded, idbMarkDownloaded,
    idbDeleteTranslation,
} from './translation-store.js';

// MiniSearch 7.1.2 — inlined
const t="ENTRIES",e="KEYS",s="VALUES",i="";class r{constructor(t){const e=t._tree,s=Array.from(e.keys());this.set=t,this._type=i,this._path=s.length>0?[{node:e,keys:s}]:[]}next(){const t=this._path;if(0===t.length)return{done:!0};for(;;){const e=t[t.length-1];if(0===e.keys.length){t.pop();continue}const s=e.keys.shift(),r=e.node.get(s);if(r===void 0)continue;if(r instanceof Map){const t=Array.from(r.keys());this._path.push({node:r,keys:t})}if(s===i)return{done:!1,value:{key:this._path.reduce((t,e)=>t+(e.node===this.set._tree?"":e.node===r?s:""),""),value:r.get(i)}}}}}[Symbol.iterator](){return this}}class n{constructor(){this._tree=new Map}add(t,e){o(this._tree,t,e)}delete(t,e){a(this._tree,t,e)}has(t){const e=h(this._tree,t);return e!==void 0&&e.has(i)}get(t){const e=h(this._tree,t);return e===void 0?void 0:e.get(i)}update(t,e,s){u(this._tree,t,e,s)}fetch(t,e){return c(this._tree,t,e)}forEach(t,e=0){l(this._tree,"",e,this.size,t)}fuzzyGet(t,e){return d(this._tree,"",t,e)}[Symbol.iterator](){return new r(this)}get size(){let t=0;for(const e of this)t+=1;return t}}function o(t,e,s){const r=e.length;let n=t;for(let t=0;t<r;t++){const s=e[t];let r=n.get(s);r===void 0&&(r=new Map,n.set(s,r)),n=r}let o=n.get(i);o===void 0&&(o=new Set,n.set(i,o)),o.add(s)}function a(t,e,s){const r=e.length,n=[t];let o=t;for(let t=0;t<r;t++){const s=e[t],r=o.get(s);if(r===void 0)return;n.push(r),o=r}for(let t=n.length-1;t>=0;t--){const r=n[t],o=t<n.length-1?e[t]:i;if(r.get(o)instanceof Set){if(r.get(o).delete(s),r.get(o).size>0)break;r.delete(o)}else if(r.get(o)instanceof Map&&r.get(o).size>0)break;else r.delete(o)}}function h(t,e){let s=t;const r=e.length;for(let t=0;t<r;t++){const r=s.get(e[t]);if(r===void 0)return;s=r}return s}function u(t,e,s,r){const n=e.length;let o=t;for(let t=0;t<n;t++){const s=e[t];let r=o.get(s);r===void 0&&(r=new Map,o.set(s,r)),o=r}let a=o.get(i);a===void 0&&(a=r(),o.set(i,a)),a.set(s,r(a.get(s)))}function c(t,e,s){let r=t;const n=e.length;for(let t=0;t<n;t++){const s=e[t],n=r.get(s);if(n===void 0)return s(void 0);r=n}return(r.get(i)??s)(r)}function l(t,e,s,r,n,o=new Map){if(o.has(t))return;o.set(t,!0);const a=t.get(i);if(a!==void 0)for(const[t,r]of a)n(t,r,e);if(!(s>=r))for(const[i,a]of t){if(i===" ")continue;l(a,e+i,s+1,r,n,o)}}function d(t,e,s,r,n=new Map){const o=[];if(0===s.length)return o;const a=[...t.keys()].filter(t=>t!==i&&t!==" ");for(const t of a){const i=p(t,s[0]);if(i>r)continue;const a=e+t,h=t.get(t);if(h!==void 0&&h.has(i)&&(o.push({candidate:a,distance:i}),o.length>=n.get(a)??1/0))continue;const u=d(t.get(t)??new Map,a,s.slice(1),r-i,n);o.push(...u)}return o}function p(t,e){return t===e?0:1}class f{constructor(t,e,s,r,n){this.lazy=r,this.combineFn=n,this._items=[t],this._sets=[e],this._indexes=[s],this.done=!1}static empty(){const t=new f([],[],[],!1,()=>{});return t.done=!0,t}static fromIndex(t,e,s,r){const n=t._index.get(e);if(n==null)return f.empty();const o=[...n.keys()].filter(t=>t!==i);if(0===o.length)return f.empty();const[a,...h]=o,u=n.get(a);return new f([u],[n],[a],s,r)}static combineResults(t,e){if(0===t.length)return f.empty();const s=t.reduce((t,e)=>t*e._items.length,1);if(0===s)return f.empty();return new f(t.map(t=>t._items[0]),t.map(t=>t._sets[0]),t.map(t=>t._indexes[0]),e==="AND",e==="AND"?w:b)}get size(){return this._items.reduce((t,e)=>t*e.size,1)}get key(){return this._indexes.join(" ")}next(){const t=this._sets.length;for(let e=t-1;e>=0;e--){this._indexes[e]=this._sets[e].keyAt(this._indexes[e]+1)??null;if(this._indexes[e]!==null)break;if(e===0){this.done=!0;return}this._indexes[e]=this._sets[e].keyAt(0)??null}this._items=this._sets.map((t,e)=>t.get(this._indexes[e]))}}function g(t){return t==null||"object"!=typeof t&&"function"!=typeof t?[]:t instanceof Map?[...t]:[...Object.entries(t)]}function m(t,e){return t.has(e)?t.get(e):(t.set(e,new Map),t.get(e))}function y(t,e,s,r,n,o,a){const h=t.get(e);if(h==null)return;const u=h.get(s);if(u==null)return;const c=u.get(n);if(c==null)return;for(const[t,e]of c)o.has(t)||(o.set(t,{score:0,match:{},terms:[]}),r.add(t));const l=o.get(e);if(l===void 0)return;l.score+=a,l.match[s]=l.match[s]??[],l.match[s].push(n)}function _(t,e){const s=[];for(const r of t){const t=r.slice(0,e);if(!s.includes(t)){s.push(t)}}return s}function w(t,e){let s=0;for(const[r,n]of t)e.has(r)&&(s+=n+e.get(r));return s}function b(t,e){let s=0;for(const[r,n]of t)s+=n+(e.get(r)??0);return s}const v=t=>t;const S=Object.prototype.toString;function E(t){return"string"==typeof t?t:S.call(t)==="[object String]"?t.valueOf():null}function x(t,e){if(!Array.isArray(t)||0===t.length)throw new Error('MiniSearch: option "fields" must be a non-empty array');const s=t.reduce((t,e)=>({...t,[e]:1}),{});for(const t of e)if(!s[t])throw new Error(`MiniSearch: key "${t}" used in options "storeFields" or "idField" is not a field`)}const A={idField:"id",extractField:(t,e)=>t[e],tokenize:t=>t.split(I),processTerm:t=>t.toLowerCase(),fields:void 0,searchOptions:void 0,autoVacuum:!0,logger:(t,...e)=>{
  if(["warn","error"].includes(t))console[t]("MiniSearch:",e)}};class M{constructor(t){const e={...A,...t};if(null==e.fields)throw new Error('MiniSearch: option "fields" must be provided');const s=e.idField;if(e.fields.includes(s))throw new Error(`MiniSearch: "fields" option must not include the idField (${JSON.stringify(s)})`);x(e.fields,[s,...(e.storeFields??[])]),this._options=e,this._index=new n,this._documentCount=0,this._documentIds=new Map,this._idToShortId=new Map,this._fieldIds={},this._fieldLength=new Map,this._avgFieldLength=[],this._nextId=0,this._storedFields=new Map,this._avgFieldLength=e.fields.map(()=>0),this._fieldIds=e.fields.reduce((t,e,s)=>({...t,[e]:s}),{}),this._vacuumCondition=null}add(t){const{extractField:e,tokenize:s,processTerm:r,fields:n,idField:o}=this._options,a=e(t,o);if(null==a)throw new Error(`MiniSearch: document does not have ID field "${o}"`);if(this._idToShortId.has(a))throw new Error(`MiniSearch: duplicate ID ${a}`);const h=this._nextId;this._idToShortId.set(a,h),this._documentIds.set(h,a),this._documentCount+=1,this._nextId+=1;for(const o of n){const n=e(t,o);if(null==n)continue;const a=this._fieldIds[o],u=s(String(n)),c=u.length;this._fieldLength.has(h)?this._fieldLength.get(h)[a]=c:this._fieldLength.set(h,n.fields.map(()=>0));const l=this._avgFieldLength[a];this._avgFieldLength[a]=(l*(this._documentCount-1)+c)/this._documentCount;for(let t=0;t<c;t++){const e=r(u[t]);if(!1!==e)for(const t of[].concat(e))y(this._index,t,o,this._documentIds,a,this._fieldLength,h)}}}remove(t){const{extractField:e,tokenize:s,processTerm:r,fields:n,idField:o}=this._options,a=e(t,o);if(null==a)throw new Error(`MiniSearch: document does not have ID field "${o}"`);if(!this._idToShortId.has(a))throw new Error(`MiniSearch: cannot remove document with ID ${a}: it is not in the index`);const h=this._idToShortId.get(a);this._idToShortId.delete(a),this._documentIds.delete(h),this._documentCount-=1;for(const o of n){const n=e(t,o);if(null==n)continue;const a=this._fieldIds[o],u=s(String(n));for(let t=0;t<u.length;t++){const e=r(u[t]);if(!1!==e)for(const t of[].concat(e))this._index.delete(t,new Map([[o,new Map([[a,new Set([h])])]]))}}}discard(t){const e=this._idToShortId.get(t);if(e===void 0)throw new Error(`MiniSearch: cannot discard document with ID ${t}: it is not in the index`);this._idToShortId.delete(t),this._documentIds.delete(e),this._documentCount-=1,this._vacuumCondition=this._options.autoVacuum===!1?null:{minDirtCount:Math.max(1,Math.floor(this._documentCount/10)),minDirtFactor:.1,batchSize:1e3,batchWait:10},this._scheduleVacuum()}replace(t){const{idField:e,extractField:s}=this._options,r=s(t,e);this.discard(r),this.add(t)}has(t){return this._idToShortId.has(t)}getStoredFields(t){const e=this._idToShortId.get(t);return e===void 0?void 0:this._storedFields.get(e)}search(t,e={}){const s=this._searchResults(t,e);const r=new Map;for(const{id:t,score:e,match:s,terms:n}of s){const o=r.get(t);if(o!==void 0){o.score=Math.max(o.score,e);for(const t of Object.keys(s))o.match[t]=o.match[t]?.concat(s[t])??s[t];o.terms.push(...n)}else r.set(t,{id:t,score:e,match:s,terms:n})}return[...r.values()].sort((t,e)=>e.score-t.score)}autoSuggest(t,e={}){const s=this._searchResults(t,{prefix:!0,...e}),r=new Map;for(const{score:t,terms:e}of s){const s=e.join(" ");r.has(s)?r.get(s).score+=t:r.set(s,{score:t,terms:e})}return[...r.entries()].map(([t,{score:e,terms:s}])=>({suggestion:t,score:e,terms:s})).sort((t,e)=>e.score-t.score)}get documentCount(){return this._documentCount}get termCount(){return this._index.size}_searchResults(t,e={}){const s={...this._options.searchOptions,...e};let{tokenize:r,processTerm:n}=s;r=r||this._options.tokenize,n=n||this._options.processTerm;const o=r(t),a=o.flatMap(t=>{const e=n(t);return[].concat(!1===e?[]:e)});if(0===a.length)return[];const h=s.combineWith||"OR",u=[],c=s.filter;for(const t of a){const e=this._searchTerm(t,s);if(null!=c)for(const[t]of e)c(t)||e.delete(t);u.push(e)}const l=f.combineResults(u,h);const d=new Map;let p;for(const[t,e]of l){const s=this._documentIds.get(t);if(s===void 0)continue;const r=d.get(s);if(r!==void 0){r.score+=e.score,Object.assign(r.match,e.match),r.terms.push(...e.terms);continue}if(p===void 0){p=Object.fromEntries(this._storedFields.get(t)??[])}const n={...p,...Object.fromEntries(this._storedFields.get(t)??[]),id:s,score:e.score,match:e.match,terms:e.terms};n.score=e.score,d.set(s,n)}return[...d.values()]}_searchTerm(t,e){const{tokenize:s,processTerm:r,searchOptions:n}=this._options;let{fuzzy:o,prefix:a,combineWith:h,maxFuzzy:u,boost:c}=e;o=o??n?.fuzzy??!1,a=a??n?.prefix??!1,h=h??n?.combineWith??"OR",u=u??n?.maxFuzzy??6,c=c??n?.boost??{};const l=new Map;this._index.forEach((e,i)=>{const n=this._fieldIds[i];if(n===void 0)return;const d=c[i]??1;if(a){const e=this._index.getPrefix(t);for(const[s,r]of e){const e=r.get(i);if(e==null)continue;for(const[r,o]of e)T(l,r,n,s,o.size,this._fieldLength,this._avgFieldLength,d,1)}}if(o!==!1){const e="number"==typeof o?Math.min(o,u):Math.floor(t.length*o);if(e){const s=this._index.fuzzyGet(t,e);for(const[r,o]of s){const s=o.get(i);if(s==null)continue;for(const[o,a]of s)T(l,o,n,r,a.size,this._fieldLength,this._avgFieldLength,d,e)}}}const p=this._index.get(t);if(p){const e=p.get(i);if(e)for(const[s,r]of e)T(l,s,n,t,r.size,this._fieldLength,this._avgFieldLength,d,0)}});return l}addAll(t){for(const e of t)this.add(e)}addAllAsync(t,e={}){const{chunkSize:s=10}=e;const r={chunk:[],promise:Promise.resolve()};const n=(e,s)=>{r.chunk.push(e),r.chunk.length>=s&&(r.promise=r.promise.then(()=>new Promise(t=>setTimeout(t,0))).then(()=>{this.addAll(r.chunk),r.chunk=[]}))};return new Promise((e,o)=>{try{for(const e of t)n(e,s);r.promise=r.promise.then(()=>new Promise(t=>setTimeout(t,0))).then(()=>{this.addAll(r.chunk),r.chunk=[],e()})}catch(t){o(t)}})}remove(t){this.discard(t)}vacuum(t={}){return this._performVacuum(t)}_scheduleVacuum(){const t=this._vacuumCondition;if(t==null)return;const{minDirtCount:e,minDirtFactor:s,batchSize:r,batchWait:n}=t;(this._documentCount-this._index.size>=e&&1-this._index.size/this._documentCount>=s)&&(this._vacuumCondition=null,this.vacuum({batchSize:r,batchWait:n}))}_performVacuum(t){const{batchSize:e=1e3,batchWait:s=10}=t;let r=Promise.resolve();let n=0;for(const[t]of this._index){if(this._documentIds.has(t))continue;n++,r=r.then(()=>new Promise(t=>setTimeout(t,0))).then(()=>{this._index.delete(t)}),n>=e&&(n=0,r=r.then(()=>new Promise(t=>setTimeout(t,0))))}return r}}function T(t,e,s,r,n,o,a,h,u){const c=o.get(e);if(!c)return;const l=c[s]??0,d=a[s];if(!d)return;const p=l/d;const f=1+Math.log(n),g=1/(f+.5+f/p);const m=1.2;const y=Math.max(1-u/(u+1),.5);const _=h*(1+m)*g/(g+m*(1-p*(1-.75)+.75*p));t.has(e)?t.set(e,{score:t.get(e).score+_,terms:[...t.get(e).terms,r],match:{...t.get(e).match,[r]:s}}):t.set(e,{score:_,terms:[r],match:{[r]:s}})}const I=/[\n\r\p{Z}\p{P}]/u;
const _MiniSearchClass = M;


const FIREBASE_TRANSLATIONS_ENABLED = false;

const PAGE_SIZE = 100;
const SEARCH_CONCURRENCY = 5;

export const PRECACHED_TRANSLATIONS = new Set([
    "BSB", "KJV",
]);

export const LOCAL_TRANSLATIONS = new Set([
    "ASV", "BLB", "BSB", "CSB", "ESV", "ISV", "KJV", "LEB",
    "MEV", "MSB", "NET", "NIV", "NKJV", "NLT", "NRSVUE", "WEB",
]);

const REPO_TRANSLATIONS = new Set([
    "ASV", "BLB", "BSB", "CSB", "ESV", "ISV", "KJV", "LEB",
    "MEV", "MSB", "NET", "NIV", "NKJV", "NLT", "NRSVUE", "WEB",
]);

const BOOK_LOAD_ORDER = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
    'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
    '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
    'Ezra','Nehemiah','Esther','Job','Psalm','Proverbs',
    'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah',
    'Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
    'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
    'Haggai','Zechariah','Malachi','Matthew','Mark','Luke',
    'John','Acts','Romans','1 Corinthians','2 Corinthians',
    'Galatians','Ephesians','Philippians','Colossians',
    '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
    'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
    '1 John','2 John','3 John','Jude','Revelation',
    // Deuterocanon
    'Additions to Esther','Bel and the Dragon','Prayer of Manasseh','Letter of Jeremiah',
    'Prayer of Azariah','Wisdom of Solomon','2 Maccabees','4 Maccabees',
    '3 Maccabees','1 Maccabees','Psalm 151','1 Esdras',
    '2 Esdras','Susanna','Sirach','Baruch',
    'Judith','Tobit',
];

const BOOK_LOAD_ORDER_BY_LENGTH = [...BOOK_LOAD_ORDER].sort((a, b) => b.length - a.length);

const BOOK_KEY_ALIASES = {
    'Song of Solomon': 'Song of Solomon',
};


function _resolveBookKey(bible, canonicalName) {
    if (bible[canonicalName] !== undefined) return canonicalName;
    const alias = BOOK_KEY_ALIASES[canonicalName];
    if (alias !== undefined && bible[alias] !== undefined) return alias;
    return null;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _buildWordRegex(q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
}

export async function loadTranslationIndex() {
    if (!FIREBASE_TRANSLATIONS_ENABLED) return [];
    const url = `${FIREBASE_DB_URL}/translationIndex.json`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return Object.values(data);
        return [];
    } catch (err) {
        console.error('BibleApi: failed to load translation index from RTDB', err);
        return [];
    }
}

export class BibleApi {
    constructor(translation = 'ESV') {
        this._translation = translation;
        this._bookCache = new Map();
        this._shallowIndexCache = new Map();
        this._searchIndexCache = new Map();
        this._miniSearchCache = new Map();
        this._miniSearchBuildPromise = new Map();
        this._localBookFetchPromise = new Map();
        this._searchIndexFetchPromise = new Map();
        this._translationBookLists = new Map();
    }

    setTranslation(translation) {
        this._translation = translation;
    }

    get translation() {
        return this._translation;
    }

    setBookList(translation, bookNames) {
        if (!translation || !Array.isArray(bookNames) || bookNames.length === 0) return;
        this._translationBookLists.set(translation, bookNames);
    }

    async _getShallowIndex(translation) {
        if (!FIREBASE_TRANSLATIONS_ENABLED) return new Map();
        if (this._shallowIndexCache.has(translation)) {
            return this._shallowIndexCache.get(translation);
        }
        const index = new Map();
        try {
            const url = `${FIREBASE_DB_URL}/translations/${encodeURIComponent(translation)}.json?shallow=true`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object') {
                    for (const key of Object.keys(data)) {
                        index.set(key.toLowerCase(), key);
                    }
                }
            }
        } catch (err) {
            console.warn(`BibleApi: shallow index fetch failed for ${translation}`, err);
        }
        this._shallowIndexCache.set(translation, index);
        return index;
    }

    async _loadBook(translation, book) {
        const cacheKey = `${translation}/${book}`;
        if (this._bookCache.has(cacheKey)) {
            return this._bookCache.get(cacheKey);
        }

        if (REPO_TRANSLATIONS.has(translation)) {
            if (this._localBookFetchPromise.has(cacheKey)) {
                return this._localBookFetchPromise.get(cacheKey);
            }

            const fetchBookFromNetwork = async (filename) => {
                const url = `./translations/${translation}/${encodeURIComponent(filename)}.json`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            };

            const promise = (async () => {
                try {
                    if (!PRECACHED_TRANSLATIONS.has(translation)) {
                        const cached = await idbGetBook(translation, book);
                        if (cached !== null) {
                            this._bookCache.set(cacheKey, cached);
                            return cached;
                        }
                        // Not installed — do not fetch from network.
                        this._bookCache.set(cacheKey, null);
                        return null;
                    }

                    const filename = BOOK_KEY_ALIASES[book] ?? book;
                    const data = await fetchBookFromNetwork(filename);
                    this._bookCache.set(cacheKey, data);
                    if (filename !== book) {
                        this._bookCache.set(`${translation}/${filename}`, data);
                    }
                    return data;
                } catch (err) {
                    console.error(`BibleApi: failed to load ${translation}/${this._sanitizeForLog(book)}`, err);
                    this._bookCache.set(cacheKey, null);
                    return null;
                } finally {
                    this._localBookFetchPromise.delete(cacheKey);
                }
            })();

            this._localBookFetchPromise.set(cacheKey, promise);
            return promise;
        }

        if (!FIREBASE_TRANSLATIONS_ENABLED) {
            console.warn(`BibleApi: Firebase translations disabled — cannot load ${translation}/${this._sanitizeForLog(book)}`);
            return null;
        }

        const fetchNode = async (nodeKey) => {
            const url = `${FIREBASE_DB_URL}/translations/${encodeURIComponent(translation)}/${encodeURIComponent(nodeKey)}.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${res.url}`);
            const data = await res.json();
            return (data && typeof data === 'object') ? data : null;
        };

        try {
            let bookData = await fetchNode(book);
            if (bookData === null) {
                const alias = BOOK_KEY_ALIASES[book];
                if (alias) bookData = await fetchNode(alias);
            }
            if (bookData === null) {
                const shallowIndex = await this._getShallowIndex(translation);
                const exactKey = shallowIndex.get(book.toLowerCase());
                if (exactKey && exactKey !== book) bookData = await fetchNode(exactKey);
            }
            this._bookCache.set(cacheKey, bookData);
            return bookData;
        } catch (err) {
            console.error(`BibleApi: failed to load ${translation}/${book} from RTDB`, err);
            this._bookCache.set(cacheKey, null);
            return null;
        }
    }

    async _loadSearchIndex(translation) {
        if (this._searchIndexCache.has(translation)) {
            return this._searchIndexCache.get(translation);
        }

        if (this._searchIndexFetchPromise.has(translation)) {
            return this._searchIndexFetchPromise.get(translation);
        }

        const promise = (async () => {
            try {
                const isRepo = REPO_TRANSLATIONS.has(translation);
                if (!isRepo && !FIREBASE_TRANSLATIONS_ENABLED) {
                    this._searchIndexCache.set(translation, null);
                    return null;
                }

                if (isRepo && !PRECACHED_TRANSLATIONS.has(translation)) {
                    // Only serve installed translations — never fetch network data for
                    // a translation the user has not explicitly downloaded.
                    const installed = await idbIsDownloaded(translation);
                    if (!installed) {
                        this._searchIndexCache.set(translation, null);
                        return null;
                    }

                    const cached = await idbGetSearchIndex(translation);
                    if (cached !== null && typeof cached === 'object' && Object.keys(cached).length > 0) {
                        this._searchIndexCache.set(translation, cached);
                        return cached;
                    }
                    // Installed but search index missing from IDB — re-fetch and store.
                }

                const url = isRepo
                    ? `./translations/${translation}/${translation}_search_index.json`
                    : `${FIREBASE_DB_URL}/searchIndex/${encodeURIComponent(translation)}.json`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const index = (data && typeof data === 'object' && Object.keys(data).length > 0) ? data : null;
                this._searchIndexCache.set(translation, index);
                if (isRepo && !PRECACHED_TRANSLATIONS.has(translation) && index !== null) {
                    idbPutSearchIndex(translation, index).catch(() => {});
                }
                return index;
            } catch (err) {
                console.warn(`BibleApi: search index unavailable for ${translation}, falling back to book fetches`, err);
                this._searchIndexCache.set(translation, null);
                return null;
            } finally {
                this._searchIndexFetchPromise.delete(translation);
            }
        })();

        this._searchIndexFetchPromise.set(translation, promise);
        return promise;
    }

    // Builds (or returns cached) a MiniSearch instance for a translation's search index.
    // Each entry in the search index is indexed as { id: ref, text: normalizedText }.
    async _getMiniSearchIndex(translation, searchIndex) {
        if (this._miniSearchCache.has(translation)) {
            return this._miniSearchCache.get(translation);
        }
        if (this._miniSearchBuildPromise.has(translation)) {
            return this._miniSearchBuildPromise.get(translation);
        }
        const promise = (async () => {
            try {
                const MiniSearch = _MiniSearchClass;
                const ms = new MiniSearch({
                    fields: ['text'],
                    storeFields: ['id'],
                    idField: 'id',
                    searchOptions: {
                        prefix: true,
                        fuzzy: 1,  // PREVIOUS VALUE fuzzy: 0.15,
                        combineWith: 'AND',
                    },
                });
                const docs = Object.entries(searchIndex).map(([ref, text]) => ({ id: ref, text }));
                await ms.addAllAsync(docs, { chunkSize: 1000 });
                this._miniSearchCache.set(translation, ms);
                return ms;
            } catch (err) {
                console.warn('BibleApi: MiniSearch index build failed, will fall back to regex', err);
                this._miniSearchCache.set(translation, null);
                return null;
            } finally {
                this._miniSearchBuildPromise.delete(translation);
            }
        })();
        this._miniSearchBuildPromise.set(translation, promise);
        return promise;
    }

    async downloadTranslation(translation, bookList, onProgress) {
        const books = bookList?.length ? bookList : BOOK_LOAD_ORDER;
        const total = books.length;
        let done = 0;

        const fetchAndStore = async (book) => {
            const cacheKey = `${translation}/${book}`;
            let data = this._bookCache.get(cacheKey) ?? null;
            if (data === null) {
                try {
                    const filename = BOOK_KEY_ALIASES[book] ?? book;
                    const url = `./translations/${translation}/${encodeURIComponent(filename)}.json`;
                    const res = await fetch(url);
                    if (res.ok) {
                        data = await res.json();
                        this._bookCache.set(cacheKey, data);
                    }
                } catch (_) {}
            }
            if (data !== null) await idbPutBook(translation, book, data);
            done++;
            onProgress?.(done, total);
        };

        const BATCH = 4;
        for (let i = 0; i < books.length; i += BATCH) {
            await Promise.all(books.slice(i, i + BATCH).map(fetchAndStore));
        }

        try {
            const url = `./translations/${translation}/${translation}_search_index.json`;
            const res = await fetch(url);
            if (res.ok) {
                const idx = await res.json();
                await idbPutSearchIndex(translation, idx);
                this._searchIndexCache.set(translation, idx);
                // Invalidate any stale MiniSearch instance so it rebuilds with the new index.
                this._miniSearchCache.delete(translation);
            }
        } catch (_) {}

        await idbMarkDownloaded(translation);

        // Notify the SW so it starts caching this translation's files on access.
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'TRANSLATION_INSTALLED',
                translation,
            });
        }
    }

    evictTranslation(translation) {
        const prefix = `${translation}/`;
        for (const key of [...this._bookCache.keys()]) {
            if (key.startsWith(prefix)) this._bookCache.delete(key);
        }
        this._searchIndexCache.delete(translation);
        this._miniSearchCache.delete(translation);
        this._shallowIndexCache.delete(translation);
        this._translationBookLists.delete(translation);
    }

    _parseReference(reference) {
        const raw = String(reference || '').trim();
        const str = normaliseBookAlias(raw);

        for (const name of BOOK_LOAD_ORDER_BY_LENGTH) {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(
                '^(' + escaped + ')\\s+(\\d+)(?:[:\\s](\\d+)(?:-(\\d+))?)?$',
                'i'
            );
            const m = str.match(re);
            if (m) {
                return {
                    book:       name,
                    chapter:    parseInt(m[2], 10),
                    verseStart: m[3] ? parseInt(m[3], 10) : null,
                    verseEnd:   m[4] ? parseInt(m[4], 10) : null,
                };
            }
        }

        const m = str.match(/^((?:[1-3]\s+)?[A-Za-z ]+?)\s+(\d+)(?:[:\s](\d+)(?:-(\d+))?)?$/);
        if (!m) return null;
        return {
            book:       m[1].trim(),
            chapter:    parseInt(m[2], 10),
            verseStart: m[3] ? parseInt(m[3], 10) : null,
            verseEnd:   m[4] ? parseInt(m[4], 10) : null,
        };
    }

    _sanitizeForLog(value) {
        return String(value ?? '').replace(/[\r\n]/g, '');
    }

    _buildPassageHtml(chapter, chapterData, verseStart, verseEnd, scaffoldEvents = [], showHeadings = true) {
        const prologueHtml = (chapterData['0'] && verseStart === null)
            ? `<div class="passage-prologue">${escapeHtml(chapterData['0'])}</div>`
            : '';

        const verseNums = Object.keys(chapterData)
            .map(Number)
            .filter(Number.isFinite)
            .filter((v) => v > 0)
            .sort((a, b) => a - b)
            .filter((v) => {
                if (verseStart !== null && v < verseStart) return false;
                if (verseEnd !== null && v > verseEnd) return false;
                return true;
            });

        if (!verseNums.length) return null;

        const hasScaffold = scaffoldEvents.length > 0;

        if (!hasScaffold) {
            const spans = [];
            for (const v of verseNums) {
                const text = chapterData[String(v)] || '';
                spans.push(
                    `<span class="verse" data-verse="${v}" id="v${chapter}-${v}">` +
                    `<sup class="verse-num">${v}</sup> ${escapeHtml(text)} ` +
                    `</span>`
                );
            }
            return prologueHtml + `<p class="passage-para">${spans.join('')}</p>`;
        }

        const eventMap = new Map();
        for (const evt of scaffoldEvents) {
            if (!eventMap.has(evt.v)) eventMap.set(evt.v, []);
            eventMap.get(evt.v).push(evt);
        }

        const parts = [];
        let inParagraph = false;

        const openP = () => { parts.push('<p class="passage-para">'); inParagraph = true; };
        const closeP = () => { if (inParagraph) { parts.push('</p>'); inParagraph = false; } };

        for (const v of verseNums) {
            const eventsHere = eventMap.get(v) || [];
            for (const evt of eventsHere) {
                if (evt.type === 'heading') {
                    if (showHeadings) { closeP(); parts.push(`<h3 class="pericope-heading">${escapeHtml(evt.text)}</h3>`); }
                } else if (evt.type === 'para_break') {
                    closeP();
                }
            }
            if (!inParagraph) openP();
            const text = chapterData[String(v)] || '';
            parts.push(
                `<span class="verse" data-verse="${v}" id="v${chapter}-${v}">` +
                `<sup class="verse-num">${v}</sup> ${escapeHtml(text)} ` +
                `</span>`
            );
        }
        closeP();
        return prologueHtml + parts.join('');
    }

    async fetchPassage(reference, scaffoldEvents = [], showHeadings = true) {
        const parsed = this._parseReference(reference);
        if (!parsed) {
            console.error(`BibleApi: cannot parse reference "${this._sanitizeForLog(reference)}"`);
            return null;
        }

        const { book, chapter, verseStart, verseEnd } = parsed;
        const bookData = await this._loadBook(this._translation, book);
        if (!bookData) {
            console.error(`BibleApi: book "${this._sanitizeForLog(book)}" not found in ${this._translation}`);
            return null;
        }

        const resolvedKey = _resolveBookKey(bookData, book);
        const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;

        const chapterData = resolvedBookData[String(chapter)];
        if (!chapterData) {
            console.error(`BibleApi: chapter ${chapter} not found in "${this._sanitizeForLog(book)}"`);
            return null;
        }

        const normalizedVerseEnd = verseStart !== null ? (verseEnd ?? verseStart) : null;
        const html = this._buildPassageHtml(chapter, chapterData, verseStart, normalizedVerseEnd, scaffoldEvents, showHeadings);
        if (!html) return null;

        const canonical = verseStart !== null
            ? `${book} ${chapter}:${verseStart}${normalizedVerseEnd !== verseStart ? `-${normalizedVerseEnd}` : ''}`
            : `${book} ${chapter}`;

        return { passages: [html], canonical };
    }

    async searchPassages(query, onBatchResults = null) {
        const q = String(query || '').toLowerCase().trim();
        if (!q) return { results: [], total_results: 0, page_size: PAGE_SIZE };

        const searchIndex = await this._loadSearchIndex(this._translation);

        if (searchIndex !== null) {
            // Try MiniSearch first; fall back to regex scan on build failure.
            const ms = await this._getMiniSearchIndex(this._translation, searchIndex);

            let matchedRefs;
            if (ms) {
                const hits = ms.search(q);
                matchedRefs = hits.map((h) => h.id);
            } else {
                // Regex fallback — exact whole-word match.
                const wordRegex = _buildWordRegex(q);
                matchedRefs = Object.keys(searchIndex).filter((ref) => wordRegex.test(searchIndex[ref]));
            }

            const matches = matchedRefs.map((ref) => {
                const colonIdx = ref.lastIndexOf(':');
                const spaceIdx = ref.lastIndexOf(' ', colonIdx);
                return {
                    ref,
                    book:    ref.slice(0, spaceIdx),
                    chapter: Number(ref.slice(spaceIdx + 1, colonIdx)),
                    verse:   Number(ref.slice(colonIdx + 1)),
                };
            });

            const uniqueBooks = [...new Set(matches.map((m) => m.book))];
            const bookDataMap = new Map();

            for (let i = 0; i < uniqueBooks.length; i += SEARCH_CONCURRENCY) {
                const chunk = uniqueBooks.slice(i, i + SEARCH_CONCURRENCY);
                const entries = await Promise.all(
                    chunk.map(async (book) => [book, await this._loadBook(this._translation, book)])
                );
                for (const [book, data] of entries) bookDataMap.set(book, data);

                if (typeof onBatchResults === 'function') {
                    const partial = [];
                    for (const { ref, book, chapter, verse } of matches) {
                        if (!bookDataMap.has(book)) continue;
                        const bookData = bookDataMap.get(book);
                        const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                        const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                        const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                        const text = originalText != null ? String(originalText) : searchIndex[ref];
                        partial.push({ reference: ref, content: text, book, chapter, verse, text });
                    }
                    if (partial.length > 0) onBatchResults(partial);
                }
            }

            const results = [];
            for (const { ref, book, chapter, verse } of matches) {
                const bookData = bookDataMap.get(book);
                const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                const text = originalText != null ? String(originalText) : searchIndex[ref];
                results.push({ reference: ref, content: text, book, chapter, verse, text });
            }

            return { results, total_results: results.length, page_size: PAGE_SIZE };
        }

        // Slow path: no search index — scan book JSONs with regex.
        const wordRegex = _buildWordRegex(q);
        const bookList = this._translationBookLists.get(this._translation) ?? BOOK_LOAD_ORDER;
        const allResults = [];

        for (let i = 0; i < bookList.length; i += SEARCH_CONCURRENCY) {
            const batch = bookList.slice(i, i + SEARCH_CONCURRENCY);
            const bookDataList = await Promise.all(
                batch.map((book) => this._loadBook(this._translation, book))
            );
            const batchResults = [];
            for (let j = 0; j < batch.length; j++) {
                const book = batch[j];
                const bookData = bookDataList[j];
                if (!bookData) continue;
                const resolvedKey = _resolveBookKey(bookData, book);
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                const chapterEntries = Object.entries(resolvedBookData)
                    .sort((a, b) => Number(a[0]) - Number(b[0]));
                for (const [chapterStr, chapterData] of chapterEntries) {
                    if (!chapterData || typeof chapterData !== 'object') continue;
                    const verseEntries = Object.entries(chapterData)
                        .filter(([verseStr]) => Number(verseStr) > 0)
                        .sort((a, b) => Number(a[0]) - Number(b[0]));
                    for (const [verseStr, text] of verseEntries) {
                        const verseText = String(text || '');
                        if (!wordRegex.test(verseText)) continue;
                        batchResults.push({
                            reference: `${book} ${chapterStr}:${verseStr}`,
                            content:   verseText,
                            book,
                            chapter:   Number(chapterStr),
                            verse:     Number(verseStr),
                            text:      verseText,
                        });
                    }
                }
            }
            if (batchResults.length > 0) {
                allResults.push(...batchResults);
                if (typeof onBatchResults === 'function') onBatchResults(batchResults);
            }
        }

        return { results: allResults, total_results: allResults.length, page_size: PAGE_SIZE };
    }

    async searchPassagesAllTranslations(query, knownRefs) {
        const q = String(query || '').toLowerCase().trim();
        if (q.length < 3) return [];

        const wordRegex = _buildWordRegex(q);
        const activeTranslation = this._translation;

        // All LOCAL_TRANSLATIONS are always available — no idbIsDownloaded check needed.
        const candidates = [...LOCAL_TRANSLATIONS].filter((t) => t !== activeTranslation);

        if (candidates.length === 0) return [];

        // seen is keyed on "TRANSLATION::ref" so the same verse from two
        // different translations are both included as separate badged results.
        // knownRefs contains bare refs (e.g. "Genesis 1:1") from the
        // active-translation search. Prefix with activeTranslation to match the
        // "TRANSLATION::ref" key format used throughout seen.
        const seen = new Set(
            [...knownRefs].map((ref) => `${activeTranslation}::${ref}`)
        );
        const supplemental = [];

        await Promise.all(candidates.map(async (translation) => {
            const searchIndex = await this._loadSearchIndex(translation);

            if (searchIndex !== null) {
                const matches = [];
                for (const [ref, normalizedText] of Object.entries(searchIndex)) {
                    const seenKey = `${translation}::${ref}`;
                    if (seen.has(seenKey)) continue;
                    if (!wordRegex.test(normalizedText)) continue;
                    const colonIdx = ref.lastIndexOf(':');
                    const spaceIdx = ref.lastIndexOf(' ', colonIdx);
                    matches.push({
                        ref,
                        seenKey,
                        book:    ref.slice(0, spaceIdx),
                        chapter: Number(ref.slice(spaceIdx + 1, colonIdx)),
                        verse:   Number(ref.slice(colonIdx + 1)),
                    });
                }

                const uniqueBooks = [...new Set(matches.map((m) => m.book))];
                const bookDataMap = new Map(
                    await Promise.all(
                        uniqueBooks.map(async (book) => [book, await this._loadBook(translation, book)])
                    )
                );

                for (const { ref, seenKey, book, chapter, verse } of matches) {
                    if (seen.has(seenKey)) continue;
                    seen.add(seenKey);
                    const bookData = bookDataMap.get(book);
                    const resolvedKey = bookData ? _resolveBookKey(bookData, book) : null;
                    const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                    const originalText = resolvedBookData?.[String(chapter)]?.[String(verse)];
                    const text = originalText != null ? String(originalText) : searchIndex[ref];
                    supplemental.push({
                        reference:         ref,
                        content:           text,
                        book,
                        chapter,
                        verse,
                        text,
                        sourceTranslation: translation,
                    });
                }
                return;
            }

            // Slow path: scan whatever books are already in the memory cache.
            for (const book of BOOK_LOAD_ORDER) {
                const bookData = this._bookCache.get(`${translation}/${book}`)
                    ?? this._bookCache.get(`${translation}/${BOOK_KEY_ALIASES[book]}`);
                if (!bookData) continue;
                const resolvedKey = _resolveBookKey(bookData, book);
                const resolvedBookData = resolvedKey ? bookData[resolvedKey] ?? bookData : bookData;
                for (const [chapterStr, chapterData] of Object.entries(resolvedBookData)) {
                    if (!chapterData || typeof chapterData !== 'object') continue;
                    for (const [verseStr, text] of Object.entries(chapterData)) {
                        if (Number(verseStr) <= 0) continue;
                        const verseText = String(text || '');
                        if (!wordRegex.test(verseText)) continue;
                        const ref = `${book} ${chapterStr}:${verseStr}`;
                        const seenKey = `${translation}::${ref}`;
                        if (seen.has(seenKey)) continue;
                        seen.add(seenKey);
                        supplemental.push({
                            reference:         ref,
                            content:           verseText,
                            book,
                            chapter:           Number(chapterStr),
                            verse:             Number(verseStr),
                            text:              verseText,
                            sourceTranslation: translation,
                        });
                    }
                }
            }
        }));

        return supplemental;
    }
}
