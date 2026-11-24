# PDF Korean font

NotoSansKR-Regular.ttf is a static weight400 instance of the official Google Fonts [Noto Sans KR variable font](https://github.com/google/fonts/tree/main/ofl/notosanskr), downloaded2026-11-12. The SIL OFL1.1 license is included in OFL.txt. Reserved font name: Source.

Generated with Python fontTools:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont('NotoSansKR[wght].ttf')
instantiateVariableFont(font, {'wght': 400}, inplace=True)
font.save('NotoSansKR-Regular.ttf')
```

Only the static font ships. PDF generation embeds it fully to avoid missing composite glyphs in fontkit subsetting. No runtime font download or Python dependency is required.

# Word bulletin fonts (`word/`)

`word/NotoSansKR-{Regular,SemiBold,Bold}.ttf` are the static 400/600/700 instances of Noto Sans KR from the npm package `@expo-google-fonts/noto-sans-kr@0.4.4` (SIL OFL 1.1, same license as above), pre-subset with fontTools to Latin, Latin-1/Extended-A/B, punctuation, symbols, arrows, box/geometric shapes, CJK symbols, Hangul Jamo/Compatibility Jamo, all modern Hangul syllables (U+AC00–D7A3) and full-width forms (no Hanja). Their name tables are intact (family "Noto Sans KR" Regular/Bold and "Noto Sans KR SemiBold"), which Word needs to match embedded fonts.

`/api/bulletins/word-fonts` cuts them down to the characters of one bulletin (subset-font/harfbuzz) and the print preview embeds the result in the downloaded .docx, so Word shows the same weights and widths as the preview.
