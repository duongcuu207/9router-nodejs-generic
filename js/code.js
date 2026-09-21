/* ==========================================================================
   code.js — Hiển thị start.js, highlight cú pháp, Copy & Download
   Hoạt động trên cả file:// và GitHub Pages (đường dẫn tương đối).
   ========================================================================== */
(function () {
  'use strict';

  var SOURCE_ID = 'startjsSource';
  var TABLE_ID = 'codeTable';
  var META_ID = 'viewerMeta';
  var HINT_ID = 'viewerHint';

  /* ---------------------------------------------------------------------- */
  /*  Toast                                                                 */
  /* ---------------------------------------------------------------------- */

  var toastTimer = null;

  function toast(message, isError) {
    var el = document.getElementById('toast');
    var text = document.getElementById('toastText');
    if (!el || !text) return;

    text.textContent = message;
    el.classList.toggle('err', !!isError);
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2600);
  }

  /* ---------------------------------------------------------------------- */
  /*  Copy helper — có fallback cho file:// (Clipboard API bị chặn)         */
  /* ---------------------------------------------------------------------- */

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);

    var ok = false;
    try {
      area.select();
      area.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }

    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (!text) return Promise.resolve(false);

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }

    return Promise.resolve(legacyCopy(text));
  }

  function markDone(button, label) {
    if (!button) return;

    var original = button.innerHTML;
    button.classList.add('done');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/>' +
      '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
      (label || 'Đã copy');

    setTimeout(function () {
      button.classList.remove('done');
      button.innerHTML = original;
    }, 2000);
  }

  /* ---------------------------------------------------------------------- */
  /*  Highlight cú pháp JS nhẹ (không dùng thư viện ngoài)                  */
  /* ---------------------------------------------------------------------- */

  var KEYWORDS = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'try', 'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof', 'delete',
    'in', 'of', 'class', 'extends', 'async', 'await', 'yield', 'switch', 'case',
    'break', 'continue', 'default', 'this', 'null', 'undefined', 'true', 'false'
  ];

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Tokenizer đơn giản: quét tuần tự và bỏ qua nội dung đã khớp,
   * nhờ vậy không cần xử lý chồng lấn phức tạp.
   */
  function highlight(line) {
    var pattern = new RegExp(
      [
        '(\\/\\/[^\\n]*)',                                    // 1 comment
        '(`(?:\\\\.|[^`\\\\])*`|\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*")', // 2 string
        '\\b(' + KEYWORDS.join('|') + ')\\b',                 // 3 keyword
        '\\b(\\d+(?:\\.\\d+)?)\\b'                            // 4 number
      ].join('|'),
      'g'
    );

    var out = '';
    var last = 0;
    var match;

    while ((match = pattern.exec(line)) !== null) {
      out += escapeHtml(line.slice(last, match.index));

      if (match[1]) {
        out += '<span class="tk-com">' + escapeHtml(match[1]) + '</span>';
      } else if (match[2]) {
        out += '<span class="tk-str">' + escapeHtml(match[2]) + '</span>';
      } else if (match[3]) {
        out += '<span class="tk-key">' + escapeHtml(match[3]) + '</span>';
      } else if (match[4]) {
        out += '<span class="tk-num">' + escapeHtml(match[4]) + '</span>';
      }

      last = pattern.lastIndex;
    }

    out += escapeHtml(line.slice(last));
    return out;
  }

  /* ---------------------------------------------------------------------- */
  /*  Render code viewer                                                    */
  /* ---------------------------------------------------------------------- */

  function renderViewer(source) {
    var table = document.getElementById(TABLE_ID);
    var meta = document.getElementById(META_ID);
    var hint = document.getElementById(HINT_ID);
    if (!table) return;

    var lines = source.split('\n');
    var html = '';
    var pad = String(lines.length).length;

    for (var i = 0; i < lines.length; i++) {
      var num = String(i + 1);
      while (num.length < pad) num = ' ' + num;

      html +=
        '<div class="code-row">' +
          '<span class="code-num">' + num + '</span>' +
          '<span class="code-line">' + highlight(lines[i]) + '</span>' +
        '</div>';
    }

    table.innerHTML = html;

    var kb = (new Blob([source]).size / 1024).toFixed(1);

    if (meta) {
      meta.textContent = lines.length + ' dòng · ' + kb + ' KB · UTF-8';
    }

    if (hint) {
      hint.textContent = 'Cần Node.js 20+ · ' + lines.length + ' dòng';
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Fallback: nếu không nhúng được source, thử fetch start.js            */
  /* ---------------------------------------------------------------------- */

  function fetchSource() {
    // Đường dẫn tương đối -> chạy được cả file:// và /repo/ trên GitHub Pages
    return fetch('start.js', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .catch(function () { return null; });
  }

  /* ---------------------------------------------------------------------- */
  /*  Khởi tạo                                                              */
  /* ---------------------------------------------------------------------- */

  function getEmbeddedSource() {
    var holder = document.getElementById(SOURCE_ID);
    if (!holder) return '';
    var code = holder.querySelector('code') || holder;
    return (code.textContent || '').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
  }

  function init() {
    var source = getEmbeddedSource();

    var proceed = function (text) {
      if (!text || text.trim().length < 50) {
        var table = document.getElementById(TABLE_ID);
        if (table) {
          table.innerHTML =
            '<div class="code-row"><span class="code-line" style="padding:24px">' +
            'Không tải được nội dung start.js.</span></div>';
        }
        return;
      }

      renderViewer(text);

      var copyAll = document.getElementById('copyAll');
      if (copyAll) {
        copyAll.addEventListener('click', function () {
          copyText(text).then(function (ok) {
            if (ok) {
              markDone(copyAll, 'Đã copy');
              toast('Đã copy toàn bộ start.js (' + text.split('\n').length + ' dòng)');
            } else {
              toast('Trình duyệt chặn copy — hãy chọn thủ công', true);
            }
          });
        });
      }

      var download = document.getElementById('downloadJs');
      if (download) {
        download.addEventListener('click', function () {
          try {
            var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'start.js';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
            toast('Đang tải start.js...');
          } catch (e) {
            toast('Không tạo được file tải về', true);
          }
        });
      }
    };

    if (source && source.trim().length > 50) {
      proceed(source);
    } else {
      fetchSource().then(function (text) {
        proceed(text || '');
      });
    }

    /* Toggle mở rộng / thu gọn */
    var toggle = document.getElementById('toggleViewer');
    var toggleText = document.getElementById('toggleViewerText');
    var body = document.getElementById('viewerBody');

    if (toggle && body) {
      toggle.addEventListener('click', function () {
        var open = body.classList.toggle('open');
        if (toggleText) toggleText.textContent = open ? 'Thu gọn' : 'Mở rộng';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

        if (!open) {
          var viewer = body.closest('.viewer');
          if (viewer) viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Copy cho mọi block code nhỏ (data-copy)                               */
  /* ---------------------------------------------------------------------- */

  function initBlockCopies() {
    var buttons = document.querySelectorAll('[data-copy]');

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        var block = button.closest('[data-copy-block]') || button.closest('.code');
        var codeEl = block ? block.querySelector('pre code') : null;
        var text = codeEl ? codeEl.textContent : '';

        copyText(text).then(function (ok) {
          if (ok) {
            markDone(button, 'Đã copy');
            toast('Đã copy vào clipboard');
          } else {
            toast('Trình duyệt chặn copy — hãy chọn thủ công', true);
          }
        });
      });
    });
  }

  /* ---------------------------------------------------------------------- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      initBlockCopies();
    });
  } else {
    init();
    initBlockCopies();
  }

  /* Cho phép app.js dùng lại toast */
  window.CodeUI = { toast: toast, copyText: copyText };
})();
