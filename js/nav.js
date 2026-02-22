(function () {
  // Resolve the root path — post pages live one level deeper
  const root = window.location.pathname.includes('/posts/') ? '../' : '';

  // Derive unique sorted tags from the posts array (provided by posts.js)
  const tags = [...new Set(posts.map(p => p.tag))].sort();

  function getActiveTag() {
    return new URLSearchParams(window.location.search).get('tag') || null;
  }

  // ── Desktop dropdown ─────────────────────────────────────────────────────
  function renderNavDropdown() {
    const activeTag = getActiveTag();
    const btn  = document.getElementById('categoriesBtn');
    const menu = document.getElementById('dropdownMenu');
    if (!btn || !menu) return;

    btn.classList.toggle('active', !!activeTag);

    menu.innerHTML = ['all', ...tags].map(t => {
      const isActive = t === 'all' ? !activeTag : t === activeTag;
      const href     = t === 'all' ? `${root}index.html` : `${root}index.html?tag=${t}`;
      const onclick  = `if(window.setFilter){window.setFilter('${t}');return false;}`;
      return `<a href="${href}" onclick="${onclick}" class="${isActive ? 'active' : ''}">${t}</a>`;
    }).join('');
  }

  // ── Mobile filter strip (injected after .status) ─────────────────────────
  function renderMobileFilter() {
    const activeTag = getActiveTag();

    let strip = document.getElementById('mobileFilter');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'mobileFilter';
      strip.className = 'mobile-filter';
      const status = document.querySelector('.status');
      if (status) status.insertAdjacentElement('afterend', strip);
    }

    strip.innerHTML = ['all', ...tags].map(t => {
      const isActive = t === 'all' ? !activeTag : t === activeTag;
      const href     = t === 'all' ? `${root}index.html` : `${root}index.html?tag=${t}`;
      const onclick  = `if(window.setFilter){window.setFilter('${t}');return false;}`;
      return `<a href="${href}" onclick="${onclick}" class="${isActive ? 'active' : ''}">${t}</a>`;
    }).join('');
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  window.toggleDropdown = function () {
    document.getElementById('dropdownMenu').classList.toggle('open');
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-dropdown')) {
      document.getElementById('dropdownMenu').classList.remove('open');
    }
  });

  function renderAll() {
    renderNavDropdown();
    renderMobileFilter();
  }

  renderAll();

  // index.js calls this after setFilter to sync both UIs
  window.renderNavDropdown = renderAll;
})();
