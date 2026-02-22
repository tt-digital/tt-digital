function renderList() {
  document.getElementById('postList').innerHTML = posts.map((p) => `
    <div class="post-item">
      <div class="meta">${p.date} &nbsp;·&nbsp; ${p.tag}</div>
      <div class="post-title"><a href="${p.url}">${p.title}</a></div>
      <div class="excerpt">${p.excerpt}</div>
      <a class="read-more" href="${p.url}">read more</a>
    </div>
  `).join('');
  document.getElementById('footerCount').textContent = `${posts.length} entries`;
  document.getElementById('status').textContent = `// ${posts.length} entries`;
}

renderList();
