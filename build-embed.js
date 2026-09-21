#!/usr/bin/env node
/**
 * build-embed.js
 * ---------------------------------------------------------------------------
 * Nhúng nội dung start.js vào index.html tại vị trí <!--__STARTJS__-->
 *
 * Chạy lại script này MỖI KHI sửa start.js:
 *     node build-embed.js
 *
 * Vì sao cần escape?
 *   Trình duyệt giải mã entity trong <pre>, nên textContent trả về đúng code gốc.
 *   Không escape thì dấu < > trong code sẽ bị hiểu là thẻ HTML và vỡ layout.
 * ---------------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTML_FILE = path.join(ROOT, 'index.html');
const JS_FILE = path.join(ROOT, 'start.js');
const MARKER = '<!--__STARTJS__-->';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function main() {
  if (!fs.existsSync(JS_FILE)) {
    console.error('Không tìm thấy start.js');
    process.exit(1);
  }
  if (!fs.existsSync(HTML_FILE)) {
    console.error('Không tìm thấy index.html');
    process.exit(1);
  }

  const source = fs.readFileSync(JS_FILE, 'utf8');
  const html = fs.readFileSync(HTML_FILE, 'utf8');

  if (source.includes('</script')) {
    console.error('start.js chứa chuỗi "</script" — không thể nhúng an toàn.');
    process.exit(1);
  }

  const escaped = escapeHtml(source);

  // Thay thế mọi lần xuất hiện marker (thường chỉ 1)
  let output;
  if (html.includes(MARKER)) {
    output = html.split(MARKER).join(escaped);
  } else {
    // Marker đã bị thay ở lần build trước -> thay khối <pre id="startjsSource">...</pre>
    const re = /(<pre id="startjsSource"[^>]*><code>)([\s\S]*?)(<\/code><\/pre>)/;
    if (!re.test(html)) {
      console.error('Không tìm thấy marker hoặc khối startjsSource trong index.html');
      process.exit(1);
    }
    output = html.replace(re, (_m, open, _body, close) => open + escaped + close);
  }

  fs.writeFileSync(HTML_FILE, output, 'utf8');

  const lines = source.split('\n').length;
  const kb = (Buffer.byteLength(source, 'utf8') / 1024).toFixed(1);

  console.log('Đã nhúng start.js vào index.html');
  console.log(`  Dòng   : ${lines}`);
  console.log(`  Kích thước: ${kb} KB`);
}

main();
