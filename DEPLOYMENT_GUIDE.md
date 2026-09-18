# 🚀 คู่มือการติดตั้ง เชื่อมต่อ HOSxP และรันระบบ RTSAS ผ่าน Docker
> **Real-Time Sepsis Alert System (RTSAS)** — ระบบเฝ้าระวัง คัดกรอง และแจ้งเตือนภาวะ Sepsis แบบเรียลไทม์  
> เอกสารนี้จัดทำขึ้นสำหรับ **เจ้าหน้าที่ IT, System Administrator, และ Developer** เพื่อใช้ในการติดตั้งระบบขึ้นใช้งานจริง (Production) หรือจำลองทดสอบ (Staging/Dev)

---

คำสั่ง ในการ ลบข้อมูลใน Dashborad -> curl -X POST http://localhost:8000/api/admin/reset-dashboard


## 📑 สารบัญ
1. [แผนผังโครงสร้างระบบ (Architecture Overview)](#1-แผนผังโครงสร้างระบบ-architecture-overview)
2. [สิ่งที่ต้องเตรียมล่วงหน้า (Pre-requisites Checklist)](#2-สิ่งที่ต้องเตรียมล่วงหน้า-pre-requisites-checklist)
3. [ขั้นตอนการตั้งค่าและติดตั้งแบบ Step-by-Step](#3-ขั้นตอนการตั้งค่าและติดตั้งแบบ-step-by-step)
4. [การตรวจสอบความถูกต้องหลังรันระบบ (Verification)](#4-การตรวจสอบความถูกต้องหลังรันระบบ-verification)
5. [คำสั่ง Docker ที่ใช้งานบ่อย (Useful Commands)](#5-คำสั่ง-docker-ที่ใช้งานบ่อย-useful-commands)
6. [วิธีแก้ปัญหาที่พบบ่อย (Troubleshooting & FAQs)](#6-วิธีแก้ปัญหาที่พบบ่อย-troubleshooting--faqs)

---

## 1. แผนผังโครงสร้างระบบ (Architecture Overview)

ระบบ RTSAS ออกแบบให้ส่วน Web App, API Server และ Auth DB ทำงานอยู่ภายใน Docker ทั้งหมด โดยต่อออกไปดึงข้อมูลสัญญาณชีพจากเครื่องแม่ข่าย **HOSxP Database** ภายนอกผ่านเครือข่าย LAN ของโรงพยาบาล:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           เครื่องเซิร์ฟเวอร์ RTSAS                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            DOCKER COMPOSE                             │  │
│  │                                                                       │  │
│  │   ┌────────────────────────┐         ┌────────────────────────────┐   │  │
│  │   │   Frontend (Nginx)     │ ◄─────► │     Backend (FastAPI)      │   │  │
│  │   │      Port: 80          │ (Proxy) │        Port: 8000          │   │  │
│  │   └────────────────────────┘         └──────────────┬─────────────┘   │  │
│  │                                                     │                 │  │
│  │                                                     ▼                 │  │
│  │                                      ┌────────────────────────────┐   │  │
│  │                                      │    Auth DB (MySQL 8.0)     │   │  │
│  │                                      │  Container: rtsas_auth_db  │   │  │
│  │                                      │        Port: 3307          │   │  │
│  │                                      └────────────────────────────┘   │  │
│  │                                                                       │  │
│  │   * มี Volume: auth_db_data เก็บข้อมูลบัญชีผู้ใช้ถาวร                   │  │
│  │   * มี SQLite: timestamp_logs.db บันทึก Action Logs ให้อัตโนมัติ      │  │
│  └─────────────────────────────────────────────────────┼─────────────────┘  │
└────────────────────────────────────────────────────────┼────────────────────┘
                                                         │ เชื่อมต่อผ่าน LAN รพ.
                                                         │ (Port: 3306)
                                                         ▼
                                       ┌──────────────────────────────────┐
                                       │    HOSxP Database Server (รพ.)   │
                                       │   - IP: เช่น 192.168.2.230       │
                                       │   - ฐานข้อมูลผู้ป่วย: hos        │
                                       │   - ฐานเก็บประวัติ: rtsas_dashboard │
                                       └──────────────────────────────────┘
```

---

## 💡 คลายข้อสงสัย: "เปลี่ยนแค่ IP แล้วทุกอย่างจะอยู่ใน Docker เองเลยถูกต้องไหม?"

**คำตอบ:** **"เกือบถูกต้องทั้งหมดครับ! 90% ของระบบอยู่ใน Docker เบ็ดเสร็จ แต่มี 2 จุดสำคัญที่ต้องทราบ"**

เพื่อให้เห็นภาพชัดเจนที่สุด ให้ดูตารางแบ่งหน้าที่นี้:

| รายการ | อยู่ที่ไหน? | ผู้ดูแลต้องทำอะไรบ้าง? |
| :--- | :---: | :--- |
| **1. หน้าเว็บ Web App (React + Nginx)** | 🐳 **ใน Docker** (`rtsas_frontend`) | **ไม่ต้องทำอะไรเลย** ระบบ Build และเปิดพอร์ต `80` ให้เอง |
| **2. ระบบประมวลผล & คำนวณ NEWS (FastAPI)** | 🐳 **ใน Docker** (`rtsas_backend`) | **ไม่ต้องทำอะไรเลย** รัน API และ WebSocket บนพอร์ต `8000` ให้เอง |
| **3. ฐานข้อมูลผู้ใช้งาน & สิทธิ์ (Auth DB MySQL)** | 🐳 **ใน Docker** (`rtsas_auth_db`) | **ไม่ต้องทำอะไรเลย** มี Docker Volume เก็บข้อมูลผู้ใช้ถาวร พอร์ต `3307` |
| **4. ระบบบันทึก Logs การทำงาน (SQLite)** | 🐳 **ใน Docker** (ภายใน Backend) | **ไม่ต้องทำอะไรเลย** จัดเก็บและหมุนเวียนให้อัตโนมัติ |
| **5. การระบุ IP เครื่อง HOSxP** | ⚙️ **ไฟล์ `.env` บนเครื่อง RTSAS** | **👉 ต้องทำ:** แก้ไข `DB_HOST` และ `DASHBOARD_DB_HOST` ให้ตรงกับ IP HOSxP |
| **6. ฐานข้อมูลประวัติการรักษา (`rtsas_dashboard`)** | 🏥 **บน MySQL ของโรงพยาบาล** | **👉 ต้องทำ (ครั้งเดียว):** เข้า MySQL ไปรันคำสั่ง `CREATE DATABASE rtsas_dashboard;` |
| **7. สิทธิ์การเชื่อมต่อข้ามเครื่อง (Firewall & Grant)** | 🏥 **บน Server ของโรงพยาบาล** | **👉 ต้องเช็ค:** เปิดพอร์ต 3306 และอนุญาตให้ User ยิงมาจาก IP เครื่อง RTSAS ได้ |

> [!TIP]
> **สรุปง่ายๆ:**  
> สิ่งที่คุณต้องทำมีเพียงแค่ **(1) สั่งสร้าง Database `rtsas_dashboard` บน Server โรงพยาบาล 1 คำสั่ง** และ **(2) แก้ไข IP ในไฟล์ `.env`** จากนั้นสั่ง `docker compose up -d` แล้วระบบจะจัดการทุกอย่างที่เหลือให้เองทันที!

---

## 2. สิ่งที่ต้องเตรียมล่วงหน้า (Pre-requisites Checklist)

ก่อนเริ่มรันระบบ กรุณาตรวจสอบและเตรียมรายการต่อไปนี้ให้พร้อม:

### ✅ 2.1 สภาพแวดล้อมเครื่องเซิร์ฟเวอร์ RTSAS
- [ ] ติดตั้ง **Docker Engine** (เวอร์ชัน 20.10 ขึ้นไป) และ **Docker Compose** (V2)
- [ ] พอร์ตบนเครื่อง RTSAS ว่างพร้อมใช้งาน:
  - **พอร์ต 80:** สำหรับเข้าใช้งานหน้าเว็บ Web App
  - **พอร์ต 8000:** สำหรับ WebSocket และ REST API
  - **พอร์ต 3307:** สำหรับเข้าดูฐานข้อมูลบัญชีผู้ใช้ภายใน Docker

### ✅ 2.2 การตั้งค่าเครือข่ายและสิทธิ์บน Server HOSxP ของโรงพยาบาล
- [ ] **เครื่อง RTSAS ต้องมองเห็นเครื่อง HOSxP:** อยู่ใน LAN เดียวกันหรือสามารถ Routing ข้ามวงได้
- [ ] **เปิด Firewall พอร์ต 3306:** อนุญาตให้ IP ของเครื่อง RTSAS ยิงเข้ามาหาเครื่อง HOSxP ได้
- [ ] **เตรียม User ที่มีสิทธิ์อ่าน HOSxP:** User ที่มีสิทธิ์ `SELECT` ในตาราง `opdscreen`, `ovst`, `patient`, `er_nursing_detail`, `lab_head`, `lab_order`
- [ ] **สร้าง Database `rtsas_dashboard` เตรียมไว้:** สร้างบน MySQL ของโรงพยาบาล (ดูคำสั่งในขั้นตอนที่ 2)

---

## 3. ขั้นตอนการตั้งค่าและติดตั้งแบบ Step-by-Step (ชัดเจนมากที่สุด)

### ขั้นตอนที่ 1: ตรวจสอบการเชื่อมต่อไปยังเครื่องแม่ข่าย HOSxP
ก่อนจะไปยุ่งกับ Docker ให้เปิด Terminal บนเครื่องเซิร์ฟเวอร์ RTSAS แล้วทดสอบว่ามองเห็นเครื่อง HOSxP หรือไม่:

```bash
# 1. ทดสอบส่ง Ping ไปยัง IP ของ HOSxP (เช่น 192.168.2.230)
ping -c 4 192.168.2.230
```
> หากขึ้น `bytes from 192.168.2.230: icmp_seq=1 ...` แปลว่าเครือข่ายเชื่อมต่อกันได้สำเร็จ ✅

จากนั้นทดสอบว่าพอร์ต MySQL (3306) เปิดให้เข้าถึงได้หรือไม่:
```bash
# ทดสอบด้วย nc (netcat)
nc -zv 192.168.2.230 3306
# หรือทดสอบด้วย telnet
telnet 192.168.2.230 3306
```
> หากขึ้น `Connected` หรือ `succeeded!` แสดงว่า Firewall เปิดแล้วพร้อมใช้งาน ✅

---

### ขั้นตอนที่ 2: สร้าง Database `rtsas_dashboard` บน Server ปลายทาง (ทำเพียงครั้งเดียว)
เข้าโปรแกรมจัดการฐานข้อมูล (เช่น HeidiSQL, Navicat, DBeaver) หรือเข้า Command Line MySQL ของเครื่องเซิร์ฟเวอร์ฐานข้อมูล แล้วรันคำสั่ง SQL ต่อไปนี้:

```sql
-- 1. สร้างฐานข้อมูลสำหรับจัดเก็บสถานะการรักษาและประวัติผู้ป่วย
CREATE DATABASE IF NOT EXISTS rtsas_dashboard 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. อนุญาตสิทธิ์ให้ User (เช่น 'bk') มีสิทธิ์จัดการฐานข้อมูลนี้
GRANT ALL PRIVILEGES ON rtsas_dashboard.* TO 'bk'@'%';

-- 3. อัปเดตสิทธิ์ให้มีผลทันที
FLUSH PRIVILEGES;
```
> *(หมายเหตุ: โครงสร้างตารางและดัชนีทั้งหมดภายใน `rtsas_dashboard` ระบบ Backend ใน Docker จะเป็นผู้สร้างให้อัตโนมัติในครั้งแรกที่สตาร์ตระบบ)*

---

### ขั้นตอนที่ 3: เข้าโฟลเดอร์โปรเจกต์และตั้งค่าไฟล์ `.env`
เปิด Terminal เข้าไปยังโฟลเดอร์ของโปรเจกต์ RTSAS:
```bash
cd /Users/phatchara/Desktop/Hospital
```

เปิดไฟล์ `.env` ขึ้นมาแก้ไขด้วย Text Editor:
```bash
nano .env
```

แก้ไขค่าตัวแปรหลักให้ตรงกับระบบของโรงพยาบาล:
```env
# ═════════════════════════════════════════════════════════════════════════════
# 1. การเชื่อมต่อฐานข้อมูล HOSxP โรงพยาบาล (อ่านสัญญาณชีพและผลแล็บ)
# ═════════════════════════════════════════════════════════════════════════════
DB_HOST=192.168.2.230             # 👈 แก้เป็น IP เครื่องแม่ข่าย HOSxP ของ รพ.
DB_PORT=3306                      # 👈 พอร์ต MySQL (ค่ามาตรฐาน 3306)
DB_USER=bk                        # 👈 Username ที่มีสิทธิ์อ่าน HOSxP
DB_PASSWORD=bk                    # 👈 รหัสผ่านของ User ดังกล่าว
DB_NAME=hos                       # 👈 ชื่อฐานข้อมูลหลักของ รพ. (เช่น hos)
DB_MIN_CONNECTIONS=1
DB_MAX_CONNECTIONS=10

# ═════════════════════════════════════════════════════════════════════════════
# 2. ฐานข้อมูลเก็บประวัติการรักษา (Dashboard Database)
# ═════════════════════════════════════════════════════════════════════════════
DASHBOARD_DB_HOST=192.168.2.230   # 👈 แก้เป็น IP เดียวกับ DB_HOST (หรือเครื่องที่สร้าง rtsas_dashboard)
DASHBOARD_DB_PORT=3306
DASHBOARD_DB_USER=bk              # 👈 User ที่มีสิทธิ์ใน rtsas_dashboard
DASHBOARD_DB_PASSWORD=bk
DASHBOARD_DB_NAME=rtsas_dashboard
DASHBOARD_DB_MIN_CONNECTIONS=1
DASHBOARD_DB_MAX_CONNECTIONS=5

# ═════════════════════════════════════════════════════════════════════════════
# 3. ฐานข้อมูลบัญชีผู้ใช้งานภายใน Docker (ไม่ต้องแก้ ใช้ค่าเดิมได้เลย)
# ═════════════════════════════════════════════════════════════════════════════
AUTH_DB_ROOT_PASSWORD=rtsas_root_password
AUTH_DB_PASSWORD=rtsas_secure_password

# ═════════════════════════════════════════════════════════════════════════════
# 4. กุญแจเข้ารหัส Token ยืนยันตัวตน (JWT)
# ═════════════════════════════════════════════════════════════════════════════
JWT_SECRET=RTSAS_PROD_SECURE_TOKEN_2026_CHANGE_THIS  # 👈 เปลี่ยนเป็นข้อความสุ่มเพื่อความปลอดภัย
JWT_EXPIRE_HOURS=8                                   # 👈 8 ชั่วโมง (ครอบคลุม 1 กะการทำงาน)

# ═════════════════════════════════════════════════════════════════════════════
# 5. โหมดการค้นหาข้อมูลผู้ป่วย
# ═════════════════════════════════════════════════════════════════════════════
# false = Production (แนะนำ): ดึงเฉพาะคนไข้ที่มาตรวจในวันปัจจุบัน
# true  = Dev/Test: หากวันนี้ยังไม่มีคนไข้ ระบบจะดึงวันล่าสุดที่มีข้อมูลมาแสดง
ENABLE_DATE_FALLBACK=false
```
> บันทึกและออกจากโปรแกรม (`Ctrl + O` แล้วกด `Enter` จากนั้นกด `Ctrl + X`)

---

### ขั้นตอนที่ 4: สั่งรันระบบทั้งหมดด้วย Docker Compose
เมื่อตั้งค่าไฟล์ `.env` ครบถ้วนแล้ว รันคำสั่งนี้เพียงคำสั่งเดียว:

```bash
docker compose up -d --build
```

ระบบจะทำการ:
1. ดึง Base Image `mysql:8.0` มาสร้าง Container `rtsas_auth_db` และเตรียม Database ผู้ใช้
2. อ่าน Source Code ใน `backend/` มา Build Image และรัน Container `rtsas_backend`
3. อ่าน Source Code ใน `src/` มา Build โปรเจกต์ React + Vite และใส่เข้าไปใน Nginx รันเป็น Container `rtsas_frontend`


---

## 4. การตรวจสอบความถูกต้องหลังรันระบบ (Verification)

### 4.1 ตรวจสอบสถานะของ Container
รันคำสั่ง:
```bash
docker compose ps
```
**ผลลัพธ์ที่ถูกต้อง:** ทุก Container ต้องมีสถานะเป็น `Up` หรือ `Up (healthy)` ดังนี้:
```text
NAME              IMAGE              COMMAND                  SERVICE      STATUS                    PORTS
rtsas_auth_db     mysql:8.0          "docker-entrypoint.s…"   auth_db      Up (healthy)              0.0.0.0:3307->3306/tcp
rtsas_backend     hospital-backend   "uvicorn backend.mai…"   backend      Up                        0.0.0.0:8000->8000/tcp
rtsas_frontend    hospital-frontend  "/docker-entrypoint.…"   frontend     Up                        0.0.0.0:80->80/tcp
```

---

### 4.2 ตรวจสอบ Log การเชื่อมต่อกับ HOSxP
ดู Log ของ Backend เพื่อดูว่าเชื่อมต่อฐานข้อมูล HOSxP ติดหรือไม่:
```bash
docker compose logs -f backend
```
**สัญญาณว่าเชื่อมต่อสำเร็จ:**
```text
[INFO] Initialized timestamp log DB at .../timestamp_logs.db
[INFO] Successfully connected to HOSxP database pool (192.168.2.230:3306/hos).
[INFO] Successfully connected to Dashboard database pool (rtsas_dashboard).
[INFO] Initialized patient_treatment_status and treated_patient_archive tables.
[INFO] Application startup complete. Uvicorn running on http://0.0.0.0:8000
```
*(กด `Ctrl + C` เพื่อออกจากหน้าดู Log)*

---

### 4.3 เข้าใช้งานระบบผ่านเว็บเบราว์เซอร์
เปิดเบราว์เซอร์ (Google Chrome แนะนำที่สุด) แล้วไปที่:
* **บนเครื่องเซิร์ฟเวอร์เอง:** `http://localhost`
* **จากเครื่องคอมพิวเตอร์อื่นในเครือข่าย รพ.:** `http://<IP-เครื่องเซิร์ฟเวอร์-RTSAS>`

---

## 5. คำสั่ง Docker ที่ใช้งานบ่อย (Useful Commands)

| การดำเนินการ | คำสั่งที่ใช้ |
| :--- | :--- |
| **เริ่มระบบและ Build ใหม่** | `docker compose up -d --build` |
| **ดู Log ของทุก Container** | `docker compose logs -f` |
| **ดู Log เฉพาะ Backend API** | `docker compose logs -f backend` |
| **ดู Log เฉพาะ Web Nginx** | `docker compose logs -f frontend` |
| **รีสตาร์ตระบบทั้งหมด** | `docker compose restart` |
| **รีสตาร์ตเฉพาะ Backend (เช่น หลังแก้ .env)** | `docker compose restart backend` |
| **หยุดการทำงานของระบบ** | `docker compose down` |
| **หยุดและลบข้อมูล Auth DB ใน Volume ทิ้งทั้งหมด** | `docker compose down -v` *(⚠️ ข้อมูลบัญชีจะหาย)* |

---

## 6. วิธีแก้ปัญหาที่พบบ่อย (Troubleshooting & FAQs)

### ❌ ปัญหาที่ 1: Backend ขึ้น Error `(2003, "Can't connect to MySQL server")`
* **สาเหตุ:** Backend ไม่สามารถติดต่อไปยัง IP ของเครื่อง HOSxP ได้
* **วิธีแก้ไข:**
  1. ตรวจสอบว่า IP ใน `DB_HOST` ถูกต้องและเครื่อง RTSAS สามารถ `ping` ไปหา IP นั้นเจอ
  2. ตรวจสอบ Firewall ของเครื่อง HOSxP ว่าเปิดพอร์ต 3306 ให้เครื่อง RTSAS หรือไม่
  3. ตรวจสอบไฟล์ `my.cnf` หรือ `my.ini` บนเครื่อง HOSxP ว่าค่า `bind-address` เป็น `0.0.0.0` หรือไม่ (หากเป็น `127.0.0.1` จะรับการเชื่อมต่อจากเครื่องอื่นไม่ได้)

### ❌ ปัญหาที่ 2: Backend ขึ้น Error `(1045, "Access denied for user...")`
* **สาเหตุ:** Username หรือ Password ของ HOSxP ผิด หรือ User ไม่มีสิทธิ์เชื่อมต่อจาก IP ภายนอก
* **วิธีแก้ไข:**
  1. ตรวจสอบ `DB_USER` และ `DB_PASSWORD` ในไฟล์ `.env`
  2. ตรวจสอบบน MySQL ของ HOSxP ว่า User มี Host เป็น `'%'` หรือระบุ `'192.168.x.x'` ของเครื่อง RTSAS:
     ```sql
     SELECT user, host FROM mysql.user WHERE user = 'bk';
     -- ถ้า host เป็น 'localhost' ต้องรันอนุญาตสิทธิ์:
     GRANT ALL PRIVILEGES ON hos.* TO 'bk'@'%' IDENTIFIED BY 'รหัสผ่าน';
     FLUSH PRIVILEGES;
     ```

### ❌ ปัญหาที่ 3: Backend ขึ้น Error `(1049, "Unknown database 'rtsas_dashboard'")`
* **สาเหตุ:** ยังไม่ได้สร้างฐานข้อมูล `rtsas_dashboard` บน Server ปลายทาง
* **วิธีแก้ไข:**
  เข้าไปที่ MySQL ของเครื่องเป้าหมายแล้วรันคำสั่ง:
  ```sql
  CREATE DATABASE rtsas_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
  จากนั้นสั่ง `docker compose restart backend`

### ❌ ปัญหาที่ 4: พอร์ต 80 หรือ 8000 ชน (Port already in use)
* **สาเหตุ:** มีบริการอื่นในเครื่องใช้งานพอร์ต 80 หรือ 8000 อยู่ก่อนแล้ว (เช่น Apache หรือ Nginx เดิม)
* **วิธีแก้ไข:**
  เปิดไฟล์ `docker-compose.yml` แล้วเปลี่ยนพอร์ตด้านซ้าย เช่น:
  ```yaml
  ports:
    - "8080:80"   # เข้าเว็บผ่าน http://localhost:8080 แทน
  ```
