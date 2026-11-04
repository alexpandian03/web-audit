import * as cheerio from 'cheerio';

/** Visible text of an element, with spaces between sibling nodes and separators at block boundaries. */
export function textOf($, el) {
  const clone = $(el).clone();
  clone.find('script,style,noscript,template').remove();
  clone.find('p, div, section, article, aside, li, tr, h1, h2, h3, h4, h5, h6, br').each((_, n) => {
    $(n).append(' | ');
  });
  clone.find('*').each((_, n) => {
    $(n).prepend(' ').append(' ');
  });
  return clone.text().replace(/\s+/g, ' ').replace(/(?:\s*\|\s*)+/g, ' | ').trim();
}

const FOOTER_SELECTOR =
  'footer, [role="contentinfo"], [id*="footer" i], [class*="footer" i]';

/** Load HTML and return { $, footerText, bodyText, scripts }. */
export function parsePage(html) {
  const $ = cheerio.load(html);
  const bodyText = textOf($, $('body').length ? $('body') : $.root());
  // Elementor/WordPress put classes like "ehf-footer" on <body> or on page-sized wrappers.
  // Those are not footers, so drop <body>/<html> and anything holding most of the page's text.
  const footers = $(FOOTER_SELECTOR)
    .toArray()
    .filter((el) => {
      if (['body', 'html'].includes(el.tagName)) return false;
      return !(bodyText.length > 2000 && textOf($, el).length > bodyText.length * 0.5);
    });
  const footerText = footers.map((el) => textOf($, el)).join(' ').replace(/\s+/g, ' ').trim();
  const footerScripts = footers
    .map((el) => $(el).find('script').toArray().map((s) => $(s).html() || '').join('\n'))
    .join('\n');
  const scripts = $('script')
    .toArray()
    .map((el) => $(el).html() || '')
    .join('\n');
  return { $, footers, footerText, footerScripts, bodyText, scripts };
}
