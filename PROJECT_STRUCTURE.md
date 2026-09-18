# 📁 RTSAS — โครงสร้างและสถาปัตยกรรมไฟล์ของระบบ (Project File Architecture)

เอกสารสรุปการจัดระเบียบโครงสร้างไดเรกทอรีและไฟล์ทั้งหมดในระบบ **RTSAS (Real-Time Sepsis Alert System)** เพื่อความเป็นระเบียบ ความง่ายต่อการบำรุงรักษา และรองรับการพัฒนาต่อยอด (Scalability)

---

## 🗺️ แผนผังโครงสร้างโปรเจกต์ (Overall Architecture Map)

```
Hospital/
├── DEPLOYMENT_GUIDE.md                  # 🚀 คู่มือการติดตั้ง เชื่อมต่อ HOSxP และ Docker Compose
├── DATABASE_CLEANUP_GUIDE.md            # 🧹 คู่มือการเคลียร์และลบข้อมูลใน SQLite (Local & Docker)
├── PROJECT_STRUCTURE.md                 # 📁 โครงสร้างและสถาปัตยกรรมไฟล์ของระบบฉบับนี้
├── README.md                            # 📌 ภาพรวมระบบและการเริ่มต้นใช้งานแบบย่อ
├── CODEBASE_GUIDE.md                    # 📘 คู่มืออธิบายโค้ดและสถาปัตยกรรมเชิงลึก
├── TODO.md                              # 📝 บันทึกความคืบหน้าและการวางแผนระบบ
│
├── src/                                 # ⚛️ รหัสต้นฉบับ Frontend (React 19 + TypeScript)
│   ├── pages/                           # 📄 หน้าจอหลักแบบเต็มหน้า (Full-page Views)
│   │   ├── AdminPage.tsx                # หน้า IT Admin Dashboard (Users, DB Status, Cache)
│   │   ├── TreatedDashboard.tsx         # หน้าสรุปสถิติและประวัติผู้ป่วยที่ผ่านการรักษา
│   │   ├── LoginPage.tsx                # หน้า Standalone Login/Register สำหรับอนาคต
│   │   └── index.ts                     # Barrel export สำหรับ Pages
│   │
│   ├── components/                      # 🧩 คอมโพเนนต์ UI จัดหมวดหมู่ตามหน้าที่
│   │   ├── common/                      # คอมโพเนนต์พื้นฐาน & Feedback UI
│   │   │   ├── Toast.tsx                # ระบบ Toast Notification & showToast helper
│   │   │   ├── LoadingSkeleton.tsx      # Skeleton Placeholder ระหว่างโหลดข้อมูล
│   │   │   ├── ErrorBanner.tsx          # แถบแจ้งเตือนการเชื่อมต่อขัดข้อง & ปุ่มลองใหม่
│   │   │   ├── CountdownBanner.tsx      # แถบนับถอยหลัง Sepsis Bundle 60 นาที
│   │   │   ├── AlertSummaryBanner.tsx   # แถบเตือนสีแดงด้านบนเมื่อมี Alert หลายรายพร้อมกัน
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/                      # โครงสร้าง Layout หลักของหน้าจอ
│   │   │   ├── Header.tsx               # ส่วนหัวระบบ: โลโก้, เวลาปัจจุบัน, Auth, ปุ่มลัด
│   │   │   ├── Sidebar.tsx              # เมนูด้านซ้าย: รายชื่อผู้ป่วย, Vitals, ตัวนับถอยหลัง
│   │   │   ├── StatusBar.tsx            # แถบสถานะด้านล่าง: สถานะ HIS & เซิร์ฟเวอร์
│   │   │   └── index.ts
│   │   │
│   │   ├── modals/                      # หน้าต่างป๊อปอัป (Modals & Dialogs)
│   │   │   ├── AlertModal.tsx           # ป๊อปอัปแจ้งเตือน Sepsis รายเดี่ยว (NEWS ≥ 5)
│   │   │   ├── MultiAlertModal.tsx      # ป๊อปอัปคิวแจ้งเตือนผู้ป่วยหลายราย
│   │   │   ├── AssessmentFormModal.tsx  # แบบฟอร์มบันทึกสัญญาณชีพซ้ำตามรอบนัด
│   │   │   ├── AuthModal.tsx            # หน้าต่าง Login / Register มุมขวาบน
│   │   │   ├── ExportReportModal.tsx    # หน้าต่างดาวน์โหลดรายงาน Shift Summary (CSV / PDF)
│   │   │   ├── ReminderModal.tsx        # หน้าต่างเตือนเมื่อถึงเวลาประเมินสัญญาณชีพซ้ำ
│   │   │   └── index.ts
│   │   │
│   │   ├── panels/                      # แผงข้อมูลทางคลินิก (Clinical Workflow & Details)
│   │   │   ├── PatientInfoBar.tsx       # แถบสรุปข้อมูลผู้ป่วย, Masked HN, เวลาที่อยู่ใน ER
│   │   │   ├── VitalSignsGrid.tsx       # ตารางแสดงสัญญาณชีพ 6 ค่าพร้อมเกณฑ์ NEWS
│   │   │   ├── NewsCalculationLogic.tsx # การแจกแจงคะแนน NEWS ย้อนกลับได้
│   │   │   ├── ChecklistPanel.tsx       # 1-Hour Sepsis Bundle Checklist แบบ Step-by-Step
│   │   │   ├── TimelinePanel.tsx        # ไทม์ไลน์บันทึกเหตุการณ์ทางการรักษา (พร้อม Copy to HIS)
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                     # Master Barrel Export รวมทุกคอมโพเนนต์
│   │
│   ├── hooks/                           # 🎣 Custom React Hooks
│   │   ├── useBackend.ts                # ดึงข้อมูลผู้ป่วย (HTTP Fetch 60s) & WebSocket Alerts
│   │   └── useTimers.ts                 # ตรวจจับเวลารอบนัดสัญญาณชีพ & แจ้งเตือนอัตโนมัติ
│   │
│   ├── store/                           # 🗄️ Zustand State Management
│   │   └── useRTSASStore.ts             # Global State ครอบคลุมการรักษา, ไทม์ไลน์, และผู้ใช้
│   │
│   ├── types/                           # 🏷️ TypeScript Type Definitions
│   │   └── index.ts                     # โครงสร้างข้อมูล Patient, NEWS, Bundle, User
│   │
│   ├── utils/                           # 🛠️ ฟังก์ชันช่วยเหลือ (Utilities)
│   │   ├── alertSound.ts                # เสียงแจ้งเตือน Web Audio API
│   │   ├── errorUtils.ts                # การจัดการและแปลง Error Messages
│   │   ├── exportReport.ts              # การสร้าง CSV (พร้อม UTF-8 BOM) & PDF Print
│   │   ├── hnMask.ts                    # การ Mask HN ตามมาตรฐาน PDPA (เช่น HN****0154)
│   │   ├── newsCalculator.ts            # การคำนวณคะแนน NEWS 2017 ตามเกณฑ์ RCP
│   │   └── patientMemory.ts             # การจัดการ Clean up ข้อมูลผู้ป่วยและบันทึก HIS Note
│   │
│   ├── data/                            # 📦 ข้อมูล Mock / ตัวอย่างสำหรับการทดสอบ
│   │   └── mockData.ts
│   ├── assets/                          # 🎨 รูปภาพและไอคอน SVG
│   ├── __tests__/                       # 🧪 Automated Unit & Integration Tests (Vitest)
│   ├── App.tsx                          # Root Application Component
│   ├── main.tsx                         # Entry Point
│   └── index.css                        # Global Design Tokens & Tailwind CSS
│
├── backend/                             # 🐍 รหัสต้นฉบับ Backend (FastAPI + Python 3.11+)
│   ├── auth/                            # โมดูลระบบความปลอดภัยและผู้ใช้งาน
│   │   ├── models.py                    # SQLAlchemy Models (ตาราง users)
│   │   ├── router.py                    # API Routes (/auth/register, /auth/login, /auth/users)
│   │   ├── schemas.py                   # Pydantic Schemas สำหรับ Request/Response
│   │   └── service.py                   # การแฮชรหัสผ่าน bcrypt & สร้าง JWT Token
│   │
│   ├── tests/                           # 🧪 Unit Tests สำหรับ Backend (Python unittest)
│   │   ├── test_api_endpoints.py
│   │   ├── test_auth.py
│   │   ├── test_dashboard_api.py
│   │   ├── test_scheduler_cache.py
│   │   ├── test_services.py
│   │   └── test_treatment_service.py
│   │
│   ├── main.py                          # FastAPI App, WebSocket Connection Manager, Admin APIs
│   ├── config.py                        # การอ่านค่า Environment Variables (.env)
│   ├── database.py                      # aiomysql Connection Pool สำหรับฐานข้อมูล HOSxP
│   ├── database_auth.py                 # SQLAlchemy Engine สำหรับ MySQL Auth DB
│   ├── schemas.py                       # Pydantic Schemas ของข้อมูลผู้ป่วยและ Vitals
│   ├── services.py                      # ตรรกะการคำนวณ NEWS และการดึงข้อมูล HOSxP
│   ├── scheduler.py                     # Background Task ดึง Vitals ทุก 30 วินาที + Auto Flush
│   ├── treatment_service.py             # จัดการสถานะการรักษาแบบ Centralized (ตาราง MySQL)
│   ├── dashboard_service.py             # คำนวณสรุปสถิติประจำวันและรายชื่อเคสที่รักษา
│   ├── requirements.txt                 # รายการ Python Packages
│   ├── Dockerfile                       # Container Build ของ Backend
│   ├── .env                             # Local Environment Credentials (Ignored ใน Git)
│   └── .env.example                     # ไฟล์ตัวอย่างการตั้งค่า Environment
│
├── docker-compose.yml                   # Docker Compose สำหรับ Frontend, Backend, Auth DB
├── frontend.Dockerfile                  # Dockerfile สำหรับ Nginx Alpine Frontend
├── nginx.conf                           # การตั้งค่า Nginx Reverse Proxy
├── package.json                         # Node.js Dependencies & NPM Scripts
├── tsconfig.json                        # Master TypeScript Configuration
├── tsconfig.app.json                    # Frontend App TypeScript Config (พร้อม @/* alias)
├── vite.config.ts                       # Vite Bundler Config (พร้อม Tailwind CSS & @/* alias)
└── eslint.config.js                     # ESLint Configuration
```

---

## 💡 สรุปการปรับปรุงความเป็นระเบียบ (Key Cleanups Done)

1. **Root Directory Clean:**
   - ย้ายไฟล์เอกสารและรายงานผลการทดสอบขนาดใหญ่ (`COMPREHENSIVE_SYSTEM_TEST_REPORT.md`, `QA_SYSTEM_TEST_REPORT.md`) ไปยัง [`docs/reports/`](file:///Users/phatchara/Desktop/Hospital/docs/reports/)
   - ย้ายไฟล์ Mockup HTML ที่ชื่อมีช่องว่าง (`real time alert mock up phanikarn.html`) ไปยัง [`docs/mockups/real_time_alert_mockup_phanikarn.html`](file:///Users/phatchara/Desktop/Hospital/docs/mockups/real_time_alert_mockup_phanikarn.html)
   - ลบไฟล์ขยะของระบบปฏิบัติการ (`.DS_Store`) และเพิ่มกฎใน `.gitignore` ป้องกันไม่ให้เผลอ Ignore ไฟล์ตัวอย่าง `.env.example`

2. **Modular Components Structure:**
   - แยกคอมโพเนนต์จากเดิมที่รวมกัน 22 ไฟล์ในโฟลเดอร์เดียว ออกเป็น 4 หมวดหมู่ชัดเจน:
     - `src/components/layout/` (Header, Sidebar, StatusBar)
     - `src/components/panels/` (ChecklistPanel, TimelinePanel, PatientInfoBar, VitalSignsGrid, NewsCalculationLogic)
     - `src/components/modals/` (AlertModal, MultiAlertModal, AssessmentFormModal, AuthModal, ExportReportModal, ReminderModal)
     - `src/components/common/` (Toast, LoadingSkeleton, ErrorBanner, CountdownBanner, AlertSummaryBanner)
   - เพิ่ม `src/pages/` สำหรับหน้าจอหลัก (`AdminPage`, `TreatedDashboard`, `LoginPage`)
   - เพิ่ม **Barrel Exports (`index.ts`)** ในทุกโฟลเดอร์ย่อย และ Master `src/components/index.ts` ทำให้การ Import สะอาดและเป็นระเบียบ

3. **TypeScript Path Alias (`@/*`):**
   - ตั้งค่า Path Alias `@/*` ใน `tsconfig.app.json` และ `vite.config.ts` ชี้ไปยัง `src/*`
   - แก้ไขปัญหา Deprecated `baseUrl` ตามมาตรฐาน TypeScript 6.0+

4. **Zero Linter & Compile Warnings:**
   - แก้ไข Dependency Effect Warning ใน `TreatedDashboard.tsx` ทำให้ `npm run lint` ผ่าน 100% (0 errors, 0 warnings)
   - ผลการรัน Test Suite ครบถ้วน: **79 Vitest Tests Pass**, **36 Python Backend Tests Pass**, **Vite Production Build Pass (108ms)**
