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
