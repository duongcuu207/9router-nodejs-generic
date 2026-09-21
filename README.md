# 🚀 9Router Generic + Cloudflare Tunnel

<p align="center">
  <b>9Router chạy trên Generic / Pterodactyl với một file <code>start.js</code></b><br>
  Tự động cài đặt • Tự động chọn Port • Tự động đặt Password • Cloudflare Quick Tunnel
</p>

---

## ✨ Tổng quan

Repo này dùng để triển khai **9Router** trên các môi trường Generic Node.js như:

- Pterodactyl
- Pelican Panel
- VPS/container có Node.js
- Hosting Generic Node.js
- Các panel cho phép chạy `node start.js`

`start.js` sẽ tự động:

```text
┌─────────────────────────┐
│       Generic Panel     │
└────────────┬────────────┘
             │
             ▼
       node start.js
             │
      ┌──────┴──────┐
      ▼             ▼
   9Router      cloudflared
      │             │
      │             ▼
      │       Cloudflare Edge
      │             │
      └───────► Public URL
                *.trycloudflare.com
```

### 🔥 Các tính năng

| Tính năng | Trạng thái |
|---|:---:|
| Tự cài 9Router | ✅ |
| Node.js 20+ check | ✅ |
| Tự lấy port Generic | ✅ |
| `0.0.0.0` binding | ✅ |
| Password tùy chỉnh | ✅ |
| JWT Secret tùy chỉnh | ✅ |
| Data directory riêng | ✅ |
| Tự tải Cloudflared | ✅ |
| AMD64 / ARM64 | ✅ |
| Cloudflare Quick Tunnel | ✅ |
| Không cần mở inbound port | ✅ |
| Một file `start.js` | ✅ |

---

# 📦 Cấu trúc repository

```text
9router-generic/
│
├── start.js
├── package.json
├── README.md
│
├── .9router/
│   └── ...
│
└── .cloudflared/
    └── cloudflared
```

> `.9router/` và `.cloudflared/` được tạo tự động khi server chạy.

---

# 🧩 Yêu cầu

## Node.js

9Router yêu cầu:

```text
Node.js >= 20
```

Kiểm tra:

```bash
node -v
```

Ví dụ:

```text
v25.x.x
```

là phù hợp.

---

# ⚡ Cài đặt nhanh

## 1. Upload `start.js`

Đưa file:

```text
start.js
```

vào thư mục chính của server.

## 2. Startup command

Trong Generic/Pterodactyl đặt:

```bash
node start.js
```

## 3. Start server

Chạy server.

`start.js` sẽ tự:

```text
Node.js check
      ↓
Tạo package.json nếu chưa có
      ↓
Cài 9Router
      ↓
Đọc PORT từ panel
      ↓
Khởi động 9Router
      ↓
Chờ 9Router mở port
      ↓
Tải cloudflared nếu chưa có
      ↓
Tạo Cloudflare Quick Tunnel
      ↓
In Public URL
```

---

# 🔐 Cấu hình Password

Trong `start.js`:

```js
const PASSWORD =
    process.env.ROUTER_PASSWORD ||
    'CHANGE_THIS_PASSWORD_123!';
```

Đổi thành:

```js
const PASSWORD =
    process.env.ROUTER_PASSWORD ||
    'YourStrongPassword@2026!';
```

Ví dụ password:

```text
YourStrongPassword@2026!
```

## Khuyến nghị

Tốt hơn là đặt password bằng Environment Variable của panel:

```text
ROUTER_PASSWORD=YourStrongPassword@2026!
```

Khi đó không cần ghi password trực tiếp vào GitHub.

### ⚠️ Lưu ý quan trọng

`INITIAL_PASSWORD` là mật khẩu **khởi tạo**.

Nếu database 9Router đã có password hash thì thay đổi:

```text
INITIAL_PASSWORD
```

sẽ **không tự ghi đè password hiện tại**.

Trong trường hợp server đã được khởi tạo trước đó, hãy đổi password từ Dashboard của 9Router hoặc xử lý database theo quy trình quản trị của instance.

---

# 🔑 JWT Secret

Có thể đặt:

```text
JWT_SECRET=your-long-random-secret
```

Ví dụ:

```text
JWT_SECRET=9router-super-secret-2026-change-this
```

Không nên dùng một secret ngắn hoặc dễ đoán.

### Tạo secret ngẫu nhiên

Linux:

```bash
openssl rand -hex 32
```

Ví dụ:

```text
JWT_SECRET=4f7a0c...<random>...
```

---

# 🌐 Port

9Router mặc định dùng:

```text
20128
```

Nhưng trên Generic/Pterodactyl, `start.js` ưu tiên lấy:

```js
process.env.SERVER_PORT
```

sau đó:

```js
process.env.PORT
```

cuối cùng mới dùng:

```text
20128
```

Code:

```js
const PORT =
    process.env.SERVER_PORT ||
    process.env.PORT ||
    '20128';
```

## Ví dụ

Panel cấp:

```text
SERVER_PORT=25565
```

thì 9Router chạy:

```text
0.0.0.0:25565
```

Dashboard:

```text
http://SERVER-IP:25565
```

API:

```text
http://SERVER-IP:25565/v1
```

---

# ☁️ Cloudflare Quick Tunnel

Khi server khởi động, `start.js` tự tải `cloudflared` và chạy:

```bash
cloudflared tunnel --url http://127.0.0.1:PORT
```

Cloudflare sẽ tạo URL dạng:

```text
https://xxxxx.trycloudflare.com
```

Ví dụ:

```text
https://abc123-example.trycloudflare.com
```

Terminal sẽ hiển thị:

```text
================================================
          CLOUDFLARE PUBLIC URL
================================================
PUBLIC : https://xxxxx.trycloudflare.com
API    : https://xxxxx.trycloudflare.com/v1
LOCAL  : http://127.0.0.1:25565
================================================
```

### API public

Nếu URL là:

```text
https://xxxxx.trycloudflare.com
```

thì API endpoint là:

```text
https://xxxxx.trycloudflare.com/v1
```

---

# ⚠️ Cloudflare Quick Tunnel không phải domain cố định

Quick Tunnel tạo một subdomain ngẫu nhiên:

```text
*.trycloudflare.com
```

URL có thể thay đổi khi tunnel được tạo lại.

Quick Tunnel phù hợp với:

- Testing
- Development
- Demo
- Tạm thời public service

Không nên xem nó là giải pháp domain production lâu dài.

Nếu cần:

```text
https://api.example.com
```

hãy dùng Cloudflare Tunnel được cấu hình với hostname/domain riêng.

---

# 🔒 Security

## Không commit password vào GitHub

❌ Không nên:

```js
const PASSWORD = 'MyPassword123!';
```

✅ Nên:

```js
const PASSWORD =
    process.env.ROUTER_PASSWORD ||
    'CHANGE_THIS_PASSWORD_123!';
```

Sau đó đặt:

```text
ROUTER_PASSWORD=MyPassword123!
```

trong Environment Variables của panel.

---

## Không commit JWT_SECRET

Không đưa secret thật vào:

```text
README.md
GitHub
Discord
Screenshot
Log
```

Nên dùng:

```text
JWT_SECRET
ROUTER_PASSWORD
```

làm environment variables.

---

# 🖥️ Environment Variables

Có thể cấu hình:

| Variable | Ví dụ | Chức năng |
|---|---|---|
| `SERVER_PORT` | `25565` | Port panel cấp |
| `PORT` | `20128` | Port 9Router |
| `ROUTER_PASSWORD` | `MyPassword@2026` | Password khởi tạo |
| `JWT_SECRET` | random string | JWT signing secret |
| `DATA_DIR` | `.9router` | Nơi lưu dữ liệu |
| `NODE_ENV` | `production` | Production mode |

Ví dụ:

```text
SERVER_PORT=25565
ROUTER_PASSWORD=MyPassword@2026!
JWT_SECRET=CHANGE_ME_TO_RANDOM_SECRET
NODE_ENV=production
```

---

# 📄 `start.js`

Đây là file chạy chính:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const net = require('net');
const { execSync, spawn } = require('child_process');

const PORT = String(
    process.env.SERVER_PORT ||
    process.env.PORT ||
    '20128'
);

const HOST = '0.0.0.0';

const PASSWORD =
    process.env.ROUTER_PASSWORD ||
    'CHANGE_THIS_PASSWORD_123!';

const JWT_SECRET =
    process.env.JWT_SECRET ||
    'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_9ROUTER';

const DATA_DIR =
    process.env.DATA_DIR ||
    path.join(process.cwd(), '.9router');

const CLOUDFLARED_DIR =
    path.join(process.cwd(), '.cloudflared');

const CLOUDFLARED_BIN =
    path.join(
        CLOUDFLARED_DIR,
        process.platform === 'win32'
            ? 'cloudflared.exe'
            : 'cloudflared'
    );

function log(msg) {
    console.log(`[9Router] ${msg}`);
}

function error(msg) {
    console.error(`[ERROR] ${msg}`);
}

console.log('');
console.log('================================================');
console.log('        9ROUTER + CLOUDFLARE GENERIC');
console.log('================================================');
console.log(`Node       : ${process.version}`);
console.log(`OS         : ${process.platform}`);
console.log(`Arch       : ${process.arch}`);
console.log(`Host       : ${HOST}`);
console.log(`Port       : ${PORT}`);
console.log(`Data       : ${DATA_DIR}`);
console.log(`Password   : ${PASSWORD === 'CHANGE_THIS_PASSWORD_123!' ? 'CHƯA ĐỔI' : 'ĐÃ CẤU HÌNH'}`);
console.log('================================================');
console.log('');

const nodeMajor =
    Number(process.versions.node.split('.')[0]);

if (nodeMajor < 20) {
    error(`Node.js ${process.version} quá cũ.`);
    error('9Router yêu cầu Node.js 20+.');
    process.exit(1);
}

const env = {
    ...process.env,
    PORT,
    HOSTNAME: HOST,
    NODE_ENV: process.env.NODE_ENV || 'production',
    DATA_DIR,
    INITIAL_PASSWORD: PASSWORD,
    JWT_SECRET
};

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(
        DATA_DIR,
        { recursive: true }
    );
}

const packageJson =
    path.join(
        process.cwd(),
        'package.json'
    );

if (!fs.existsSync(packageJson)) {
    fs.writeFileSync(
        packageJson,
        JSON.stringify(
            {
                name: '9router-generic',
                version: '1.0.0',
                private: true
            },
            null,
            2
        )
    );
}

function install9Router() {
    log('Đang cài 9Router...');

    try {
        execSync(
            'npm install 9router@latest --no-audit --no-fund',
            {
                cwd: process.cwd(),
                stdio: 'inherit',
                env
            }
        );

        log('9Router cài đặt thành công.');
    } catch {
        error('Không thể cài 9Router.');
        process.exit(1);
    }
}

const routerPath =
    path.join(
        process.cwd(),
        'node_modules',
        '9router'
    );

if (!fs.existsSync(routerPath)) {
    install9Router();
}

function waitForPort(
    port,
    host = '127.0.0.1',
    timeout = 120000
) {
    return new Promise(
        (resolve, reject) => {
            const start = Date.now();

            function check() {
                const socket =
                    new net.Socket();

                socket.setTimeout(1500);

                socket.once('connect', () => {
                    socket.destroy();
                    resolve();
                });

                socket.once('error', () => {
                    socket.destroy();

                    if (
                        Date.now() - start >
                        timeout
                    ) {
                        reject(
                            new Error(
                                `Port ${port} không mở sau ${timeout / 1000}s`
                            )
                        );
                        return;
                    }

                    setTimeout(
                        check,
                        1000
                    );
                });

                socket.once('timeout', () => {
                    socket.destroy();
                    setTimeout(
                        check,
                        1000
                    );
                });

                socket.connect(
                    port,
                    host
                );
            }

            check();
        }
    );
}

function downloadFile(
    url,
    destination
) {
    return new Promise(
        (resolve, reject) => {
            const file =
                fs.createWriteStream(
                    destination
                );

            https.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            '9router-generic'
                    }
                },
                response => {

                    if (
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        return downloadFile(
                            response.headers.location,
                            destination
                        )
                            .then(resolve)
                            .catch(reject);
                    }

                    if (
                        response.statusCode !== 200
                    ) {
                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        reject(
                            new Error(
                                `HTTP ${response.statusCode}`
                            )
                        );
                        return;
                    }

                    response.pipe(file);

                    file.on(
                        'finish',
                        () => {
                            file.close(resolve);
                        }
                    );
                }
            ).on(
                'error',
                e => {
                    file.close();

                    try {
                        fs.unlinkSync(
                            destination
                        );
                    } catch {}

                    reject(e);
                }
            );
        }
    );
}

function getLatestCloudflared() {
    return new Promise(
        (resolve, reject) => {
            https.get(
                'https://api.github.com/repos/cloudflare/cloudflared/releases/latest',
                {
                    headers: {
                        'User-Agent':
                            '9router-generic',
                        'Accept':
                            'application/vnd.github+json'
                    }
                },
                response => {

                    let data = '';

                    response.on(
                        'data',
                        chunk => {
                            data += chunk;
                        }
                    );

                    response.on(
                        'end',
                        () => {

                            if (
                                response.statusCode !== 200
                            ) {
                                reject(
                                    new Error(
                                        `GitHub API HTTP ${response.statusCode}`
                                    )
                                );
                                return;
                            }

                            try {
                                resolve(
                                    JSON.parse(data)
                                );
                            } catch (e) {
                                reject(e);
                            }
                        }
                    );
                }
            ).on(
                'error',
                reject
            );
        }
    );
}

function getCloudflaredAsset(
    release
) {
    if (process.platform !== 'linux') {
        throw new Error(
            'Script này dành cho Linux Generic/Pterodactyl.'
        );
    }

    let filename;

    switch (process.arch) {
        case 'x64':
            filename =
                'cloudflared-linux-amd64';
            break;

        case 'arm64':
            filename =
                'cloudflared-linux-arm64';
            break;

        case 'arm':
            filename =
                'cloudflared-linux-arm';
            break;

        case 'ia32':
            filename =
                'cloudflared-linux-386';
            break;

        default:
            throw new Error(
                `Không hỗ trợ CPU: ${process.arch}`
            );
    }

    const asset =
        release.assets.find(
            x => x.name === filename
        );

    if (!asset) {
        throw new Error(
            `Không tìm thấy ${filename}`
        );
    }

    return asset;
}

async function installCloudflared() {
    if (
        fs.existsSync(
            CLOUDFLARED_BIN
        )
    ) {
        try {
            fs.chmodSync(
                CLOUDFLARED_BIN,
                0o755
            );
        } catch {}

        log(
            'cloudflared đã tồn tại.'
        );
        return;
    }

    fs.mkdirSync(
        CLOUDFLARED_DIR,
        { recursive: true }
    );

    log(
        'Đang lấy cloudflared mới nhất...'
    );

    const release =
        await getLatestCloudflared();

    log(
        `cloudflared ${release.tag_name}`
    );

    const asset =
        getCloudflaredAsset(
            release
        );

    await downloadFile(
        asset.browser_download_url,
        CLOUDFLARED_BIN
    );

    fs.chmodSync(
        CLOUDFLARED_BIN,
        0o755
    );

    log(
        'cloudflared đã cài xong.'
    );
}

function startRouter() {
    log(
        `Khởi động 9Router tại ${HOST}:${PORT}...`
    );

    const command =
        process.platform === 'win32'
            ? 'npx.cmd'
            : 'npx';

    return spawn(
        command,
        [
            '--yes',
            '9router@latest',
            '--port',
            PORT,
            '--no-browser'
        ],
        {
            cwd: process.cwd(),
            env,
            stdio: 'inherit'
        }
    );
}

function findCloudflareURL(
    text
) {
    const regex =
        /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g;

    const result =
        text.match(regex);

    return result
        ? result[0]
        : null;
}

function startCloudflare() {
    log(
        `Tạo Cloudflare Quick Tunnel -> localhost:${PORT}`
    );

    const tunnel =
        spawn(
            CLOUDFLARED_BIN,
            [
                'tunnel',
                '--no-autoupdate',
                '--url',
                `http://127.0.0.1:${PORT}`
            ],
            {
                cwd:
                    CLOUDFLARED_DIR,
                env: {
                    ...process.env
                },
                stdio: [
                    'ignore',
                    'pipe',
                    'pipe'
                ]
            }
        );

    let found = false;

    function output(data) {
        const text =
            data.toString();

        process.stdout.write(
            `[Cloudflare] ${text}`
        );

        const url =
            findCloudflareURL(
                text
            );

        if (
            url &&
            !found
        ) {
            found = true;

            console.log('');
            console.log(
                '================================================'
            );
            console.log(
                '          CLOUDFLARE PUBLIC URL'
            );
            console.log(
                '================================================'
            );
            console.log(
                `PUBLIC : ${url}`
            );
            console.log(
                `API    : ${url}/v1`
            );
            console.log(
                `LOCAL  : http://127.0.0.1:${PORT}`
            );
            console.log(
                '================================================'
            );
            console.log('');
        }
    }

    tunnel.stdout.on(
        'data',
        output
    );

    tunnel.stderr.on(
        'data',
        output
    );

    tunnel.on(
        'error',
        e => {
            error(
                `Cloudflare: ${e.message}`
            );
        }
    );

    return tunnel;
}

let routerProcess = null;
let cloudflareProcess = null;

function shutdown() {
    console.log('');
    log('Đang dừng server...');

    try {
        if (
            cloudflareProcess &&
            !cloudflareProcess.killed
        ) {
            cloudflareProcess.kill(
                'SIGTERM'
            );
        }
    } catch {}

    try {
        if (
            routerProcess &&
            !routerProcess.killed
        ) {
            routerProcess.kill(
                'SIGTERM'
            );
        }
    } catch {}

    setTimeout(
        () => process.exit(0),
        2000
    );
}

process.on(
    'SIGINT',
    shutdown
);

process.on(
    'SIGTERM',
    shutdown
);

async function main() {
    try {

        await installCloudflared();

        routerProcess =
            startRouter();

        log(
            `Đang chờ port ${PORT}...`
        );

        await waitForPort(
            Number(PORT)
        );

        log(
            '9Router đã sẵn sàng.'
        );

        cloudflareProcess =
            startCloudflare();

    } catch (e) {

        error(
            e.message
        );

        shutdown();
    }
}

main();
```

---

# 🧪 Kiểm tra sau khi deploy

## Kiểm tra Node

```bash
node -v
```

## Kiểm tra process

```bash
ps aux | grep 9router
```

## Kiểm tra port

```bash
ss -lntp
```

Hoặc:

```bash
netstat -lntp
```

## Kiểm tra HTTP

```bash
curl http://127.0.0.1:20128
```

Nếu panel cấp port khác:

```bash
curl http://127.0.0.1:$SERVER_PORT
```

---

# 🛠️ Troubleshooting

## `Node.js quá cũ`

Lỗi:

```text
9Router yêu cầu Node.js 20+
```

Hãy đổi Egg/Container image sang Node.js 20+.

---

## `EADDRINUSE`

Lỗi:

```text
EADDRINUSE
```

Có process đang dùng port.

Kiểm tra:

```bash
ss -lntp
```

Hoặc:

```bash
lsof -i :20128
```

---

## Cloudflare không tạo URL

Kiểm tra:

```bash
./.cloudflared/cloudflared tunnel \
  --no-autoupdate \
  --url http://127.0.0.1:20128
```

Nếu server dùng port khác:

```bash
./.cloudflared/cloudflared tunnel \
  --no-autoupdate \
  --url http://127.0.0.1:$SERVER_PORT
```

---

## Public URL không hoạt động

Kiểm tra local trước:

```bash
curl http://127.0.0.1:$SERVER_PORT
```

Nếu local không trả lời thì Cloudflare cũng không thể proxy được.

Kiểm tra log:

```text
[9Router]
[Cloudflare]
```

---

# 🔄 Restart

Chỉ cần restart server trong panel:

```text
STOP
↓
START
```

`start.js` sẽ tự chạy lại 9Router và tạo Quick Tunnel mới.

---

# 📌 API configuration

Sau khi tạo API key trong Dashboard:

```text
Base URL:
https://xxxxx.trycloudflare.com/v1

API Key:
<API_KEY_FROM_9ROUTER>

Model:
<MODEL_FROM_DASHBOARD>
```

Local:

```text
http://127.0.0.1:20128/v1
```

Public:

```text
https://xxxxx.trycloudflare.com/v1
```

---

# 🚀 Deploy từ GitHub

Đưa các file sau lên repository:

```text
start.js
package.json
README.md
```

Sau đó trên Generic/Pterodactyl:

### Startup

```bash
node start.js
```

### Nếu panel có Git Repository

Đặt repository của bạn vào Git Repository field rồi để panel pull source.

### Nếu dùng terminal

```bash
git clone YOUR_REPOSITORY
cd YOUR_REPOSITORY
node start.js
```

---

# 📋 package.json tối thiểu

```json
{
  "name": "9router-generic",
  "version": "1.0.0",
  "private": true,
  "description": "9Router Generic deployment with Cloudflare Quick Tunnel"
}
```

Không cần khai báo dependency bắt buộc trong `package.json` vì `start.js` tự cài:

```bash
npm install 9router@latest
```

---

# ⚙️ Recommended Panel Variables

```text
SERVER_PORT=25565
ROUTER_PASSWORD=YOUR_STRONG_PASSWORD
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
NODE_ENV=production
```

Startup:

```bash
node start.js
```

---

# 🗂️ Data Persistence

Nên giữ thư mục:

```text
.9router/
```

để dữ liệu không bị mất sau restart/reinstall container nếu panel hỗ trợ persistent storage.

Không nên xóa:

```text
.9router/
```

trừ khi bạn thực sự muốn reset dữ liệu instance.

---

# ⚠️ Production note

Cloudflare Quick Tunnel được thiết kế cho **testing/development**, không phải giải pháp domain production lâu dài.

Khi cần production:

```text
9Router
   ↓
Cloudflare Tunnel
   ↓
Custom Domain
   ↓
api.example.com
```

Thay vì:

```text
9Router
   ↓
Quick Tunnel
   ↓
random.trycloudflare.com
```

---

# 🤝 Credits

- **9Router** — AI routing gateway
- **Cloudflare Tunnel** — secure outbound tunnel
- **Node.js** — runtime
- **Generic/Pterodactyl** — container environment

---

# ⭐ Kết luận

Để deploy, bạn chỉ cần:

```text
1. Upload start.js
2. Startup = node start.js
3. Set ROUTER_PASSWORD
4. Set JWT_SECRET
5. Start server
6. Lấy https://xxxxx.trycloudflare.com trong console
```

### 🎯 Endpoint cuối cùng

```text
Dashboard
https://xxxxx.trycloudflare.com

OpenAI-compatible API
https://xxxxx.trycloudflare.com/v1
```

---

<p align="center">
  <b>🚀 9Router Generic</b><br>
  <sub>One file • Auto install • Cloudflare public access</sub>
</p>
