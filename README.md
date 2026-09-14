# RTSAS — Real-Time Sepsis Alert System
### ระบบแจ้งเตือนและติดตามภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (ห้องอุบัติเหตุและฉุกเฉิน โรงพยาบาลบางคล้า)

---

## 📌 ภาพรวมระบบ (System Overview)

**RTSAS (Real-Time Sepsis Alert System)** คือระบบเฝ้าระวัง คัดกรอง และแจ้งเตือนภาวะ Sepsis (ภาวะติดเชื้อในกระแสเลือด) แบบอัตโนมัติและเรียลไทม์ สำหรับห้องอุบัติเหตุและฉุกเฉิน (ER) โดยดึงข้อมูลสัญญาณชีพของผู้ป่วยจากฐานข้อมูล **HOSxP** คำนวณคะแนน **NEWS (National Early Warning Score - RCP 2017)** อัตโนมัติ แจ้งเตือนเมื่อมีความเสี่ยงสูง (NEWS ≥ 5) พร้อมกระบวนการติดตาม **Sepsis Bundle 1-Hour Protocol** อย่างเป็นระบบ

### จุดเด่นสำคัญ:
- **Real-Time Alert & Monitoring:** คำนวณ NEWS ทันทีที่มีการบันทึกสัญญาณชีพ และส่งการแจ้งเตือนผ่าน WebSocket
- **Privacy & PDPA Compliant:** ซ่อนข้อมูลส่วนบุคคล (HN Masked แสดงเฉพาะ 4 หลักท้าย เช่น `HN****6455`, ไม่แสดงชื่อ-นามสกุลบนหน้าจอรวม)
- **Role-Based Access Control:** ระบบยืนยันตัวตนด้วย **JWT Token** (อายุ 8 ชั่วโมง = 1 กะการทำงาน) พร้อมรหัสผ่านเข้ารหัส **bcrypt** แบ่งบทบาท **แพทย์ (Doctor)**, **พยาบาล (Nurse)**, และ **เจ้าหน้าที่ IT (IT Admin)**
- **Hospital Network Ready:** รองรับการ Deploy ด้วย **Docker Compose** และเชื่อมต่อไปยังฐานข้อมูล HOSxP ภายนอกผ่านเครือข่าย LAN ของโรงพยาบาล

---

## 🏗️ สถาปัตยกรรมระบบ (System Architecture)

```
                       [ โรงพยาบาล LAN / HOSxP Server ]
                             192.168.2.230:3306
                                     ▲
                                     │ (Read-Only Pool: aiomysql)
                                     │
┌──────────────────────── Docker Environment ────────────────────────┐
│                                                                    │
│  ┌─────────────────┐      Proxy API/WS      ┌──────────────────┐   │
│  │ rtsas_frontend  │ ─────────────────────► │  rtsas_backend   │   │
│  │   Nginx :80     │                        │  FastAPI :8000   │   │
│  └─────────────────┘                        └──────────────────┘   │
│           ▲                                          │             │
│           │                                          │ SQLAlchemy  │
│      Web Browser                                     ▼ (Port 3306) │
│   (PC / Tablet ER)                          ┌──────────────────┐   │
│                                             │  rtsas_auth_db   │   │
│                                             │   MySQL 8 :3307  │   │
│                                             └──────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

> 📁 **โครงสร้างไฟล์และโมดูลโดยละเอียด:** ดูรายละเอียดการจัดระเบียบไฟล์ Frontend / Backend / Docs ทั้งหมดได้ที่ [PROJECT_STRUCTURE.md](file:///Users/phatchara/Desktop/Hospital/PROJECT_STRUCTURE.md)

---

## 💻 เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS + Custom CSS tokens (Glassmorphism & Medical Dark/Light Accents)
- **State Management:** Zustand (พร้อม Persist State ใน LocalStorage)
- **Real-Time:** WebSocket Client (Auto-reconnect 5s fallback)

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **HOSxP DB Pool:** `aiomysql` (Async connection pool, fallback query engine)
- **Auth DB ORM:** SQLAlchemy 2.0 + PyMySQL
- **Security:** `bcrypt` (Direct hash), `PyJWT` (HS256)
- **Scheduler:** Asyncio background task ดึงข้อมูลสัญญาณชีพทุก 30 วินาที

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Web Server:** Nginx Alpine (Reverse proxy `/api/`, `/auth/`, `/ws/`)
- **Database:** MySQL 8.0 (สำหรับระบบผู้ใช้และการยืนยันตัวตน)

---

## ⚙️ ข้อกำหนดและโครงสร้างเครือข่าย (Prerequisites & Network)

1. **เครื่อง Server / Host:**
   - ติดตั้ง **Docker Engine (20.10+)** และ **Docker Compose (v2+)**
   - หรือหากรันแบบ Local: ติดตั้ง **Node.js 20+** และ **Python 3.11+**
2. **Network Connection:**
   - เครื่อง Server ต้องอยู่ในเครือข่าย LAN เดียวกับ HOSxP Server (เช่น `192.168.2.230`)
   - พอร์ตที่ใช้งาน:
     - `80` : หน้าเว็บ RTSAS Frontend (Nginx)
     - `8000` : Backend REST API & WebSocket (FastAPI)
     - `3307` : Auth Database MySQL (Exposed ภายนอกเป็น 3307 เพื่อไม่ให้ชนกับ 3306 ของ HOSxP)
     - `3306` : HOSxP Database (ภายนอก)

---

## 🚀 วิธีการติดตั้งและเริ่มต้นใช้งาน (Quick Start with Docker)

### 1. โคลนโปรเจกต์
```bash
git clone https://github.com/opal-Pachara/Hospital-sepsis-system.git
cd Hospital-sepsis-system
```

### 2. ตั้งค่าไฟล์ Environment Variables (`.env`)
คัดลอกไฟล์ตัวอย่าง `.env.example` ไปเป็น `.env`:
```bash
cp .env.example .env
```

แก้ไขค่าในไฟล์ `.env` ให้ตรงกับระบบของโรงพยาบาล:
```ini
# ── JWT Secret & Expiry ──
JWT_SECRET=YOUR_SUPER_SECRET_KEY_HERE_2026
JWT_EXPIRE_HOURS=8

# ── Auth DB (MySQL ใน Docker) ──
AUTH_DB_ROOT_PASSWORD=rtsas_root_password
AUTH_DB_PASSWORD=rtsas_secure_password

# ── HOSxP Database (LAN นอก Docker) ──
DB_HOST=192.168.2.230
DB_PORT=3306
DB_USER=bk
DB_PASSWORD=bk
DB_NAME=hos
```

### 3. สั่งรันด้วย Docker Compose
```bash
docker compose up -d --build
```

### 4. ตรวจสอบสถานะการทำงาน
```bash
docker compose ps
```
เมื่อทุก Container รันสมบูรณ์:
- เข้าสู่ระบบผ่านเบราว์เซอร์: **`http://localhost`** (หรือ IP ของเครื่อง Server เช่น `http://192.168.x.x`)
- Backend API Docs (Swagger): **`http://localhost:8000/docs`**

---

## 🛠️ วิธีการรันสำหรับการพัฒนา (Local Development)

หากต้องการรันแยกโดยไม่ใช้ Docker:

### 1. รัน Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # บน Windows: venv\Scripts\activate
pip install -r requirements.txt

# สร้าง .env ในโฟลเดอร์ backend (หรือใช้ตัวแปรจาก root)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. รัน Frontend
```bash
# อยู่ที่ Root Directory
npm install
npm run dev
```
เข้าใช้งานผ่าน `http://localhost:5173`

---

## 🔐 ระบบผู้ใช้งานและสิทธิ์ (Roles & Authentication)

ระบบรองรับการลงทะเบียน (Register) และเข้าสู่ระบบ (Login):

| บทบาท (Role) | สิทธิ์การเข้าถึง | การแสดงผล |
| :--- | :--- | :--- |
| **🩺 แพทย์ (Doctor)** | ยืนยันการวินิจฉัย Sepsis, สั่งการรักษา, บันทึก Bundle | 🟢 ป้ายแพทย์ |
| **💉 พยาบาล (Nurse)** | คัดกรอง, รับทราบการแจ้งเตือน, บันทึกสัญญาณชีพซ้ำ, ดำเนินการ Checklist | 🔵 ป้ายพยาบาล |
| **💻 เจ้าหน้าที่ IT (IT Admin)** | จัดการผู้ใช้งาน (เรียกดูรายชื่อ/ระงับบัญชี), ตรวจสอบสถานะ Server & Connection | 🟣 ป้าย IT |

### ข้อมูลในการสมัครสมาชิก (Register):
- **ชื่อ (Firstname)**
- **นามสกุล (Lastname)**
- **ตำแหน่ง / บทบาท (Role Dropdown):** แพทย์, พยาบาล, เจ้าหน้าที่ IT
- **ชื่อผู้ใช้ (Username):** ภาษาอังกฤษ/ตัวเลข ไม่ซ้ำกันในระบบ
- **รหัสผ่าน (Password):** เข้ารหัสแบบ bcrypt ปลอดภัยตามมาตรฐาน

---

## 📊 เกณฑ์การคำนวณ NEWS & Sepsis Protocol

| ค่า NEWS Score | ระดับความเสี่ยง | การดำเนินการของระบบ |
| :---: | :---: | :--- |
| **0 – 2** | 🟢 ต่ำ (Low) | ประเมินสัญญาณชีพตามรอบปกติ (ทุก 4–6 ชม.) |
| **3 – 4** | 🟡 ปานกลาง (Medium) | เฝ้าระวัง เพิ่มความถี่การประเมินสัญญาณชีพ (ทุก 1–2 ชม.) |
| **≥ 5** | 🔴 เสี่ยง Sepsis (High) | **แจ้งเตือนทันที (Popup/Sound/WebSocket)** + เริ่มจับเวลานับถอยหลัง **Sepsis Bundle 60 นาที** |

---

## 🩺 HOSxP Query Integration

ระบบดึงข้อมูลสัญญาณชีพโดยคำนึงถึงความเป็นส่วนตัว (PDPA) โดยไม่ดึงชื่อ-สกุลผู้ป่วยเข้าสู่ระบบกลาง:

```sql
SELECT 
    o.vstdate, o.vsttime, o.hn, o.vn,
    p.sex,
    TIMESTAMPDIFF(YEAR, p.birthday, o.vstdate) AS age,
    o.cc AS chief_complaint,
    (e.gcs_e + e.gcs_v + e.gcs_m) AS gcs,
    e.o2sat AS spo2,
    o.pulse AS heart_rate,
    o.bps AS sbp,
    o.bpd AS dbp,
    o.rr AS resp_rate,
    o.temperature,
    o.bw AS weight,
    o.height
FROM opdscreen o
JOIN er_nursing_detail e ON o.vn = e.vn
LEFT JOIN patient p ON o.hn = p.hn
WHERE o.vstdate >= CURDATE()
ORDER BY o.vstdate DESC, o.vsttime DESC;
```

---

## ❓ การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

1. **ไม่สามารถเชื่อมต่อ HOSxP Database ได้ (`Disconnected HIS`):**
   - ตรวจสอบว่าเครื่อง Server สามารถ `ping 192.168.2.230` ได้หรือไม่
   - ตรวจสอบสิทธิ์ Username/Password ของ MySQL HOSxP
   - ตรวจสอบว่า Firewall ของเครื่อง HOSxP อนุญาตให้ IP ของ Server RTSAS เชื่อมต่อพอร์ต `3306`

2. **หน้าเว็บขึ้นแจ้งเตือน Token หมดอายุ:**
   - Token มีอายุ 8 ชั่วโมงตามระยะเวลาของกะการทำงาน ให้กดออกจากระบบแล้ว Login ใหม่อีกครั้ง

3. **Portชนกันขณะรัน Docker:**
   - พอร์ต Auth Database ถูกแมปไว้ที่ `3307:3306` หากต้องการเปลี่ยนพอร์ต ให้แก้ไขในไฟล์ `docker-compose.yml`

---

## 📑 เอกสารและรายงานผลการทดสอบ (Documentation & QA Reports)

สามารถดูรายละเอียดเอกสารประกอบและผลการทดสอบระบบได้ที่โฟลเดอร์ [`docs/`](file:///Users/phatchara/Desktop/Hospital/docs/README.md):
- 📖 **[คู่มือการใช้งานระบบ RTSAS (User & Operations Manual)](file:///Users/phatchara/Desktop/Hospital/docs/USER_MANUAL.md)** — คู่มือการใช้งานระบบฉบับสมบูรณ์อย่างละเอียด พร้อมภาพถ่ายหน้าจอประกอบทุกฟังก์ชัน
- 🧪 **[Comprehensive System Test Report](file:///Users/phatchara/Desktop/Hospital/docs/reports/COMPREHENSIVE_SYSTEM_TEST_REPORT.md)** — รายงานการทดสอบระบบแบบละเอียดทุกโมดูล
- 🛡️ **[QA System Test Report](file:///Users/phatchara/Desktop/Hospital/docs/reports/QA_SYSTEM_TEST_REPORT.md)** — รายงานการตรวจสอบความเสถียร ระบบ Audit และ Persistence
- 🎨 **[Real-Time Alert UI Mockup](file:///Users/phatchara/Desktop/Hospital/docs/mockups/real_time_alert_mockup_phanikarn.html)** — ต้นแบบหน้าจอการออกแบบดั้งเดิม

---

## 📄 License & Maintainer

- **ผู้ดูแลระบบ:** ทีมงานพัฒนาระบบเฝ้าระวังสารสนเทศทางการแพทย์ โรงพยาบาลบางคล้า
- **ลิขสิทธิ์:** สำหรับใช้งานภายในโรงพยาบาลบางคล้าและหน่วยงานที่ได้รับอนุญาต

