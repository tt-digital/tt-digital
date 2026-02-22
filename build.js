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

// ── Post HTML template ────────────────────────────────────────────────────────
function renderPostHtml(post) {
  const hasGpx   = !!post.gpx;
  const leaflet  = hasGpx
    ? `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">\n` : '';
  const embedDiv = hasGpx
    ? `    <div class="trail-embed" data-gpx="../${post.gpx}"></div>\n    ` : '';
  const trailScripts = hasGpx ? `
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>
<script src="../js/trail-embed.js"></script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${post.title} — tt-digital</title>
<meta name="description" content="${post.excerpt}">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
${leaflet}<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="stylesheet" href="../css/style.css">
<script src="../js/theme.js"></script>
</head>
<body>

<header>
  <a class="logo" href="../index.html">tt-digital</a>
  <nav>
    <a href="../index.html">posts</a>
    <div class="nav-dropdown">
      <a href="#" id="categoriesBtn" onclick="toggleDropdown(); return false;">categories</a>
      <div class="dropdown-menu" id="dropdownMenu"></div>
    </div>
    <a href="../about.html">about</a>
    <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()"></button>
  </nav>
</header>

<div class="status">// ${post.date} &nbsp;·&nbsp; ${post.tag}</div>

<main>
  <article class="single-post">
    <a class="back-btn" href="../index.html">back</a>
    <h1>${post.title}</h1>
    ${embedDiv}<div class="post-body">${post.body}</div>
  </article>
</main>

<footer>
  <span>tt-digital v1.0</span>
  <span></span>
</footer>

<script src="../js/posts.js"></script>
<script src="../js/nav.js"></script>${trailScripts}
</body>
</html>
`;
}
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
  const htmlFilename     = filename.replace('.md', '.html');

  const post = {
    id:      i + 1,
    slug:    slugFromFilename(filename),
    date:    meta.date    || dateFromFilename(filename) || '',
    tag:     meta.tag     || '',
    title:   meta.title   || slugFromFilename(filename),
    excerpt: meta.excerpt || '',
    body:    parseMarkdown(body),
    url:     `posts/${htmlFilename}`,
    ...(meta.gpx ? { gpx: meta.gpx } : {}),
  };

  fs.writeFileSync(path.join(POSTS_DIR, htmlFilename), renderPostHtml(post));

  return post;
});

fs.writeFileSync(OUT_FILE, `const posts = ${JSON.stringify(posts, null, 2)};\n`);
console.log(`built ${posts.length} post${posts.length === 1 ? '' : 's'} → js/posts.js`);
