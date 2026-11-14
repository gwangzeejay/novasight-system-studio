# CaneSync System Studio — phòng thí nghiệm mô phỏng

## Bảy nâng cấp

1. **Cảm biến từ hình học:** ToF 4×4/20 Hz hoặc 8×8/15 Hz giao tia với vật và sàn, xét che khuất, nhiễu, ô lỗi và giới hạn tầm đo. Siêu âm dùng chùm tia mẫu. Hazard được gom từ phép đo và xác nhận qua nhiều khung.
2. **Bản ghi thống nhất:** thanh Bản ghi tua lại phép đo, quyết định và biên độ motor tại cùng thời điểm. Trong Phòng thí nghiệm → Truy vết, bấm sự kiện và ID cha để đi ngược từ motor/PWM đến quyết định, khung ToF và gói BLE.
3. **Dự đoán 3 giây:** hiển thị đường đầu gậy, hướng thân, các mốc 1/2/3 giây và vùng bất định. Dự đoán dùng lịch sử quét đã nhận; vùng bất định là quy tắc minh họa, chưa phải khoảng tin cậy đã hiệu chuẩn.
4. **Thử lỗi:** chỉnh nhiễu, góc lắp, trôi yaw, độ trễ/mất gói BLE và độ trễ motor ở tab Dữ liệu. Phòng thí nghiệm có chuỗi lỗi theo thời gian và bộ đánh giá 11 ca.
5. **Dựng cảnh:** kéo vật trên sơ đồ nhìn từ trên, sửa kích thước/vị trí/tốc độ, thêm tối đa 8 vật; lưu trên trình duyệt hoặc xuất/nhập JSON. Bấm áp dụng để chạy cảnh.
6. **Phát lại log:** nhập phép đo JSON để tái dựng quyết định. Không dùng quyết định có sẵn trong file làm kết quả. Có log mẫu, mô tả schema và video tham chiếu cục bộ với độ lệch thời gian chỉnh bằng tay.
7. **So sánh:** hai chính sách CaneSync/Tunnel nhận cùng đầu vào, báo cáo thời lượng A/B/C/D, số đợt cảnh báo và xuất CSV.

## Phân biệt hai thanh thời gian

Thanh 8 chương điều khiển thuyết minh cinematic. Thanh Bản ghi bên dưới tua trạng thái đã ghi, bước 50 ms và trở về trực tiếp. Bản ghi tối đa 120 giây; đồng hồ tính theo bước 10 ms. Tua lại không tạo thêm sự kiện cảm biến.

## Log cảm biến

Nhận schema `novasight-studio-v2` do trang xuất, hoặc `novasight-sensors-v1` có mảng `records`. Mỗi record có `t_ms`, `type`, `data`; thời gian phải tăng hoặc bằng nhau. Hỗ trợ IMU, BLE_RX, TOF, ULTRASOUND, MOTOR. Tải mẫu/schema trong giao diện để xem đầy đủ tên trường.

ToF dùng mét, sigma dùng mm; hướng tia là vector đơn vị, status hợp lệ là 5. IMU dùng yaw_deg hoặc yaw radian. Biên độ motor L/R trong [0,1]. Giới hạn file 32 MB, 25.000 records cảm biến, thời lượng 120 giây. Log thiết bị được gắn nhãn chưa xác minh; chưa có log phần cứng thực để kiểm chứng adapter. Video chỉ phát cục bộ, không được tải lên máy chủ.

## Giới hạn mô hình

Góc mở ToF vuông 45°, mô hình nhiễu, chùm siêu âm, vùng bất định và đáp ứng motor là giả định có thể điều chỉnh, không phải số đo sản phẩm. Hình học vật là các hộp xấp xỉ; chưa mô phỏng đầy đủ quang học/âm học, nhận dạng camera, bộ lọc IMU thô, phản xạ người dùng hoặc đồng bộ hai đồng hồ thiết bị.

Thông số P1 giữ theo slide v3.0; các khác biệt với PDF được ghi trong trang. Kết quả so sánh là trên cảnh/log đầu vào, không phải bằng chứng về hiệu quả hoặc độ an toàn ngoài thực địa.

## Kiểm tra

`npm test`: 21 ca kiểm tra logic, bao gồm giao tia/che khuất, đồng hồ độc lập FPS, BLE đang truyền/quá hạn/phục hồi, điều kiện A/C/D, quan hệ sự kiện, nhập dữ liệu sai và tua motor tại cùng timestamp. Một ca chạy toàn bộ bộ thử lỗi 11 tình huống.

`node tests/browser.cjs`: kiểm tra thao tác lưới ToF, tua lại, truy vết, kéo thả, nhập log, so sánh/xuất CSV, chuỗi lỗi, bố cục desktop/mobile và bản HTML offline khi chặn mạng. Cần Playwright, Chrome và máy chủ preview như README.
