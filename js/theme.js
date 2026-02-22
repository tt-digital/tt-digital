// Runs immediately in <head> to set theme before paint (prevents FOUC)
(function () {
  function autoTheme() {
    var h = new Date().getHours();
    return h >= 7 && h < 19 ? 'light' : 'dark';
  }
  document.documentElement.setAttribute(
    'data-theme',
    localStorage.getItem('theme') || autoTheme()
  );
})();

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeToggle').textContent =
    next === 'dark' ? '☀' : '☾';
}

// Set toggle button label once DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  var theme = document.documentElement.getAttribute('data-theme');
  var btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
});
