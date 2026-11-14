# NovaSight · CaneSync System Studio

Trang 3D bổ sung cho mô phỏng hiện có, được xây dựng từ hai tài liệu người dùng cung cấp:

- `CaneSync_Dac_ta_cong_nghe_loi.pdf`, v1.0, 13/11/2026, đặc biệt §5–10.
- `NovaSight_v3.0_CaneSync_System_Diagram.pptx`, 14/11/2026, slide 6–25.

Toàn bộ phần System Studio nằm trong thư mục riêng `NovaSight System Studio` ở gốc dự án. `qa-initial` và `qa-v2` giữ dữ liệu kiểm thử; `source-repository` giữ checkout Git đã dùng triển khai; hai gói `.tar.gz` là các bản triển khai đã có.

## Mở trang

Mở trực tiếp `dist/NovaSight-System-Studio.html` bằng Chrome hoặc Edge. Three.js, font, CAD và mã ứng dụng đều được nhúng; bản này không cần mạng hoặc máy chủ. Trang `output/3d/NovaSight-3D.html` của dự án cũng có liên kết **System Studio**.

Bản dùng cho hosting nằm ở `dist/index.html`, cùng các tài nguyên trong `dist/`. Không di chuyển riêng `index.html` mà bỏ các tài nguyên đi kèm.

Bản nâng cấp bổ sung phòng thí nghiệm cảm biến, tua lại dữ liệu, dự đoán 3 giây, dựng cảnh, phát lại log và báo cáo so sánh. Xem [hướng dẫn nâng cấp](ENGINE-LAB.md).

## Cách dùng

- **Luồng chạy:** trình diễn 72 giây qua 8 chương; camera đi từ toàn cảnh đến Chest, vùng ToF, Clip, BLE, bộ quyết định và motor vai. Thanh thời gian chọn phần thuyết minh, không tua lịch sử cảm biến.
- **Thử tình huống:** 11 kịch bản, đổi tốc độ, khoảng cách, chiều dài/độ cao tay, cung/nhịp quét; gây lỗi BLE, IMU, đổi hướng, mất độ sâu hoặc ngắt điện thoại. Dữ liệu phân tích giữ khoảng cách cố định cho đến khi bấm **Chạy tiếp cận**.
- **Chạy tiếp cận:** thu lịch sử quét 3 giây, sau đó tiến về vật theo vận tốc đã chọn. Dừng tại tiếp xúc hình học hoặc lớp C. Ca A → C cố ý bỏ sự kiện tiếp xúc để minh họa việc hoãn rung phải được đánh giá lại.
- **Phần cứng:** chọn khối để zoom cận cảnh, đọc đầu vào/đầu ra và đối chiếu tài liệu. Kéo để xoay, cuộn để zoom, bấm thiết bị 3D để mở thuyết minh. **Tách lớp** tách vỏ và các thành phần minh họa.
- **Sơ đồ dữ liệu:** mở trong bảng Luồng chạy để xem ảnh chụp Hazard/CaneState, các phép tính, đường phản hồi và ngân sách thời gian.
- **Xuất log:** tải JSON gồm cấu hình, bản ghi trạng thái, chuỗi quyết định và sự kiện. Space chạy/dừng, R đặt lại, 1–8 chọn chương.

## Phạm vi và khác biệt nguồn

Theo mốc phần cứng P1 của slide v3.0: camera OV5640, curb 4×4 ở 20 Hz hoặc 8×8 ở 15 Hz. PDF ghi OV3660 và đề xuất 4×4 ở 30 Hz; trang ghi rõ cả hai thay vì trộn thông số. IMU 9 trục là đề xuất nghiên cứu, không được trình bày như nâng cấp P1 đã hoàn thành.

Vỏ lấy từ CAD nhúng trong trang 3D hiện có. Các linh kiện/dây tín hiệu và vùng cảm biến bổ sung chỉ minh họa chức năng, không phải vị trí lắp ráp PCB chính xác. Hazard được suy từ các tia ToF và echo siêu âm mô phỏng trên hình học 3D, có che khuất, nhiễu đo, ô lỗi, trôi yaw và mất/trễ gói BLE. Góc mở ToF vuông 45° là giả định; chưa hiệu chuẩn quang học/âm học, chưa nhận dạng camera, lọc IMU thô, phân loại kỹ thuật dùng gậy hay TinyML. Hai thiết bị dùng chung đồng hồ mô phỏng.

P gậy là điểm mô hình chưa hiệu chuẩn. Nhánh D phản hồi theo khung đo sau khi bật lỗi mất độ sâu trong demo, khác cơ chế chờ nắng kéo dài ở PDF §6.4. Độ trễ ≤ 200 ms là mục tiêu nghiên cứu, chưa có phép đo để xác nhận. NovaApp và SOS chỉ được giải thích; trang không kết nối thiết bị hoặc gửi SMS.

## Phát triển và kiểm tra

```powershell
npm ci
npm run build
npm test
```

`src/policy.mjs` là bản sao nguyên trạng của `output/3d/canesync-core.mjs` tại lúc tạo trang. Không sửa chính sách mô phỏng cũ. `engine.mjs` điều phối đồng hồ, cảm biến, quyết định và log; `sensors.mjs` tính giao tia; `recording.mjs` nhập và phát lại phép đo; `workbench.mjs` cung cấp phòng thí nghiệm. `scene.mjs` dựng CAD và cảnh Three.js. `app.mjs` điều khiển trải nghiệm; `build.mjs` tạo cả bản hosting và HTML độc lập.

Kiểm tra trình duyệt: cài/cung cấp Playwright trong `NODE_PATH`, Chrome, và phục vụ thư mục dự án ở `http://127.0.0.1:8765`, sau đó chạy `node tests/browser.cjs` trong thư mục này. Kiểm tra gồm WebGL, nhánh A/B/C/D, BLE quá hạn và phục hồi, chuyển chương, xuất log, màn hình 390 px, và bản HTML độc lập khi chặn mọi yêu cầu mạng. Ảnh QA nằm ngoài nguồn website, trong thư mục `qa-v2` của NovaSight System Studio.

Font Be Vietnam Pro dùng giấy phép SIL OFL (`src/OFL.txt`). Mã Three.js được đóng gói từ bản 0.160.0.
