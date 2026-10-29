# AGENTS.md (bản tiếng Việt)

> Bản đối chiếu để đọc lại. **Bản chính là [AGENTS.md](AGENTS.md) (tiếng Anh).** Khi sửa bản tiếng Anh thì cập nhật cả file này.

Hướng dẫn cho người và agent AI phát triển dự án. Đọc trước khi sửa code.

## Dự án là gì

**Agents Factory** là trang web chạy cục bộ (http://127.0.0.1:7420) để giao việc cho các agent AI viết code ở mọi project trên một máy, và theo dõi chúng chạy. Hiện hỗ trợ Claude Code, Antigravity (`agy`), Codex, Gemini CLI, cùng agent dạng CLI tuỳ ý.

Hiện là dự án cá nhân, sau này có thể mở cho cộng đồng. Ba nguyên tắc cần giữ:
- **Không phụ thuộc thư viện ngoài.** Chỉ dùng thư viện có sẵn của Node 20+. Không `npm install`, không build, không framework.
- **Chỉ chạy cục bộ.** Server chỉ nghe ở 127.0.0.1 và không bao giờ được mở ra mạng.
- **Mang đi được.** Mọi thứ riêng của từng máy nằm trong `hub.config.json`.

**Quy ước ngôn ngữ:**
- **Mọi chữ trên giao diện lấy từ từ điển i18n** (`public/i18n/<lang>/<namespace>.json`, khoá → giá trị); không viết cứng trong code hay HTML.
- **Ghi chú trong code, tài liệu, skill và file ví dụ đều viết tiếng Anh**; không thêm ghi chú tiếng Việt trong code.
- `README_vi.md` và `AGENTS_vi.md` là bản tiếng Việt để đọc lại, phải cập nhật theo bản tiếng Anh.
- Không để tên cá nhân, tên người dùng máy hay đường dẫn riêng của máy trong các file đưa lên git. Khi cần ký tên tác giả thì dùng `ngthxnk312`.

## Chạy, khởi động lại, thử nghiệm

```bash
./start.sh                                # bật server nếu chưa chạy (ưu tiên dịch vụ systemd), mở trình duyệt
systemctl --user restart agents-factory   # nạp lại sau khi sửa server.js / agents.js
tail -f hub.log                           # log server
./install.sh                              # trên máy mới: hub.config.json + dịch vụ systemd + biểu tượng menu
```

- **Sửa file trong `public/` không cần khởi động lại.** Server đọc file tĩnh trực tiếp từ ổ đĩa, nên chỉ cần Ctrl+F5 trên trình duyệt.
- **Khởi động lại server sẽ ngắt mọi chat đang chạy**, kể cả chat anh đang dùng để nói chuyện, vì các agent là tiến trình con của server. Trước khi khởi động lại thì làm một trong hai cách:
  1. Chạy `curl -s localhost:7420/api/tasks` và chắc chắn không còn việc nào `running` hay `queued`.
  2. Hẹn khởi động lại vào lúc Hub rảnh.

  Hub thường được dùng để phát triển chính nó, nên tình huống này xảy ra thường xuyên.

### Thử nghiệm

Chưa có bộ test tự động. Hãy thử trên một bản Hub riêng để không đụng tới Hub đang chạy và dữ liệu của nó:

```bash
D=$(mktemp -d); cp data/hub.json $D/
PORT=7499 HUB_DATA=$D node server.js     # thư mục dữ liệu riêng; đọc ~/.claude thật nhưng chỉ đọc
```

- **API:** thử bằng `curl`.
- **Giao diện:** điều khiển Chromium chạy ngầm qua giao thức CDP (dùng `WebSocket` có sẵn của Node, không cần thư viện Playwright). Chụp màn hình rồi xem lại, và kiểm tra lỗi `Runtime.exceptionThrown`.
- **Cú pháp:** chạy `node --check` cho mọi file JS đã sửa.

## Cấu trúc

```
server.js           Server HTTP + toàn bộ backend (một file, chia mục bằng "// ---------- … ----------")
agents.js           Adapter cho agent ngoài Claude (agy, codex, gemini, tuỳ ý): dựng tham số + đọc output JSON từng dòng
hub.config.json     Cấu hình theo máy (không đưa lên git). Mẫu: hub.config.example.json
hub-service.sh      Điểm chạy cho systemd: nạp lại PATH (pyenv, sdkman, linuxbrew…) rồi chạy `node server.js`
install.sh          Tạo cấu hình, dịch vụ systemd (agents-factory.service), biểu tượng menu; có --uninstall
start.sh            Bật server nếu cần + mở trình duyệt
public/
  index.html        Khung trang: thanh trên, cột trái, các tab, hộp giao việc. Thứ tự nạp script là quan trọng (xem dưới)
  style.css         Toàn bộ CSS. Biến màu đặt ở :root; chế độ tối qua [data-theme] + prefers-color-scheme
  i18n.js           t(khoá, tham số), i18n.tx(), data-i18n / data-i18n-attr, nút chuyển vi/en (nạp từ điển đồng bộ)
  i18n/<lang>/*.json Từ điển phẳng khoá → giá trị, mỗi namespace một file (common, index, app, dashboard, files, slash, nav, bgview, ui, resize, server)
  icons.js          Bộ icon SVG + MutationObserver tự đổi emoji trên giao diện thành <svg> (danh sách MAP / SKIP)
  ui.js             Popup tự làm: dialog/confirm/prompt, toast, <select> tuỳ biến, popMenu, tooltip (thay cho title=)
  files.js          Cột File bên phải: cây thư mục, trình sửa file, lưu có phát hiện xung đột
  slash.js          Gợi ý lệnh "/" trong ô chat; lệnh riêng của Hub (/stop /rename /model …)
  dashboard.js      Dashboard màn Home (tab mặc định): việc đang chạy, cần xử lý, số liệu chính, biểu đồ 14 ngày, chat gần đây
  app.js            Giao diện chính: state, các hàm vẽ, chat, phiên cũ, thống kê token, điều hướng, xử lý SSE
  bgview.js         Danh sách agent chạy nền (claude --bg) + xem trực tiếp (chỉ đọc)
  nav.js            Ctrl/chuột giữa để mở tab mới; menu chuột phải có thông tin
  resize.js         Kéo để đổi độ rộng cột (lưu trong layout.sizes)
  img/logo.svg      Logo / favicon / icon ứng dụng
skills/             Skill SDLC của factory (sdlc-*/SKILL.md). CHỈ LÀ DỰ PHÒNG, xem mục "Skill SDLC"; mục lục ở skills/README.md
data/               Dữ liệu lúc chạy (không đưa lên git): hub.json, tasks.json, logs/<task>.jsonl, uploads/,
                    sessions-cache.json, ratelimit.json, accounts.json, commands.json
```

**Thứ tự nạp script:** `icons.js → i18n.js → ui.js → files.js → slash.js → nav.js → app.js → dashboard.js → bgview.js → resize.js`.
- Đây là script thường, dùng chung một phạm vi toàn cục.
- Các file khác dùng biến và hàm cấp cao nhất của `app.js` (`state`, `api`, `esc`, `$`, `$$`, `toast`, `layout`…) **lúc gọi hàm**, không phải lúc nạp. Vì vậy file nào nạp trước `app.js` thì không được gọi chúng ngay khi nạp.

## Backend (`server.js`)

- **Cấu hình:** `hub.config.json` cho giá trị mặc định; biến môi trường được ưu tiên hơn (`PORT`, `HUB_DATA`, `CLAUDE_BIN`, `CLAUDE_CONFIG_DIR`, `MAX_PARALLEL`, `IDLE_MINUTES`).
- **Chat Claude:** mỗi chat (task) chạy một tiến trình sống lâu: `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`, khởi động trong thư mục project. Nhờ vậy CLI tự nạp MCP, plugin, CLAUDE.md và settings của project đó.
  - Tin nhắn đi vào qua stdin dạng JSON từng dòng; `handleLine()` đổi output thành sự kiện.
  - Tiến trình tự đóng khi rảnh quá `IDLE_MINUTES`, lần nhắn sau sẽ mở lại bằng `--resume`.
  - Đổi model, chế độ quyền hoặc plugin cũng khởi động lại tiến trình bằng `--resume`.
- **Agent khác:** mỗi tin nhắn chạy một tiến trình qua `deliverOneShot()` và adapter trong `agents.js`; nối tiếp cuộc trò chuyện bằng ID phiên.
- **Sự kiện:** lưu ở `data/logs/<taskId>.jsonl` và phát qua SSE ở `/api/stream`.
  - Loại tin SSE: `task`, `event`, `delta`, `usage`, `ratelimit`, `removed`, `sessions-updated`, `account`.
  - Loại sự kiện mà `evNode()` hiển thị: `user`, `text`, `thinking`, `init`, `tool`, `tool_result`, `result`, `stderr`, `system`.
- **Lịch sử phiên:** đọc dần từ `~/.claude/projects/*/*.jsonl`. Vị trí đã đọc được lưu trong `sessions-cache.json`; tăng `SCAN_V` để buộc quét lại từ đầu.
  - Token được loại trùng theo `message.id`.
  - Token của subagent lấy từ `<id>/subagents/*.jsonl`.
- **Tài khoản:** token được tính cho tài khoản đang đăng nhập lúc dùng. Lịch sử đổi tài khoản lưu ở `accounts.json` (lấy từ `oauthAccount` trong `~/.claude.json`). Claude Code không ghi tài khoản vào từng phiên, nên token dùng trước khi bắt đầu theo dõi được xếp vào "chưa rõ".
- **Skill SDLC:** `resolveSkills(project)` gộp skill theo thứ tự ưu tiên từ cao xuống thấp:
  1. skill của project (`<project>/.claude/skills`)
  2. skill trên máy (`~/.claude/skills`, cho phép thư mục lồng nhau)
  3. skill có sẵn hoặc skill plugin được khai báo ở mục `prefer:` của skill factory. Nguồn gồm thư mục `skills/` của các plugin đã cài, và danh sách lệnh "/" mà CLI báo về (lưu ở `commands.json`).
  4. skill `skills/sdlc-*` của factory

  Cách dùng sau khi chọn:
  - Với Claude: skill không phải của factory được gọi theo cách gốc là `/<skill> …`. Skill của factory thì đưa vào `--append-system-prompt` (khi chọn skill cho cả việc) hoặc chèn vào tin nhắn (khi gõ `/sdlc-x` một lần).
  - Với agent khác: nội dung `SKILL.md` đã chọn được chèn vào tin nhắn đầu tiên.
- **Bàn giao sang agent khác:** `POST /api/tasks/:id/handoff {agent, model, permissionMode, note}`.
  - `handoffBrief()` dựng bản bàn giao gồm: yêu cầu gốc, todo, file đã sửa / đã đọc (lấy từ sự kiện tool), các trao đổi gần nhất trong giới hạn độ dài.
  - Hub tạo task mới cho agent đích; `handoffFrom` / `handoffTo` liên kết hai chat với nhau. Tin nhắn hiển thị chỉ là `displayText` ngắn, không hiện cả bản bàn giao.
  - Giao diện nằm ở `public/handoff.js` (namespace `handoff.*`).
- **Agent chạy nền:** liệt kê bằng `claude agents --json` (có cache). Gỡ agent thì chạy `claude stop` rồi `claude rm`. Dịch vụ nền (daemon) của CLI chỉ chạy khi có việc, nên nếu `rm` báo không kết nối được thì bật nó bằng `claude daemon run`.

### Những điều đã học được, không được làm hỏng lại

- `result.total_cost_usd` mà CLI trả về là **chi phí cộng dồn của cả phiên**; resume một phiên sẽ nạp lại cả chi phí cũ. Không bao giờ cộng con số này qua từng lượt; hãy lưu phần chênh lệch giữa các lượt (`costBase`/`costLast`).
- CLI gửi `system/init` ở **mỗi lượt**; Hub loại trùng bằng `lastInitKey`.
- `--resume` báo lỗi "running in the background (<id>)" khi một agent `claude --bg` đang giữ phiên. Hub nhận ra lỗi này (`BG_RE`) và cho 3 lựa chọn: tách nhánh, dừng rồi chuyển vào Hub, hoặc mở bằng terminal.
- CLI `agy` cần gắn liền nội dung vào cờ: `-p=<nội dung>`, không phải `-p <nội dung>`. Khi chạy không tương tác, `agy` tự từ chối chạy lệnh trừ khi dùng `--mode accept-edits` hoặc `--dangerously-skip-permissions`.
- % hạn mức là của **tài khoản** (gồm cả các máy khác dùng chung tài khoản); số token là của **máy này**. Giao diện không bao giờ được trình bày cái này như cái kia.

## Quy tắc bảo mật

- Giữ nguyên việc chỉ nghe ở localhost và bước kiểm tra Host/Origin ở đầu hàm xử lý request (để chặn tấn công DNS rebinding).
- **API file** (`/api/fs/*`): mọi đường dẫn phải đi qua `fsResolve()`. Hàm này lấy đường dẫn thật (`realpath`) và yêu cầu kết quả nằm trong một thư mục project mà Hub biết, nên symlink trỏ ra ngoài bị chặn. Không thêm đường xử lý nào bỏ qua bước này.
- **Xem trước file của project:** `/api/fs/raw` **chỉ phục vụ ảnh**, kèm header `Content-Security-Policy: sandbox`. Không bao giờ phục vụ file HTML của project từ địa chỉ của Hub, vì trang đó sẽ dùng được API của Hub và điều khiển được agent.
- **Thông tin bí mật:** được che trước khi cấu hình MCP gửi xuống trình duyệt (`maskServer` / `maskStr`). Phần mới nào trả về cấu hình cũng phải che như vậy.
- **File của Claude Code chỉ được đọc** (`~/.claude/projects/*.jsonl`, `~/.claude.json`), không bao giờ ghi vào. Tên phiên do anh đặt lưu trong `hub.json` (`names`); xoá phiên nghĩa là chuyển vào Thùng rác (`gio trash`).
- **Tiến trình con:** luôn chạy bằng mảng tham số, không bao giờ ghép chuỗi lệnh shell từ dữ liệu người dùng nhập. `openTerminal` chỉ ghép lệnh shell từ ID đã kiểm tra hợp lệ.

## Quy ước giao diện

- **Dựng HTML:** dùng template string kèm `innerHTML`. **Mọi giá trị chèn vào đều phải qua `esc()`.**
  - Ngoại lệ là các hàm đã trả về HTML: `md()`, `toolLabel()`, `modeChip()`, `agentBadge()`, `skillBadge()`, `fxIconHtml()`. Không bọc chúng trong `esc()`.
- **Không dùng giao diện có sẵn của trình duyệt:** không `alert`, `confirm`, `prompt`, `Notification`, menu `<select>` gốc hay tooltip `title`. Dùng `ui.*` thay thế; `ui.js` tự nâng cấp `<select>` và `title`.
- **Icon:** viết emoji trong template, `icons.js` tự đổi sang SVG. Muốn thêm icon thì thêm hình vào `P` và ánh xạ emoji vào `MAP`. Nội dung của người dùng và của agent phải giữ nguyên, nên thêm khung chứa nó vào `SKIP` hoặc gắn `data-noicon`.
- **Bấm chuột:** chỉ có một hàm bắt click chung trên `document`, nhận diện theo thuộc tính `data-*`. Thuộc tính mới phải được đăng ký vào `CLICK_SEL`.
- **Lưu trạng thái:** trạng thái riêng của từng người xem để trong `localStorage`, khoá bắt đầu bằng `hub-` (`hub-layout`, `hub-ws`, `hub-theme`, `hub-seen`…). Trạng thái dùng chung thì lưu lên server.
- **i18n:** mọi nhãn đều là khoá, không viết cứng chữ trong code hay HTML.
  - JS dùng `t('ns.khu.ten', { thamSo })`, chỗ trống ghi `{thamSo}`. Thứ tự từ nằm trong giá trị của từ điển, không ghép trong code.
  - HTML dùng `data-i18n="khoá"` cho chữ, `data-i18n-attr="placeholder:khoá;title:khoá"` cho thuộc tính.
  - Mỗi file sở hữu một namespace riêng (`app.*` trong app.js, `dashboard.*` trong dashboard.js…); từ dùng chung để trong `common.*`.
  - Thêm khoá vào **cả** file `vi` và `en`. Ngày giờ định dạng theo `i18n.locale`. Tooltip và menu chuột phải cũng lấy qua `t()`.
  - Chữ do server tạo: lỗi HTTP được dịch theo header `X-Lang` (trả về `{ error, errorKey }`). Chữ server lưu lại (sự kiện, `lastText`/`note` của task) mang `textKey` + `params` kèm bản tiếng Việt dự phòng, giao diện hiển thị bằng `i18n.tx()`.
  - Không dịch nội dung của người dùng hay của agent.
  - Thêm ngôn ngữ mới: tạo thư mục `public/i18n/<lang>/` và thêm vào `LANGS` trong i18n.js. Đổi ngôn ngữ sẽ tải lại trang.
- **Điều hướng:** dùng phần hash của URL: `#tab=…&project=…`, `#chat=<taskId>`, `#session=<sessionId>`. Link phải mở được ở tab mới.
- **Khung chat:** `.timeline` là cột flex, nên các phần tử con cần `flex-shrink: 0`; nếu không, các `<details>` đang thu gọn bị ép thành vạch mảnh. Khung chỉ tự cuộn xuống khi người dùng đang ở cuối (`state.follow`).
- **Bẫy khi sửa code bằng script:** trong `String.prototype.replace`, chuỗi thay thế coi `$$` là `$`, nên chuỗi chứa `$$(` sẽ lặng lẽ thành `$(`. Hãy dùng hàm thay thế, hoặc kiểm tra lại sau khi sửa.

## Thêm tính năng

- **Thêm CLI agent mới:** thêm adapter vào `ADAPTERS` trong `agents.js`:
  - `args(t, text, ctx)` trả về mảng tham số cho một lượt.
  - `parse(obj, h)` đổi mỗi dòng JSON thành lời gọi `h.session / delta / text / thinking / tool / toolResult / result / stderr`.
  - khai báo thêm `resumeCmd(t)`, `models` và `modes`.

  Chế độ dùng lại tên của Claude (`''`, `acceptEdits`, `plan`, `auto`, `bypassPermissions`) và ánh xạ sang cờ gần nhất mà CLI đó có. Chạy thử từ đầu tới cuối trên bản Hub riêng với một yêu cầu thật.
- **Thêm API:** thêm nhánh `p === '/api/…'` trong hàm xử lý request. Đọc body bằng `await body(req)`, trả về bằng `send(res, code, obj)`. Thông báo lỗi hiện cho người dùng viết tiếng Việt (là chữ trên giao diện); ghi chú code viết tiếng Anh.
- **Thêm skill SDLC:** thêm `skills/sdlc-<tên>/SKILL.md`, phần đầu file có các dòng `name`, `description`, `stage`, `icon`, `mode`, `prefer`.
  - Viết chung cho mọi stack.
  - Liệt kê các skill tương đương phổ biến ở `prefer:` để skill có sẵn trên máy được ưu tiên.
  - Thêm skill vào `skills/README.md`.
- **Vai trò của skill:** mỗi skill SDLC có `role:` (`lead`, `pm`, `ba`, `sa`, `dev`, `fe`, `mobile`, `qa`, `devops`); hộp giao việc nhóm skill theo vai trò (`SKILL_ROLES` trong app.js).
- **Thêm trường cho task:** đặt bằng `updateTask(t, patch)`; hàm này lưu và phát cho trình duyệt. `publicTask()` quyết định trường nào được gửi xuống trình duyệt.
- **Thêm khung hay hộp thoại:** dùng `modalShell(html, cls)` hoặc `ui.dialog`. CSS thêm vào cuối `style.css` dưới tiêu đề `/* ---------- mục ---------- */`, dùng biến màu chung, không viết màu cứng.

## Quy trình git

- `main` và `develop` đều được **bảo vệ** trên GitHub: không push thẳng, không force-push, không xoá; mọi thay đổi vào qua Pull Request.
- Làm tính năng mới:
  1. Tách nhánh `feature/<tên-ngắn>` từ `develop`. Sửa lỗi thì dùng `fix/<tên>`.
  2. Commit theo Conventional Commits (`feat: …`, `fix: …`, `docs: …`).
  3. Tạo Pull Request vào `develop`.
- Phát hành: tạo Pull Request từ `develop` vào `main`, rồi gắn tag phiên bản (`vX.Y.Z`).
- Tác giả commit: `ngthxnk312`. Không commit `data/`, `hub.log`, `hub.config.json`.
- **Không thêm dòng ghi công:** không bao giờ thêm `Co-Authored-By:`, dòng "Generated with …" hay bất kỳ ghi chú AI / công cụ nào vào commit message, tiêu đề hoặc mô tả PR. Quy tắc được kiểm tự động ở 2 chỗ:
  - Trên máy: `.githooks/commit-msg`. Mỗi lần clone chạy một lần `git config core.hooksPath .githooks`.
  - Trên mọi PR: GitHub Action `commit-hygiene`, là bước kiểm bắt buộc của `main` và `develop`.

## Phong cách code

- Hàm nhỏ; không dùng class trừ khi trạng thái thật sự cần; thoát sớm khỏi hàm khi có thể.
- Ghi chú *lý do* trong một dòng, bằng tiếng Anh, đặt ngay trên đoạn code khó hiểu.
- Giữ `server.js` là một file chia mục, cho tới khi một mục rõ ràng đáng tách thành module riêng (như `agents.js`).
- Thêm tính năng thì cập nhật README.md (+ README_vi.md). Học được điều gì không nên phải học lại thì cập nhật file này (+ AGENTS_vi.md).
