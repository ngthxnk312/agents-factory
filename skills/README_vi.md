# Bộ skill SDLC của factory (bản tiếng Việt để đọc lại)

> Bản chính là [README.md](README.md) (tiếng Anh). Nội dung các `SKILL.md` đều viết tiếng Anh.

55 skill dùng chung cho mọi dự án phần mềm, chia theo 10 vai trò. Đây **chỉ là bộ dự phòng**. Với mỗi skill, Hub dùng theo thứ tự ưu tiên:
1. skill riêng của project, ở `<project>/.claude/skills/`
2. skill trên máy, ở `~/.claude/skills/`
3. skill có sẵn hoặc skill của plugin tương đương, liệt kê ở mục `prefer:`
4. cuối cùng mới là bản của factory

**Chế độ** là chế độ quyền Hub gợi ý khi chọn skill:
- `plan`: chỉ đọc, hoặc chỉ soạn bản nháp chờ duyệt.
- `acceptEdits`: được ghi file.

## Điều phối
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-feature-workflow` | acceptEdits | Chạy trọn luồng một tính năng, từ tiếp nhận tới tài liệu, có các điểm dừng chờ duyệt |

## PM – Quản lý dự án
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-pm-stakeholder-comms` | plan | Bản đồ các bên liên quan, kế hoạch truyền thông, agenda và biên bản họp (chỉ soạn nháp) |
| `sdlc-pm-project-plan` | plan | Mục tiêu, phạm vi, WBS, ước lượng, đường găng, mốc, baseline; nhập kế hoạch từ bảng tính (chạy thử trước) |
| `sdlc-pm-sprint` | plan | Lập sprint theo năng lực và velocity, theo dõi trong sprint, review, retro, nhắc việc |
| `sdlc-pm-risk-issue` | plan | Sổ RAID: chấm điểm rủi ro, độ ưu tiên issue, giả định, phụ thuộc, gói leo thang |
| `sdlc-pm-resource-budget` | plan | Năng lực và tải của đội, người duy nhất nắm việc, ngân sách so với thực chi, CPI/EAC; đánh giá thành viên (tuỳ chọn) |
| `sdlc-pm-progress` | plan | Tiến độ so với baseline, dự báo mốc, earned value, trạng thái RAG, kiểm số liệu trước khi gửi báo cáo |
| `sdlc-pm-change-control` | plan | Yêu cầu thay đổi: phân loại, đánh giá ảnh hưởng, phương án, người quyết, baseline mới |
| `sdlc-pm-quality` | plan | Definition of done, các cổng chất lượng, số liệu lỗi, kết luận go / no-go, bàn giao, nghiệm thu, đóng dự án |

## BA – Phân tích nghiệp vụ
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-intake` | plan | Tiếp nhận ticket/yêu cầu: phân loại, tiêu chí chấp nhận, ảnh hưởng, rủi ro, câu hỏi làm rõ |
| `sdlc-ideate` | plan | Khám phá vấn đề, so sánh các phương án khác nhau, đề xuất một phương án |
| `sdlc-ba-discovery` | plan | Chuẩn bị buổi lấy yêu cầu (bộ câu hỏi), hiện trạng / mục tiêu, biến ý tưởng mơ hồ thành brief tính năng và MVP |
| `sdlc-ba-requirements` | plan | Duy nhất giữ baseline yêu cầu (URD): tổng hợp từ biên bản, soát tài liệu khách hàng, yêu cầu kiểm thử được, MoSCoW, ma trận truy vết |
| `sdlc-ba-functional-spec` | plan | Đặc tả chức năng từng tính năng: vai trò, quyền, luồng, quy tắc, kiểm tra dữ liệu, trạng thái, thông báo, user story |
| `sdlc-ba-process-flow` | plan | Sơ đồ quy trình bằng Mermaid (swimlane, sequence, state), đủ nhánh lỗi, kèm bảng bước để truy vết |
| `sdlc-ba-ui-spec` | plan | Đặc tả màn hình: bảng thành phần, trường, hành vi ở mọi trạng thái; chỉ dùng design token có sẵn |
| `sdlc-ba-srs` | plan | Viết SRS chính thức, tự soát theo góc nhìn tester và dev, duyệt trước khi xuất, quản lý phiên bản |

## SA – Kiến trúc giải pháp
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-system-context` | acceptEdits | Lập bộ tài liệu bối cảnh cho hệ thống có sẵn; cập nhật phần thay đổi sau mỗi lần sửa |
| `sdlc-sa-solution-design` | plan | Kiến trúc giải pháp từ đặc tả chức năng: các NFR quan trọng nhất, so sánh phương án, tài liệu 13 mục, ADR, danh sách cần duyệt |
| `sdlc-sa-nfr-review` | plan | Kịch bản thuộc tính chất lượng đo được, utility tree, review kiến trúc với kết luận đạt / đạt có điều kiện / không đạt |
| `sdlc-sa-integration` | plan | Thiết kế tích hợp hệ thống ngoài: adapter, ánh xạ dữ liệu và lỗi, timeout / retry / idempotency, đối soát, chuyển đổi |
| `sdlc-design` | plan | Thiết kế kỹ thuật để review: luồng, dữ liệu, giao diện, edge case, bảo mật, giám sát, triển khai dần, ADR |
| `sdlc-api-design` | plan | Thiết kế API theo hợp đồng: DTO, phân quyền theo đối tượng, lỗi RFC 9457, phân trang, idempotency, phiên bản |

## Dev – Lập trình
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-standards` | plan | Chuẩn kỹ thuật nền: kiến trúc, code, lỗi, bảo mật, log, dữ liệu, API, test, git, definition of done |
| `sdlc-breakdown` | plan | Chia việc thành các lát dọc theo thứ tự, kèm test, ước lượng, cách chia MR, cổng duyệt kế hoạch |
| `sdlc-db-migration` | acceptEdits | Migration an toàn: mở rộng → chuyển dữ liệu → thu hẹp, backfill theo lô, chú ý khoá bảng, kế hoạch rollback |
| `sdlc-implement` | acceptEdits | Code từng bước nhỏ, viết test trước, theo đúng quy ước sẵn có, báo cáo kiểm chứng trung thực |
| `sdlc-debug` | acceptEdits | Tìm nguyên nhân gốc trước: tái hiện, khoanh vùng, chứng minh, sửa kèm test hồi quy |
| `sdlc-review` | plan | Review độc lập theo checklist, thang mức độ nghiêm trọng, kết luận PASS / FAIL |
| `sdlc-docs` | acceptEdits | Tài liệu tính năng có thông tin truy vết, ADR, runbook, worklog trung thực |

## BE – Backend
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-be-implement` | acceptEdits | Làm tính năng backend trọn vẹn: phân tầng chặt, tách DTO / domain / entity, kiểm tra dữ liệu, phạm vi transaction (không gọi ra ngoài trong transaction), đồng thời và idempotency, phân quyền theo đối tượng ngay trong truy vấn, lỗi RFC 9457, test trước với CSDL thật |
| `sdlc-be-endpoint` | acceptEdits | Thêm / sửa một API theo hợp đồng đã chốt: kiểm tra request, handler mỏng, truy vấn có phạm vi, phân trang / lọc / sắp xếp theo danh sách cho phép, bảng lỗi, tương thích ngược, ma trận test |
| `sdlc-be-data-access` | acceptEdits | Tầng truy cập dữ liệu: thiết kế truy vấn, bẫy ORM, index có chứng minh bằng query plan, phân trang, isolation và khoá, upsert, xử lý theo lô, cỡ connection pool, cache có xét quyền, read replica |
| `sdlc-be-async-jobs` | acceptEdits | Job, hàng đợi, sự kiện: giao ít nhất một lần, outbox, consumer idempotent, retry hay dead-letter, thứ tự, timeout, tắt êm, job định kỳ chỉ chạy một lần trên nhiều máy |
| `sdlc-be-security` | plan | Review bảo mật backend (chỉ đọc) theo 13 nhóm, có thang mức độ và mẫu báo cáo |
| `sdlc-be-performance` | acceptEdits | Tối ưu hiệu năng dựa trên số đo: mục tiêu, baseline tái hiện được, nguyên nhân → cách sửa, bằng chứng trước / sau, chặn hồi quy, kế hoạch load test an toàn |
| `sdlc-be-observability` | acceptEdits | Đảm bảo service vận hành được trước khi phát hành: log sự kiện, metric RED/USE, tracing, health check, SLO, cảnh báo, dashboard, runbook |

## FE – Frontend
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-prototype` | acceptEdits | Prototype bấm được, ghi rõ mức độ chi tiết, để các bên duyệt; kiểm tra lại độ khớp sau khi code |
| `sdlc-fe-implement` | acceptEdits | Frontend web: tầng component, state, gọi API đủ mọi trạng thái, design token, accessibility, i18n, ngân sách hiệu năng, test |

## Mobile
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-mobile-implement` | acceptEdits | Kiến trúc mobile phân tầng, điều hướng và deep link, offline / đồng bộ, quyền, lưu trữ an toàn, flavor, theo dõi lỗi |
| `sdlc-mobile-release` | acceptEdits | Phát hành app: phiên bản, ký app, nộp lên store, phát hành theo giai đoạn, dừng phát hành / hot-fix; bước nào cũng phải duyệt |

## QA – Kiểm thử
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-qa-domain-checklists` | plan | Checklist rủi ro theo lĩnh vực: thanh toán, ngân hàng số, CRM, chatbot AI, thương mại điện tử… |
| `sdlc-qa-requirement-analysis` | plan | Phân tích yêu cầu dưới góc QA: khả năng kiểm thử, chỗ thiếu, mâu thuẫn, mức rủi ro, câu hỏi gửi BA |
| `sdlc-qa-test-plan` | plan | Kế hoạch test dựa trên rủi ro: phạm vi, cấp độ, tiêu chí vào / ra, môi trường, dữ liệu, lịch, rủi ro |
| `sdlc-qa-test-design` | acceptEdits | Thiết kế test case (EP / BVA / bảng quyết định / chuyển trạng thái…), dữ liệu test, ma trận truy vết, xuất CSV |
| `sdlc-qa-testcase-review` | plan | Review bộ test case: độ đúng, độ phủ, khớp nghiệp vụ, kết luận duyệt / duyệt kèm góp ý / không duyệt |
| `sdlc-qa-automation` | acceptEdits | Chọn case nên tự động, thiết kế page object, sinh script, giảm test chập chờn, chạy và phân loại lỗi |
| `sdlc-test` | acceptEdits | Vòng TDD và thiết kế test có hệ thống; test ổn định, không gọi ra ngoài thật |
| `sdlc-quality-gate` | acceptEdits | Cổng 10 bước trước khi merge (bước chặn / bước cảnh báo), kèm báo cáo |
| `sdlc-qa-defect` | plan | Tái hiện lỗi, viết báo cáo lỗi, đặt severity / priority theo quy tắc, phân tích danh sách lỗi |
| `sdlc-qa-ui-ux` | acceptEdits | Kiểm thử UI/UX và accessibility (WCAG 2.2 AA), responsive, mọi trạng thái giao diện, có ảnh chụp làm bằng chứng |
| `sdlc-qa-test-report` | acceptEdits | Báo cáo tổng kết test: tỉ lệ chạy / đạt, độ phủ, tiêu chí ra, khuyến nghị go / no-go |

## DevOps – Phát hành và vận hành
| Skill | Chế độ | Dùng để |
|---|---|---|
| `sdlc-release` | acceptEdits | Commit theo quy ước, mô tả MR, semver, changelog, phát hành theo phạm vi, chiến lược rollback |
| `sdlc-deploy` | acceptEdits | Kiểm tra trước triển khai, triển khai khi đã duyệt, kiểm chứng sau triển khai, rollback / roll-forward |
| `sdlc-incident` | plan | Xử lý sự cố production: phân loại, chẩn đoán chỉ đọc, xử lý tạm khi đã duyệt, sửa dữ liệu an toàn, postmortem |

## Các vai trò bàn giao cho nhau thế nào
- **Chuỗi BA:** discovery → requirements → functional-spec → process-flow / ui-spec → srs.
- **BA → SA:** đặc tả chức năng hoặc SRS đã duyệt đưa sang `sdlc-sa-solution-design`. Skill này dùng `sdlc-sa-nfr-review` và `sdlc-sa-integration`, rồi bàn giao cho `sdlc-design`, `sdlc-api-design`, `sdlc-db-migration` và `sdlc-breakdown`.
- **Dev / BE / FE / Mobile:** `sdlc-implement` (mọi stack) / `sdlc-be-implement` (+ endpoint, data-access, async-jobs) / `sdlc-fe-implement` / `sdlc-mobile-implement` (+ `sdlc-debug`), luôn theo `sdlc-standards`. Backend được kiểm bằng `sdlc-be-security`, `sdlc-be-performance` và chuẩn bị vận hành bằng `sdlc-be-observability`.
- **Chuỗi QA:** requirement-analysis → test-plan → test-design → testcase-review → automation → defect → test-report. Đi kèm `sdlc-qa-ui-ux` và `sdlc-qa-domain-checklists`. Kết quả đưa vào `sdlc-quality-gate`.
- **PM** chạy song song suốt vòng đời:
  - `sdlc-pm-change-control` đi cùng các yêu cầu thay đổi của BA.
  - `sdlc-pm-quality` đi cùng `sdlc-quality-gate`, `sdlc-release` / `sdlc-mobile-release` và `sdlc-deploy`.

## Các nguyên tắc chung của mọi skill
- Quy ước riêng của project (CLAUDE.md, AGENTS.md, skill của project) luôn được ưu tiên hơn bộ chung này.
- Không push, merge, triển khai, gửi tin nhắn hay cập nhật tracker khi chưa được duyệt.
- Ghi rõ đâu là giả định, giữ mã truy vết (yêu cầu → thiết kế → test).
- Không ghi bí mật hay dữ liệu cá nhân vào log; test không gọi ra hệ thống ngoài thật.
