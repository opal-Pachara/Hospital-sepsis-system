# 🚀 คู่มือการติดตั้ง เชื่อมต่อ HOSxP และรันระบบ RTSAS ผ่าน Docker
> **Real-Time Sepsis Alert System (RTSAS)** — ระบบเฝ้าระวัง คัดกรอง และแจ้งเตือนภาวะ Sepsis แบบเรียลไทม์  
> เอกสารนี้จัดทำขึ้นสำหรับ **เจ้าหน้าที่ IT, System Administrator, และ Developer** เพื่อใช้ในการติดตั้งระบบขึ้นใช้งานจริง (Production) หรือจำลองทดสอบ (Staging/Dev)

---

> [!IMPORTANT]
> ## ⚡ ศูนย์รวมทุกคำสั่งในการดูแลและจัดการระบบ RTSAS (Master Command Cheat Sheet)
> **เอกสารรวบรวมคำสั่งทั้งหมดที่จำเป็นสำหรับการ Deploy, ควบคุมการทำงาน, ตรวจสอบ, ดู Logs และเคลียร์ข้อมูลระบบ ทั้งฝั่ง Docker และ Local:**

### 1. 🚀 คำสั่งควบคุมระบบ Docker (Lifecycle & Service Management)
| การทำงาน | คำสั่ง Terminal | คำอธิบาย |
|---|---|---|
| **เริ่มระบบและ Build ใหม่** | `docker compose up -d --build` | สั่ง Build โค้ดใหม่ทั้งหมดและรันเป็น Background Services |
| **เริ่มระบบปกติ (ไม่ Rebuild)** | `docker compose up -d` | สตาร์ต Containers ทั้งหมดตาม Image ที่มีอยู่ |
| **หยุดการทำงานระบบทั้งหมด** | `docker compose down` | หยุดและลบ Containers แต่คงรักษา Volume ข้อมูลไว้ |
| **หยุดระบบและล้าง Volume ทั้งหมด** | `docker compose down -v` | ⚠️ ลบ Container + ล้าง Volume (บัญชีผู้ใช้ Auth DB จะหาย) |
| **รีสตาร์ตระบบทั้งหมด** | `docker compose restart` | สั่ง Restart ทุก Service ใน `docker-compose.yml` |
| **รีสตาร์ตเฉพาะ Backend** | `docker compose restart backend` | ใช้เมื่อแก้ไขคอนฟิก `.env` หรืออัปเดตโค้ด Backend |
| **รีสตาร์ตเฉพาะ Frontend** | `docker compose restart frontend` | ใช้เมื่อต้องการให้ Nginx โหลดคอนฟิกใหม่ |
| **รีสตาร์ตเฉพาะ Auth DB** | `docker compose restart auth_db` | สั่ง Restart ฐานข้อมูลบัญชีผู้ใช้งานระบบ |
| **ตรวจสอบสถานะ Container** | `docker compose ps` | แสดงตารางสถานะ Ports และ Health ของแต่ละ Service |

---

### 2. 📊 คำสั่งดู Logs และตรวจสอบสถานะระบบ (Logging & Monitoring)
| การทำงาน | คำสั่ง Terminal | คำอธิบาย |
|---|---|---|
| **ดู Log สดทุก Container** | `docker compose logs -f` | ติดตาม Stream Logs รวมทุก Service แบบ Real-time |
| **ดู Log Backend สด** | `docker compose logs -f backend` | ตรวจสอบการเชื่อมต่อ HOSxP, Scheduler, และคำนวณ NEWS |
| **ดู Log Backend ย้อนหลัง 100 บรรทัด** | `docker compose logs --tail=100 -f backend` | ดูย้อนหลัง 100 บรรทัดล่าสุดแล้วสตรีมต่อ |
| **ดู Log Frontend (Nginx)** | `docker compose logs -f frontend` | ตรวจสอบ HTTP Access Log และการ Proxy Requests |
| **ดู Log Auth DB (MySQL)** | `docker compose logs -f auth_db` | ตรวจสอบการเชื่อมต่อและ Query ของฐานข้อมูลบัญชี |
| **ทดสอบ Health Check API** | `curl -s http://localhost:8000/health` | ตรวจสอบสถานะ Backend, MySQL Pool และ Cache Stats |
| **ทดสอบดึงข้อมูลคนไข้วันนี้** | `curl -s http://localhost:8000/api/patients` | ดึง JSON รายชื่อคนไข้และผลคะแนน NEWS ล่าสุด |

---

### 3. 🧹 คำสั่งเคลียร์ Dashboard, แคช และ Logs ข้อมูล (Cleanup & Reset)

#### 🔹 ผ่าน REST API (แนะนำและปลอดภัยที่สุด — ใช้ได้ทั้ง Docker และ Local)
| การทำงาน | คำสั่ง cURL Terminal | ผลลัพธ์ |
|---|---|---|
| **เคลียร์ Dashboard ทั้งหมด** | `curl -X POST http://localhost:8000/api/admin/reset-dashboard` | ล้างผู้ป่วย active, เคลียร์ cache, ล้างสถานะรักษา คืนจอว่าง |
| **เคลียร์เฉพาะเคสที่รักษาจบแล้ว** | `curl -X POST http://localhost:8000/api/admin/clear-treated` | ลบประวัติใน Treated Dashboard ทั้งหมด |
| **เคลียร์ Logs ทั้งหมด** | `curl -X POST http://localhost:8000/api/admin/clear-logs` | ลบตาราง Logs และ Timestamp Action Logs ทั้งหมด |
| **เคลียร์ Cache สัญญาณชีพ** | `curl -X POST http://localhost:8000/api/admin/clear-cache` | ล้างแคชสัญญาณชีพ (คงข้อมูลเคสที่กำลังรักษาไว้) |

#### 🔹 ระดับ Docker Container
- **เคลียร์ SQLite DB + Cache ภายใน Container (One-Liner):**
  ```bash
  docker exec rtsas_backend sh -c "rm -f /app/backend/data/*.db* /app/backend/data/*.json" && docker compose restart backend
  ```
- **เคลียร์ตารางสถานะการรักษาใน MySQL (`rtsas_dashboard`):**
  ```bash
  docker exec -i rtsas_auth_db mysql -uroot -p12345678 -e "
    TRUNCATE TABLE rtsas_dashboard.patient_treatment_status;
    TRUNCATE TABLE rtsas_dashboard.treated_patient_archive;
  "
  ```
- **เคลียร์ Container Logs ของ Docker ทั้งหมด:**
  ```bash
  docker compose down && docker compose up -d
  ```

#### 🔹 ระดับ Local (เมื่อรันบนเครื่องโดยตรง)
- **ลบไฟล์ฐานข้อมูล SQLite และ JSON แคช:**
  ```bash
  rm -f backend/data/*.db* backend/data/*.json
  ```
- **ล้างตารางสถานะการรักษาใน MySQL Local:**
  ```bash
  mysql -h 127.0.0.1 -P 3306 -u root -p12345678 -e "
    TRUNCATE TABLE rtsas_dashboard.patient_treatment_status;
    TRUNCATE TABLE rtsas_dashboard.treated_patient_archive;
  "
  ```

#### 🔹 ระดับ Frontend Web Browser
- **ล้าง Offline Storage (Zustand Cache) ในเบราว์เซอร์:**
  กด `F12` ➔ แท็บ **Console** ➔ พิมพ์คำสั่ง:
  ```javascript
  localStorage.clear(); location.reload();
  ```
  *(หรือไปที่เมนู **Admin Panel** ➔ แท็บ **"จัดการความจำระบบ"** ➔ กด **"ล้างความจำผู้ป่วยทั้งหมด"**)*

📖 *ดูคู่มือการจัดการและโครงสร้างฐานข้อมูลฉบับเต็มได้ที่:* [DATABASE_CLEANUP_GUIDE.md](file:///Users/phatchara/Desktop/Hospital/DATABASE_CLEANUP_GUIDE.md)

---

### 4. 🛠️ คำสั่งเข้าถึง Container และจัดการฐานข้อมูล (Container Shell & Exec)
| การทำงาน | คำสั่ง Terminal | คำอธิบาย |
|---|---|---|
| **เข้า Shell ภายใน Backend** | `docker exec -it rtsas_backend sh` | เปิด Terminal ข้างใน Backend Container |
| **เข้า MySQL Prompt (User ธรรมดา)** | `docker exec -it rtsas_auth_db mysql -urtsas -prtsas rtsas_auth` | เข้าฐานข้อมูล `rtsas_auth` ด้วย User ประจำระบบ |
| **เข้า MySQL Prompt (Root Admin)** | `docker exec -it rtsas_auth_db mysql -uroot -p12345678` | เข้าสิทธิ์ Root เพื่อจัดการและตรวจสอบทุก Database |
| **Copy ไฟล์เข้า Container** | `docker cp <local-path> rtsas_backend:<target-path>` | คัดลอกไฟล์จากเครื่องคอมพิวเตอร์เข้า Container |
| **Copy ไฟล์ออกจาก Container** | `docker cp rtsas_backend:<source-path> <local-path>` | คัดลอกไฟล์จาก Container ออกมายังเครื่องคอมพิวเตอร์ |

---

### 5. 💻 คำสั่งสำหรับพัฒนาแบบ Local (Local Development)
| การทำงาน | คำสั่ง Terminal | คำอธิบาย |
|---|---|---|
| **รัน Frontend Dev Server** | `npm run dev` | เปิดเซิร์ฟเวอร์ทดสอบหน้าเว็บ (Vite พอร์ต 5173) |
| **รัน Frontend Unit Tests** | `npm test` | รันชุดทดสอบ Vitest ตรวจสอบการทำงานทุกโมดูล (127 tests) |
| **ทดสอบ Build Frontend** | `npm run build` | ตรวจสอบ Typecheck และสร้าง Bundle สำหรับ Production |
| **รัน Backend FastAPI Local** | `uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload` | รัน API Server พอร์ต 8000 พร้อม Auto-reload เมื่อเซฟโค้ด |
| **ติดตั้ง Python Dependencies** | `pip install -r backend/requirements.txt` | ติดตั้งแพ็กเกจไลบรารีที่จำเป็นสำหรับ Backend |
| **ติดตั้ง Node Dependencies** | `npm install` | ติดตั้งแพ็กเกจ Node Modules สำหรับ Frontend |

---

### 6. 🧼 คำสั่งล้างขยะและเคลียร์พื้นที่ Docker (Docker Prune)
| การทำงาน | คำสั่ง Terminal | คำอธิบาย |
|---|---|---|
| **ล้าง Containers/Networks ค้าง** | `docker system prune -f` | ลบ Dangling Resources ที่ไม่ได้ใช้งานเพื่อคืนพื้นที่ Harddisk |
| **ล้าง Images และ Build Cache ทั้งหมด** | `docker system prune -a --volumes -f` | ⚠️ เคลียร์พื้นที่เกลี้ยงทุกอย่าง คืนพื้นที่ Disk สูงสุด |
| **ตรวจสอบการใช้งานพื้นที่ Disk ของ Docker** | `docker system df` | แสดงสรุปขนาดพื้นที่ที่ Images, Containers, Volumes ใช้งาน |

---

> [!CAUTION]
> ### 🛑 ข้อกำหนดเรื่องโมดูลที่เสร็จสมบูรณ์ 100% (Strictly Locked Modules)
> **โมดูลในรายการด้านล่างนี้ได้รับการพัฒนา ตรวจสอบความถูกต้อง ทดสอบ Unit Tests ผ่านครบ 100% (127/127 tests) และผ่านการยืนยันการใช้งานจริงทางคลินิกเรียบร้อยแล้ว ห้ามทำการดัดแปลง แก้ไข ลบ หรือเขียนทับโค้ดในส่วนเหล่านี้อีกโดยเด็ดขาด การแก้ไขโมดูลเหล่านี้อาจทำให้กระบวนการกู้ชีพ Sepsis (60-minute Bundle) และระบบ Real-time Synchronization ผิดพลาด:**
>
> | โมดูล / ไฟล์ | สถานะ | รายละเอียดการทำงานที่สมบูรณ์แล้ว (ห้ามแก้ไขเด็ดขาด) |
> |---|:---:|---|
> | **[`src/components/layout/Sidebar.tsx`](file:///Users/phatchara/Desktop/Hospital/src/components/layout/Sidebar.tsx)** | 🔒 **LOCKED** | • แสดงรายชื่อผู้ป่วย ER เรียงตามความเสี่ยง NEWS<br>• มี Badge จับเวลานับถอยหลัง 60 นาทีแบบ Real-time<br>• ระบบ Auto-refresh ทุก 10 วินาทีแบบ Background โดยไม่รบกวนหน้าจอรักษา<br>• ปุ่ม "🔄 ดึงข้อมูล" อัปเดตรายชื่อผู้ป่วยโดยไม่รีเฟรชทั้งเว็บ<br>• คลิกการ์ดผู้ป่วยแล้วเปิดเคสเสมอ ไม่หลุดไปหน้าว่าง (`EmptyState`) |
> | **[`vite.config.ts`](file:///Users/phatchara/Desktop/Hospital/vite.config.ts)** | 🔒 **LOCKED** | • ตั้งค่า `server.watch.ignored` ข้ามโฟลเดอร์ `backend/**`, `.db`, `.sqlite`, `.log`<br>• ป้องกันปัญหา Vite สั่ง Page Reload ทั้งแท็บ (F5) เมื่อ Backend มีการบันทึกข้อมูล |
> | **[`src/App.tsx`](file:///Users/phatchara/Desktop/Hospital/src/App.tsx)** | 🔒 **LOCKED** | • ปรับใช้ Fine-grained Selectors ป้องกัน Full-page re-render เมื่อข้อมูลคนไข้รายอื่นอัปเดต<br>• แยกระบบมุมมอง Dashboard, Treated Dashboard และ Admin Panel อย่างสมบูรณ์ |
> | **[`src/store/useRTSASStore.ts`](file:///Users/phatchara/Desktop/Hospital/src/store/useRTSASStore.ts)** | 🔒 **LOCKED** | • Centralized Treatment Synchronization รองรับการทำงานร่วมกันแบบ Multi-client<br>• ตรรกะ Checklist ปลดล็อค Phase 1 ➔ 2 ➔ 3 ➔ 4 อย่างถูกต้องตามมาตรฐานคลินิก<br>• การ Rule Out Sepsis คลิกเดียวจบ เคลียร์ countdownTimer และไม่เด้งกลับมาถามซ้ำ<br>• ป้องกันสถานะ countdown_started_at เก่ามาทับสถานะ Rule Out (`!status.sepsis_ruled_out`)<br>• LocalStorage Persistence บันทึกทั้ง `selectedPatient`, `checklist`, `patientData` |
> | **[`src/components/panels/ChecklistPanel.tsx`](file:///Users/phatchara/Desktop/Hospital/src/components/panels/ChecklistPanel.tsx)** | 🔒 **LOCKED** | • Phase 1: การประเมินเบื้องต้น (ลงทะเบียน, พยาบาลประเมินซ้ำ, รายงานแพทย์)<br>• Phase 2: แพทย์เวรยืนยันติดเชื้อ หรือกด Rule Out แบบคลิกเดียวจบ (1-Click Execution) จบกระบวนการทันที ไม่เด้งกล่องถามซ้ำ และปุ่มไม่เด้งกลับมาอีกหลังบันทึก<br>• Phase 3: Sepsis Bundle (Hemoculture, IV Fluid, Antibiotics, Lactate)<br>• Phase 4: ตารางบันทึกการประเมินสัญญาณชีพซ้ำ (Q15 x 4, Q30) |
> | **[`src/components/modals/AlertModal.tsx`](file:///Users/phatchara/Desktop/Hospital/src/components/modals/AlertModal.tsx)** & **[`MultiAlertModal.tsx`](file:///Users/phatchara/Desktop/Hospital/src/components/modals/MultiAlertModal.tsx)** | 🔒 **LOCKED** | • ป๊อปอัปแจ้งเตือนฉุกเฉินเมื่อผู้ป่วยมีคะแนน NEWS ≥ 5<br>• กด "รับทราบ" แล้วเริ่มนับเวลา 60 นาทีทันทีโดยไม่ข้ามขั้นตอน Phase 1<br>• รองรับระบบคิวแจ้งเตือนหลายคนไข้พร้อมกัน (Alert Queue) |
> | **[`src/components/modals/AssessmentFormModal.tsx`](file:///Users/phatchara/Desktop/Hospital/src/components/modals/AssessmentFormModal.tsx)** | 🔒 **LOCKED** | • บันทึกสัญญาณชีพซ้ำ 6 ช่องครบถ้วนตามรอบการประเมิน<br>• ปุ่ม "รักษาเสร็จแล้ว" จบการรักษา Timestamp ทันที ปิดเวลา 60 นาที และย้ายเคสไป Treated Dashboard อย่างถูกต้อง |
> | **[`src/pages/TreatedDashboard.tsx`](file:///Users/phatchara/Desktop/Hospital/src/pages/TreatedDashboard.tsx)** | 🔒 **LOCKED** | • แดชบอร์ดสรุปเคสที่จบการรักษาแล้วย้อนหลัง 14 วัน<br>• สรุปอัตรา Bundle Compliance Rate และสถิติภาพรวม<br>• ดูประวัติ Timeline ย้อนหลังในโหมดอ่านอย่างเดียว (Locked Historical Archive) |
> | **[`backend/scheduler.py`](file:///Users/phatchara/Desktop/Hospital/backend/scheduler.py)** | 🔒 **LOCKED** | • ตรวจจับสัญญาณชีพใหม่จากฐานข้อมูล HOSxP ทุก 10 วินาที<br>• คำนวณคะแนน NEWS และส่งแจ้งเตือนผ่าน WebSocket `/ws/alerts` ทันที<br>• มี Guard ตรวจสอบ `treatment_completed` ไม่ส่งสัญญาณแจ้งเตือนหรือเปิดเคสซ้ำซ้อน |
> | **[`backend/treatment_service.py`](file:///Users/phatchara/Desktop/Hospital/backend/treatment_service.py)** | 🔒 **LOCKED** | • บันทึกและดึงสถานะการรักษาส่วนกลาง (`patient_treatment_status`)<br>• ฟังก์ชัน `rule_out_sepsis` เคลียร์ `doctor_confirmed = 0` และ `countdown_started_at = NULL` ในฐานข้อมูล เพื่อไม่ให้เวลาหรือปุ่มยืนยันค้าง<br>• ระบบจัดเก็บแฟ้มประวัติผู้ป่วยที่รักษาแล้ว (`treated_patient_archive`) |

---

## 📑 สารบัญ
- [⚡ รวมทุกคำสั่งในการดูแลและจัดการระบบ (Master Command Cheat Sheet)](#-ศูนย์รวมทุกคำสั่งในการดูแลและจัดการระบบ-rtsas-master-command-cheat-sheet)
- [🛑 ข้อกำหนดเรื่องโมดูลที่เสร็จสมบูรณ์ 100% (ห้ามแก้ไขเด็ดขาด)](#-ข้อกำหนดเรื่องโมดูลที่เสร็จสมบูรณ์-100-strictly-locked-modules)
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
