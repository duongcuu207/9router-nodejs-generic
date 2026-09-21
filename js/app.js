/* ==========================================================================
   app.js — Nav, scrollspy, tabs, accordion, terminal animation, reveal
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------- */
  /*  NAVBAR: scroll state, burger, active link                             */
  /* ---------------------------------------------------------------------- */

  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  var progress = document.getElementById('progress');
  var toTop = document.getElementById('toTop');

  function closeMenu() {
    if (!navLinks || !burger) return;
    navLinks.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }

  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeMenu();
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  Scroll: progress bar + navbar + back-to-top                           */
  /* ---------------------------------------------------------------------- */

  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docH > 0 ? (y / docH) * 100 : 0;

    if (progress) progress.style.width = pct.toFixed(2) + '%';
    if (nav) nav.classList.toggle('scrolled', y > 20);
    if (toTop) toTop.classList.toggle('show', y > 600);

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  SCROLLSPY                                                             */
  /* ---------------------------------------------------------------------- */

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var linkMap = {};

  if (navLinks) {
    Array.prototype.forEach.call(navLinks.querySelectorAll('a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1);
      if (id) linkMap[id] = a;
    });
  }

  if (sections.length && window.IntersectionObserver) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var id = entry.target.id;
        if (!linkMap[id]) return;

        Array.prototype.forEach.call(navLinks.querySelectorAll('a'), function (a) {
          a.classList.remove('active');
        });
        linkMap[id].classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------------------------------------------------------- */
  /*  REVEAL ON SCROLL                                                      */
  /* ---------------------------------------------------------------------- */

  var revealEls = document.querySelectorAll('.rv');
  var revealedAny = false;

  function revealAll() {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('in'); });
  }

  if (reduceMotion || !window.IntersectionObserver) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealedAny = true;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealEls, function (el) { io.observe(el); });

    /*
      Failsafe: nếu IntersectionObserver không bao giờ fire (một số môi trường
      headless/prerender hoặc trình duyệt cũ), nội dung sẽ vô hình vì opacity: 0.
      Vì vậy nếu sau khi đã scroll mà vẫn chưa có phần tử nào được reveal,
      hiển thị toàn bộ để không bao giờ mất nội dung.
    */
    var failsafe = function () {
      if (revealedAny) return;
      revealAll();
    };

    setTimeout(failsafe, 2500);
    window.addEventListener('scroll', function () {
      if (!revealedAny) setTimeout(failsafe, 300);
    }, { passive: true, once: true });
  }

  /* ---------------------------------------------------------------------- */
  /*  TABS                                                                  */
  /* ---------------------------------------------------------------------- */

  var tabWrap = document.getElementById('cfgTabs');

  if (tabWrap) {
    var tabs = tabWrap.querySelectorAll('.tab');

    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        var targetId = tab.getAttribute('data-tab');

        Array.prototype.forEach.call(tabs, function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        var panels = document.querySelectorAll('.tab-panel');
        Array.prototype.forEach.call(panels, function (p) {
          p.classList.toggle('active', p.id === targetId);
        });
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  ACCORDION                                                             */
  /* ---------------------------------------------------------------------- */

  function initAccordion(containerId) {
    var wrap = document.getElementById(containerId);
    if (!wrap) return;

    var items = wrap.querySelectorAll('.acc-item');

    Array.prototype.forEach.call(items, function (item) {
      var q = item.querySelector('.acc-q');
      var a = item.querySelector('.acc-a');
      if (!q || !a) return;

      q.setAttribute('aria-expanded', 'false');

      q.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');

        /* Đóng các item khác trong cùng nhóm */
        Array.prototype.forEach.call(items, function (other) {
          if (other === item) return;
          other.classList.remove('open');
          var oa = other.querySelector('.acc-a');
          var oq = other.querySelector('.acc-q');
          if (oa) oa.style.maxHeight = null;
          if (oq) oq.setAttribute('aria-expanded', 'false');
        });

        if (isOpen) {
          item.classList.remove('open');
          a.style.maxHeight = null;
          q.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('open');
          a.style.maxHeight = a.scrollHeight + 'px';
          q.setAttribute('aria-expanded', 'true');
        }
      });
    });

    /* Giữ chiều cao đúng khi resize */
    window.addEventListener('resize', function () {
      Array.prototype.forEach.call(items, function (item) {
        if (!item.classList.contains('open')) return;
        var a = item.querySelector('.acc-a');
        if (a) a.style.maxHeight = a.scrollHeight + 'px';
      });
    });
  }

  initAccordion('accLoi');
  initAccordion('accFaq');

  /* ---------------------------------------------------------------------- */
  /*  TERMINAL ANIMATION                                                    */
  /* ---------------------------------------------------------------------- */

  var term = document.getElementById('terminal');

  var LOG = [
    { c: 'c-org', t: '==========================================================' },
    { c: 'c-org', t: '  9ROUTER + CLOUDFLARE TUNNEL  |  GENERIC / PTERODACTYL' },
    { c: 'c-org', t: '==========================================================' },
    { c: 'c-dim', t: 'Node       : v22.14.0' },
    { c: 'c-dim', t: 'OS / Arch  : linux / x64' },
    { c: 'c-dim', t: 'Bind       : 0.0.0.0:20128' },
    { c: 'c-dim', t: 'Data dir   : /home/container/.9router' },
    { c: 'c-dim', t: '' },
    { c: 'c-wht', t: '[1/7] Kiểm tra Node.js...' },
    { c: 'c-wht', t: '[2/7] Chuẩn bị thư mục dữ liệu...' },
    { c: 'c-wht', t: '[3/7] Kiểm tra package.json...' },
    { c: 'c-wht', t: '[4/7] Chuẩn bị 9Router...' },
    { c: 'c-dim', t: '      └─ 9Router đã có sẵn (v0.5.81) — bỏ qua cài đặt.' },
    { c: 'c-yel', t: '[9Router] Password     : ********  (vừa tự sinh và đã lưu lại)' },
    { c: 'c-dim', t: '[9Router] JWT Secret   : đã thiết lập (đã lưu từ lần chạy trước)' },
    { c: 'c-wht', t: '[5/7] Khởi động 9Router...' },
    { c: 'c-dim', t: '[9Router] Khởi động 9Router tại 0.0.0.0:20128 ...' },
    { c: 'c-grn', t: '[9Router] 9Router đã sẵn sàng.' },
    { c: 'c-dim', t: '[9Router] Dashboard local: http://127.0.0.1:20128/dashboard' },
    { c: 'c-wht', t: '[6/7] Chuẩn bị cloudflared...' },
    { c: 'c-dim', t: '[9Router] cloudflared đã có sẵn.' },
    { c: 'c-wht', t: '[7/7] Tạo Cloudflare Quick Tunnel...' },
    { c: 'c-dim', t: '[Cloudflare] INF Registered tunnel connection connIndex=0' },
    { c: 'c-dim', t: '' },
    { c: 'c-org', t: '==========================================================' },
    { c: 'c-org', t: '            CLOUDFLARE PUBLIC URL' },
    { c: 'c-org', t: '==========================================================' },
    { c: 'c-wht', t: 'PUBLIC    : ' },
    { c: 'c-wht', t: 'DASHBOARD : ' },
    { c: 'c-wht', t: 'API (v1)  : ' },
    { c: 'c-dim', t: 'LOCAL     : http://127.0.0.1:20128' },
    { c: 'c-org', t: '==========================================================' }
  ];

  var PUBLIC_URL = 'https://nine-router-demo.trycloudflare.com';

  function renderTerminal() {
    if (!term) return;

    var html = '';
    LOG.forEach(function (line, i) {
      var text = line.t;
      var isPasswordLine = text.indexOf('Password') !== -1 && text.indexOf('********') !== -1;

      if (text === 'PUBLIC    : ') {
        text += '<span class="c-cyn">' + PUBLIC_URL + '</span>';
      } else if (text === 'DASHBOARD : ') {
        text += '<span class="c-cyn">' + PUBLIC_URL + '/dashboard</span>';
      } else if (text === 'API (v1)  : ') {
        text += '<span class="c-cyn">' + PUBLIC_URL + '/v1</span>';
      } else if (isPasswordLine) {
        var parts = text.split('********');
        text = escapeHtml(parts[0]) +
          '<span class="c-yel">Kx7mPq2wR9tLz4Bn!8</span>' +
          escapeHtml(parts.slice(1).join(''));
      } else {
        text = escapeHtml(text);
      }

      html += '<span class="ln ' + line.c + '" data-i="' + i + '" style="display:none">' +
        (text || '&nbsp;') + '</span>';
    });

    term.innerHTML = html;

    if (reduceMotion) {
      Array.prototype.forEach.call(term.querySelectorAll('.ln'), function (el) {
        el.style.display = 'block';
      });
      appendCursor();
      return;
    }

    var index = 0;
    var lines = term.querySelectorAll('.ln');

    function next() {
      if (index >= lines.length) {
        appendCursor();
        /* Lặp lại sau một khoảng nghỉ để demo sinh động */
        setTimeout(function () {
          if (!term.isConnected) return;
          Array.prototype.forEach.call(lines, function (el) { el.style.display = 'none'; });
          index = 0;
          next();
        }, 6000);
        return;
      }

      lines[index].style.display = 'block';
      term.scrollTop = term.scrollHeight;
      index++;

      var delay = 55 + Math.random() * 90;
      setTimeout(next, delay);
    }

    setTimeout(next, 350);
  }

  function appendCursor() {
    if (!term) return;
    var old = term.querySelector('.term-cursor');
    if (old) old.remove();

    var cursor = document.createElement('span');
    cursor.className = 'term-cursor';
    term.appendChild(cursor);
    term.scrollTop = term.scrollHeight;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  renderTerminal();

  /* ---------------------------------------------------------------------- */
  /*  SMOOTH SCROLL cho anchor nội bộ (bù trừ navbar)                       */
  /* ---------------------------------------------------------------------- */

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;

    var id = a.getAttribute('href');
    if (!id || id === '#' || id.length < 2) return;

    var target = document.getElementById(id.slice(1));
    if (!target) return;

    e.preventDefault();
    closeMenu();

    var top = target.getBoundingClientRect().top + window.pageYOffset - 84;

    window.scrollTo({
      top: top,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    if (history.replaceState) history.replaceState(null, '', id);
  });

  /* ---------------------------------------------------------------------- */
  /*  Keyboard shortcut: "/" mở menu (tiện dụng)                            */
  /* ---------------------------------------------------------------------- */

  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;

    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    e.preventDefault();
    if (burger && navLinks && window.innerWidth <= 1024) {
      navLinks.classList.add('open');
      burger.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
    }
  });
})();
