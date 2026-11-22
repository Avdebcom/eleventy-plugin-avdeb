# Changelog

## 0.1.0 - 2026-11-22

- First release: `avdebProducts`, `avdebProduct` and `avdebButton` shortcodes, `{avdeb-…}` tags in Markdown and HTML, the `avdeb`, `avdebStrip` and `avdebData` filters.
- Grid, carousel, list and spotlight layouts; horizontal, hero and card single products; referral buttons.
- Products cached in memory and in `.cache/avdeb` between builds; the last good copy is used for a week if AVDEB can't be reached.
- Stylesheet and carousel script copied to the output and linked only on pages that show products.
