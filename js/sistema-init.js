'use strict';

(function initSistemaBackdrop() {
  if (!document.querySelector('.geo-backdrop')) {
    const host = document.createElement('div');
    host.className = 'geo-backdrop';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML =
      '<div class="geo-light geo-light-a"></div>' +
      '<div class="geo-light geo-light-b"></div>' +
      '<div class="geo-light geo-light-c"></div>' +
      '<div class="geo-parallax geo-parallax-far"><div class="geo-layer geo-layer-far"><div class="geo-slab geo-slab-1"></div><div class="geo-slab geo-slab-2"></div><div class="geo-slab geo-slab-3"></div></div></div>' +
      '<div class="geo-parallax geo-parallax-mid"><div class="geo-layer geo-layer-mid"><div class="geo-slab geo-slab-4"></div><div class="geo-slab geo-slab-5"></div><div class="geo-slab geo-slab-6"></div></div></div>' +
      '<div class="geo-parallax geo-parallax-near"><div class="geo-layer geo-layer-near"><div class="geo-slab geo-slab-7"></div><div class="geo-slab geo-slab-8"></div></div></div>' +
      '<div class="geo-sheen"></div>' +
      '<div class="geo-vignette"></div>';
    document.body.prepend(host);

    const syncIntensity = () => {
      const h = location.hash || '#/login';
      const isAuth = /^#\/(login|register|forgot)/.test(h) || !window.S80?.user;
      host.classList.toggle('geo-subtle', !isAuth);
    };
    window.addEventListener('hashchange', syncIntensity);
    setTimeout(syncIntensity, 0);

    if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const tick = () => {
        cx += (tx - cx) * 0.045;
        cy += (ty - cy) * 0.045;
        host.style.setProperty('--px', cx.toFixed(4));
        host.style.setProperty('--py', cy.toFixed(4));
        if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      };
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!raf) tick();
      }, { passive: true });
    }
  }
})();

window.S80.boot();
