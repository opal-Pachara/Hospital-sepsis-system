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

## 🚀 วิธีการติดตั้งและเริ่มต้นใช้งาน (Step-by-Step with Docker)

> 💡 **เข้าใจสถาปัตยกรรมใน 1 นาที:**  
> ระบบ **Web App, Backend API, Auth DB (MySQL ในตัว) และ SQLite Logs** จะทำงานอยู่ใน **Docker ทั้งหมด 100%**  
> ผู้ดูแลระบบเพียงแค่ **(1) ระบุ IP ของ HOSxP ในไฟล์ `.env`** และ **(2) สร้างฐานข้อมูล `rtsas_dashboard` บน Server โรงพยาบาล 1 ครั้ง** แล้วสั่งรัน Docker ได้ทันที!  
> *(อ่านคู่มืออย่างละเอียดพร้อมวิธีแก้ปัญหาได้ที่ [DEPLOYMENT_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/DEPLOYMENT_GUIDE.md))*

### ขั้นตอนที่ 1: ตรวจสอบการเชื่อมต่อ LAN ไปยังเครื่อง HOSxP
เปิด Terminal บนเครื่องที่จะติดตั้ง RTSAS แล้วทดสอบว่าเชื่อมต่อกับ Server HOSxP ได้หรือไม่:
```bash
ping -c 4 192.168.2.230
nc -zv 192.168.2.230 3306   # หรือ telnet 192.168.2.230 3306
```

### ขั้นตอนที่ 2: สร้างฐานข้อมูล `rtsas_dashboard` บน MySQL ของโรงพยาบาล (ทำครั้งเดียว)
ล็อกอินเข้า MySQL บนเครื่อง Server โรงพยาบาล แล้วรันคำสั่ง SQL เตรียมไว้:
```sql
CREATE DATABASE IF NOT EXISTS rtsas_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON rtsas_dashboard.* TO 'bk'@'%';
FLUSH PRIVILEGES;
```
*(ตารางจัดเก็บสถานะและการรักษาภายในฐานข้อมูลนี้ Backend ใน Docker จะสร้างให้อัตโนมัติเมื่อเริ่มระบบ)*

### ขั้นตอนที่ 3: โคลนโปรเจกต์และตั้งค่าไฟล์ `.env`
```bash
# โคลนโปรเจกต์เข้าเครื่อง
git clone https://github.com/opal-Pachara/Hospital-sepsis-system.git
cd Hospital-sepsis-system

# คัดลอกและเปิดไฟล์ .env ขึ้นมาแก้ไข
cp .env.example .env
nano .env
```

ระบุ IP และการตั้งค่าของโรงพยาบาล:
```ini
# ── HOSxP Database (อ่านสัญญาณชีพและผลแล็บจาก LAN โรงพยาบาล) ──
DB_HOST=192.168.2.230             # 👈 ใส่ IP เครื่อง HOSxP ของ รพ.
DB_PORT=3306
DB_USER=bk
DB_PASSWORD=bk
DB_NAME=hos

# ── Dashboard Database (เก็บประวัติการรักษาในฐานข้อมูล รพ.) ──
DASHBOARD_DB_HOST=192.168.2.230   # 👈 ใส่ IP เดียวกับ DB_HOST
DASHBOARD_DB_PORT=3306
DASHBOARD_DB_USER=bk
DASHBOARD_DB_PASSWORD=bk
DASHBOARD_DB_NAME=rtsas_dashboard

# ── Auth DB (MySQL ใน Docker — ไม่ต้องแก้ ใช้ค่านี้ได้เลย) ──
AUTH_DB_ROOT_PASSWORD=rtsas_root_password
AUTH_DB_PASSWORD=rtsas_secure_password

# ── ความปลอดภัยและอายุ Token ──
JWT_SECRET=RTSAS_PROD_SECURE_TOKEN_2026_CHANGE_THIS
JWT_EXPIRE_HOURS=8

# ── โหมดการค้นหาข้อมูล (false = คนไข้วันนี้ / true = fallback วันล่าสุด) ──
ENABLE_DATE_FALLBACK=false
```

### ขั้นตอนที่ 4: สั่งเริ่มระบบผ่าน Docker Compose
```bash
docker compose up -d --build
```

### ขั้นตอนที่ 5: ตรวจสอบสถานะการทำงาน
```bash
# ตรวจสอบสถานะ Container ทุกตัว (ต้องขึ้นสถานะ Up)
docker compose ps

# ดู Log ของ Backend เพื่อยืนยันการเชื่อมต่อ HOSxP
docker compose logs -f backend
```
เมื่อเชื่อมต่อสำเร็จจะปรากฏข้อความ:  
`[INFO] Successfully connected to HOSxP database pool (192.168.2.230:3306/hos)`

- **เข้าใช้งานระบบผ่านเบราว์เซอร์:** `http://localhost` หรือ `http://<IP-เครื่อง-RTSAS>`
- **API Documentation (Swagger):** `http://localhost:8000/docs`
- 📖 **คู่มือการติดตั้งฉบับสมบูรณ์:** ดูรายละเอียดเชิงลึกและวิธีแก้ปัญหาได้ที่ [DEPLOYMENT_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/DEPLOYMENT_GUIDE.md)

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

## 📑 เอกสารและคู่มือในโปรเจกต์ (Project Documentation)

เอกสารสำคัญที่จัดทำขึ้นสำหรับทีมงานและผู้ดูแลระบบ:
- 🚀 **[DEPLOYMENT_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/DEPLOYMENT_GUIDE.md)** — คู่มือการติดตั้ง เชื่อมต่อ HOSxP และการรัน Docker อย่างละเอียด (พร้อมคำสั่ง SQL, การแก้ปัญหา, และคำถาม-คำตอบ)
- 🧹 **[DATABASE_CLEANUP_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/DATABASE_CLEANUP_GUIDE.md)** — คู่มือการเคลียร์และลบข้อมูลใน SQLite (`rtsas_local.db` & `timestamp_logs.db`) ทั้ง Host และ Docker
- 📁 **[PROJECT_STRUCTURE.md](file:///Users/phatchara/Desktop/Hospital/PROJECT_STRUCTURE.md)** — โครงสร้างและสถาปัตยกรรมไฟล์ทั้งหมดของระบบ (Frontend, Backend, Config)
- 📘 **[CODEBASE_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/CODEBASE_GUIDE.md)** — คู่มืออธิบายหน้าที่ของแต่ละไฟล์ สถาปัตยกรรม และ Clinical Logic (RCP NEWS 2017 & Sepsis Bundle)
- 📝 **[TODO.md](file:///Users/phatchara/Desktop/Hospital/TODO.md)** — บันทึกสถานะงานและการวางแผนฟีเจอร์ของระบบ

---

## 📄 License & Maintainer

- **ผู้ดูแลระบบ:** ทีมงานพัฒนาระบบเฝ้าระวังสารสนเทศทางการแพทย์ โรงพยาบาลบางคล้า
- **ลิขสิทธิ์:** สำหรับใช้งานภายในโรงพยาบาลบางคล้าและหน่วยงานที่ได้รับอนุญาต

