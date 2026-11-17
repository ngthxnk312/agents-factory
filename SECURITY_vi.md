# Chính sách bảo mật

[English](SECURITY.md)

Agents Factory khởi chạy các AI agent có thể đọc và sửa file trên máy của bạn, vì vậy mọi báo cáo bảo mật đều được xem xét nghiêm túc.

## Phiên bản được hỗ trợ

Chỉ bản phát hành mới nhất được vá lỗi.

| Phiên bản | Hỗ trợ |
| --------- | ------ |
| `v0.0.x` mới nhất | ✅ |
| cũ hơn | ❌ |

## Báo cáo lỗ hổng

**Vui lòng không mở issue công khai cho vấn đề bảo mật.**

Hãy báo cáo kín qua GitHub: **Security → Advisories → [Report a vulnerability](https://github.com/ngthxnk312/agents-factory/security/advisories/new)**.

Nên kèm theo:

- kẻ tấn công làm được gì, và trong điều kiện nào;
- các bước tái hiện (phiên bản / commit, hệ điều hành, trình duyệt, CLI của agent);
- bản chứng minh khái niệm (proof of concept) hoặc log giúp xác nhận lỗi.

Bạn sẽ nhận được phản hồi xác nhận trong vòng **3 ngày làm việc** và đánh giá ban đầu trong vòng **7 ngày**. Khi bản vá được phát hành, bạn sẽ được ghi công trong advisory, trừ khi bạn muốn ẩn danh.

## Phạm vi

Agents Factory được thiết kế để **chạy trên máy, cho một người dùng**:

- server chỉ lắng nghe trên `127.0.0.1` và từ chối request từ origin lạ;
- quyền truy cập file chỉ giới hạn trong các project mà Hub biết, và các endpoint ảnh chỉ trả về file ảnh.

Ví dụ những vấn đề chúng tôi muốn được báo:

- một trang web hoặc một người dùng khác trên máy có thể gọi API của Hub hoặc khởi chạy agent;
- đọc hoặc ghi file ngoài các project được phép, path traversal, hoặc lấy được file không phải ảnh qua endpoint ảnh;
- chèn lệnh vào các câu lệnh Hub chạy (CLI của agent, `git`, trình mở terminal);
- token hoặc thông tin bí mật bị lộ ra log, giao diện hoặc repository.

Ngoài phạm vi: những lỗi đòi hỏi kẻ tấn công đã kiểm soát sẵn tài khoản người dùng của bạn, và việc mở Hub ra mạng công cộng trái với cách cài đặt được hướng dẫn.
