const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.resolve(__dirname, '..', 'translations');
const filter = process.argv.slice(2);

const dirs = fs.readdirSync(TRANSLATIONS_DIR).filter(name => {
  const full = path.join(TRANSLATIONS_DIR, name);
  return fs.statSync(full).isDirectory() && (!filter.length || filter.includes(name));
});

for (const t of dirs) {
  const metaPath = path.join(TRANSLATIONS_DIR, t, 'meta.json');
  if (!fs.existsSync(metaPath)) { console.warn(`[${t}] no meta.json, skipping`); continue; }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!Array.isArray(meta.books)) { console.warn(`[${t}] meta.books missing, skipping`); continue; }

  const index = {};

  for (const bookName of meta.books) {
    const bookPath = path.join(TRANSLATIONS_DIR, t, `${bookName}.json`);
    if (!fs.existsSync(bookPath)) continue;

    const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'));

    let chapters = bookData;
    const keys = Object.keys(bookData);
    if (keys.length === 1 && isNaN(Number(keys[0]))) chapters = bookData[keys[0]];

    for (const [ch, verses] of Object.entries(chapters)) {
      if (!verses || typeof verses !== 'object') continue;
      for (const [v, text] of Object.entries(verses)) {
        index[`${bookName} ${ch}:${v}`] = String(text).toLowerCase();
      }
    }
  }

  const outPath = path.join(TRANSLATIONS_DIR, t, `${t}_search_index.json`);
  fs.writeFileSync(outPath, JSON.stringify(index), 'utf8');
  console.log(`[${t}] ${Object.keys(index).length.toLocaleString()} verses written`);
}
