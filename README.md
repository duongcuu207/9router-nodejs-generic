# 🚀 9Router Generic Hỗ Trợ NAT Hosting App Cheap
<p align="center">
  <b>9Router chạy trên Generic / Pterodactyl với một file <code>start.js</code></b><br>
  Tự động cài đặt • Tự động chọn Port • Tự động đặt Password • Cloudflare Quick Tunnel
</p>

---

## ✨ Tổng quan

> **Lưu ý:** README này chỉ chứa hướng dẫn triển khai và cấu hình. Mã nguồn `start.js` được tách riêng khỏi tài liệu để README dễ đọc và phù hợp để xuất bản trên GitHub.



Repo này dùng để triển khai **9Router** trên các môi trường Generic Node.js như:

- Pterodactyl
- Pelican Panel
- VPS/container có Node.js
- Hosting Generic Node.js
- Các panel cho phép chạy `node start.js`

Khi khởi động bằng `start.js`, hệ thống sẽ thực hiện:

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
