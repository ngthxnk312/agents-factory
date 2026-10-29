# Agents Factory

Phòng điều khiển cục bộ cho các agent AI viết code. Giao việc cho Claude Code, Antigravity, Codex, Gemini CLI hoặc bất kỳ agent dạng CLI nào, ở mọi project trên máy. Sau đó theo dõi agent chạy, xem kết quả và làm tiếp, tất cả trong một tab trình duyệt.

- **Không phụ thuộc thư viện ngoài.** Chỉ cần Node.js ≥ 20 và CLI của từng agent muốn dùng (`claude`, `agy`, `codex`, `gemini`…). Không cần `npm install`, không cần build.
- **Chỉ chạy cục bộ.** Server chỉ nghe ở `127.0.0.1` và chặn request từ trang khác, vì nó có quyền chạy agent đụng vào file trên máy.
- **Bám quy trình SDLC.** Có sẵn bộ skill SDLC dự phòng (ý tưởng → kế hoạch → thiết kế → code → kiểm thử → phát hành → vận hành). Bộ này luôn nhường cho skill riêng của project và của máy.

> Bản tiếng Anh (bản chính): [README.md](README.md)

```bash
./install.sh          # lần đầu trên một máy: cấu hình + dịch vụ tự chạy + biểu tượng menu
./start.sh            # bật (nếu chưa chạy) và mở http://127.0.0.1:7420
node server.js        # hoặc chạy trực tiếp
```

## Tính năng

**Project và workspace**
- Project tự lấy từ `~/.claude.json`.
- Mở thư mục khác bằng **＋** (có hộp duyệt thư mục). Kéo thả để đổi thứ tự, đánh dấu ★, gỡ khỏi Hub hoặc đưa lại.
- Gom project thành workspace và chuyển qua lại; mọi màn hình đều lọc theo workspace đang chọn.

**Chat với agent**
- Mỗi chat Claude là một tiến trình `claude` chạy suốt cuộc chat (stream-json), khởi động trong thư mục project. Nhờ vậy nó nạp đúng MCP, plugin, CLAUDE.md, skill và settings như khi mở bằng terminal.
- Chữ hiện dần theo thời gian thực, và anh nhắn thêm được trong lúc agent đang làm.
- Agent khác (Antigravity, Codex, Gemini, agent tuỳ ý) chạy một tiến trình cho mỗi tin nhắn, rồi nối tiếp phiên bằng ID phiên.
- **Đổi agent** (nút ⇄ ở đầu chat): chuyển cuộc chat sang agent khác, ví dụ Claude → Antigravity. Phiên của các CLI không chuyển qua nhau được, nên Hub mở chat mới với agent đích và bàn giao ngữ cảnh: yêu cầu gốc, danh sách việc, file đã sửa, các trao đổi gần đây. Hai chat được liên kết với nhau.
- Chế độ quyền giống terminal Claude Code: `default`, `⏵⏵ accept edits`, `⏸ plan`, `⏵⏵ auto`, `bypass`. Nhấn **Shift+Tab** trong ô chat để đổi vòng.
- Gõ `/` trong ô chat để chọn lệnh CLI, skill, plugin và lệnh của Hub (`/stop /rename /model /terminal /files /new /help`).
- Đính kèm file bằng kéo thả, dán hoặc nút 📎.
- Link và đường dẫn file trong câu trả lời bấm được. Đường dẫn file mở trong cột File, nhảy tới đúng dòng.
- Thanh tiến độ hiện bước đang làm, thời gian chạy, số bước và danh sách todo của agent. Các bước của subagent được gộp vào dòng của agent cha.

**Phiên làm việc**
- Mọi phiên Claude Code trên máy (chạy ở terminal hay trong Hub) đều mở lại, tách nhánh, đổi tên, nhóm theo project hoặc xoá được. Xoá nghĩa là chuyển vào Thùng rác.
- Phiên đang bị agent chạy nền (`claude --bg`) giữ: có 3 cách xử lý là tách nhánh, chuyển vào Hub (`claude stop` rồi tiếp tục), hoặc mở bằng terminal.
- Mục **Agents nền**: liệt kê các agent `claude --bg`, xem trực tiếp (chỉ đọc), mở terminal hoặc gỡ agent.

**File**
- Cột File (Ctrl+B): cây thư mục project, xem và sửa file (Ctrl+S để lưu; báo khi agent sửa cùng file), xem trước ảnh và markdown, tạo file mới.
- Chỉ truy cập được trong các thư mục project mà Hub biết.

**Thống kê dùng**
- Token theo ngày, model, project và phiên cho toàn máy.
- Lịch sử dài hạn lấy từ số liệu của chính Claude Code.
- Xem theo tài khoản: token tính cho tài khoản đang đăng nhập lúc dùng.
- Hạn mức 5 giờ / 7 ngày kèm giờ làm mới.
- Chi phí là ước tính theo giá API niêm yết, không phải hoá đơn.

**Dashboard màn Home**
- Việc đang chạy (bước hiện tại, thời gian chạy, tiến độ todo), việc cần xử lý, output hôm nay, chi phí toàn máy, hạn mức, biểu đồ token 14 ngày, project hoạt động nhiều và chat gần đây.

**Giao diện**
- Nút chuyển tiếng Việt / tiếng Anh ở thanh trên cùng.
- Giao diện sáng / tối / theo hệ thống. Các cột kéo được độ rộng và thu gọn được.
- Màn hình nào cũng có link riêng (`#tab=…`, `#chat=…`, `#session=…`) để mở ở tab mới. Chuột phải để mở menu có thêm thông tin.

## Skill SDLC

Thư mục `skills/` chứa bộ skill SDLC của factory (`sdlc-ideate`, `sdlc-breakdown`, `sdlc-design`, `sdlc-implement`, `sdlc-review`, `sdlc-test`, `sdlc-release`…) theo định dạng chuẩn `SKILL.md`. Chọn một skill khi giao việc, hoặc gõ `/sdlc-review <yêu cầu>` trong chat.

Skill được nhóm theo vai trò: **Điều phối, PM, BA, SA, Dev, BE, FE, Mobile, QA, DevOps**, bao trọn vòng đời phần mềm từ tiếp nhận yêu cầu, khám phá, tới xử lý sự cố.

Bộ này **chỉ là dự phòng**. Với mỗi skill, Hub dùng theo thứ tự:
1. skill riêng của project, ở `<project>/.claude/skills/`
2. skill trên máy, ở `~/.claude/skills/`
3. skill có sẵn hoặc skill của plugin tương đương, khai báo ở mục `prefer:` của skill (ví dụ `code-review`)
4. cuối cùng mới là `SKILL.md` của factory

Danh sách đầy đủ và cách thêm skill mới: xem [skills/README.md](skills/README.md).

## Agent

| Agent | Cách chạy | Tình trạng |
|---|---|---|
| Claude Code (`claude`) | tiến trình stream-json chạy suốt cuộc chat, `--resume` | đầy đủ tính năng |
| Antigravity (`agy`) | `agy --output-format stream-json -p=…`, `--conversation` | đã chạy thử |
| Codex (`codex`) | `codex exec --json`, `codex exec resume` | theo tài liệu CLI, chưa chạy thử |
| Gemini CLI (`gemini`) | `gemini --output-format stream-json`, `--resume` | theo tài liệu CLI, chưa chạy thử |
| Tuỳ ý | CLI bất kỳ khai báo trong `hub.config.json` (chỗ trống `{prompt}`, `{session}`) | hiện nguyên văn chữ in ra |

## Cấu hình

Cấu hình riêng của từng máy nằm trong `hub.config.json`. File này được `install.sh` tạo từ `hub.config.example.json`. Gồm: tên và avatar hiển thị, cổng, thư mục dữ liệu, thư mục cấu hình Claude, lệnh mở terminal, thư mục skill thêm, lệnh và model của từng agent.

Biến môi trường được ưu tiên hơn file cấu hình:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 7420 | cổng web |
| `HUB_DATA` | `./data` | thư mục dữ liệu |
| `MAX_PARALLEL` | 4 | số chat chạy cùng lúc; chat còn lại xếp hàng |
| `IDLE_MINUTES` | 15 | đóng tiến trình Claude khi rảnh quá ngần này phút |
| `CLAUDE_BIN` | `claude` | đường dẫn CLI Claude Code |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | thư mục cấu hình Claude Code |

## Tự chạy khi mở máy (Linux, dịch vụ systemd của người dùng)

`install.sh` cài 2 thứ:
- Dịch vụ `~/.config/systemd/user/agents-factory.service`. Dịch vụ này chạy `hub-service.sh`, file này nạp lại PATH của shell để agent và MCP chạy giống như trong terminal.
- Biểu tượng **Agents Factory** trong menu ứng dụng.

```bash
systemctl --user restart agents-factory   # sau khi sửa server.js
systemctl --user stop agents-factory      # tắt; dùng disable để bỏ tự chạy
tail -f hub.log                           # xem log
./install.sh --uninstall                  # gỡ dịch vụ và biểu tượng (giữ dữ liệu)
```

## Phát triển

Đọc [AGENTS.md](AGENTS.md) ([tiếng Việt](AGENTS_vi.md)) trước khi sửa code. Tài liệu này mô tả kiến trúc, cách chạy thử an toàn, quy tắc bảo mật và những điều đã học được.

## Tác giả

ngthxnk312
