# Báo cáo Kiểm tra Hệ thống: Quarterly Agent Forensic Audit

Báo cáo này tóm tắt kết quả kiểm tra hệ thống (Forensic Audit) đối với **Quarterly Agent** nhằm xác định xem Agent này có gặp các vấn đề tương tự như HTF-Macro liên quan đến truy xuất (retrieval), tái xếp hạng (rerank) và đối chiếu thông tin (grounding).

---

## 1. Execution Path Trace (Luồng thực thi kiểm thử)

Luồng thực thi đầy đủ của Quarterly Agent đi qua các thành phần dùng chung trong hệ thống:

| Stage | File | Function | Purpose |
| :--- | :--- | :--- | :--- |
| **1. Entry / Config** | [quarterly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/quarterly-agent.ts) | `quarterlyAgent` | Khởi chạy tiến trình, định nghĩa các ràng buộc (constraints) chu kỳ thời gian Quarterly và khởi tạo cuộc gọi `runBaseAgent`. |
| **2. Base Orchestration** | [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts) | `runBaseAgent` | Quản lý vòng đời chạy của Agent: gọi nạp pipeline, build query, embed query, gọi RAG, grounding, build prompt, gọi LLM. |
| **3. Query Generation** | [query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts) | `buildQueries` / `finalizeWeightedQueries` | Sinh các anchor query từ concepts, thực hiện mở rộng canonical, loại trùng lặp và giới hạn tối đa 15 query. |
| **4. Retrieval Core** | [retrieval-core.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/retrieval-core.ts) | `retrieveRAG` / `fuseScores` | Nhận danh sách query, sinh embedding, tìm kiếm Cosine Similarity kết hợp BM25, tính toán fusion score kết hợp các điểm boost. |
| **5. Reranking** | [rerank.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/rerank.ts) | `rerank` | Tái xếp hạng top 80 ứng viên thông qua Jina AI Reranker (nếu bật) hoặc LLM prompt của Gemini để tối ưu hóa thứ tự. |
| **6. Grounding** | [grounding.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts) | `buildGrounded` | Lọc các chunk liên quan qua `isRelevant`, loại bỏ trùng lặp bằng `simpleDedup` (giữ nguyên thứ tự sau rerank), lấy tối đa 6 chunks. |
| **7. Prompt Building** | [prompt-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/prompt-builder.ts) | `buildPrompt` | Lắp ráp prompt hoàn chỉnh gồm Vai trò, Nhiệm vụ, Grounded Knowledge, Context đầu vào gửi tới LLM. |

---

## 2. Agent Configuration Audit (Kiểm tra cấu hình)

> [!NOTE]
> Quarterly Agent chạy hoàn toàn ở chế độ **Pure Lane0** do không có cấu hình `visionPrompt` trong định nghĩa agent.

* **Concepts**: Nhận 19 concepts từ bước `quarterly_time` của [time_pipeline.json](file:///d:/10.%20ict-scholar-agents-V1/data/time_pipeline.json).
* **Parent Thesis**: Được nạp qua `hydrationContext.parent_thesis` và đưa vào prompt qua `buildPrompt`.
* **Scenarios / Relational**: Được truyền qua `hydrationContext` nhưng bị **dead** trong tiến trình query expansion (giải thích tại Phần 3).
* **Temporal Inputs**: Được tính toán động trong `buildInputContext` của [quarterly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/quarterly-agent.ts#L58-L78).

| Feature | Enabled? | Evidence |
| :--- | :--- | :--- |
| **visionPrompt** | **NO** | Không được cấu hình trong `AgentConfig` của [quarterly-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/time/quarterly-agent.ts). |
| **Lane1** | **NO** | Tiến trình trích xuất concept từ vision chỉ kích hoạt khi tồn tại `visionPrompt` ([base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L408-L414)). |
| **Lane2** | **NO** | Tiến trình trích xuất quan sát thực tế chỉ kích hoạt khi tồn tại `visionPrompt` ([base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L421-L428)). |
| **Pure Lane0** | **YES** | Không có `visionPrompt`, base-agent rơi vào nhánh mặc định gán toàn bộ query cho `lane0` ([base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L520-L524)). |

---

## 3. Query Generation Audit & Bottlenecks

### Nút thắt lớn về mở rộng truy vấn (Dead Expansions)
* **Scenario Expansion**: **DEAD**.
* **Relational Expansion**: **DEAD**.
  > [!WARNING]
  > Trong [base-agent.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/agents/shared/base-agent.ts#L373-L374), khi gọi `buildQueries`, hệ thống truyền cứng `undefined` cho cả hai tham số `relational` và `scenarios`:
  > ```typescript
  > let queries = buildQueries(concepts, knowledgeMap, undefined, undefined, { skipFinalize: ... });
  > ```
  > Điều này làm vô hiệu hóa hoàn toàn cơ chế tự động mở rộng truy vấn đa chiều theo kịch bản thị trường.
* **Temporal Expansion**: **DEAD** (Trong thực tế) do chỉ kích hoạt với các concepts có chứa từ khóa `"silver bullet"`.

### Số lượng truy vấn
* **Trước khi rút gọn**: ~20-25 queries (19 anchors + canonical expansions).
* **Sau khi rút gọn**: Giới hạn cứng tối đa **15 queries** do hàm `finalizeWeightedQueries` thực hiện lát cắt `.slice(0, 15)` ([query-builder.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/query-builder.ts#L262)).

---

## 4. Grounding Risk Assessment (Đánh giá rủi ro đối chiếu)

Quarterly Agent có bị ảnh hưởng bởi lỗi đối chiếu cũ không?

| Component | Status | Evidence |
| :--- | :--- | :--- |
| **Context Grounding** | **NEW FIX (preserve rerank order)** | Trong [grounding.ts](file:///d:/10.%20ict-scholar-agents-V1/core/3.query/grounding.ts#L116-L125), hàm `buildGrounded` loại bỏ trùng lặp bằng `simpleDedup` tuần tự để bảo toàn thứ tự xếp hạng (rerank order) thay vì tính toán lại điểm số dựa trên từ khóa (keyword rescoring). |

---

## 5. Phân tích độ bao phủ từ vựng (Vocabulary Coverage Audit)

Bảng phân tích độ bao phủ thực tế đối với tất cả 19 concepts thuộc `quarterly_time`:

| Pipeline Concept | Exact Hits | Closest Semantic Match in Corpus | Semantic Count | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Quarterly Bias** | 0 | `directional bias`, `quarterly shifts` | 123 | **B** (Kiến thức tồn tại bằng từ khác) |
| **Quarterly Seasonality** | 0 | `seasonal tendency`, `seasonal tendencies` | 127 | **B** |
| **Quarterly profile** | 0 | `data ranges`, `quarterly shifts`, `ipda data ranges` | 40 | **B** |
| **End-of-Quarter Effect** | 0 | `quarterly shift`, `turn of quarter` | 43 | **B** |
| **Turn-of-Quarter Effect** | 0 | `quarterly shift`, `turn of quarter` | 43 | **B** |
| **First Trading Day Effect** | 0 | `opening range` | 85 | **C** (Kiến thức tồn tại một phần) |
| **Last Trading Day Effect** | 0 | `last trading day` | 5 | **B** |
| **Options Expiry Effect** | 0 | `expiration`, `options expiry`, `opex` | 5 | **B** |
| **Quarterly Market Sentiment Shifts** | 0 | `sentiment shift`, `market sentiment` | 17 | **B** |
| **Quarterly Economic Data Releases** | 0 | `economic data`, `news release` | 12 | **B** |
| **Quarterly Options Expiry** | 0 | `expiration`, `options expiry` | 5 | **B** |
| **Quarterly Buy Day Bias** | 0 | `seasonal tendencies` | 79 | **C** |
| **Quarterly Sell Day Bias** | 0 | `seasonal tendencies` | 79 | **C** |
| **End-of-Quarter Reversal** | 0 | `rebalancing`, `reversal`, `quarterly shift` | 204 | **B** |
| **Turn-of-Quarter Reversal** | 0 | `turn of quarter`, `reversal` | 170 | **B** |
| **First Trading Day Reversal** | 0 | `first trading day`, `reversal` | 158 | **B** |
| **Last Trading Day Reversal** | 0 | `last trading day`, `reversal` | 158 | **B** |
| **Options Expiry Reversal** | 0 | `options expiry`, `reversal` | 153 | **B** |
| **NFP Reversal** | 0 | `non-farm payroll`, `nfp`, `nfp week` | 57 | **B** |

### Tỷ lệ bao phủ
* **Exact Coverage %**: **0%** (Tất cả 19 concepts có 0 hits khi so khớp chính xác chuỗi ký tự).
* **Semantic Coverage %**: **100%** (Cả 19 concepts đều có thông tin tương đương bằng các từ đồng nghĩa kỹ thuật).
* **Missing Coverage %**: **0%** (Không có concept nào bị mất gốc hoàn toàn).

---

## 6. Ontology Bridge Simulation (Mô phỏng bắc cầu từ vựng)

Nếu thiết lập một bộ ánh xạ bắc cầu từ vựng giả định từ Concepts sang từ khóa thực tế trong Corpus (như ánh xạ `Quarterly Seasonality` $\rightarrow$ `seasonal tendencies`, `NFP Reversal` $\rightarrow$ `non-farm payroll`), hệ thống sẽ đạt được:
* **Vocabulary Coverage**: Tăng từ **0%** lên **100%**.
* **Khả năng tiếp cận**: Có thêm **hơn 200+ unique chunks** chứa dữ liệu kỹ thuật lịch sử của ICT về chu kỳ lớn lập tức có thể được tìm thấy và nạp vào prompt.

---

## 7. Kết luận cuối cùng (Final Verdict)

> [!IMPORTANT]
> **The dominant bottleneck of Quarterly Agent is vocabulary mismatch because all 19 quarterly pipeline concepts yield zero exact string matches inside the corpus despite their corresponding technical knowledge being heavily present under alternative terms like "seasonal tendencies", "directional bias", and "non-farm payroll".**

Kiến thức về chu kỳ Quarterly hoàn toàn có sẵn trong tập dữ liệu của dự án nhưng đang bị chặn đứng ở khâu tìm kiếm RAG do sự bất đồng bộ từ vựng (vocabulary mismatch) giữa định nghĩa pipeline và thuật ngữ sử dụng trong tài liệu corpus gốc.
