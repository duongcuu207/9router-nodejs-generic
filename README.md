# 🚀 9Router Generic — Hướng dẫn + start.js

Website hướng dẫn deploy **9Router** trên **Generic / Pterodactyl** với một file `start.js`.
Giao diện cam–đen, tiếng Việt, deploy được ngay lên **GitHub Pages**.

> Tự động cài đặt • Tự động chọn Port • Tự động đặt Password • Cloudflare Quick Tunnel

---

## 📦 Repo này chứa 2 thứ

| Thành phần | Mô tả |
|---|---|
| **Website hướng dẫn** | `index.html` + `css/` + `js/` — deploy lên GitHub Pages |
| **File deploy thật** | `start.js` — upload lên Pterodactyl / Generic |

`start.js` vừa là file chạy thật, vừa được nhúng vào trang web để người dùng copy/tải trực tiếp.

---

## 🌐 Deploy lên GitHub Pages

### Bước 1 — Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "Add 9Router Generic guide"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

### Bước 2 — Bật GitHub Pages

1. Vào repository → **Settings**
2. Chọn **Pages** ở menu trái
3. Mục **Source** → chọn `Deploy from a branch`
4. **Branch** → `main` · thư mục `/ (root)` → **Save**
5. Chờ 1–2 phút, site có tại:

```
https://<user>.github.io/<repo>/
```

> File `.nojekyll` đã có sẵn trong repo để GitHub Pages không xử lý qua Jekyll
> và không bỏ qua các thư mục bắt đầu bằng dấu chấm.

Mọi đường dẫn trong site đều là **tương đối** (`css/style.css`, `js/app.js`)
nên chạy đúng ở cả `file://`, `localhost` và `https://<user>.github.io/<repo>/`.

---

## ⚡ Deploy 9Router trên Pterodactyl / Generic

### 1. Upload `start.js`

Đặt file vào thư mục chính của server (nơi panel chạy lệnh).

### 2. Startup Command

```bash
node start.js
```

### 3. Start server

Lần chạy đầu mất 1–3 phút để cài 9Router và tải cloudflared.
Sau khi xong, console in ra:

```text
==========================================================
            CLOUDFLARE PUBLIC URL
==========================================================
PUBLIC    : https://xxxxx-xxxx.trycloudflare.com
DASHBOARD : https://xxxxx-xxxx.trycloudflare.com/dashboard
API (v1)  : https://xxxxx-xxxx.trycloudflare.com/v1
LOCAL     : http://127.0.0.1:20128
USER      : admin
PASSWORD  : ********
==========================================================
```

Mở `PUBLIC`, đăng nhập bằng `admin` + password ở trên.

---

## 🔐 Biến môi trường

Đặt trong panel (**khuyến nghị**) thay vì sửa code:

| Biến | Ví dụ | Chức năng |
|---|---|---|
| `SERVER_PORT` | `25565` | Port panel cấp (ưu tiên cao nhất) |
| `PORT` | `20128` | Port dự phòng |
| `ROUTER_PASSWORD` | `MyPassword@2026!` | Password khởi tạo |
| `JWT_SECRET` | chuỗi ngẫu nhiên | Khóa ký JWT cho cookie dashboard |
| `DATA_DIR` | `.9router` | Nơi lưu dữ liệu |
| `NODE_ENV` | `production` | Chế độ chạy |
| `CF_TUNNEL` | `0` | Đặt `0` để tắt Cloudflare Tunnel |
| `AUTO_UPDATE` | `1` | Luôn cài `9router@latest` mỗi lần khởi động |
| `READY_TIMEOUT` | `300` | Số giây chờ 9Router mở port |
| `ROUTER_LOG` | `0` | Đặt `0` để ẩn log chi tiết |
| `CLOUDFLARED_BIN` | `/usr/bin/cloudflared` | Dùng binary cloudflared có sẵn |
| `CF_ARGS` | `--protocol http2` | Tham số thêm cho cloudflared |

Cấu hình khuyến nghị:

```env
SERVER_PORT=25565
ROUTER_PASSWORD=YOUR_STRONG_PASSWORD
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
NODE_ENV=production
```

Tạo secret ngẫu nhiên:

```bash
openssl rand -hex 32
```

---

## 🔑 Cơ chế tự sinh Password & JWT

Nếu **không** đặt biến môi trường, script tự sinh và **lưu lại** để không đổi sau restart:

```text
ROUTER_PASSWORD (env)
      ↓ nếu trống
.9router/.initial-password   (file đã lưu từ lần trước)
      ↓ nếu chưa có
sinh mới + ghi vào file
```

Điều này áp dụng tương tự cho `JWT_SECRET`, `API_KEY_SECRET`, `MACHINE_ID_SALT`.

> ⚠️ `INITIAL_PASSWORD` chỉ là mật khẩu **khởi tạo**. Nếu database đã có password hash
> thì giá trị mới **không ghi đè**. Muốn đổi password sau đó, hãy đổi trong Dashboard.

---

## 🌐 Port

Thứ tự ưu tiên:

```js
process.env.SERVER_PORT   // panel cấp
process.env.PORT          // dự phòng
'20128'                   // mặc định
```

---

## 📁 Cấu trúc sau khi chạy

```text
9router-generic/
├── start.js
├── package.json
├── README.md
│
├── .9router/                  # dữ liệu instance — GIỮ LẠI khi restart
│   ├── db/data.sqlite
│   ├── .initial-password
│   ├── .jwt-secret
│   └── last-public-url.txt
│
└── .cloudflared/
    └── cloudflared            # binary tự tải về
```

---

## 🛠️ Phát triển website

Sửa `start.js` xong thì **bắt buộc** chạy lại lệnh nhúng, nếu không trang web
sẽ hiển thị code cũ:

```bash
node build-embed.js
```

Kiểm tra toàn vẹn trước khi deploy:

```bash
node verify.js
```

`verify.js` kiểm tra:

- Mọi `id` mà JS tham chiếu đều tồn tại trong HTML
- Source nhúng khớp **byte-for-byte** với `start.js`
- Không còn marker build sót lại
- Không có thẻ HTML chưa escape trong khối code
- Không có đường dẫn tuyệt đối gốc (sẽ hỏng trên GitHub Pages)
- Thẻ HTML và dấu ngoặc CSS cân bằng

### Cấu trúc website

```text
.
├── index.html          # Trang hướng dẫn (source start.js nhúng trong <pre id="startjsSource">)
├── css/style.css       # Theme cam–đen, responsive, reduced-motion
├── js/
│   ├── code.js         # Code viewer, highlight, Copy, Download .js
│   └── app.js          # Nav, scrollspy, tabs, accordion, terminal, reveal
├── build-embed.js      # Nhúng start.js vào index.html
└── verify.js           # Kiểm tra toàn vẹn
```

### Cách nút Copy / Download hoạt động

`start.js` được nhúng **một lần** vào `<pre id="startjsSource">` (đã escape `& < >`).
Nút **Copy** và **Tải start.js** đọc qua `textContent` của chính phần tử đó, nên:

- Nội dung copy/tải **luôn khớp 100%** với code hiển thị
- Chạy được cả trên `file://` (dùng fallback `execCommand` khi Clipboard API bị chặn)

Nếu khối nhúng trống, `code.js` tự động `fetch('start.js')` làm phương án dự phòng.

---

## 🧪 Test nhanh `start.js` (không cần tunnel)

```bash
CF_TUNNEL=0 SERVER_PORT=25999 node start.js
```

Rồi kiểm tra:

```bash
curl http://127.0.0.1:25999/api/health
# {"ok":true}
```

---

## ⚠️ Lưu ý

- **Quick Tunnel không phải domain cố định.** URL đổi mỗi lần restart. Phù hợp cho
  testing/development/demo, không phải giải pháp production lâu dài. Cần domain riêng
  thì dùng Cloudflare Tunnel có cấu hình hostname.
- **Không commit `.9router/`** lên GitHub — thư mục này chứa password hash và secret.
  `.gitignore` đã chặn sẵn.
- Node.js **20+** được khuyến nghị (tối thiểu 18 để chạy).

---

## 🤝 Credits

- **9Router** — AI routing gateway
- **Cloudflare Tunnel** — secure outbound tunnel
- **Node.js** — runtime
- **Generic / Pterodactyl** — container environment
