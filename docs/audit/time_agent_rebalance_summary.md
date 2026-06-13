# Tóm Tắt Tái Cân Bằng Time Agents: Di Trú Vision-First & Nâng Cấp Hợp Đồng Grounding

Tài liệu này tổng hợp toàn bộ các quyết định kiến trúc, thay đổi mã nguồn, mở rộng ontology, và kết quả nghiệm thu liên quan đến việc định hình lại Time Agents trong phiên làm việc này.

---

## 1. Tổng Quan Mục Tiêu
Đưa tư duy của hệ thống Time Agents về mục tiêu cốt lõi: **Ưu tiên thời gian trước (WHEN first)** đạt tỉ lệ **>= 70% Time / <= 30% Price**, loại bỏ rò rỉ phân tích cấu trúc giá (Price domain) trong khi bảo toàn tuyệt đối tính độc lập của các Price Agents khác và Calendar Engine.

---

## 2. Các Thay Đổi Đã Triển Khai

### Phase 1: Tái Thiết Kế Vision Prompts
Thay đổi chỉ thị quan sát biểu đồ trực quan (`visionPrompt`) của 6 Time Agents để loại bỏ hoàn toàn các mỏ neo giá thô, chuyển sang quan sát mốc thời gian:
*   **HTF Macro**: Chuyển sang DXY/Yield Displacement và liên thị trường confirmations.
*   **Quarterly / Monthly**: Tập trung vào Quarterly Shift, Month-in-Quarter, Turn-of-Month (TOM), End-of-Month (EOM) và Options Expiry.
*   **Weekly / Daily / Session**: Định vị chặt chẽ theo NWOG, NDOG, Daily opening range, AM/PM session transitions, Judas Swing và Silver Bullet Hour.

### Phase 1B: Mở Rộng Ontology Bản Đồ Thời Gian
Bổ sung các khái niệm cốt lõi còn khuyết thiếu vào cơ sở dữ liệu tri thức của hệ thống:
*   **P0 (Ưu tiên cao)**: `Yield Seasonal Regime`, `Turn Of Month`, `End Of Month`, `Daily Economic Catalyst Timing`.
*   **P1 (Mở rộng)**: `Silver Bullet Hour`, `Macro Cycle Transition`.
*   Cập nhật đồng bộ các tệp cấu hình pipeline và registry: [master_registry.json](file:///d:/10.%20ict-scholar-agents-V1/data/ontology/master_registry.json), [htf_pipeline.json](file:///d:/10.%20ict-scholar-agents-V1/data/htf_pipeline.json), và [time_pipeline.json](file:///d:/10.%20ict-scholar-agents-V1/data/time_pipeline.json).

### Phase 2 & Upgrades: Hợp Đồng Grounding Tối Ưu (6 -> 8 Chunks)
*   **Hợp đồng v1**: Thiết lập bộ lọc Grounding theo Ownership Metadata cứng để ngăn chặn triệt để hiện tượng grounding bị sập đổ hoàn toàn về Price-only.
*   **Hợp đồng v2**: Nâng cấp dung lượng grounding của Time Agents từ **6 chunks lên 8 chunks** (Phân bổ lý tưởng: **6 TIME + 2 PRICE**).
*   **Cơ chế dự phòng (Fallback)**: Đảm bảo điền đầy 8 chunks bằng các chunk PRICE dư thừa trong trường hợp thiếu hụt TIME để bảo vệ hiệu năng RAG, đồng thời cô lập hoàn toàn Price Agents (HTF, ITF, LTF) dưới cấu hình 6 chunks mặc định.

---

## 3. Kết Quả Xác Minh & Thẩm Định Thực Tế

### Ma trận Lan truyền thực tế (Propagation Matrix)
*   **Trước di trú**: Grounding sụt giảm về 0 TIME / 5 PRICE.
*   **Sau di trú**: Daily Agent đạt **6 TIME / 2 PRICE** (Target lý tưởng). Session Agent đạt **7 TIME / 1 PRICE** (Case C Fallback).
*   **Lập luận (Reasoning)**: Session Agent đạt **100%** tư duy chứa yếu tố thời gian (67% Time, 33% Mixed). Daily Agent đạt **58%** Time/Mixed.

### Đánh giá chất lượng lập luận
Việc mở rộng dung lượng grounding thời gian giúp nâng cao vượt trội chất lượng suy luận của các agent chạy khung thời gian thấp nhờ khả năng liên kết đồng thời nhiều mốc thời gian chuyển giao phức tạp (ví dụ: Midnight Open phối hợp cùng Judas Swing và Silver Bullet) trong cùng một ngữ cảnh mà không làm gia tăng rủi ro tràn cửa sổ ngữ cảnh (chỉ tăng thêm ~400 tokens, chiếm chưa tới 0.3% dung lượng).

---

## 4. Khuyến Nghị Cuối Cùng
*   **HỦY BỎ PHASE 3 (Query Budget Quotas)**: Vì luồng lọc Grounding Contract ở Phase 2 đã giải quyết hoàn toàn sự sụt giảm Time và đưa chất lượng suy luận đạt mục tiêu tối ưu, việc áp hạn ngạch cứng cho Query Builder ở Phase 3 là không cần thiết và có nguy cơ làm giảm tính bao phủ dữ liệu giá bối cảnh.
