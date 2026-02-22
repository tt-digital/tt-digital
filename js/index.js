function formatBody(t) {
  if (t.includes('<p>')) return t;
  return t.split('\n\n').filter(Boolean).map(p => `<p>${p}</p>`).join('');
}

function renderList() {
  document.getElementById('postList').innerHTML = posts.map((p) => `
    <div class="post-item">
      <div class="meta">${p.date} &nbsp;·&nbsp; ${p.tag}</div>
      <div class="post-title"><a onclick="showPost(${p.id})">${p.title}</a></div>
      <div class="excerpt">${p.excerpt}</div>
      <button class="read-more" onclick="showPost(${p.id})">read more</button>
    </div>
  `).join('');
  document.getElementById('footerCount').textContent = `${posts.length} entries`;
  document.getElementById('status').textContent = `// ${posts.length} entries`;
}

function showList() {
  document.getElementById('postList').classList.remove('hidden');
  document.getElementById('singlePost').classList.remove('active');
  renderList();
}

function showPost(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('singleMeta').textContent = `${p.date} · ${p.tag}`;
  document.getElementById('singleTitle').textContent = p.title;
  document.getElementById('singleBody').innerHTML = formatBody(p.body);
  document.getElementById('postList').classList.add('hidden');
  document.getElementById('singlePost').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

renderList();
