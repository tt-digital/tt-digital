(function () {
  // Resolve the root path — post pages live one level deeper
  const root = window.location.pathname.includes('/posts/') ? '../' : '';

  // Derive unique sorted tags from the posts array (provided by posts.js)
  const tags = [...new Set(posts.map(p => p.tag))].sort();

  function getActiveTag() {
    return new URLSearchParams(window.location.search).get('tag') || null;
  }

  function renderNavDropdown() {
    const activeTag = getActiveTag();
    const btn  = document.getElementById('categoriesBtn');
    const menu = document.getElementById('dropdownMenu');
    if (!btn || !menu) return;

    btn.classList.toggle('active', !!activeTag);

    menu.innerHTML = ['all', ...tags].map(t => {
      const isActive = t === 'all' ? !activeTag : t === activeTag;
      const href     = t === 'all' ? `${root}index.html` : `${root}index.html?tag=${t}`;
      // On index.html setFilter is defined — filter in place without reload.
      // On other pages it is undefined — the href navigates normally.
      const onclick  = `if(window.setFilter){window.setFilter('${t}');return false;}`;
      return `<a href="${href}" onclick="${onclick}" class="${isActive ? 'active' : ''}">${t}</a>`;
    }).join('');
  }

  window.toggleDropdown = function () {
    document.getElementById('dropdownMenu').classList.toggle('open');
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-dropdown')) {
      document.getElementById('dropdownMenu').classList.remove('open');
    }
  });

  renderNavDropdown();

  // Allow index.js to re-render after a filter change
  window.renderNavDropdown = renderNavDropdown;
})();
