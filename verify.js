#!/usr/bin/env node
/**
 * verify.js — Kiểm tra tính toàn vẹn của site trước khi deploy.
 *
 *   node verify.js
 *
 * Kiểm tra:
 *   1. Mọi id mà JS tham chiếu đều tồn tại trong index.html
 *   2. Source nhúng trong index.html khớp byte-for-byte với start.js
 *   3. Không còn marker build sót lại
 *   4. Thẻ HTML cơ bản cân bằng
 *   5. Các file bắt buộc tồn tại
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let errors = 0;
let warnings = 0;

function ok(msg) { console.log(`  OK    ${msg}`); }
function bad(msg) { console.log(`  LỖI   ${msg}`); errors++; }
function warn(msg) { console.log(`  CẢNH BÁO  ${msg}`); warnings++; }

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

console.log('\n=== 1. File bắt buộc ===');
const REQUIRED = [
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/code.js',
  'start.js',
  'package.json',
  '.nojekyll'
];

REQUIRED.forEach((f) => {
  if (fs.existsSync(path.join(ROOT, f))) ok(f);
  else bad(`Thiếu file: ${f}`);
});

const html = read('index.html');
const codeJs = read('js/code.js');
const appJs = read('js/app.js');

console.log('\n=== 2. id tham chiếu trong JS có tồn tại trong HTML ===');

function collectIds(source) {
  const ids = new Set();
  const re = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) ids.add(m[1]);
  return ids;
}

const htmlIds = new Set();
{
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) htmlIds.add(m[1]);
}

const referenced = new Set([...collectIds(codeJs), ...collectIds(appJs)]);

referenced.forEach((id) => {
  if (htmlIds.has(id)) ok(`#${id}`);
  else bad(`JS tham chiếu #${id} nhưng HTML không có`);
});

console.log('\n=== 3. data-tab phải khớp id của tab-panel ===');
{
  const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
  const panels = [...html.matchAll(/class="tab-panel[^"]*" id="([^"]+)"/g)].map((m) => m[1]);

  if (!tabs.length) bad('Không tìm thấy data-tab nào');
  tabs.forEach((t) => {
    if (panels.includes(t)) ok(`${t} -> #${t}`);
    else bad(`data-tab="${t}" nhưng không có .tab-panel id="${t}"`);
  });
  panels.forEach((p) => {
    if (!tabs.includes(p)) warn(`tab-panel #${p} không có tab tương ứng`);
  });
}

console.log('\n=== 4. Source start.js nhúng khớp file thật ===');
{
  if (html.includes('<!--__STARTJS__-->')) {
    bad('Còn marker <!--__STARTJS__--> — chưa chạy build-embed.js');
  } else {
    const re = /<pre id="startjsSource"[^>]*><code>([\s\S]*?)<\/code><\/pre>/;
    const m = html.match(re);

    if (!m) {
      bad('Không tìm thấy khối startjsSource trong index.html');
    } else {
      const embedded = m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      const actual = read('start.js');

      const a = embedded.replace(/\s+$/, '');
      const b = actual.replace(/\s+$/, '');

      if (a === b) {
        ok(`Khớp hoàn toàn (${actual.split('\n').length} dòng, ${(Buffer.byteLength(actual, 'utf8') / 1024).toFixed(1)} KB)`);
      } else {
        bad('Source nhúng KHÁC start.js — chạy lại: node build-embed.js');
        console.log(`        nhúng: ${a.length} ký tự / thật: ${b.length} ký tự`);
      }
    }
  }
}

console.log('\n=== 5. An toàn HTML ===');
{
  const embeddedMatch = html.match(/<pre id="startjsSource"[^>]*><code>([\s\S]*?)<\/code><\/pre>/);
  const region = embeddedMatch ? embeddedMatch[1] : '';

  if (/<\/script/i.test(region)) bad('Khối nhúng chứa "</script" — sẽ vỡ HTML');
  else ok('Không có "</script" trong khối nhúng');

  const strayTags = region.match(/<(?!\/?code>|\/?pre>)[a-z]/gi);
  if (strayTags) bad(`Còn thẻ HTML chưa escape trong khối nhúng: ${strayTags.slice(0, 5).join(', ')}`);
  else ok('Mọi ký tự < > trong code đã escape đúng');
}

console.log('\n=== 6. Đường dẫn tương đối (GitHub Pages) ===');
{
  const badPaths = [...html.matchAll(/(?:href|src)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  if (badPaths.length) {
    badPaths.forEach((p) => bad(`Đường dẫn tuyệt đối gốc sẽ hỏng trên GitHub Pages: ${p}`));
  } else {
    ok('Không có đường dẫn tuyệt đối gốc');
  }

  ['css/style.css', 'js/code.js', 'js/app.js'].forEach((rel) => {
    if (html.includes(`"${rel}"`)) ok(`Tham chiếu tương đối: ${rel}`);
    else bad(`Thiếu tham chiếu: ${rel}`);
  });
}

console.log('\n=== 7. Thẻ HTML cơ bản ===');
{
  const checks = [
    ['<!DOCTYPE html>', /^<!DOCTYPE html>/i],
    ['lang="vi"', /<html[^>]+lang="vi"/i],
    ['<meta charset', /<meta charset="UTF-8">/i],
    ['viewport', /name="viewport"/i],
    ['</html>', /<\/html>\s*$/i]
  ];

  checks.forEach(([label, re]) => {
    if (re.test(html.trim())) ok(label);
    else bad(`Thiếu: ${label}`);
  });

  const openSec = (html.match(/<section\b/g) || []).length;
  const closeSec = (html.match(/<\/section>/g) || []).length;
  if (openSec === closeSec) ok(`<section> cân bằng (${openSec})`);
  else bad(`<section> lệch: ${openSec} mở / ${closeSec} đóng`);

  const openDiv = (html.match(/<div\b/g) || []).length;
  const closeDiv = (html.match(/<\/div>/g) || []).length;
  if (openDiv === closeDiv) ok(`<div> cân bằng (${openDiv})`);
  else warn(`<div> lệch: ${openDiv} mở / ${closeDiv} đóng (kiểm tra thủ công)`);
}

console.log('\n=== 8. CSS ===');
{
  const css = read('css/style.css');

  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open === close) ok(`Dấu ngoặc {} cân bằng (${open})`);
  else bad(`Dấu ngoặc {} lệch: ${open} mở / ${close} đóng`);

  // Phát hiện giá trị màu bị vỡ do xuống dòng
  const brokenColor = css.match(/color:\s*#[0-9a-fA-F]{0,5}\s*\n\s*[0-9a-fA-F]+\s*!important/);
  if (brokenColor) bad('Có khai báo màu bị vỡ dòng');
  else ok('Không có màu bị vỡ dòng');

  ['--orange', '--bg', '--text', '.rv', '@media'].forEach((token) => {
    if (css.includes(token)) ok(`Có ${token}`);
    else bad(`Thiếu ${token} trong CSS`);
  });
}

console.log('\n=== 9. Chống regression trong start.js ===');
{
  const js = read('start.js');

  /*
    --tray là BẮT BUỘC: khi container không có TTY, menu TUI của 9Router
    trả về -1 và vòng while(true) trong cli.js lặp vô hạn gây treo CPU.
  */
  const checks = [
    ['--tray flag (chống treo menu TTY)', /'--tray'/, 'BẮT BUỘC — thiếu sẽ treo CPU trong container không TTY'],
    ['--skip-update flag', /'--skip-update'/, 'script tự quản lý cập nhật'],
    ['--no-browser flag', /'--no-browser'/, 'tránh cố mở browser trong container'],
    ['--host 0.0.0.0', /'--host',\s*HOST/, 'bind mọi interface'],
    ['SERVER_PORT ưu tiên cao nhất', /process\.env\.SERVER_PORT/, 'port do panel cấp'],
    ['Dùng releases/latest/download', /releases\/latest\/download/, 'tránh rate limit 60 req/h của api.github.com'],
    ['Health check /api/health', /\/api\/health/, 'xác nhận server thật sự sẵn sàng'],
    ['Fallback kiểm tra TCP', /net\.connect/, 'dự phòng khi health endpoint đổi'],
    ['Tự sinh password', /generatePassword|crypto\.randomBytes/, 'không dùng password mặc định yếu'],
    ['Lưu secret vào file', /\.initial-password|resolveSecret/, 'password không đổi sau restart'],
    ['Hỗ trợ linux arm64', /cloudflared-linux-arm64/, 'chạy được trên ARM'],
    ['Hỗ trợ linux amd64', /cloudflared-linux-amd64/, 'kiến trúc phổ biến nhất'],
    ['Kill process group khi shutdown', /SIGINT[\s\S]*SIGTERM[\s\S]*SIGHUP/, 'không để process mồ côi'],
    ['Auto-restart tunnel', /startTunnel\(bin\)/, 'tự tạo lại tunnel khi cloudflared thoát'],
    ['CF_TUNNEL để tắt tunnel', /CF_TUNNEL/, 'cho phép chạy local-only']
  ];

  checks.forEach(([label, re, why]) => {
    if (re.test(js)) ok(label);
    else bad(`${label} — ${why}`);
  });

  if (/CHANGE_THIS_PASSWORD_123!/.test(js)) {
    bad('Còn password mặc định CHANGE_THIS_PASSWORD_123! trong start.js');
  } else {
    ok('Không có password mặc định yếu');
  }

  /*
    Kiểm tra api.github.com chỉ xuất hiện trong comment, không phải code chạy.
    Loại bỏ comment dạng // và block comment rồi mới tìm.
  */
  const codeOnly = js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  if (/api\.github\.com/.test(codeOnly)) {
    bad('Có gọi api.github.com trong code thực thi — sẽ bị rate limit 60 req/giờ');
  } else {
    ok('Không gọi api.github.com trong code thực thi (chỉ trong comment)');
  }
}

console.log('\n=== 10. Chống regression trong js/app.js ===');
{
  const app = read('js/app.js');

  if (/revealAll/.test(app) && /setTimeout\(failsafe/.test(app)) {
    ok('Failsafe reveal (nội dung không bao giờ vô hình)');
  } else {
    bad('Thiếu failsafe reveal — nếu IntersectionObserver không fire, nội dung sẽ vô hình');
  }

  if (/prefers-reduced-motion/.test(app)) ok('Tôn trọng prefers-reduced-motion');
  else warn('Không kiểm tra prefers-reduced-motion trong app.js');
}

console.log('\n=== 11. Kết quả ===');
if (errors === 0) {
  console.log(`  TẤT CẢ ĐỀU ĐẠT  (${warnings} cảnh báo)`);
  console.log('  Site sẵn sàng deploy lên GitHub Pages.\n');
  process.exit(0);
} else {
  console.log(`  ${errors} LỖI, ${warnings} cảnh báo\n`);
  process.exit(1);
}
