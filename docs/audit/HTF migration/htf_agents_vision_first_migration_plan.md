# Kế Hoạch Di Trú Vision-First Cho HTF Price Agents (Audit & Hướng Dẫn)

Tài liệu này trình bày kết quả audit hệ thống HTF (High Time Frame) Price Agents và hướng dẫn cách di trú các agent này sang kiến trúc **Vision-First** mà không làm ảnh hưởng hoặc thay đổi logic nghiệp vụ cốt lõi của mỗi agent.

---

## 1. Kết Quả Audit Hiện Trạng HTF Agents

Hệ thống HTF Agents hiện tại gồm 5 tác nhân chính:

| Agent | Cơ chế Hoạt động | Trạng thái Vision-First | Khả năng Di trú |
| :--- | :--- | :--- | :--- |
| **HTF Macro Agent** (`htf-macro-agent.ts`) | LLM + RAG (`runBaseAgent`) | **Đã kích hoạt** | Đã hoàn thành |
| **HTF Structure Agent** (`htf-structure-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **HTF Liquidity Agent** (`htf-liquidity-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **HTF PD Array Agent** (`htf-pd-array-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **HTF Bias Agent** (`htf-bias-agent.ts`) | Thuần mã nguồn (Deterministic) | **Không áp dụng** | Không di trú (Giữ nguyên logic quy tắc cứng) |

### Khảo sát Kiến trúc Kỹ thuật (`runBaseAgent`)
Nhờ vào việc chuẩn hóa base agent qua `core/3.query/agents/shared/base-agent.ts` trong đợt nâng cấp Time Agents, luồng xử lý **Vision-First** (gồm 3-lane query merge và bổ sung LIVE MARKET OBSERVATIONS làm ngữ cảnh sơ cấp) đã được tích hợp trực tiếp bên trong `runBaseAgent`.

Do đó, việc di trú các agent còn lại sang Vision-First **không yêu cầu thay đổi cấu trúc mã nguồn hay viết lại thuật toán RAG/Logic**. Chúng ta chỉ cần cung cấp thêm cấu hình `visionPrompt` phù hợp với nghiệp vụ chuyên biệt của từng Price Agent.

---

## 2. Giải Pháp Di Trú Chi Tiết Cho Từng Agent

Dưới đây là các cấu hình `visionPrompt` được đề xuất để tích hợp vào tệp cấu hình của các Agent mà không thay đổi bất kỳ logic ràng buộc, Zod schema hay mapper nào:

### 1. HTF Structure Agent (`htf-structure-agent.ts`)
Tập trung vào cấu trúc thị trường khách quan và tín hiệu phân kỳ SMT.

```typescript
// Thêm vào cấu hình truyền vào runBaseAgent trong htfStructureAgent:
visionPrompt: `Analyze ALL attached chart images for LIVE ICT market structure observations.

Focus on identifying structural shifts, block formations, and intermarket divergence:
1. **SMT Divergence Detection**: Compare EURUSD and GBPUSD swing highs/lows. Identify if there is a bullish SMT (EURUSD Lower Low vs GBPUSD Higher Low) or bearish SMT (EURUSD Higher High vs GBPUSD Lower High) at key turning points. (STRUCTURE)
2. **Market Structure Shifts (MSS / BOS)**: Look for clean breaks of swing highs/lows confirming displacement and trend shifts. (STRUCTURE)
3. **Structural Blocks**: Identify prominent Breaker Blocks (BB), Mitigation Blocks (MB), or high-confidence Order Blocks (OB) on Monthly, Weekly, or Daily charts. (STRUCTURE)
4. **Swing Highs & Lows**: Note key structural swing points currently acting as major support/resistance levels. (PRICE)

Output your observations as objective bullet points. Do NOT infer directional bias or make trading recommendations.`,
```

### 2. HTF Liquidity Agent (`htf-liquidity-agent.ts`)
Tập trung vào việc trả lời câu hỏi **"WHERE IS LIQUIDITY"** (Thanh khoản đang nằm ở đâu?) thay vì xác định "FVG nào đang tồn tại". Tránh dùng FVG làm primary observation để không trùng lặp với PD Array Agent.

```typescript
// Thêm vào cấu hình truyền vào runBaseAgent trong htfLiquidityAgent:
visionPrompt: `Analyze ALL attached chart images for LIVE ICT liquidity observations.

Focus strictly on identifying where resting liquidity lies and recent sweep events (Answer the question: WHERE IS LIQUIDITY?):
1. **Buy-side Liquidity (BSL) Pools**: Locate resting liquidity above major swing highs, equal highs (EQH), or old weekly/monthly highs. (LIQUIDITY)
2. **Sell-side Liquidity (SSL) Pools**: Locate resting liquidity below major swing lows, equal lows (EQL), or old weekly/monthly lows. (LIQUIDITY)
3. **Liquidity Sweeps & Stop Hunts**: Note if recent price action has swept high/low liquidity pools before reversing or pulling back. (LIQUIDITY)
4. **Liquidity Voids, Imbalance Zones, & Delivery Gaps**: Identify major unfilled spaces or delivery gaps acting as magnets for future price movement without classifying them as specific FVG structures. (LIQUIDITY)

Output your observations as objective bullet points. Focus purely on liquidity location and action. Do NOT try to identify or prioritize specific FVG structures.`,
```

### 3. HTF PD Array Agent (`htf-pd-array-agent.ts`)
Tập trung chủ yếu vào câu hỏi **"Price đang ở đâu trong dealing range?"** thay vì "FVG nào quan trọng nhất?". Định hình rõ cấu trúc phân cấp (Primary vs Secondary ownership) để tránh nuốt việc của Structure Agent và Liquidity Agent.

```typescript
// Thêm vào cấu hình truyền vào runBaseAgent trong htfPDArrayAgent:
visionPrompt: `Analyze ALL attached chart images for LIVE ICT Premium/Discount (PD) Array observations.

Focus on mapping the active dealing range and identifying the PD array hierarchy (Answer the question: Where is price in the dealing range?):
Primary Focus:
1. **HTF Dealing Range Boundaries**: Identify the recent valid swing high and swing low defining the current daily/weekly dealing range. (PD_ARRAY)
2. **Equilibrium Level**: Pinpoint the estimated midpoint (50% level) of the current dealing range. (PD_ARRAY)
3. **Current Price Position**: Determine whether the current price is trading in a Premium zone (above 50% equilibrium) or Discount zone (below 50% equilibrium). (PD_ARRAY)
4. **PD Array Hierarchy**: Map which structural zone the price is in (e.g. Deep Premium, Discount, Equilibrium boundary). (PD_ARRAY)

Secondary Focus (Only as supporting reference):
5. **Premium / Discount PD Arrays**: Note supporting Daily/Weekly Order Blocks (OB), Fair Value Gaps (FVG), or Volume Imbalances (VI) only to confirm price location inside the range. (PD_ARRAY)

Output your observations as objective bullet points detailing the Premium/Discount status and dealing range location.`,
```

---

## 3. Phân Tích Sự Ảnh Hưởng Đến Logic Hệ Thống

*   **Logic Ràng Buộc (Constraints & Validation):** Không thay đổi. Các ràng buộc về cấu trúc đầu ra JSON, kiểm tra tính đúng đắn của Grounding (`useGroundingVerification`) vẫn được thực thi đầy đủ.
*   **Logic Biến Đổi Đầu Ra (Mapping Logic):** Giữ nguyên hoàn toàn. Hàm `mapOutput` của từng agent vẫn trích xuất dữ liệu thô từ LLM để đưa về đúng cấu trúc hợp đồng dữ liệu cũ.
*   **Quy Trình RAG & Query Merge:** Khi kích hoạt `visionPrompt`, `runBaseAgent` sẽ tự động thực hiện:
    1. Gọi LLM Vision để lấy báo cáo quan sát trực quan từ biểu đồ.
    2. Chạy 3-Lane Query Merge để mở rộng bộ từ khóa RAG từ các quan sát trực quan đó.
    3. Trích xuất tài liệu RAG chính xác hơn nhờ bộ query đã được cập nhật bối cảnh thị trường thực tế.
    4. Trộn báo cáo vision làm bối cảnh chính (`VISION PRIMARY`) và tài liệu RAG làm bối cảnh phụ (`RAG SECONDARY`) trước khi đưa vào prompt phân tích cuối cùng.

## 4. Kế Hoạch Xác Minh (Verification Plan)

Sau khi bổ sung các cấu hình `visionPrompt` trên, chúng ta có thể kiểm tra trực tiếp qua các bộ test có sẵn:
1. Chạy test cho từng agent:
   * `npm run test-htf-structure` (chạy `test/test-htf-structure.ts`)
   * `npm run test-htf-liquidity` (chạy `test/test-htf-liquidity.ts`)
   * `npm run test-htf-pd-array` (chạy `test/test-htf-pd-array.ts`)
2. Bật cờ `RAG_DEBUG_DUMP=true` để kiểm tra thư mục `data/rag-debug/{captureId}` nhằm xác nhận các lane truy vấn `00_VISION_CONCEPTS.json`, `00_VISION_SIGNALS.json`, và `00_VISION_OBSERVATION_QUERIES.json` được tạo đầy đủ và khớp với quan sát trực quan từ chart.
