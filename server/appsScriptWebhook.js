/**
 * ============================================================================
 * GOOGLE APPS SCRIPT WEBHOOK TRIGGER: IELTS CBT SERVER CACHE SYNC
 * ============================================================================
 * Hướng dẫn cài đặt trên Google Sheets:
 * 1. Mở file Google Sheet (ở chế độ Private).
 * 2. Chọn menu Tiện ích mở rộng (Extensions) > Apps Script.
 * 3. Dán toàn bộ mã nguồn bên dưới vào file Code.gs (hoặc WebhookSync.gs).
 * 4. Điền URL Server của bạn vào biến SERVER_WEBHOOK_URL bên dưới.
 *    (Ví dụ: https://your-domain.app/api/sync-sheet)
 * 5. Thiết lập Trigger tự động:
 *    - Bấm vào biểu tượng Đồng hồ bấm giờ (Triggers) ở menu bên trái.
 *    - Bấm "+ Thêm trình kích hoạt" (+ Add Trigger).
 *    - Chọn hàm: installedOnEdit
 *    - Chọn nguồn sự kiện: Từ bảng tính (From spreadsheet)
 *    - Chọn loại sự kiện: Khi chỉnh sửa (On edit)
 *    - Bấm Lưu (Save) và cấp quyền cho Apps Script.
 * ============================================================================
 */

// ĐỊA CHỈ SERVER NHẬN WEBHOOK ĐỒNG BỘ
const SERVER_WEBHOOK_URL = "https://your-domain.app/api/sync-sheet";

// SECRET TOKEN ĐỂ BẢO VỆ ĐẦU CUỐI WEBHOOK (Trùng với x-admin-token hoặc header trên server)
const WEBHOOK_SECRET_TOKEN = "admin-secret";

/**
 * Tạo Menu tiện ích trên Google Sheets để Admin bấm đồng bộ thủ công bất cứ lúc nào
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("⚡ IELTS CBT Sync")
    .addItem("Đồng bộ toàn bộ đề thi lên Server", "manualSyncAll")
    .addItem("Đồng bộ đề thi đang chọn", "manualSyncCurrentExam")
    .addToUi();
}

/**
 * Trình kích hoạt có thể cài đặt (Installable Trigger) khi Admin chỉnh sửa Sheet
 * Tự động gửi Webhook về Server Node.js để cập nhật Server In-Memory Cache (<20ms)
 */
function installedOnEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName().toUpperCase();

    // Chỉ kích hoạt khi chỉnh sửa tab EXAMS hoặc QUESTIONS
    if (sheetName !== "EXAMS" && sheetName !== "QUESTIONS") {
      return;
    }

    // Cơ chế Debounce: Tránh bắn dồn dập nhiều request khi Admin gõ liên tục
    const cache = CacheService.getScriptCache();
    const lockKey = "WEBHOOK_SYNC_LOCK";
    if (cache.get(lockKey)) {
      // Đang có yêu cầu vừa gửi trong vòng 5 giây trước, bỏ qua để debounce
      return;
    }
    cache.put(lockKey, "1", 5); // Khóa trong 5 giây

    let examCode = "";
    const row = e.range.getRow();

    // Lấy mã đề thi từ cột A của dòng vừa sửa
    if (row >= 2) {
      examCode = String(sheet.getRange(row, 1).getValue()).trim().toUpperCase();
    }

    sendSyncWebhookToServer(examCode, "on_edit_trigger");
  } catch (err) {
    console.error("Lỗi trong installedOnEdit:", err);
  }
}

/**
 * Gửi HTTP POST request thông báo Server Node.js cập nhật lại Server Cache
 */
function sendSyncWebhookToServer(examCode, source) {
  if (!SERVER_WEBHOOK_URL || SERVER_WEBHOOK_URL.includes("your-domain.app")) {
    console.warn("Vui lòng cấu hình SERVER_WEBHOOK_URL chính xác trước khi kích hoạt.");
    return;
  }

  const payload = {
    action: "sync_cache",
    source: source || "apps_script_webhook",
    exam_code: examCode || undefined,
    spreadsheet_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
    timestamp: new Date().toISOString()
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-admin-token": WEBHOOK_SECRET_TOKEN,
      "User-Agent": "Google-Apps-Script-IELTS-Sync"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(SERVER_WEBHOOK_URL, options);
    const code = response.getResponseCode();
    console.log("Phản hồi từ Server:", code, response.getContentText());
    return { success: code === 200, response: response.getContentText() };
  } catch (netErr) {
    console.error("Lỗi mạng khi gọi webhook tới Server:", netErr);
    return { success: false, error: netErr.toString() };
  }
}

/**
 * Hàm thủ công: Đồng bộ toàn bộ đề thi lên Server
 */
function manualSyncAll() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.getActiveSpreadsheet().toast("Đang gửi yêu cầu đồng bộ toàn bộ đề thi lên Server...", "IELTS Sync", 5);
  
  const res = sendSyncWebhookToServer("", "manual_menu_all");
  if (res && res.success) {
    ui.alert("Thành công", "Đã cập nhật toàn bộ Server In-Memory Cache thành công!", ui.ButtonSet.OK);
  } else {
    ui.alert("Thông báo", "Yêu cầu đã được gửi. Kiểm tra logs hoặc cấu hình SERVER_WEBHOOK_URL nếu có sự cố.", ui.ButtonSet.OK);
  }
}

/**
 * Hàm thủ công: Đồng bộ đề thi theo dòng con trỏ đang chọn
 */
function manualSyncCurrentExam() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert("Vui lòng chọn một dòng từ dòng 2 trở xuống để lấy Exam Code.");
    return;
  }

  const examCode = String(sheet.getRange(row, 1).getValue()).trim().toUpperCase();
  if (!examCode) {
    SpreadsheetApp.getUi().alert("Không tìm thấy Exam Code ở cột A của dòng hiện tại.");
    return;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(`Đang đồng bộ đề [${examCode}] lên Server...`, "IELTS Sync", 4);
  sendSyncWebhookToServer(examCode, "manual_menu_single");
  SpreadsheetApp.getActiveSpreadsheet().toast(`Đã gửi đồng bộ [${examCode}] thành công!`, "IELTS Sync", 3);
}
