# 📚 เอกสารประกอบโครงการ (Project Documentation)

สารบัญเอกสาร คู่มือ และรายงานการทดสอบระบบ **RTSAS (Real-Time Sepsis Alert System)**

---

## 📂 โครงสร้างโฟลเดอร์ (Directory Structure)

```
docs/
├── README.md               # สารบัญเอกสาร (ไฟล์นี้)
├── mockups/                # ไฟล์ Mockup / ต้นแบบหน้าจอ UX/UI
│   └── real_time_alert_mockup_phanikarn.html
└── reports/                # รายงานผลการทดสอบระบบและ QA Audits
    ├── COMPREHENSIVE_SYSTEM_TEST_REPORT.md  # รายงานทดสอบระบบครอบคลุมทุกโมดูล
    └── QA_SYSTEM_TEST_REPORT.md             # รายงาน Audit ความเสถียรและความพร้อมใช้งาน
```

---

## 📋 รายการเอกสารและรายงาน

### 1. 📖 [คู่มือการใช้งานระบบ RTSAS (User & Operations Manual)](file:///Users/phatchara/Desktop/Hospital/docs/USER_MANUAL.md)
คู่มือการใช้งานระบบฉบับสมบูรณ์อย่างละเอียด พร้อมภาพถ่ายหน้าจอประกอบทุกฟังก์ชัน:
- ภาพรวมหน้าจอและการนำทาง (3-Column Layout)
- การจัดการคิวผู้ป่วยและการคัดแยก (Sidebar Queue & Filters)
- ข้อมูลผู้ป่วย สัญญาณชีพ 6 พารามิเตอร์ และกล่องอาการสำคัญ
- ระบบการแจ้งเตือนภาวะวิกฤตเดี่ยวและกลุ่ม (Single & Multi-Alert Modals)
- ขั้นตอนปฏิบัติ Sepsis Bundle 60 นาทีและแบบฟอร์มประเมินซ้ำ
- การบันทึก Clinical Timeline และการคัดลอกลงระบบ HOSxP
- แดชบอร์ดสรุปสถิติผู้ป่วยที่รักษาแล้ว (Treated Dashboard)
- การบริหารจัดการฐานข้อมูลและแคช (Admin Page)
- ตารางเกณฑ์คะแนน NEWS 2017 และการตอบสนองทางการแพทย์
- 📄 **ไฟล์ Microsoft Word (.docx):** [RTSAS_User_Manual.docx](file:///Users/phatchara/Desktop/Hospital/docs/RTSAS_User_Manual.docx) (ขนาด ~7.1 MB พร้อมรูปภาพครบถ้วน เหมาะสำหรับสั่งพิมพ์หรือจัดหน้าส่งรายงาน)

### 2. 🧪 [Comprehensive System Test Report](file:///Users/phatchara/Desktop/Hospital/docs/reports/COMPREHENSIVE_SYSTEM_TEST_REPORT.md)
รายงานผลการทดสอบเชิงลึกครอบคลุม:
- การคำนวณคะแนน NEWS 2017 และ Single Alert Trigger
- การจำกัดสิทธิ์และการป้องกันข้อมูลส่วนบุคคล (PDPA Masking)
- การทำงานร่วมกันระหว่าง Frontend และ Backend API
- สถิติการทดสอบและผลการรัน Test Suite

### 2. 🛡️ [QA System Test Report](file:///Users/phatchara/Desktop/Hospital/docs/reports/QA_SYSTEM_TEST_REPORT.md)
รายงานผลการตรวจสอบคุณภาพระบบ (Quality Assurance) ครอบคลุม:
- Patient Memory Cleanup & Sepsis Guard
- Centralized Treatment Status Synchronization
- การจัดการ Cache และความเสถียรของ Database Connection
- การส่งออกรายงานสรุป Shift (CSV & PDF)

### 3. 🎨 [Real-Time Alert UI Mockup](file:///Users/phatchara/Desktop/Hospital/docs/mockups/real_time_alert_mockup_phanikarn.html)
ไฟล์ HTML Mockup ต้นแบบการออกแบบระบบแจ้งเตือนแบบเรียลไทม์ฉบับดั้งเดิม สำหรับการอ้างอิงดีไซน์
