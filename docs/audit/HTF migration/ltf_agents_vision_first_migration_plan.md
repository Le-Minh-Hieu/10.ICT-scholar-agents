# Kế Hoạch Di Trú Vision-First Cho LTF Price Agents (Audit & Hướng Dẫn)

Tài liệu này trình bày kết quả audit hệ thống LTF (Low Time Frame) Agents và hướng dẫn cách di trú các agent này sang kiến trúc **Vision-First** mà không làm ảnh hưởng hoặc thay đổi logic nghiệp vụ cốt lõi của mỗi agent.

---

## 1. Kết Quả Audit Hiện Trạng LTF Agents

Hệ thống LTF Agents gồm 4 tác nhân chính:

| Agent | Cơ chế Hoạt động | Trạng thái Vision-First | Khả năng Di trú |
| :--- | :--- | :--- | :--- |
| **LTF Structure Agent** (`ltf-structure-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **LTF Liquidity Agent** (`ltf-liquidity-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **LTF PD Array Agent** (`ltf-pd-array-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |
| **LTF Trigger Agent** (`ltf-trigger-agent.ts`) | LLM + RAG (`runBaseAgent`) | Chưa kích hoạt | **Sẵn sàng di trú** |

### Khảo sát Kiến trúc Kỹ thuật (`runBaseAgent`)
Nhờ vào việc chuẩn hóa base agent qua `core/3.query/agents/shared/base-agent.ts`, luồng xử lý **Vision-First** (gồm 3-lane query merge và bổ sung LIVE MARKET OBSERVATIONS làm ngữ cảnh sơ cấp) đã được tích hợp trực tiếp bên trong `runBaseAgent`.

Do đó, việc di trú các agent LTF sang Vision-First không yêu cầu thay đổi cấu trúc mã nguồn hay viết lại thuật toán RAG/Logic. Chúng ta chỉ cần cung cấp thêm cấu hình `visionPrompt` phù hợp với nghiệp vụ chuyên biệt của từng agent.

---

## 2. Giải Phản Di Trú Chi Tiết Cho Từng Agent

Dưới đây là các cấu hình `visionPrompt` được đề xuất và tích hợp vào tệp cấu hình của các Agent mà không thay đổi bất kỳ logic ràng buộc, Zod schema hay mapper nào:

### 1. LTF Structure Agent (`ltf-structure-agent.ts`)
Tập trung vào cấu trúc thị trường khách quan trên khung thời gian thấp (M15, M5, M1).

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT market structure observations on the Low Time Frame (LTF - M15, M5, M1).

Focus on identifying low-timeframe structural shifts, displacement, and micro-level blocks:
1. **Market Structure Shifts (MSS / BOS)**: Look for clean breaks of micro swing highs/lows on M15, M5, or M1 confirming local displacement and trend shifts. (STRUCTURE)
2. **Change in State of Delivery (CISD)**: Identify changes in state of delivery where price fails to respect previous zones (e.g. failure to respect a bearish FVG, turning it into a support zone). (STRUCTURE)
3. **Displacement & Strong Moves**: Look for strong, energetic moves (long-bodied candles) indicating institutional participation and potential shifts. (STRUCTURE)
4. **Structural Blocks & Gaps**: Identify local Breaker Blocks (BB), Mitigation Blocks (MB), or Fair Value Gaps (FVG) forming on M15, M5, or M1. (STRUCTURE)

Output your observations as objective bullet points. Do NOT infer directional bias or make trading recommendations.`
```

### 2. LTF Liquidity Agent (`ltf-liquidity-agent.ts`)
Tập trung vào việc trả lời câu hỏi **"WHERE IS LIQUIDITY"** (Thanh khoản đang nằm ở đâu?) ở cấp độ vi mô (sweeps, inducements).

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT liquidity observations on the Low Time Frame (LTF - M15, M5, M1).

Focus strictly on identifying resting micro-liquidity pools, sweeps, and inducements (Answer the question: WHERE IS LIQUIDITY?):
1. **Micro Buy-side Liquidity (BSL) Pools**: Locate resting liquidity above local swing highs, equal highs (EQH), or session highs on M15, M5, or M1. (LIQUIDITY)
2. **Micro Sell-side Liquidity (SSL) Pools**: Locate resting liquidity below local swing lows, equal lows (EQL), or session lows on M15, M5, or M1. (LIQUIDITY)
3. **Liquidity Sweeps & Stop Hunts**: Check if recent price action has swept BSL or SSL pools on M15, M5, or M1 charts before reversing or pulling back. (LIQUIDITY)
4. **Inducements**: Identify minor swing highs/lows acting as local inducement (trapping early buyers/sellers) before major liquidity pools are reached. (LIQUIDITY)
5. **Liquidity Voids & Delivery Gaps**: Identify unfilled price spaces or delivery gaps on low timeframes acting as magnets for price. (LIQUIDITY)

Output your observations as objective bullet points. Focus purely on liquidity location and action. Do NOT try to identify or prioritize specific FVG structures.`
```

### 3. LTF PD Array Agent (`ltf-pd-array-agent.ts`)
Tập trung chủ yếu vào dealing range vi mô và Premium/Discount status của Low Time Frame.

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT Premium/Discount (PD) Array observations on the Low Time Frame (LTF - M15, M5, M1).

Focus on mapping the active low-timeframe dealing range and identifying the PD array hierarchy (Answer the question: Where is price in the dealing range?):
Primary Focus:
1. **LTF Dealing Range Boundaries**: Identify the recent valid M15 or M5 swing high and swing low defining the current active low-timeframe dealing range. (PD_ARRAY)
2. **Equilibrium Level**: Pinpoint the midpoint (50% level) of this active dealing range. (PD_ARRAY)
3. **Current Price Position**: Determine whether the current price is trading in a Premium zone (above 50% equilibrium) or Discount zone (below 50% equilibrium) within the active range. (PD_ARRAY)
4. **PD Array Hierarchy**: Map where the price is trading relative to key low-timeframe PD Arrays (e.g. trading at equilibrium, deep premium, deep discount, or reacting to a specific M15/M5 PD Array). (PD_ARRAY)

Secondary Focus:
5. **Premium / Discount PD Arrays**: Note supporting M15/M5/M1 Order Blocks (OB), Fair Value Gaps (FVG), or Volume Imbalances (VI) only to confirm price location and interaction within the dealing range. (PD_ARRAY)

Output your observations as objective bullet points detailing the Premium/Discount status and dealing range location.`
```

### 4. LTF Trigger Agent (`ltf-trigger-agent.ts`)
Tập trung vào tổng hợp (synthesis), mức độ hội tụ (confluence) của tín hiệu và xác thực điểm vào lệnh mà không trùng lặp phân tích thô.

```typescript
visionPrompt: `Analyze ALL attached chart images for LIVE ICT execution trigger and entry readiness on the low timeframes (M15, M5, M1).

Focus strictly on evaluating the execution readiness and confluence of the trade entry, synthesizing the current market state rather than rediscovering raw building blocks:
1. **Multi-Timeframe Alignment**: Evaluate if the low-timeframe evidence aligns with intermediate (ITF) narrative and high timeframe (HTF) bias. (TRIGGER)
2. **Liquidity Objective & Sweeps**: Observe if key micro liquidity pools (sweeps/inducements) have been hit, confirming the stop hunt has occurred. (TRIGGER)
3. **Low-Timeframe Structural Confirmation**: Confirm if a market structure shift (MSS) or change in state of delivery (CISD) has occurred as a consequence of the sweep. (TRIGGER)
4. **Favorable Range Location**: Verify if the entry trigger is occurring in a highly favorable Premium/Discount zone (deep discount for buy, deep premium for sell) relative to the active dealing range. (TRIGGER)
5. **Execution Pattern Validation**: Verify if there is a valid execution pattern (e.g. displacement, reaction off FVG/OB/Breaker) confirming the entry trigger. (TRIGGER)

Output your observations as objective synthesis points assessing execution readiness and confluence. Do NOT make trade recommendations.`
```

---

## 3. Quy Trình Xác Minh (Verification Plan)

Chạy các tệp test của LTF agents:
* `npx tsx test/test-ltf-structure-agent.ts`
* `npx tsx test/test-ltf-liquidity-agent.ts`
* `npx tsx test/test-ltf-trigger-agent.ts`
