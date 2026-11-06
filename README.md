Báo cáo Tổng hợp Toàn bộ Cập nhật và Thay đổi Dự án VibePath

Dự án VibePath (Hệ thống tự động hóa Video Bản đồ 3D và Kịch bản AI Đa ngôn ngữ cho YouTuber Ẩm thực) đã trải qua quá trình tiến hóa toàn diện từ một ý tưởng kiến trúc sơ khai đến một hệ sinh thái mô-đun dạng Lego hoàn chỉnh. Báo cáo này tổng hợp chi tiết tất cả các nâng cấp, sửa lỗi kỹ thuật, tối ưu hóa UI/UX và cải tiến hạ tầng đã được thực thi từ giai đoạn khởi tạo đến hiện tại.

1. Tổng quan Hành trình Phát triển và Cột mốc Kiến trúc VibePath

Hệ thống VibePath được thiết kế nhằm giải quyết triệt để các rào cản thủ công của các nhà sáng tạo nội dung ẩm thực: chuyển đổi dữ liệu định vị di chuyển (GPS Telemetry) và các điểm dừng chân (Food POIs) thành thước phim bản đồ 3D 60FPS mượt mà, đi kèm kịch bản lời thoại voiceover, phụ đề song ngữ .SRT, YouTube Chapters và Captions truyền thông xã hội.

Mô hình Kiến trúc 3 Tầng Cơ bản

1. Tầng Client & Edge: Bản ứng dụng Web Demo triển khai trên Cloudflare Workers (vibepath.mizu2711.workers.dev) và mô hình định hướng ứng dụng di động Native (Flutter/React Native) tích hợp dịch vụ ghi vị trí chạy ngầm (Background Location Service).
2. Tầng Gateway & Automation Orchestrator: Đường hầm bảo mật Cloudflare Tunnel (cloudflared) dẫn truyền không mở cổng Public Inbound vào máy chủ VPS Hetzner CX23 Docker Engine (chạy container n8n_core port 5678 và python_microservice port 8000 xử lý toán học B-Spline), kết nối với Dify Cloud SaaS chạy lõi Google Vertex AI Gemini 1.5 Flash.
3. Tầng Persistence & Alerts: Cơ sở dữ liệu Supabase PostgreSQL (lưu trữ bảng user_feedbacks), kho lưu trữ đối tượng Cloudflare R2 Bucket (agent-image-storage), và Telegram Admin Bot thông báo sự cố P0/P1.

2. Cập nhật và Xử lý Điểm nghẽn tại Tầng Automation (n8n & Dify Engine)

Giai đoạn đầu của dự án gặp một số điểm nghẽn về xử lý bất đồng bộ, lỗi định dạng dữ liệu và độ trễ. Đội ngũ đã thực hiện hàng loạt nâng cấp quy trình trên n8n và Dify:

Tách biệt 2 Luồng Workflow Độc lập

* Luồng Render Video & AI Content (WF_01_RENDER_PIPELINE):
  * Endpoint: POST /webhook/vibepath/render (UUID cố định: vibe-render-wf-001).
  * Cấu trúc rẽ nhánh song song: Nhánh 1 nội suy đường đi GPS mượt 30/60 FPS bằng thuật toán B-Spline toán học trên Python Microservice; Nhánh 2 gửi danh sách quán ăn sang Dify AI Agent. Hai nhánh được hội tụ qua node Merge trước khi gửi job sang Render Server.
* Luồng Phản hồi & Báo lỗi (WF_02_FEEDBACK_PIPELINE):
  * Endpoint: POST /webhook/vibepath/feedback (UUID cố định: vibe-feedback-wf-002).
  * Cơ chế Respond: Immediately (trả về HTTP 200 OK ngay lập tức) giúp giải phóng giao diện người dùng.
  * Cấu trúc rẽ nhánh song song: Nhánh 1 đẩy ảnh chụp màn hình lên Cloudflare R2 (VibePath/screenshots/); Nhánh 2 gọi Dify AI phân loại bug (UI Error, Logic Bug, Feature Request, User Praise) và đánh giá độ nghiêm trọng (P0, P1, P2). Dữ liệu sau đó được lưu vào Supabase và phát cảnh báo Telegram Alert.

Xử lý Bẫy Dữ liệu và Ép kiểu Khắt khe (Strict Data Contracts)

* Triệt tiêu bẫy Markdown Wrapper: Thêm đoạn mã Regex sanitizer rawData.replace(/```json/gi, '').replace(/```/g, '').trim() trong các node Code n8n (Parse Dify JSON) để loại bỏ hoàn toàn các ký tự ```json do LLM tự động thêm vào, ngăn ngừa crash hàm JSON.parse.
* Đồng bộ Ép kiểu Dữ liệu:
  * Tọa độ GPS latitude và longitude bắt buộc kiểu Float (Number) để tránh làm gãy thuật toán ma trận B-Spline.
  * Đánh giá rating bắt buộc kiểu Integer (1 đến 5) để không gây lỗi invalid input syntax for integer trên cột INT2 của PostgreSQL/Supabase.
  * Ngôn ngữ language bắt buộc kiểu Enum chuỗi viết thường ("vi" hoặc "en").
  * Vai trò role bắt buộc kiểu Enum chuỗi viết thường ("vlogger", "editor", "tester").
* Cấu hình Vertex AI JSON Output: Bật cờ response_mime_type: "application/json" trong cài đặt model của Dify để đảm bảo Gemini xuất dữ liệu cấu trúc thuần.
* Tích hợp Cloudflare R2 chuẩn S3: Cấu hình Custom Endpoint https://<account_id>.r2.cloudflarestorage.com, Region auto, Bucket agent-image-storage với tiền tố Object Key VibePath/.

3. Nâng cấp Giao diện và Trải nghiệm Người dùng (Frontend UI/UX)

Trải nghiệm người dùng trên bản Web Demo (vibepath.mizu2711.workers.dev) đã được tinh chỉnh khắt khe dựa trên các báo cáo kiểm thử thực tế.

Bố cục 3 Tab Trải nghiệm Độc lập

1. Tab 1: Vlogger Simulator:
  * Cho phép chọn các chuyến đi mẫu (Foodtour Cần Thơ, Saigon Expedition).
  * Ghim nhanh các quán ăn dừng chân kèm đánh giá và hình ảnh.
  * Segmented switch chọn ngôn ngữ đầu ra (VN | EN).
  * Nút kích hoạt đồng bộ dữ liệu Sync to Cloud.
2. Tab 2: Editor Studio:
  * Trình phát Video Bản đồ 3D MP4 60FPS rendered trực quan.
  * Tải 1-Click trọn bộ tài nguyên biên tập: Phụ đề song ngữ .SRT, Marker Timeline .XML cắm thẳng vào Premiere Pro / CapCut, YouTube Chapters và TikTok Captions.
3. Tab 3: Feedback & Bug Report:
  * Form khảo sát UX tối giản (hoàn thành dưới 30 giây): Chọn vai trò, 5-Star Rating, Checkbox tính năng ấn tượng, Textarea nội dung góp ý và đính kèm ảnh lỗi.

Sửa đổi Tối ưu Trải nghiệm và Chống Lỗi Giao diện

* Ngăn chặn bấm lặp (Double-Submission Prevention): Thêm biến trạng thái isSubmitting và thuộc tính disabled={isSubmitting} đi kèm icon Spinner xoay cho nút Sync to Cloud và Gửi Phản hồi.
* Cố định Thanh Header: Thiết lập class sticky top-0 z-50 cho HeaderHUD.tsx giúp công tắc đổi ngôn ngữ VN | EN luôn nổi trên cùng khi cuộn trang.
* Xử lý Tràn chữ (Layout Overflow): Thêm class truncate và overflow-hidden cho khung hiển thị tên quán ăn quá dài trên Mobile View Frame.

4. Tái Cấu trúc Mô-đun Lego và Thiết lập Protocol Bàn giao AI (AGENT.md)

Để chuyển đổi dự án từ một sản phẩm đơn lẻ thành một bộ khung kỹ thuật tái sử dụng 80-90% cho các dự án AI Automation tương lai, VibePath đã được tái cấu trúc thành Mô hình Lego (Modular IaC).

Tách biệt 2 Kho Lưu trữ Git (Repositories)

* Repo Frontend Client (vibepath-web-client): Chứa mã nguồn React 18, Tailwind CSS, Lucide Icons và Cloudflare Worker Client (src/App.tsx, src/components/, src/i18n/, src/services/).
* Repo Backend & Automation Core (vibepath-automation-core): Chứa hạ tầng Docker, n8n workflows, Dify DSL, Python Service, Supabase Migrations, Data Contracts và CI/CD.

Tệp Protocol Điều hành System AGENT.md

Tệp AGENT.md đã được khởi tạo và lưu trực tiếp tại thư mục gốc của Repo Backend để điều hành các AI Agent (Jules, Cursor, Claude Code, Devin) với 4 Quy tắc Bất biến:

1. Quy tắc Tối cao Data Contract (Rule of Contract Supremacy): Ép kiểu Float cho GPS, Integer 1-5 cho Rating, Enum "vi"|"en" cho Language.
2. Quy tắc Cập nhật Workflow Bất biến (Rule of Deterministic Workflow Deployment): Sử dụng UUID cố định (vibe-render-wf-001 và vibe-feedback-wf-002) để cập nhật tại chỗ via REST API PUT /api/v1/workflows/{id}, giữ nguyên Webhook slug URL tĩnh (vibepath/render và vibepath/feedback).
3. Quy tắc Xử lý bẫy Markdown (Rule of Markdown Traps in LLMs): Bắt buộc dọn dẹp Regex trước khi parse JSON từ LLM.
4. Quy tắc Chống gửi trùng & Kháo giao diện (Rule of Double-Submission Prevention): Khóa nút và hiển thị Spinner loading khi thực hiện các tác vụ bất đồng bộ.

Ma trận Mô-đun Lego

* Khối Quy chuẩn (Schemas & Contracts): architecture/data-contracts.json (JSON Schema Draft-07), architecture/openapi.yaml (OpenAPI 3.1), architecture/architecture-map.md (Bản đồ Causal Lineage & Ma trận rẽ nhánh ngầm), DDL SQL Migration 20261026_init_user_feedbacks.sql.
* Khối Dựng sẵn (Templates): Hạ tầng Docker VPS (docker-compose.yml + .env), n8n Canvas Templates (.json), Dify Agent DSL (.yml), CI/CD GitHub Actions (validate-contracts.yml và deploy-automation.yml).

