let activeTag = new URLSearchParams(window.location.search).get('tag') || null;

window.setFilter = function (tag) {
  activeTag = tag === 'all' ? null : tag;
  history.replaceState(null, '', activeTag ? `?tag=${activeTag}` : window.location.pathname);
  if (window.renderNavDropdown) window.renderNavDropdown();
  renderList();
};

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

renderList();
