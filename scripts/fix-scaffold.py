from pathlib import Path

structure_path = Path('bsb-structure.js')
structure = structure_path.read_text()
structure_guard = "    if (translation === 'BST') return [];\n"
if structure.count(structure_guard) != 1:
    raise SystemExit('Expected BST scaffold guard not found exactly once')
structure_path.write_text(structure.replace(structure_guard, '', 1))

api_path = Path('bible-api.js')
api = api_path.read_text()
old = """        const verseNums = Object.keys(chapterData)
            .filter((v) => /^[1-9]\\d*(?:[a-z]+|-[1-9]\\d*[a-z]*)?$/i.test(v))
            .sort((a, b) => {"""
new = """        const verseNums = Object.keys(chapterData)
            .filter((v) => /^[1-9]\\d*(?:[a-z]+|-[1-9]\\d*[a-z]*)?$/i.test(v))
            .map((v) => /^\\d+$/.test(v) ? Number(v) : v)
            .sort((a, b) => {"""
if api.count(old) != 1:
    raise SystemExit('Expected verse normalization block not found exactly once')
api_path.write_text(api.replace(old, new, 1))

final_structure = structure_path.read_text()
final_api = api_path.read_text()
if "translation === 'BST'" in final_structure:
    raise SystemExit('BST scaffold guard still present')
if ".map((v) => /^\\d+$/.test(v) ? Number(v) : v)" not in final_api:
    raise SystemExit('Numeric verse normalization was not added')

print('Restored scaffold loading for BST and numeric scaffold keys.')
