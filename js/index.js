let activeTag = null;

const tags = [...new Set(posts.map(p => p.tag))].sort();

function toggleDropdown() {
  document.getElementById('dropdownMenu').classList.toggle('open');
}

function setFilter(tag) {
  activeTag = tag === 'all' ? null : tag;
  document.getElementById('dropdownMenu').classList.remove('open');
  renderDropdown();
  renderList();
}

function renderDropdown() {
  document.getElementById('categoriesBtn').classList.toggle('active', activeTag !== null);
  document.getElementById('dropdownMenu').innerHTML = ['all', ...tags].map(t => {
    const isActive = t === 'all' ? !activeTag : t === activeTag;
    return `<a href="#" class="${isActive ? 'active' : ''}" onclick="setFilter('${t}'); return false;">${t}</a>`;
  }).join('');
}

function renderList() {
  const filtered = activeTag ? posts.filter(p => p.tag === activeTag) : posts;
  document.getElementById('postList').innerHTML = filtered.map((p) => `
    <div class="post-item">
      <div class="meta">${p.date} &nbsp;·&nbsp; ${p.tag}</div>
      <div class="post-title"><a href="${p.url}">${p.title}</a></div>
      <div class="excerpt">${p.excerpt}</div>
      <a class="read-more" href="${p.url}">read more</a>
    </div>
  `).join('');
  document.getElementById('footerCount').textContent = `${filtered.length} entries`;
  document.getElementById('status').textContent = activeTag
    ? `// ${filtered.length} ${activeTag}`
    : `// ${posts.length} entries`;
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.nav-dropdown')) {
    document.getElementById('dropdownMenu').classList.remove('open');
  }
});

renderDropdown();
renderList();
