// 行農合作社 三大產品層級方案設定
const PLANS = {
  starter: {
    id: "starter",
    name: "Starter｜接單版",
    shortName: "接單版",
    price: "NT$500 / 月",
    tagLine: "把 LINE 對話整理成服務單，看完直接打電話",
    demoUrl: "https://xingnong-starter-demo.netlify.app",
    badgeColor: "#856200",
    badgeBg: "#fef3c7",
    
    // 管理端統計 Chips
    statFilters: [
      { key: "all", label: "全部" },
      { key: "to_contact", label: "待聯絡", highlight: true },
      { key: "processing", label: "處理中" },
      { key: "closed", label: "已結案" }
    ],

    // 狀態流轉
    statusOptions: [
      { key: "to_contact", label: "待聯絡", pillClass: "to_contact", pillText: "🟡 待聯絡" },
      { key: "processing", label: "處理中", pillClass: "processing", pillText: "🔵 處理中" },
      { key: "closed", label: "已結案", pillClass: "closed", pillText: "⚪ 已結案" }
    ],

    // 底部 Navigation (最多2-3項，嚴格移除排程與農友)
    bottomTabs: [
      { key: "bookings", icon: "📋", label: "服務申請" },
      { key: "settings", icon: "⚙️", label: "設定" }
    ],

    // 功能旗標 (嚴格排除)
    features: {
      schedule: false,            // 不得出現確認排程
      dispatch: false,            // 不得出現派工
      customerHistory: false,     // 不得出現客戶歷史
      farmersDirectory: false,    // 不得出現農友名錄
      lineContactDemo: false,     // 不得出現LINE官方聯絡
      constructionRecord: false,  // 不得出現施工紀錄
      workers: false,             // 不得出現師傅
      machines: false             // 不得出現機具
    }
  },

  management: {
    id: "management",
    name: "Management｜管理版",
    shortName: "管理版",
    price: "NT$990～1,290 / 月",
    tagLine: "施工日期管理、客戶歷史紀錄與案件狀態追蹤",
    demoUrl: "https://xingnong-management-demo.netlify.app",
    badgeColor: "#1e40af",
    badgeBg: "#dbeafe",

    statFilters: [
      { key: "all", label: "全部" },
      { key: "pending", label: "待處理", highlight: true },
      { key: "confirmed", label: "已確認" },
      { key: "scheduled", label: "已排程" },
      { key: "completed", label: "已完成" }
    ],

    statusOptions: [
      { key: "pending", label: "待處理", pillClass: "pending", pillText: "🟡 待處理" },
      { key: "confirmed", label: "已確認", pillClass: "confirmed", pillText: "🟢 已確認" },
      { key: "scheduled", label: "已排程", pillClass: "scheduled", pillText: "📅 已排程" },
      { key: "completed", label: "已完成", pillClass: "completed", pillText: "✅ 已完成" }
    ],

    bottomTabs: [
      { key: "bookings", icon: "📋", label: "預約審核" },
      { key: "schedule_simple", icon: "📅", label: "施工日程" },
      { key: "farmers", icon: "🧑‍🌾", label: "農友名錄" },
      { key: "settings", icon: "⚙️", label: "設定" }
    ],

    features: {
      schedule: true,             // 確認施工日期 (希望日期 vs 確認施工日期)
      scheduleModalType: "simple",// 簡易確認日期彈窗 (無指派師傅與機具)
      scheduleOverview: true,     // 今日 / 本週 / 未來案件
      dispatch: false,            // 排除多人派工
      customerHistory: true,      // 客戶歷史紀錄 (例如過去 3 次服務)
      farmersDirectory: true,     // 農友名錄
      lineContactDemo: true,      // 官方 LINE 聯絡示意
      constructionRecord: true,   // 簡單施工紀錄
      workers: false,             // 排除師傅
      machines: false             // 排除機具
    }
  },

  dispatch: {
    id: "dispatch",
    name: "Dispatch｜派工版",
    shortName: "派工版",
    price: "NT$1,990+ / 月",
    tagLine: "多師傅、多機具排班調度與時段衝突管理",
    demoUrl: "https://xingnong-dispatch-demo.netlify.app",
    badgeColor: "#065f46",
    badgeBg: "#d1fae5",

    statFilters: [
      { key: "all", label: "全部" },
      { key: "pending", label: "待確認", highlight: true },
      { key: "confirmed", label: "已確認" },
      { key: "scheduled", label: "已排程" },
      { key: "completed", label: "已完成" }
    ],

    statusOptions: [
      { key: "pending", label: "待確認", pillClass: "pending", pillText: "🟡 待確認" },
      { key: "confirmed", label: "已確認", pillClass: "confirmed", pillText: "🟢 已確認" },
      { key: "scheduled", label: "已排程", pillClass: "scheduled", pillText: "🚜 已排程" },
      { key: "completed", label: "已完成", pillClass: "completed", pillText: "✅ 已完成" }
    ],

    bottomTabs: [
      { key: "bookings", icon: "📋", label: "預約審核" },
      { key: "dispatch_schedule", icon: "🚜", label: "派工日程" },
      { key: "resources", icon: "🛠️", label: "師傅與機具" },
      { key: "farmers", icon: "🧑‍🌾", label: "農友名錄" },
      { key: "settings", icon: "⚙️", label: "設定" }
    ],

    features: {
      schedule: true,
      scheduleModalType: "full",  // 完整排程：指定日期 + 時段 + 師傅 + 機具
      scheduleOverview: true,
      dispatch: true,             // 完整多人派工
      dispatchScheduleView: true, // 時段派工行程表 (08:00, 13:30)
      customerHistory: true,
      farmersDirectory: true,
      lineContactDemo: true,
      constructionRecord: true,
      workers: true,              // 師傅狀態 (陳師傅: 今日 2 件 / 李師傅: 今日 1 件)
      machines: true              // 機具管理 (1號機可用 / 2號機施工中 / 3號機明日)
    }
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PLANS };
}
