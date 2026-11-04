import { parsePage } from './text.js';

const SYMBOL = /©|&copy;|\(c\)|copyright/gi;
const YEAR_OR_RANGE = /\b((?:19|20)\d{2})\b(?:\s*(?:[-–—]|to)\s*(\d{2,4})\b)?/g;

/** All plausible years in a string. Handles "2015-2026" and "2015-26". */
function yearsIn(str, maxYear) {
  const years = [];
  for (const m of str.matchAll(YEAR_OR_RANGE)) {
    const start = Number(m[1]);
    years.push(start);
    if (m[2]) {
      let end = Number(m[2]);
      if (m[2].length === 2) end = Math.floor(start / 100) * 100 + end;
      if (end >= start) years.push(end);
    }
  }
  return years.filter((y) => y >= 1990 && y <= maxYear + 1);
}

/** Look for a copyright statement + year inside a block of text. */
function scan(text, maxYear) {
  let best = null;
  let symbolSeen = false;
  let statement = null; // a copyright line that has no year in it

  for (const m of text.matchAll(SYMBOL)) {
    symbolSeen = true;

    // 1. Look for year AFTER the symbol first (standard: "© 2026", "Copyright 2020-2026")
    const afterWindow = text.slice(m.index, m.index + 90);
    let years = yearsIn(afterWindow, maxYear);
    let snippet = afterWindow;

    // 2. Only if no year follows the symbol, check if year preceded it (e.g. "2026 © Acme")
    if (!years.length) {
      const start = Math.max(0, m.index - 15);
      const beforeWindow = text.slice(start, m.index);
      const beforeYears = yearsIn(beforeWindow, maxYear);
      if (beforeYears.length) {
        years = beforeYears;
        snippet = text.slice(start, m.index + 90);
        if (start > 0) snippet = snippet.replace(/^\S*\s/, ''); // drop partial leading word
      }
    }

    if (!years.length) {
      if (!statement && m[0] !== '(c)' && m[0] !== '(C)') {
        const raw = text.slice(m.index, m.index + 80);
        const upToRights = raw.match(/^.*?all rights reserved\.?/i); // drop trailing icon labels etc.
        statement = (upToRights ? upToRights[0] : raw.slice(0, 60)).trim();
      }
      continue;
    }

    const year = Math.max(...years);
    if (!best || year > best.year) {
      best = { year, text: snippet.trim() };
    }
  }

  return { best, symbolSeen, statement };
}

/**
 * Detect the copyright year of a page.
 * @returns {{ status: 'current'|'outdated'|'no_year'|'missing', year: number|null,
 *             text: string|null, source: 'footer'|'page'|null, dynamic: boolean }}
 */
export function detectCopyright(html, { currentYear = new Date().getFullYear() } = {}) {
  const { footerText, bodyText, scripts } = parsePage(html);

  const inFooter = scan(footerText, currentYear);
  let found = inFooter;
  let source = 'footer';
  if (!found.best) {
    found = scan(bodyText, currentYear);
    source = 'page';
    found.statement = inFooter.statement || found.statement;
    found.symbolSeen = found.symbolSeen || inFooter.symbolSeen;
  }

  if (found.best) {
    return {
      status: found.best.year >= currentYear ? 'current' : 'outdated',
      year: found.best.year,
      text: found.best.text,
      source,
      dynamic: false,
    };
  }

  // Year is probably injected by JavaScript: © symbol present, no static year, getFullYear() in a script.
  if (found.symbolSeen && /getFullYear\s*\(/.test(scripts)) {
    return { status: 'current', year: currentYear, text: null, source, dynamic: true };
  }

  // A copyright line exists but states no year, so there is nothing to compare with the current year.
  if (found.statement) {
    return { status: 'no_year', year: null, text: found.statement, source, dynamic: false };
  }

  return { status: 'missing', year: null, text: null, source: null, dynamic: false };
}
