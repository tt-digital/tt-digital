#!/usr/bin/env node

const fs   = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'posts');
const OUT_FILE  = path.join(__dirname, 'js', 'posts.js');

// ── Frontmatter parser ───────────────────────────────────────────────────────
// Reads the --- block at the top of a .md file and returns { meta, body }
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: src.trim() };

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, ''); // strip optional quotes
    meta[key] = val;
  }

  return { meta, body: m[2].trim() };
}

// ── Markdown → HTML ──────────────────────────────────────────────────────────
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Inline elements: code, bold, italic
function inline(s) {
  return s
    .replace(/`([^`]+)`/g,       '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,   '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,       '<em>$1</em>')
    .replace(/_(.+?)_/g,         '<em>$1</em>');
}

// Block-level parser — line by line, handles:
//   fenced code blocks, h1–h3, blockquotes, paragraphs
function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html  = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // ── Blank line — skip
    if (!line.trim()) { i++; continue; }

    // ── Headings
    if (line.startsWith('### ')) { html.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue; }
    if (line.startsWith('## '))  { html.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith('# '))   { html.push(`<h1>${inline(line.slice(2))}</h1>`); i++; continue; }

    // ── Blockquote — collect consecutive > lines into one block
    if (line.startsWith('> ')) {
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      html.push(`<blockquote>${inline(bqLines.join(' '))}</blockquote>`);
      continue;
    }

    // ── Paragraph — collect until blank line or block-level element
    const pLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      !lines[i].startsWith('```')
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length) html.push(`<p>${inline(pLines.join(' '))}</p>`);
  }

  return html.join('\n');
}

// ── Filename helpers ──────────────────────────────────────────────────────────
// Strips optional YYYY-MM-DD- date prefix and .md extension
function slugFromFilename(f) {
  return f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
}

// Reads the date from YYYY-MM-DD- filename prefix, falls back to frontmatter
function dateFromFilename(f) {
  const m = f.match(/^(\d{4}-\d{2}-\d{2})-/);
  return m ? m[1] : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse(); // newest first (YYYY-MM-DD prefix makes this correct)

if (files.length === 0) {
  console.error('No .md files found in posts/');
  process.exit(1);
}

const posts = files.map((filename, i) => {
  const src              = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
  const { meta, body }   = parseFrontmatter(src);

  return {
    id:      i + 1,
    slug:    slugFromFilename(filename),
    date:    meta.date    || dateFromFilename(filename) || '',
    tag:     meta.tag     || '',
    title:   meta.title   || slugFromFilename(filename),
    excerpt: meta.excerpt || '',
    body:    parseMarkdown(body),
  };
});

fs.writeFileSync(OUT_FILE, `const posts = ${JSON.stringify(posts, null, 2)};\n`);
console.log(`built ${posts.length} post${posts.length === 1 ? '' : 's'} → js/posts.js`);
