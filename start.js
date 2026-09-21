#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * ============================================================================
 *  9ROUTER GENERIC BOOTSTRAP + CLOUDFLARE QUICK TUNNEL
 * ============================================================================
 *  Dùng cho: Pterodactyl / Pelican / VPS / Hosting Generic Node.js
 *
 *  Startup command trong panel:
 *      node start.js
 *
 *  Script này tự động:
 *    [1] Kiểm tra Node.js
 *    [2] Tạo package.json nếu chưa có
 *    [3] Cài 9router (npm) nếu chưa có
 *    [4] Tự chọn PORT (SERVER_PORT -> PORT -> 20128)
 *    [5] Tự sinh Password + JWT Secret (lưu lại, không đổi sau restart)
 *    [6] Khởi động 9Router bind 0.0.0.0
 *    [7] Chờ 9Router sẵn sàng (HTTP health check)
 *    [8] Tự tải cloudflared (amd64 / arm64 / arm / 386)
 *    [9] Tạo Cloudflare Quick Tunnel -> in Public URL
 *
 *  Biến môi trường (đặt trong panel, KHÔNG cần sửa code):
 *    SERVER_PORT        Port panel cấp (ưu tiên cao nhất)
 *    PORT               Port dự phòng
 *    ROUTER_PASSWORD    Password khởi tạo (nếu bỏ trống sẽ tự sinh)
 *    JWT_SECRET         JWT signing secret (nếu bỏ trống sẽ tự sinh)
 *    DATA_DIR           Nơi lưu dữ liệu (mặc định .9router)
 *    NODE_ENV           production | development
 *    CF_TUNNEL          0 = tắt Cloudflare Tunnel
 *    CLOUDFLARED_BIN    Dùng cloudflared có sẵn (đường dẫn tuyệt đối)
 *    CF_ARGS            Tham số thêm cho cloudflared
 *    ROUTER_LOG         0 = ẩn log server 9Router
 *    AUTO_UPDATE        1 = luôn cài 9router@latest khi khởi động
 *    READY_TIMEOUT      Giây chờ 9Router mở port (mặc định 300)
 * ============================================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

/* ========================================================================== */
/*  CẤU HÌNH                                                                  */
/* ========================================================================== */

const ROOT = __dirname;
const IS_WIN = process.platform === 'win32';

const PORT = String(
  process.env.SERVER_PORT ||
  process.env.PORT ||
  '20128'
).trim();

const HOST = '0.0.0.0';
const LOCAL_URL = `http://127.0.0.1:${PORT}`;

const DATA_DIR = path.resolve(
  ROOT,
  process.env.DATA_DIR || '.9router'
);

const CF_DIR = path.join(ROOT, '.cloudflared');
const CF_BIN = process.env.CLOUDFLARED_BIN
  ? path.resolve(process.env.CLOUDFLARED_BIN)
  : path.join(CF_DIR, IS_WIN ? 'cloudflared.exe' : 'cloudflared');

const CF_PID_FILE = path.join(DATA_DIR, '.cloudflared.pid');
const URL_FILE = path.join(DATA_DIR, 'last-public-url.txt');

const ROUTER_ENTRY = path.join(ROOT, 'node_modules', '9router', 'cli.js');
const ROUTER_PKG = path.join(ROOT, 'node_modules', '9router', 'package.json');

const READY_TIMEOUT = Number(process.env.READY_TIMEOUT || 300) * 1000;
const MIN_NODE_MAJOR = 20;
const HARD_MIN_NODE_MAJOR = 18;

const CF_ENABLED = process.env.CF_TUNNEL !== '0' && process.env.CF_TUNNEL !== 'false';
const SHOW_ROUTER_LOG = process.env.ROUTER_LOG !== '0';

/* ========================================================================== */
/*  LOG HELPERS                                                               */
/* ========================================================================== */

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  orange: '\x1b[38;5;208m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const hasColor = process.stdout.isTTY || process.env.FORCE_COLOR === '1';
const paint = (color, text) => (hasColor ? color + text + C.reset : text);

function log(msg) {
  console.log(`${paint(C.orange, '[9Router]')} ${msg}`);
}

function step(n, total, msg) {
  console.log(`${paint(C.orange, `[${n}/${total}]`)} ${msg}`);
}

function warn(msg) {
  console.log(`${paint(C.yellow, '[WARN]')} ${msg}`);
}

function fail(msg) {
  console.error(`${paint(C.red, '[ERROR]')} ${msg}`);
}

function banner(title) {
  const line = '='.repeat(58);
  console.log('');
  console.log(paint(C.orange, line));
  console.log(paint(C.bold + C.orange, `  ${title}`));
  console.log(paint(C.orange, line));
}

/* ========================================================================== */
/*  TIỆN ÍCH                                                                  */
/* ========================================================================== */

function readFileSafe(file) {
  try {
    const value = fs.readFileSync(file, 'utf8').trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeFileSafe(file, content, mode) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, { mode: mode || 0o600 });
    if (!IS_WIN && mode) {
      try { fs.chmodSync(file, mode); } catch {}
    }
    return true;
  } catch (e) {
    warn(`Không ghi được ${path.basename(file)}: ${e.message}`);
    return false;
  }
}

/** Lấy secret: ưu tiên ENV -> file đã lưu -> sinh mới rồi lưu lại. */
function resolveSecret(envName, fileName, generator) {
  const fromEnv = (process.env[envName] || '').trim();
  if (fromEnv) {
    return { value: fromEnv, source: 'env' };
  }

  const file = path.join(DATA_DIR, fileName);
  const saved = readFileSafe(file);
  if (saved) {
    return { value: saved, source: 'file' };
  }

  const generated = generator();
  writeFileSafe(file, generated, 0o600);
  return { value: generated, source: 'generated' };
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Password mạnh, dễ đọc lại trong log nhưng vẫn đủ entropy. */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '!@#$%^&*-_=+';
  const pick = (set, n) => {
    let out = '';
    const bytes = crypto.randomBytes(n);
    for (let i = 0; i < n; i++) out += set[bytes[i] % set.length];
    return out;
  };
  return `${pick(alphabet, 16)}${pick(symbols, 2)}${pick('0123456789', 2)}`;
}

function killPidFile(pidFile) {
  const raw = readFileSafe(pidFile);
  if (!raw) return;
  const pid = parseInt(raw, 10);
  if (!pid || Number.isNaN(pid)) return;

  try {
    if (IS_WIN) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    } else {
      process.kill(pid, 'SIGTERM');
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        try { process.kill(pid, 0); } catch { break; }
      }
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  } catch {
    /* process đã chết */
  }

  try { fs.unlinkSync(pidFile); } catch {}
}

/** Kill cả cây process (dùng được cho process detached). */
function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (IS_WIN) {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    }
  } catch {
    try { child.kill('SIGKILL'); } catch {}
  }
}

/* ========================================================================== */
/*  BƯỚC 1 — KIỂM TRA NODE.JS                                                 */
/* ========================================================================== */

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);

  if (major < HARD_MIN_NODE_MAJOR) {
    fail(`Node.js ${process.version} quá cũ.`);
    fail(`9Router yêu cầu Node.js ${MIN_NODE_MAJOR}+. Hãy đổi Egg/Container image.`);
    process.exit(1);
  }

  if (major < MIN_NODE_MAJOR) {
    warn(`Node.js ${process.version} thấp hơn khuyến nghị (${MIN_NODE_MAJOR}+).`);
    warn('Script vẫn chạy nhưng nên nâng lên Node.js 20/22/24 để ổn định nhất.');
  }
}

/* ========================================================================== */
/*  BƯỚC 2 — PACKAGE.JSON                                                     */
/* ========================================================================== */

function ensurePackageJson() {
  const file = path.join(ROOT, 'package.json');
  if (fs.existsSync(file)) return false;

  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        name: '9router-generic',
        version: '1.0.0',
        private: true,
        description: '9Router Generic deployment with Cloudflare Quick Tunnel',
        scripts: { start: 'node start.js' }
      },
      null,
      2
    ) + '\n'
  );

  return true;
}

/* ========================================================================== */
/*  BƯỚC 3 — CÀI 9ROUTER                                                      */
/* ========================================================================== */

function npmCmd() {
  return IS_WIN ? 'npm.cmd' : 'npm';
}

function installedVersion() {
  try {
    return JSON.parse(fs.readFileSync(ROUTER_PKG, 'utf8')).version;
  } catch {
    return null;
  }
}

function installRouter() {
  const current = installedVersion();
  const forceUpdate = process.env.AUTO_UPDATE === '1';

  if (current && !forceUpdate) {
    log(`9Router đã có sẵn (v${current}) — bỏ qua cài đặt.`);
    log('Đặt AUTO_UPDATE=1 trong panel nếu muốn tự cập nhật mỗi lần khởi động.');
    return;
  }

  log(forceUpdate && current
    ? `Đang cập nhật 9Router (v${current} -> latest)...`
    : 'Đang cài 9Router (lần đầu, có thể mất 1-3 phút)...');

  try {
    execSync(`${npmCmd()} install 9router@latest --no-audit --no-fund --loglevel=error`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, npm_config_update_notifier: 'false' }
    });
  } catch {
    fail('Không cài được 9Router. Kiểm tra kết nối mạng của container.');
    process.exit(1);
  }

  if (!fs.existsSync(ROUTER_ENTRY)) {
    fail('Cài đặt xong nhưng không tìm thấy node_modules/9router/cli.js');
    process.exit(1);
  }

  log(`9Router cài đặt thành công (v${installedVersion()}).`);
}

/* ========================================================================== */
/*  BƯỚC 4 — KHỞI ĐỘNG 9ROUTER                                                */
/* ========================================================================== */

function buildRouterEnv(secrets) {
  return {
    ...process.env,
    PORT,
    HOSTNAME: HOST,
    NODE_ENV: process.env.NODE_ENV || 'production',
    DATA_DIR,
    INITIAL_PASSWORD: secrets.password,
    JWT_SECRET: secrets.jwtSecret,
    API_KEY_SECRET: secrets.apiKeySecret,
    MACHINE_ID_SALT: secrets.machineIdSalt,
    BASE_URL: process.env.BASE_URL || LOCAL_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || LOCAL_URL,
    NEXT_TELEMETRY_DISABLED: '1'
  };
}

function startRouter(env) {
  // --tray        : bắt buộc, tránh menu TUI treo vô hạn khi container không có TTY
  // --no-browser  : không cố mở browser
  // --skip-update : không tự update (script đã quản lý)
  // --log         : đẩy log server ra console panel
  const args = [
    ROUTER_ENTRY,
    '--port', PORT,
    '--host', HOST,
    '--no-browser',
    '--skip-update',
    '--tray'
  ];

  if (SHOW_ROUTER_LOG) args.push('--log');

  log(`Khởi động 9Router tại ${HOST}:${PORT} ...`);

  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    detached: !IS_WIN
  });

  child.on('error', (e) => fail(`Không spawn được 9Router: ${e.message}`));
  return child;
}

/** Chờ 9Router sẵn sàng: ưu tiên HTTP /api/health, fallback TCP. */
function waitForRouter(timeout = READY_TIMEOUT) {
  const startedAt = Date.now();
  let lastNote = 0;

  const httpReady = () => new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: Number(PORT), path: '/api/health', timeout: 3000 },
      (res) => {
        res.resume();
        resolve(res.statusCode > 0 && res.statusCode < 500);
      }
    );
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });

  const tcpReady = () => new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: Number(PORT) });
    socket.setTimeout(2500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });

  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await httpReady()) return resolve('health');
      if (await tcpReady()) return resolve('tcp');

      const elapsed = Date.now() - startedAt;
      if (elapsed > timeout) {
        return reject(new Error(`9Router không mở port ${PORT} sau ${Math.round(timeout / 1000)}s`));
      }

      if (elapsed - lastNote > 15000) {
        lastNote = elapsed;
        log(`Đang chờ port ${PORT}... (${Math.round(elapsed / 1000)}s)`);
      }

      setTimeout(tick, 1200);
    };

    tick();
  });
}

/* ========================================================================== */
/*  BƯỚC 5 — CLOUDFLARED                                                       */
/* ========================================================================== */

function cloudflaredAsset() {
  const arch = process.arch;
  const platform = process.platform;

  if (platform === 'linux') {
    const map = {
      x64: 'cloudflared-linux-amd64',
      arm64: 'cloudflared-linux-arm64',
      arm: 'cloudflared-linux-arm',
      ia32: 'cloudflared-linux-386'
    };
    const asset = map[arch];
    if (!asset) throw new Error(`Không hỗ trợ CPU: ${arch}`);
    return { asset, archive: false };
  }

  if (platform === 'win32') {
    const map = {
      x64: 'cloudflared-windows-amd64.exe',
      ia32: 'cloudflared-windows-386.exe'
    };
    const asset = map[arch];
    if (!asset) throw new Error(`Không hỗ trợ CPU: ${arch}`);
    return { asset, archive: false };
  }

  if (platform === 'darwin') {
    const map = {
      x64: 'cloudflared-darwin-amd64.tgz',
      arm64: 'cloudflared-darwin-arm64.tgz'
    };
    const asset = map[arch];
    if (!asset) throw new Error(`Không hỗ trợ CPU: ${arch}`);
    return { asset, archive: true };
  }

  throw new Error(`Không hỗ trợ hệ điều hành: ${platform}`);
}

/**
 * Tải file, tự đi theo redirect (GitHub Releases redirect sang CDN).
 * Dùng URL /releases/latest/download/<asset> nên KHÔNG bị giới hạn rate limit
 * như khi gọi api.github.com.
 */
function download(url, dest, redirects = 6) {
  return new Promise((resolve, reject) => {
    if (redirects < 0) return reject(new Error('Quá nhiều redirect'));

    const request = (target) => {
      https
        .get(target, { headers: { 'User-Agent': '9router-generic' } }, (res) => {
          const { statusCode, headers } = res;

          if (statusCode >= 300 && statusCode < 400 && headers.location) {
            res.resume();
            return request(new URL(headers.location, target).toString());
          }

          if (statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${statusCode}`));
          }

          const total = Number(headers['content-length'] || 0);
          let received = 0;
          let lastShown = -1;

          const file = fs.createWriteStream(dest);

          res.on('data', (chunk) => {
            received += chunk.length;
            if (!total || !process.stdout.isTTY) return;
            const pct = Math.floor((received / total) * 100);
            if (pct >= lastShown + 10) {
              lastShown = pct;
              process.stdout.write(`\r${paint(C.dim, `  Đang tải... ${pct}%`)}   `);
            }
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              if (total && process.stdout.isTTY) process.stdout.write('\r\x1b[K');
              resolve(dest);
            });
          });

          file.on('error', (e) => {
            try { fs.unlinkSync(dest); } catch {}
            reject(e);
          });
        })
        .on('error', reject);
    };

    request(url);
  });
}

async function ensureCloudflared() {
  if (fs.existsSync(CF_BIN)) {
    if (!IS_WIN) { try { fs.chmodSync(CF_BIN, 0o755); } catch {} }
    log('cloudflared đã có sẵn.');
    return CF_BIN;
  }

  fs.mkdirSync(CF_DIR, { recursive: true });

  const { asset, archive } = cloudflaredAsset();
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;

  log(`Đang tải cloudflared (${asset})...`);

  try {
    if (archive) {
      const tmp = path.join(CF_DIR, 'cloudflared.tgz');
      await download(url, tmp);
      execSync(`tar -xzf "${tmp}" -C "${CF_DIR}"`, { stdio: 'ignore' });
      try { fs.unlinkSync(tmp); } catch {}
      const extracted = path.join(CF_DIR, 'cloudflared');
      if (fs.existsSync(extracted) && extracted !== CF_BIN) fs.renameSync(extracted, CF_BIN);
    } else {
      await download(url, CF_BIN);
    }
  } catch (e) {
    fail(`Không tải được cloudflared: ${e.message}`);
    return null;
  }

  if (!fs.existsSync(CF_BIN)) {
    fail('Tải cloudflared xong nhưng không thấy file binary.');
    return null;
  }

  if (!IS_WIN) { try { fs.chmodSync(CF_BIN, 0o755); } catch {} }
  log('cloudflared đã cài xong.');
  return CF_BIN;
}

/* ========================================================================== */
/*  BƯỚC 6 — CLOUDFLARE QUICK TUNNEL                                          */
/* ========================================================================== */

const URL_REGEX = /https:\/\/[a-z0-9][a-z0-9-]*\.trycloudflare\.com/gi;

let tunnelChild = null;
let tunnelAttempts = 0;
let tunnelStopped = false;
let shuttingDown = false;

function startTunnel(bin) {
  const extra = (process.env.CF_ARGS || '').trim().split(/\s+/).filter(Boolean);

  const args = [
    'tunnel',
    '--no-autoupdate',
    '--url', LOCAL_URL,
    ...extra
  ];

  log(`Tạo Cloudflare Quick Tunnel -> ${LOCAL_URL}`);

  const child = spawn(bin, args, {
    cwd: CF_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !IS_WIN
  });

  tunnelChild = child;

  if (child.pid) writeFileSafe(CF_PID_FILE, String(child.pid), 0o600);

  let found = false;

  const handle = (buffer) => {
    const text = buffer.toString();

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (SHOW_ROUTER_LOG) console.log(`${paint(C.dim, '[Cloudflare]')} ${line}`);
    }

    if (found) return;

    const match = text.match(URL_REGEX);
    if (!match || !match.length) return;

    found = true;
    tunnelAttempts = 0;

    const publicUrl = match[0].replace(/[.,)]+$/, '');
    writeFileSafe(URL_FILE, publicUrl, 0o600);
    printPublicBanner(publicUrl);
  };

  child.stdout.on('data', handle);
  child.stderr.on('data', handle);

  child.on('error', (e) => fail(`cloudflared lỗi: ${e.message}`));

  child.on('close', (code) => {
    if (shuttingDown || tunnelStopped) return;

    tunnelAttempts += 1;

    if (tunnelAttempts > 10) {
      warn(`cloudflared đã dừng ${tunnelAttempts} lần — không thử lại nữa.`);
      warn('9Router vẫn chạy bình thường ở địa chỉ local.');
      return;
    }

    const delay = Math.min(5 * tunnelAttempts, 30);
    warn(`cloudflared thoát (code=${code ?? 'unknown'}). Thử lại sau ${delay}s...`);
    setTimeout(() => {
      if (!shuttingDown && !tunnelStopped) startTunnel(bin);
    }, delay * 1000);
  });

  return child;
}

function printPublicBanner(publicUrl) {
  const line = '='.repeat(58);
  const api = `${publicUrl}/v1`;
  const dashboard = `${publicUrl}/dashboard`;

  console.log('');
  console.log(paint(C.orange, line));
  console.log(paint(C.bold + C.orange, '            CLOUDFLARE PUBLIC URL'));
  console.log(paint(C.orange, line));
  console.log(`${paint(C.white, 'PUBLIC    :')} ${paint(C.cyan + C.bold, publicUrl)}`);
  console.log(`${paint(C.white, 'DASHBOARD :')} ${paint(C.cyan, dashboard)}`);
  console.log(`${paint(C.white, 'API (v1)  :')} ${paint(C.cyan, api)}`);
  console.log(`${paint(C.white, 'LOCAL     :')} ${paint(C.dim, LOCAL_URL)}`);
  console.log(`${paint(C.white, 'USER      :')} ${paint(C.green, 'admin')}`);
  console.log(`${paint(C.white, 'PASSWORD  :')} ${paint(C.yellow, state.password)}`);
  console.log(paint(C.orange, line));
  console.log(paint(C.dim, `Đã lưu URL vào ${path.relative(ROOT, URL_FILE)}`));
  console.log(paint(C.dim, 'Quick Tunnel dùng domain ngẫu nhiên, sẽ đổi mỗi lần restart.'));
  console.log('');
}

/* ========================================================================== */
/*  SHUTDOWN                                                                  */
/* ========================================================================== */

let routerChild = null;
const state = { password: '' };

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  tunnelStopped = true;

  console.log('');
  log(`Đang dừng server... (${reason})`);

  killTree(tunnelChild);
  killTree(routerChild);
  killPidFile(CF_PID_FILE);

  setTimeout(() => process.exit(0), 1500).unref();
}

/* ========================================================================== */
/*  MAIN                                                                      */
/* ========================================================================== */

async function main() {
  banner('9ROUTER + CLOUDFLARE TUNNEL  |  GENERIC / PTERODACTYL');
  console.log(`${paint(C.white, 'Node       :')} ${process.version}`);
  console.log(`${paint(C.white, 'OS / Arch  :')} ${process.platform} / ${process.arch}`);
  console.log(`${paint(C.white, 'Bind       :')} ${HOST}:${PORT}`);
  console.log(`${paint(C.white, 'Local URL  :')} ${LOCAL_URL}`);
  console.log(`${paint(C.white, 'Data dir   :')} ${DATA_DIR}`);
  console.log(`${paint(C.white, 'Tunnel     :')} ${CF_ENABLED ? 'BẬT' : 'TẮT (CF_TUNNEL=0)'}`);
  console.log(paint(C.orange, '='.repeat(58)));
  console.log('');

  const TOTAL = 7;

  step(1, TOTAL, 'Kiểm tra Node.js...');
  checkNode();

  step(2, TOTAL, 'Chuẩn bị thư mục dữ liệu...');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  killPidFile(CF_PID_FILE); // dọn tunnel cũ còn sót lại sau restart

  step(3, TOTAL, 'Kiểm tra package.json...');
  if (ensurePackageJson()) log('Đã tạo package.json.');

  step(4, TOTAL, 'Chuẩn bị 9Router...');
  installRouter();

  const password = resolveSecret('ROUTER_PASSWORD', '.initial-password', generatePassword);
  const jwtSecret = resolveSecret('JWT_SECRET', '.jwt-secret', () => randomHex(32));
  const apiKeySecret = resolveSecret('API_KEY_SECRET', '.api-key-secret', () => randomHex(32));
  const machineIdSalt = resolveSecret('MACHINE_ID_SALT', '.machine-id-salt', () => randomHex(16));

  state.password = password.value;

  const sourceLabel = {
    env: 'từ Environment Variable',
    file: 'đã lưu từ lần chạy trước',
    generated: 'vừa tự sinh và đã lưu lại'
  };

  log(`Password     : ${paint(C.yellow, password.value)}  (${sourceLabel[password.source]})`);
  log(`JWT Secret   : ${paint(C.dim, 'đã thiết lập')} (${sourceLabel[jwtSecret.source]})`);

  if (password.source === 'generated') {
    log('Lưu ý: đây là PASSWORD KHỞI TẠO, chỉ dùng cho lần đăng nhập đầu tiên.');
    log(`Đặt ROUTER_PASSWORD trong panel để chủ động mật khẩu ở lần deploy sau.`);
  }

  const env = buildRouterEnv({
    password: password.value,
    jwtSecret: jwtSecret.value,
    apiKeySecret: apiKeySecret.value,
    machineIdSalt: machineIdSalt.value
  });

  step(5, TOTAL, 'Khởi động 9Router...');
  routerChild = startRouter(env);

  await waitForRouter();
  log(paint(C.green, '9Router đã sẵn sàng.'));
  log(`Dashboard local: ${paint(C.cyan, `${LOCAL_URL}/dashboard`)}`);

  step(6, TOTAL, CF_ENABLED ? 'Chuẩn bị cloudflared...' : 'Bỏ qua cloudflared (CF_TUNNEL=0).');

  if (CF_ENABLED) {
    const bin = await ensureCloudflared();

    step(7, TOTAL, 'Tạo Cloudflare Quick Tunnel...');

    if (bin) {
      startTunnel(bin);
    } else {
      warn('Không có cloudflared — chỉ chạy local.');
    }
  }
}

/* ========================================================================== */
/*  SIGNAL HANDLERS                                                           */
/* ========================================================================== */

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

process.on('uncaughtException', (e) => {
  fail(`Lỗi không xử lý được: ${e.message}`);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (e) => {
  fail(`Promise bị từ chối: ${e && e.message ? e.message : e}`);
});

main().catch((e) => {
  fail(e.message);
  shutdown('fatal');
});
