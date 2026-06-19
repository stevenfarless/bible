from pathlib import Path

path = Path('index.html')
text = path.read_text()

critical_fonts = """	<style id="startup-font-faces">
		@font-face {
			font-family: 'Cinzel';
			src: url('./fonts/Cinzel-Regular.woff2') format('woff2');
			font-weight: 400;
			font-style: normal;
			font-display: swap;
		}

		@font-face {
			font-family: 'Gentium Book Plus';
			src: url('./fonts/GentiumBookPlus-Regular.woff2') format('woff2');
			font-weight: 400;
			font-style: normal;
			font-display: swap;
		}
	</style>
	<link rel="preload" href="css/fonts.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />
	<noscript><link rel="stylesheet" href="css/fonts.css" /></noscript>"""

old = '\t<link rel="stylesheet" href="css/fonts.css" />'

if old in text:
    text = text.replace(old, critical_fonts, 1)
    path.write_text(text)
elif 'id="startup-font-faces"' in text and 'rel="preload" href="css/fonts.css" as="style"' in text:
    print('Phase 9 font startup optimization is already present.')
else:
    raise SystemExit('Expected blocking fonts.css link was not found in index.html.')
