// bible-api.js
import { FIREBASE_DB_URL } from './config/firebase-config.js';
import { normaliseBookAlias } from './book-aliases.js';
import {
    idbGetBook, idbPutBook,
    idbGetSearchIndex, idbPutSearchIndex,
    idbIsDownloaded, idbMarkDownloaded,
    idbDeleteTranslation,
} from './translation-store.js';

// MiniSearch 7.1.2 — inlined from UMD build
const t="KEYS",e="VALUES",s="";class i{constructor(t,e){const s=t._tree,i=Array.from(s.keys());this.set=t,this._type=e,this._path=i.length>0?[{node:s,keys:i}]:[]}next(){const t=this.dive();return this.backtrack(),t}dive(){if(0===this._path.length)return{done:!0,value:void 0};const{node:t,keys:e}=n(this._path);if(n(e)===s)return{done:!1,value:this.result()};const i=t.get(n(e));return this._path.push({node:i,keys:Array.from(i.keys())}),this.dive()}backtrack(){if(0===this._path.length)return;const t=n(this._path).keys;t.pop(),t.length>0||(this._path.pop(),this.backtrack())}key(){return this.set._prefix+this._path.map((({keys:t})=>n(t))).filter((t=>t!==s)).join("")}value(){return n(this._path).node.get(s)}result(){switch(this._type){case e:return this.value();case t:return this.key();default:return[this.key(),this.value()]}}[Symbol.iterator](){return this}}const n=t=>t[t.length-1],o=(t,e,i,n,r,c,h,u)=>{const d=c*h;t:for(const a of t.keys())if(a===s){const e=r[d-1];e<=i&&n.set(u,[t.get(a),e])}else{let s=c;for(let t=0;t<a.length;++t,++s){const n=a[t],o=h*s,c=o-h;let u=r[o];const d=Math.max(0,s-i-1),l=Math.min(h-1,s+i);for(let t=d;t<l;++t){const s=n!==e[t],i=r[c+t]+ +s,h=r[c+t+1]+1,d=r[o+t]+1,a=r[o+t+1]=Math.min(i,h,d);a<u&&(u=a)}if(u>i)continue t}o(t.get(a),e,i,n,r,s,h,u+a)}};class r{constructor(t=new Map,e=""){this._size=void 0,this._tree=t,this._prefix=e}atPrefix(t){if(!t.startsWith(this._prefix))throw new Error("Mismatched prefix");const[e,i]=c(this._tree,t.slice(this._prefix.length));if(void 0===e){const[e,n]=f(i);for(const i of e.keys())if(i!==s&&i.startsWith(n)){const s=new Map;return s.set(i.slice(n.length),e.get(i)),new r(s,t)}}return new r(e,t)}clear(){this._size=void 0,this._tree.clear()}delete(t){return this._size=void 0,d(this._tree,t)}entries(){return new i(this,"ENTRIES")}forEach(t){for(const[e,s]of this)t(e,s,this)}fuzzyGet(t,e){return((t,e,s)=>{const i=new Map;if(void 0===e)return i;const n=e.length+1,r=n+s,c=new Uint8Array(r*n).fill(s+1);for(let t=0;t<n;++t)c[t]=t;for(let t=1;t<r;++t)c[t*n]=t;return o(t,e,s,i,c,1,n,""),i})(this._tree,t,e)}get(t){const e=h(this._tree,t);return void 0!==e?e.get(s):void 0}has(t){const e=h(this._tree,t);return void 0!==e&&e.has(s)}keys(){return new i(this,t)}set(t,e){if("string"!=typeof t)throw new Error("key must be a string");this._size=void 0;return u(this._tree,t).set(s,e),this}get size(){if(this._size)return this._size;this._size=0;const t=this.entries();for(;!t.next().done;)this._size+=1;return this._size}update(t,e){if("string"!=typeof t)throw new Error("key must be a string");this._size=void 0;const i=u(this._tree,t);return i.set(s,e(i.get(s))),this}fetch(t,e){if("string"!=typeof t)throw new Error("key must be a string");this._size=void 0;const i=u(this._tree,t);let n=i.get(s);return void 0===n&&i.set(s,n=e()),n}values(){return new i(this,e)}[Symbol.iterator](){return this.entries()}static from(t){const e=new r;for(const[s,i]of t)e.set(s,i);return e}static fromObject(t){return r.from(Object.entries(t))}}const c=(t,e,i=[])=>{if(0===e.length||null==t)return[t,i];for(const n of t.keys())if(n!==s&&e.startsWith(n))return i.push([t,n]),c(t.get(n),e.slice(n.length),i);return i.push([t,e]),c(void 0,"",i)},h=(t,e)=>{if(0===e.length||null==t)return t;for(const i of t.keys())if(i!==s&&e.startsWith(i))return h(t.get(i),e.slice(i.length))},u=(t,e)=>{const i=e.length;t:for(let n=0;t&&n<i;){for(const o of t.keys())if(o!==s&&e[n]===o[0]){const s=Math.min(i-n,o.length);let r=1;for(;r<s&&e[n+r]===o[r];)++r;const c=t.get(o);if(r===o.length)t=c;else{const s=new Map;s.set(o.slice(r),c),t.set(e.slice(n,n+r),s),t.delete(o),t=s}n+=r;continue t}const o=new Map;return t.set(e.slice(n),o),o}return t},d=(t,e)=>{const[i,n]=c(t,e);if(void 0!==i)if(i.delete(s),0===i.size)a(n);else if(1===i.size){const[t,e]=i.entries().next().value;l(n,t,e)}},a=t=>{if(0===t.length)return;const[e,i]=f(t);if(e.delete(i),0===e.size)a(t.slice(0,-1));else if(1===e.size){const[i,n]=e.entries().next().value;i!==s&&l(t.slice(0,-1),i,n)}},l=(t,e,s)=>{if(0===t.length)return;const[i,n]=f(t);i.set(n+e,s),i.delete(n)},f=t=>t[t.length-1],m="or",_="and",g="and_not";class p{constructor(t){if(null==(null==t?void 0:t.fields))throw new Error('MiniSearch: option "fields" must be provided');const e=null==t.autoVacuum||!0===t.autoVacuum?M:t.autoVacuum;this._options={...z,...t,autoVacuum:e,searchOptions:{...b,...t.searchOptions||{}},autoSuggestOptions:{...I,...t.autoSuggestOptions||{}}},this._index=new r,this._documentCount=0,this._documentIds=new Map,this._idToShortId=new Map,this._fieldIds={},this._fieldLength=new Map,this._avgFieldLength=[],this._nextId=0,this._storedFields=new Map,this._dirtCount=0,this._currentVacuum=null,this._enqueuedVacuum=null,this._enqueuedVacuumConditions=F,this.addFields(this._options.fields)}add(t){const{extractField:e,tokenize:s,processTerm:i,fields:n,idField:o}=this._options,r=e(t,o);if(null==r)throw new Error(`MiniSearch: document does not have ID field "${o}"`);if(this._idToShortId.has(r))throw new Error(`MiniSearch: duplicate ID ${r}`);const c=this.addDocumentId(r);this.saveStoredFields(c,t);for(const o of n){const n=e(t,o);if(null==n)continue;const r=s(n.toString(),o),h=this._fieldIds[o],u=new Set(r).size;this.addFieldLength(c,h,this._documentCount-1,u);for(const t of r){const e=i(t,o);if(Array.isArray(e))for(const t of e)this.addTerm(h,c,t);else e&&this.addTerm(h,c,e)}}}addAll(t){for(const e of t)this.add(e)}addAllAsync(t,e={}){const{chunkSize:s=10}=e,i={chunk:[],promise:Promise.resolve()},{chunk:n,promise:o}=t.reduce((({chunk:t,promise:e},i,n)=>(t.push(i),(n+1)%s==0?{chunk:[],promise:e.then((()=>new Promise((t=>setTimeout(t,0))))).then((()=>this.addAll(t)))}:{chunk:t,promise:e})),i);return o.then((()=>this.addAll(n)))}remove(t){const{tokenize:e,processTerm:s,extractField:i,fields:n,idField:o}=this._options,r=i(t,o);if(null==r)throw new Error(`MiniSearch: document does not have ID field "${o}"`);const c=this._idToShortId.get(r);if(null==c)throw new Error(`MiniSearch: cannot remove document with ID ${r}: it is not in the index`);for(const o of n){const n=i(t,o);if(null==n)continue;const r=e(n.toString(),o),h=this._fieldIds[o],u=new Set(r).size;this.removeFieldLength(c,h,this._documentCount,u);for(const t of r){const e=s(t,o);if(Array.isArray(e))for(const t of e)this.removeTerm(h,c,t);else e&&this.removeTerm(h,c,e)}}this._storedFields.delete(c),this._documentIds.delete(c),this._idToShortId.delete(r),this._fieldLength.delete(c),this._documentCount-=1}removeAll(t){if(t)for(const e of t)this.remove(e);else{if(arguments.length>0)throw new Error("Expected documents to be present. Omit the argument to remove all documents.");this._index=new r,this._documentCount=0,this._documentIds=new Map,this._idToShortId=new Map,this._fieldLength=new Map,this._avgFieldLength=[],this._storedFields=new Map,this._nextId=0}}discard(t){const e=this._idToShortId.get(t);if(null==e)throw new Error(`MiniSearch: cannot discard document with ID ${t}: it is not in the index`);this._idToShortId.delete(t),this._documentIds.delete(e),this._storedFields.delete(e),(this._fieldLength.get(e)||[]).forEach(((t,s)=>{this.removeFieldLength(e,s,this._documentCount,t)})),this._fieldLength.delete(e),this._documentCount-=1,this._dirtCount+=1,this.maybeAutoVacuum()}maybeAutoVacuum(){if(!1===this._options.autoVacuum)return;const{minDirtFactor:t,minDirtCount:e,batchSize:s,batchWait:i}=this._options.autoVacuum;this.conditionalVacuum({batchSize:s,batchWait:i},{minDirtCount:e,minDirtFactor:t})}discardAll(t){const e=this._options.autoVacuum;try{this._options.autoVacuum=!1;for(const e of t)this.discard(e)}finally{this._options.autoVacuum=e}this.maybeAutoVacuum()}replace(t){const{idField:e,extractField:s}=this._options,i=s(t,e);this.discard(i),this.add(t)}vacuum(t={}){return this.conditionalVacuum(t)}conditionalVacuum(t,e){return this._currentVacuum?(this._enqueuedVacuumConditions=this._enqueuedVacuumConditions&&e,null!=this._enqueuedVacuum||(this._enqueuedVacuum=this._currentVacuum.then((()=>{const e=this._enqueuedVacuumConditions;return this._enqueuedVacuumConditions=F,this.performVacuuming(t,e)}))),this._enqueuedVacuum):!1===this.vacuumConditionsMet(e)?Promise.resolve():(this._currentVacuum=this.performVacuuming(t),this._currentVacuum)}async performVacuuming(t,e){const s=this._dirtCount;if(this.vacuumConditionsMet(e)){const e=t.batchSize||S.batchSize,i=t.batchWait||S.batchWait;let n=1;for(const[t,s]of this._index){for(const[t,e]of s)for(const[i]of e)this._documentIds.has(i)||(e.size<=1?s.delete(t):e.delete(i));0===this._index.get(t).size&&this._index.delete(t),n%e==0&&await new Promise((t=>setTimeout(t,i))),n+=1}this._dirtCount-=s}await null,this._currentVacuum=this._enqueuedVacuum,this._enqueuedVacuum=null}vacuumConditionsMet(t){if(null==t)return!0;let{minDirtCount:e,minDirtFactor:s}=t;return e=e||M.minDirtCount,s=s||M.minDirtFactor,this.dirtCount>=e&&this.dirtFactor>=s}get isVacuuming(){return null!=this._currentVacuum}get dirtCount(){return this._dirtCount}get dirtFactor(){return this._dirtCount/(1+this._documentCount+this._dirtCount)}has(t){return this._idToShortId.has(t)}getStoredFields(t){const e=this._idToShortId.get(t);if(null!=e)return this._storedFields.get(e)}search(t,e={}){const{searchOptions:s}=this._options,i={...s,...e},n=this.executeQuery(t,e),o=[];for(const[t,{score:e,terms:s,match:r}]of n){const n=s.length||1,c={id:this._documentIds.get(t),score:e*n,terms:Object.keys(r),queryTerms:s,match:r};Object.assign(c,this._storedFields.get(t)),(null==i.filter||i.filter(c))&&o.push(c)}return t===p.wildcard&&null==i.boostDocument||o.sort(V),o}autoSuggest(t,e={}){e={...this._options.autoSuggestOptions,...e};const s=new Map;for(const{score:i,terms:n}of this.search(t,e)){const t=n.join(" "),e=s.get(t);null!=e?(e.score+=i,e.count+=1):s.set(t,{score:i,terms:n,count:1})}const i=[];for(const[t,{score:e,terms:n,count:o}]of s)i.push({suggestion:t,terms:n,score:e/o});return i.sort(V),i}get documentCount(){return this._documentCount}get termCount(){return this._index.size}static loadJSON(t,e){if(null==e)throw new Error("MiniSearch: loadJSON should be given the same options used when serializing the index");return this.loadJS(JSON.parse(t),e)}static async loadJSONAsync(t,e){if(null==e)throw new Error("MiniSearch: loadJSON should be given the same options used when serializing the index");return this.loadJSAsync(JSON.parse(t),e)}static getDefault(t){if(z.hasOwnProperty(t))return w(z,t);throw new Error(`MiniSearch: unknown option "${t}"`)}static loadJS(t,e){const{index:s,documentIds:i,fieldLength:n,storedFields:o,serializationVersion:r}=t,c=this.instantiateMiniSearch(t,e);c._documentIds=T(i),c._fieldLength=T(n),c._storedFields=T(o);for(const[t,e]of c._documentIds)c._idToShortId.set(e,t);for(const[t,e]of s){const s=new Map;for(const t of Object.keys(e)){let i=e[t];1===r&&(i=i.ds),s.set(parseInt(t,10),T(i))}c._index.set(t,s)}return c}static async loadJSAsync(t,e){const{index:s,documentIds:i,fieldLength:n,storedFields:o,serializationVersion:r}=t,c=this.instantiateMiniSearch(t,e);c._documentIds=await L(i),c._fieldLength=await L(n),c._storedFields=await L(o);for(const[t,e]of c._documentIds)c._idToShortId.set(e,t);let h=0;for(const[t,e]of s){const s=new Map;for(const t of Object.keys(e)){let i=e[t];1===r&&(i=i.ds),s.set(parseInt(t,10),await L(i))}++h%1e3==0&&await E(0),c._index.set(t,s)}return c}static instantiateMiniSearch(t,e){const{documentCount:s,nextId:i,fieldIds:n,averageFieldLength:o,dirtCount:c,serializationVersion:h}=t;if(1!==h&&2!==h)throw new Error("MiniSearch: cannot deserialize an index created with an incompatible version");const u=new p(e);return u._documentCount=s,u._nextId=i,u._idToShortId=new Map,u._fieldIds=n,u._avgFieldLength=o,u._dirtCount=c||0,u._index=new r,u}executeQuery(t,e={}){if(t===p.wildcard)return this.executeWildcardQuery(e);if("string"!=typeof t){const s={...e,...t,queries:void 0},i=t.queries.map((t=>this.executeQuery(t,s)));return this.combineResults(i,s.combineWith)}const{tokenize:s,processTerm:i,searchOptions:n}=this._options,o={tokenize:s,processTerm:i,...n,...e},{tokenize:r,processTerm:c}=o,h=r(t).flatMap((t=>c(t))).filter((t=>!!t)).map(x(o)).map((t=>this.executeQuerySpec(t,o)));return this.combineResults(h,o.combineWith)}executeQuerySpec(t,e){const s={...this._options.searchOptions,...e},i=(s.fields||this._options.fields).reduce(((t,e)=>({...t,[e]:w(s.boost,e)||1})),{}),{boostDocument:n,weights:o,maxFuzzy:r,bm25:c}=s,{fuzzy:h,prefix:u}={...b.weights,...o},d=this._index.get(t.term),a=this.termResults(t.term,t.term,1,t.termBoost,d,i,n,c);let l,f;if(t.prefix&&(l=this._index.atPrefix(t.term)),t.fuzzy){const e=!0===t.fuzzy?.2:t.fuzzy,s=e<1?Math.min(r,Math.round(t.term.length*e)):e;s&&(f=this._index.fuzzyGet(t.term,s))}if(l)for(const[e,s]of l){const o=e.length-t.term.length;if(!o)continue;null==f||f.delete(e);const r=u*e.length/(e.length+.3*o);this.termResults(t.term,e,r,t.termBoost,s,i,n,c,a)}if(f)for(const e of f.keys()){const[s,o]=f.get(e);if(!o)continue;const r=h*e.length/(e.length+o);this.termResults(t.term,e,r,t.termBoost,s,i,n,c,a)}return a}executeWildcardQuery(t){const e=new Map,s={...this._options.searchOptions,...t};for(const[t,i]of this._documentIds){const n=s.boostDocument?s.boostDocument(i,"",this._storedFields.get(t)):1;e.set(t,{score:n,terms:[],match:{}})}return e}combineResults(t,e=m){if(0===t.length)return new Map;const s=e.toLowerCase(),i=y[s];if(!i)throw new Error(`Invalid combination operator: ${e}`);return t.reduce(i)||new Map}toJSON(){const t=[];for(const[e,s]of this._index){const i={};for(const[t,e]of s)i[t]=Object.fromEntries(e);t.push([e,i])}return{documentCount:this._documentCount,nextId:this._nextId,documentIds:Object.fromEntries(this._documentIds),fieldIds:this._fieldIds,fieldLength:Object.fromEntries(this._fieldLength),averageFieldLength:this._avgFieldLength,storedFields:Object.fromEntries(this._storedFields),dirtCount:this._dirtCount,index:t,serializationVersion:2}}termResults(t,e,s,i,n,o,r,c,h=new Map){if(null==n)return h;for(const u of Object.keys(o)){const d=o[u],a=this._fieldIds[u],l=n.get(a);if(null==l)continue;let f=l.size;const m=this._avgFieldLength[a];for(const n of l.keys()){if(!this._documentIds.has(n)){this.removeTerm(a,n,e),f-=1;continue}const o=r?r(this._documentIds.get(n),e,this._storedFields.get(n)):1;if(!o)continue;const _=l.get(n),g=this._fieldLength.get(n)[a],p=s*i*d*o*v(_,f,this._documentCount,g,m,c),y=h.get(n);if(y){y.score+=p,k(y.terms,t);const s=w(y.match,e);s?s.push(u):y.match[e]=[u]}else h.set(n,{score:p,terms:[t],match:{[e]:[u]}})}}return h}addTerm(t,e,s){const i=this._index.fetch(s,O);let n=i.get(t);if(null==n)n=new Map,n.set(e,1),i.set(t,n);else{const t=n.get(e);n.set(e,(t||0)+1)}}removeTerm(t,e,s){if(!this._index.has(s))return void this.warnDocumentChanged(e,t,s);const i=this._index.fetch(s,O),n=i.get(t);null==n||null==n.get(e)?this.warnDocumentChanged(e,t,s):n.get(e)<=1?n.size<=1?i.delete(t):n.delete(e):n.set(e,n.get(e)-1),0===this._index.get(s).size&&this._index.delete(s)}warnDocumentChanged(t,e,s){for(const i of Object.keys(this._fieldIds))if(this._fieldIds[i]===e)return void this._options.logger("warn",`MiniSearch: document with ID ${this._documentIds.get(t)} has changed before removal: term "${s}" was not present in field "${i}". Removing a document after it has changed can corrupt the index!`,"version_conflict")}addDocumentId(t){const e=this._nextId;return this._idToShortId.set(t,e),this._documentIds.set(e,t),this._documentCount+=1,this._nextId+=1,e}addFields(t){for(let e=0;e<t.length;e++)this._fieldIds[t[e]]=e}addFieldLength(t,e,s,i){let n=this._fieldLength.get(t);null==n&&this._fieldLength.set(t,n=[]),n[e]=i;const o=(this._avgFieldLength[e]||0)*s+i;this._avgFieldLength[e]=o/(s+1)}removeFieldLength(t,e,s,i){if(1===s)return void(this._avgFieldLength[e]=0);const n=this._avgFieldLength[e]*s-i;this._avgFieldLength[e]=n/(s-1)}saveStoredFields(t,e){const{storeFields:s,extractField:i}=this._options;if(null==s||0===s.length)return;let n=this._storedFields.get(t);null==n&&this._storedFields.set(t,n={});for(const t of s){const s=i(e,t);void 0!==s&&(n[t]=s)}}}p.wildcard=Symbol("*");const w=(t,e)=>Object.prototype.hasOwnProperty.call(t,e)?t[e]:void 0,y={[m]:(t,e)=>{for(const s of e.keys()){const i=t.get(s);if(null==i)t.set(s,e.get(s));else{const{score:t,terms:n,match:o}=e.get(s);i.score=i.score+t,i.match=Object.assign(i.match,o),C(i.terms,n)}}return t},[_]:(t,e)=>{const s=new Map;for(const i of e.keys()){const n=t.get(i);if(null==n)continue;const{score:o,terms:r,match:c}=e.get(i);C(n.terms,r),s.set(i,{score:n.score+o,terms:n.terms,match:Object.assign(n.match,c)})}return s},[g]:(t,e)=>{for(const s of e.keys())t.delete(s);return t}},v=(t,e,s,i,n,o)=>{const{k:r,b:c,d:h}=o;return Math.log(1+(s-e+.5)/(e+.5))*(h+t*(r+1)/(t+r*(1-c+c*i/n)))},x=t=>(e,s,i)=>({term:e,fuzzy:"function"==typeof t.fuzzy?t.fuzzy(e,s,i):t.fuzzy||!1,prefix:"function"==typeof t.prefix?t.prefix(e,s,i):!0===t.prefix,termBoost:"function"==typeof t.boostTerm?t.boostTerm(e,s,i):1}),z={idField:"id",extractField:(t,e)=>t[e],tokenize:t=>t.split(D),processTerm:t=>t.toLowerCase(),fields:void 0,searchOptions:void 0,storeFields:[],logger:(t,e)=>{"function"==typeof(null===console||void 0===console?void 0:console[t])&&console[t](e)},autoVacuum:!0},b={combineWith:m,prefix:!1,fuzzy:!1,maxFuzzy:6,boost:{},weights:{fuzzy:.45,prefix:.375},bm25:{k:1.2,b:.7,d:.5}},I={combineWith:"and",prefix:(t,e,s)=>e===s.length-1},S={batchSize:1e3,batchWait:10},F={minDirtFactor:.1,minDirtCount:20},M={...S,...F},k=(t,e)=>{t.includes(e)||t.push(e)},C=(t,e)=>{for(const s of e)t.includes(s)||t.push(s)},V=({score:t},{score:e})=>e-t,O=()=>new Map,T=t=>{const e=new Map;for(const s of Object.keys(t))e.set(parseInt(s,10),t[s]);return e},L=async t=>{const e=new Map;let s=0;for(const i of Object.keys(t))e.set(parseInt(i,10),t[i]),++s%1e3==0&&await E(0);return e},E=t=>new Promise((e=>setTimeout(e,t))),D=/[\n\r\p{Z}\p{P}]+/u;
const _MiniSearchClass = p;


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


function _normalizeTerm(word) {
    const w = word.toLowerCase();
    if (w.length < 3) return w;
    // loved/moved/fixed -> lov/mov/fix  (strip -ed after consonant)
    if (w.endsWith('ed') && w.length > 4 && !'aeiou'.includes(w[w.length - 3])) {
        return w.slice(0, -2);
    }
    // loves/moves/fixes -> lov/mov/fix  (strip -es after consonant)
    if (w.endsWith('es') && w.length > 4 && !'aeiou'.includes(w[w.length - 3])) {
        return w.slice(0, -2);
    }
    // love/grace/name -> lov/grac/nam  (strip silent trailing -e after consonant)
    if (w.endsWith('e') && w.length >= 4 && !'aeiou'.includes(w[w.length - 2])) {
        return w.slice(0, -1);
    }
    // commandments -> commandment  (plain plural -s after consonant)
    if (w.endsWith('s') && w.length > 4 && !'aeiou'.includes(w[w.length - 2])) {
        return w.slice(0, -1);
    }
    return w;
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
                    processTerm: (term) => _normalizeTerm(term),
                    searchOptions: {
                        prefix: true,
                        fuzzy: 0,
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
