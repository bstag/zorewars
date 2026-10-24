// Site menu: on narrow screens the navigation folds into a menu button.
const btn = document.getElementById('menuBtn');
const nav = document.getElementById('siteNav');
if (btn && nav) {
  const set = (open) => {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    set(!nav.classList.contains('open'));
  });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
}
