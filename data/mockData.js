// 行農合作社 共用示範資料庫 (Shared Mock Data)
const MOCK_DATA = {
  bookings: [
    {
      id: "XN-DEMO-006",
      name: "岡山王",
      phone: "0912-345-678",
      service: "果樹枝條粉碎",
      crop: "芭樂",
      area: "岡山",
      location: "高雄市岡山區果菜批發市場旁農地",
      size: "100 分",
      branches: "中量",
      hopeDate: "2026-09-29",
      flex: "前後 3 天皆可",
      note: "入口較窄，請先電話聯絡引導進場。",
      time: "剛剛送出",
      photos: ["📷 枝條堆放處", "📷 農地入口窄路"],
      
      // Starter 狀態
      starterStatus: "to_contact",
      starterStatusText: "🟡 待聯絡",

      // Management 狀態與確認資訊
      mgmtStatus: "pending",
      mgmtStatusText: "🟡 待處理",
      confirmedDate: "2026-10-07",
      mgmtNote: "已電訪，預計 10/07 施工，枝條約兩車量。",
      pastServices: [
        { date: "2026/03", service: "芭樂枝條粉碎", note: "完成，約 2.5 車" },
        { date: "2026/06", service: "果園代耕鬆土", note: "翻耕 3 分地" },
        { date: "2026/09", service: "枝條粉碎申請中", note: "本案" }
      ],

      // Dispatch 派工狀態與資源
      dispatchStatus: "scheduled",
      dispatchStatusText: "🚜 已排程",
      actualDate: "2026-10-07",
      actualTime: "08:00",
      worker: "陳師傅",
      machine: "2號粉碎機",
      dispatchNote: "林道較陡，配備四輪傳動牽引"
    },
    {
      id: "XN-DEMO-005",
      name: "Eric Lee",
      phone: "0921-222-222",
      service: "果樹枝條粉碎",
      crop: "芭樂",
      area: "大社",
      location: "大社區果菜市場周邊",
      size: "5 甲",
      branches: "中量",
      hopeDate: "2026-09-30",
      flex: "前後 3 天皆可",
      note: "現場有開闊水泥地供堆放粉碎機具。",
      time: "25 分鐘前",
      photos: ["📷 空地現場"],

      starterStatus: "processing",
      starterStatusText: "🔵 處理中",

      mgmtStatus: "confirmed",
      mgmtStatusText: "🟢 已確認",
      confirmedDate: "2026-10-02",
      mgmtNote: "已聯絡確認施工範圍，等候農友完成修剪。",
      pastServices: [
        { date: "2025/11", service: "果樹枝條粉碎", note: "大社 4 甲" }
      ],

      dispatchStatus: "confirmed",
      dispatchStatusText: "🟢 已確認 (待排程)",
      actualDate: "",
      actualTime: "",
      worker: "",
      machine: "",
      dispatchNote: ""
    },
    {
      id: "XN-DEMO-004",
      name: "林先生",
      phone: "0933-987-654",
      service: "竹子粉碎",
      crop: "竹子",
      area: "燕巢",
      location: "燕巢區金山里雞冠山腳下",
      size: "2 甲",
      branches: "大量",
      hopeDate: "2026-10-07",
      flex: "僅此日期方便",
      note: "老竹較硬，需大馬力粉碎刀盤。",
      time: "1 小時前",
      photos: ["📷 竹林現場堆放"],

      starterStatus: "to_contact",
      starterStatusText: "🟡 待聯絡",

      mgmtStatus: "scheduled",
      mgmtStatusText: "📅 已排程",
      confirmedDate: "2026-10-07",
      mgmtNote: "確認 10/07 下午進場。",
      pastServices: [
        { date: "2025/08", service: "竹子代耕砍伐", note: "燕巢" }
      ],

      dispatchStatus: "scheduled",
      dispatchStatusText: "🚜 已排程",
      actualDate: "2026-10-07",
      actualTime: "13:30",
      worker: "李師傅",
      machine: "3號粉碎機",
      dispatchNote: "需配備長竹導料槽"
    },
    {
      id: "XN-DEMO-003",
      name: "陳小姐",
      phone: "0928-888-168",
      service: "果樹枝條粉碎",
      crop: "芭樂",
      area: "大社",
      location: "大社區農會旁果園",
      size: "2.5 分",
      branches: "大量",
      hopeDate: "2026-09-28",
      flex: "前後 3 天皆可",
      note: "修剪完成，集中於路邊水溝旁。",
      time: "2 小時前",
      photos: ["📷 集中堆放"],

      starterStatus: "processing",
      starterStatusText: "🔵 處理中",

      mgmtStatus: "confirmed",
      mgmtStatusText: "🟢 已確認",
      confirmedDate: "2026-09-28",
      mgmtNote: "已完成路況確認，道路平坦。",
      pastServices: [],

      dispatchStatus: "confirmed",
      dispatchStatusText: "🟢 已確認",
      actualDate: "",
      actualTime: "",
      worker: "",
      machine: "",
      dispatchNote: ""
    },
    {
      id: "XN-DEMO-002",
      name: "李先生",
      phone: "0933-123-456",
      service: "果樹枝條粉碎",
      crop: "棗子",
      area: "岡山",
      location: "岡山交流道往大社方向農田",
      size: "5 分",
      branches: "少量",
      hopeDate: "2026-09-24",
      flex: "日期可以再與我聯絡確認",
      note: "現場有寬敞空地供迴轉。",
      time: "昨日",
      photos: [],

      starterStatus: "closed",
      starterStatusText: "⚪ 已結案",

      mgmtStatus: "completed",
      mgmtStatusText: "✅ 已完成",
      confirmedDate: "2026-09-24",
      mgmtNote: "施工完成，粉碎碎屑直接鋪設果園覆蓋保濕。",
      pastServices: [
        { date: "2025/12", service: "蜜棗修枝代工", note: "5 分" }
      ],

      dispatchStatus: "completed",
      dispatchStatusText: "✅ 已完成",
      actualDate: "2026-09-24",
      actualTime: "09:00",
      worker: "陳師傅",
      machine: "1號粉碎機",
      dispatchNote: "工時 3 小時完成"
    },
    {
      id: "XN-DEMO-001",
      name: "黃老伯",
      phone: "0955-666-777",
      service: "果樹枝條粉碎",
      crop: "其他",
      area: "大樹",
      location: "大樹區姑婆寮段山坡地",
      size: "1.8 分",
      branches: "少量",
      hopeDate: "2026-09-22",
      flex: "前後 3 天皆可",
      note: "坡度稍陡，有便道可通行小發財。",
      time: "3 天前",
      photos: [],

      starterStatus: "to_contact",
      starterStatusText: "🟡 待聯絡",

      mgmtStatus: "pending",
      mgmtStatusText: "🟡 待處理",
      confirmedDate: "",
      mgmtNote: "",
      pastServices: [],

      dispatchStatus: "pending",
      dispatchStatusText: "🟡 待確認",
      actualDate: "",
      actualTime: "",
      worker: "",
      machine: "",
      dispatchNote: ""
    }
  ],

  // 師傅名錄（Dispatch 版專用）
  workers: [
    { id: "W01", name: "陳師傅", phone: "0918-111-222", status: "available", statusText: "可用", todayTasks: 2, currentCase: "10/07 08:00 岡山王" },
    { id: "W02", name: "李師傅", phone: "0922-333-444", status: "available", statusText: "可用", todayTasks: 1, currentCase: "10/07 13:30 燕巢林先生" },
    { id: "W03", name: "張師傅", phone: "0935-555-666", status: "busy", statusText: "施工中", todayTasks: 1, currentCase: "大社區代耕作業" },
    { id: "W04", name: "林師傅", phone: "0960-777-888", status: "off", statusText: "休假", todayTasks: 0, currentCase: "無任務" }
  ],

  // 機具庫存（Dispatch 版專用）
  machines: [
    { id: "M01", name: "1號履帶粉碎機", type: "中型自走式", status: "available", statusText: "🟢 可用", spec: "最大樹徑 12cm · 燕巢庫存" },
    { id: "M02", name: "2號高馬力粉碎機", type: "重型牽引式", status: "busy", statusText: "🟡 施工中", spec: "最大樹徑 18cm · 岡山出勤中" },
    { id: "M03", name: "3號長料專用粉碎機", type: "竹木多功能", status: "reserved", statusText: "🔵 明日預約", spec: "含長竹進料滾筒 · 預備派工" },
    { id: "M04", name: "4號小型農園粉碎機", type: "輕便輪胎式", status: "available", statusText: "🟢 可用", spec: "適合 1 米極窄果園走道" }
  ],

  // 農友名錄（Management & Dispatch 版專用）
  farmers: [
    { name: "岡山王", phone: "0912-345-678", area: "岡山", crop: "芭樂", lineFriend: true, totalCases: 3, lastContact: "2026-09-21" },
    { name: "Eric Lee", phone: "0921-222-222", area: "大社", crop: "芭樂", lineFriend: true, totalCases: 2, lastContact: "2026-09-20" },
    { name: "林先生", phone: "0933-987-654", area: "燕巢", crop: "竹子", lineFriend: false, totalCases: 2, lastContact: "2026-09-19" },
    { name: "陳小姐", phone: "0928-888-168", area: "大社", crop: "芭樂", lineFriend: true, totalCases: 1, lastContact: "2026-09-21" },
    { name: "李先生", phone: "0933-123-456", area: "岡山", crop: "棗子", lineFriend: true, totalCases: 2, lastContact: "2026-09-24" },
    { name: "黃老伯", phone: "0955-666-777", area: "大樹", crop: "其他", lineFriend: false, totalCases: 1, lastContact: "2026-09-18" }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MOCK_DATA };
}
