# Đóng góp cho Agents Factory

[English](CONTRIBUTING.md)

Cảm ơn bạn đã dành thời gian đóng góp! Mọi báo lỗi, ý tưởng và pull request đều được chào đón.

## Trước khi bắt đầu

- Đọc [AGENTS_vi.md](AGENTS_vi.md) ([English](AGENTS.md)): kiến trúc, cách chạy thử an toàn, quy tắc bảo mật và những điều đã rút ra. Tài liệu này áp dụng cho cả người lẫn AI agent.
- Với thay đổi lớn hơn một bản sửa nhỏ, hãy mở issue trước để thống nhất hướng làm.
- Lỗi bảo mật: **không mở issue công khai**, xem [SECURITY_vi.md](SECURITY_vi.md).

## Chuẩn bị môi trường

Agents Factory không có thư viện phụ thuộc và không cần build. Bạn chỉ cần Node.js ≥ 20 và CLI của agent muốn dùng thử.

```bash
git clone https://github.com/ngthxnk312/agents-factory.git
cd agents-factory
git config core.hooksPath .githooks   # bật kiểm tra commit message
node server.js                        # http://127.0.0.1:7420
```

Chạy thử trên một bản tạm để không đụng tới chat và cấu hình thật:

```bash
HUB_CONFIG=/tmp/hub-test/config.json HUB_DATA=/tmp/hub-test/data PORT=7499 node server.js
```

## Nhánh và pull request

- `main` và `develop` được bảo vệ: mọi thay đổi đều đi qua pull request.
- Tạo nhánh từ `develop`: `feature/<tên-ngắn>` cho tính năng, `fix/<tên-ngắn>` cho sửa lỗi.
- Mở pull request **vào `develop`**. Bản phát hành đi từ `develop` vào `main` và được gắn tag `vX.Y.Z`.
- Mỗi pull request chỉ nên chứa một thay đổi, và điền đầy đủ mẫu PR.

## Commit

- Dùng [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`.
- **Không thêm dòng ghi công**: không có `Co-Authored-By:`, "Generated with …" hay bất kỳ dòng ghi công AI/công cụ nào trong commit message, tiêu đề hay mô tả pull request. Quy tắc này được kiểm tra bởi `.githooks/commit-msg` và bởi check `commit-hygiene` trên mọi pull request.

## Phong cách code

- Viết giống code xung quanh: hàm nhỏ, return sớm, không dùng class trừ khi thật sự cần giữ trạng thái.
- Comment một dòng bằng tiếng Anh, giải thích *vì sao*, đặt phía trên đoạn code khó hiểu.
- Mọi chữ trên giao diện đều là khoá i18n: thêm vào **cả** `public/i18n/vi/` và `public/i18n/en/`.
- Không bao giờ commit `data/`, `hub.log` hoặc `hub.config.json`.

## Checklist trước khi mở pull request

- [ ] Đã chạy thử trên bản tạm (`HUB_DATA`/`PORT`), ở theme sáng và tối, tiếng Việt và tiếng Anh.
- [ ] Không có lỗi trong console trình duyệt hay log server.
- [ ] Đã cập nhật tài liệu (`README*.md`, `AGENTS*.md`) khi hành vi hoặc cách cài đặt thay đổi.
