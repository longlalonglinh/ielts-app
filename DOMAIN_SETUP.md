# Hướng dẫn cấu hình Tên miền (Custom Domain) cho IELTS-APP

Tài liệu này tổng hợp cấu hình đã đồng bộ từ `EO-EO-3` sang `IELTS-APP`, cùng bảng thông số chuẩn cho từng nền tảng triển khai.

---

## 1. Các thay đổi cốt lõi đã được đồng bộ trong IELTS-APP

1. **Chuẩn hóa đường dẫn tài nguyên (`vite.config.ts`)**:
   - `base` mặc định là `'/'` (hoặc lấy từ `VITE_BASE_PATH` nếu cấu hình).
   - Đảm bảo khi chạy domain riêng hoặc subdomain, toàn bộ file JavaScript và CSS trong `dist/assets/` không còn bị lỗi **HTTP 404**.

2. **Hỗ trợ đồng thời `VITE_API_URL` và `VITE_API_BASE_URL` (`src/services/api.ts`)**:
   - Tự động nhận diện backend endpoint từ biến môi trường `VITE_API_URL` hoặc `VITE_API_BASE_URL`.
   - Nếu chạy trên cùng một domain (fullstack container / VPS), API tự động phân giải về tương đối (`/api/...`).

3. **Backend `server.ts`**:
   - Hỗ trợ biến môi trường `PORT` (mặc định 3000, có thể override thành 8080, 80,... trên VPS / Docker).
   - Kích hoạt `trust proxy` (`app.set('trust proxy', 1)`) cho Nginx, Traefik, Cloudflare.
   - Bổ sung middleware **CORS** toàn diện (cho phép `*` và xử lý HTTP `OPTIONS` preflight) giúp frontend tách biệt gọi API mượt mà không bị chặn `Access-Control-Allow-Origin`.

4. **GitHub Actions (`.github/workflows/deploy.yml`)**:
   - Tự động tạo file `public/CNAME` khi khai báo secret `CUSTOM_DOMAIN`.
   - Chuyển tiếp các biến `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_BASE_PATH` vào quá trình build.

---

## 2. Cấu hình DNS Record theo loại tên miền

### Trường hợp A: Dùng Tên miền gốc (Apex Domain - ví dụ `yourdomain.com`)

| Type | Name / Host | Value / Target | Proxy Status |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` | DNS Only (Grey Cloud) |
| **A** | `@` | `185.199.109.153` | DNS Only (Grey Cloud) |
| **A** | `@` | `185.199.110.153` | DNS Only (Grey Cloud) |
| **A** | `@` | `185.199.111.153` | DNS Only (Grey Cloud) |
| **CNAME** | `www` | `<username>.github.io` | DNS Only (Grey Cloud) |

*(Nếu triển khai trên VPS riêng: Tạo 1 bản ghi `A` trỏ `@` về địa chỉ IPv4 của VPS).*

### Trường hợp B: Dùng Subdomain (ví dụ `ielts.yourdomain.com` hoặc `app.yourdomain.com`)

| Type | Name / Host | Value / Target | Proxy Status |
| :--- | :--- | :--- | :--- |
| **CNAME** | `ielts` (hoặc `app`) | `<username>.github.io` | DNS Only (Grey Cloud) |

---

## 3. Cấu hình GitHub Pages (Nếu chạy Static Frontend)

1. **Tạo file `public/CNAME`**:
   Tạo file `public/CNAME` chứa đúng tên miền (ví dụ: `ielts.yourdomain.com`).
2. **Kích hoạt trên GitHub**:
   - Vào **Repository Settings** > **Pages**.
   - Tại mục **Custom domain**: Nhập domain và ấn **Save**.
   - Tích chọn **Enforce HTTPS** (sau khi chứng chỉ SSL của GitHub hoàn tất cấp phát, thường mất 5 - 15 phút).

---

## 4. Cấu hình Nginx Reverse Proxy (Nếu chạy Fullstack VPS với `server.ts`)

Nếu chạy backend Node.js / Bun (`bun run server.ts` hoặc PM2) trên VPS lắng nghe tại cổng `3000`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Cấp chứng chỉ SSL tự động qua Certbot:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 5. Danh sách kiểm tra chẩn đoán lỗi nhanh

- **`DNS_PROBE_FINISHED_NXDOMAIN`**: Bản ghi DNS chưa tồn tại hoặc chưa được lưu trên hệ thống phân giải tên miền (chờ 5 - 30 phút để lan truyền DNS).
- **`ERR_CONNECTION_REFUSED`**: Tiến trình `server.ts` chưa chạy trên VPS, hoặc Nginx chưa được bật (`sudo systemctl status nginx`).
- **`HTTP 404` trên các file `assets/*.js`**: Do `base` trong `vite.config.ts` trỏ sai đường dẫn subfolder. Trong bản cập nhật này đã được fix về `'/'`.
- **`HTTP 502 Bad Gateway`**: Tiến trình backend bị dừng hoặc đang lắng nghe sai cổng so với cấu hình `proxy_pass` của Nginx.
