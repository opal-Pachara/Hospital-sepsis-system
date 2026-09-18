# 🧹 คู่มือการเคลียร์และลบข้อมูลในระบบฐานข้อมูล SQLite
> **RTSAS (Real-Time Sepsis Alert System)**  
> เอกสารแนะนำวิธีการล้างข้อมูลในไฟล์ `rtsas_local.db` และ `timestamp_logs.db` ทั้งบนเครื่อง Host (เครื่องพัฒนา/เซิร์ฟเวอร์) และภายใน Docker Container

---

## 📍 1. ตำแหน่งของไฟล์ในระบบ (File Locations)

เนื่องจากระบบ RTSAS สามารถรันได้ทั้งแบบ Local และผ่าน Docker Compose ข้อมูลจึงอาจมีตัวตนอยู่ใน 2 สถานที่:

| สถานที่ | ที่อยู่ไฟล์ (Path) | คำอธิบาย |
| :--- | :--- | :--- |
| **1. บนเครื่องเซิร์ฟเวอร์ / Host** | `/Users/phatchara/Desktop/Hospital/backend/data/` | ไฟล์บนโฟลเดอร์โปรเจกต์ของเครื่อง Host |
| **2. ภายใน Docker Container** | `/app/backend/data/` (ใน Container `rtsas_backend`) | ไฟล์ที่กำลังถูกใช้งานโดยระบบที่รันอยู่ใน Docker |

### ข้อมูลเบื้องต้นของแต่ละไฟล์:
* **`timestamp_logs.db`**: ฐานข้อมูล SQLite ที่บันทึก System Action Logs ทั้งหมด (HOSxP polling, การแจ้งเตือน, การกดรับทราบ) หากลบไฟล์นี้ทิ้ง ระบบ Backend จะสร้างไฟล์ใหม่และตารางเปล่าให้อัตโนมัติทันทีที่มีบันทึกใหม่
* **`rtsas_local.db`**: ฐานข้อมูล SQLite ทดสอบออฟไลน์ดั้งเดิม (ปัจจุบันระบบ Production ใช้ MySQL `rtsas_dashboard` แทนแล้ว) สามารถลบทิ้งได้อย่างปลอดภัย 100%

---

## 💻 2. คุณสามารถรันคำสั่งได้ที่ไหนบ้าง?

1. **Terminal ของเครื่อง Host (macOS / Linux):** สำหรับจัดการไฟล์ที่อยู่ในเครื่องคอมพิวเตอร์ของคุณ
2. **Terminal ผ่านคำสั่ง `docker exec`:** สำหรับจัดการไฟล์ที่อยู่ภายใน Docker Container ที่กำลังทำงานอยู่
3. **เรียกผ่าน REST API (cURL / Postman / Browser):** สำหรับเคลียร์ Logs ผ่าน Service API โดยไม่ต้องยุ่งกับไฟล์

---

## 🛠️ 3. วิธีการล้างข้อมูล (เลือกตามความต้องการ)

### วิธีที่ 1: ลบไฟล์ฐานข้อมูลทิ้งเกลี้ยง 100% (แนะนำที่สุด สะอาดหมดจด)

วิธีนี้รวดเร็ว ปลอดภัย และได้พื้นที่คืนทันที ระบบจะสร้างไฟล์ใหม่ที่เป็นตารางว่างขึ้นมาให้อัตโนมัติเมื่อเริ่มทำงาน

#### 1.1 รันบน Terminal ของเครื่องคุณ (Host):
```bash
cd /Users/phatchara/Desktop/Hospital

# ลบไฟล์ SQLite ทั้ง 2 ไฟล์
rm -f backend/data/rtsas_local.db
rm -f backend/data/timestamp_logs.db
```

#### 1.2 รันส่งเข้าไปใน Docker Container (กรณีที่เปิด Docker อยู่):
```bash
# ลบไฟล์ทั้งสองที่อยู่ข้างใน Container rtsas_backend
docker exec rtsas_backend rm -f /app/backend/data/rtsas_local.db
docker exec rtsas_backend rm -f /app/backend/data/timestamp_logs.db

# สั่ง Restart Backend สั้นๆ 1 ครั้งเพื่อให้ระบบ Initialize ฐานข้อมูลเปล่าใหม่
docker compose restart backend
```

---

### วิธีที่ 2: เคลียร์เฉพาะข้อมูลในตาราง (เก็บโครงสร้างตารางเดิมไว้)

วิธีนี้จะไม่ลบตัวไฟล์ทิ้ง แต่จะทำการรันคำสั่ง SQL `DELETE FROM` ข้อมูลทิ้งจนหมด และสั่ง `VACUUM` เพื่อบีบอัดขนาดไฟล์คืนพื้นที่

#### 2.1 รันบน Terminal ของเครื่องคุณ (Host):
```bash
cd /Users/phatchara/Desktop/Hospital

# เคลียร์ Logs ใน timestamp_logs.db
sqlite3 backend/data/timestamp_logs.db "DELETE FROM timestamp_logs; VACUUM;"

# เคลียร์ข้อมูลใน rtsas_local.db
sqlite3 backend/data/rtsas_local.db "DELETE FROM patient_treatment_status; DELETE FROM patient_vitals_cache; DELETE FROM system_timestamp_logs; VACUUM;"
```

#### 2.2 รันส่งเข้าไปใน Docker Container:
```bash
# เคลียร์ Logs ใน Docker
docker exec rtsas_backend sqlite3 /app/backend/data/timestamp_logs.db "DELETE FROM timestamp_logs; VACUUM;"

# เคลียร์ข้อมูลใน rtsas_local.db ใน Docker
docker exec rtsas_backend sqlite3 /app/backend/data/rtsas_local.db "DELETE FROM patient_treatment_status; DELETE FROM patient_vitals_cache; DELETE FROM system_timestamp_logs; VACUUM;"
```

---

### วิธีที่ 3: เคลียร์ข้อมูลผ่าน REST API (สะดวกที่สุด ไม่ต้องเข้าถึงไฟล์)

การเคลียร์ผ่าน API มีข้อดีคือ **ระบบจะบันทึกสถานะและทำงานอย่างปลอดภัยทันที** สามารถทำได้หลายวิธีดังนี้:

#### 3.1 วิธีที่ง่ายที่สุด: ทำผ่าน Swagger UI บนเบราว์เซอร์ (ไม่ต้องพิมพ์คำสั่ง)
1. เปิดเบราว์เซอร์ไปที่: **`http://localhost:8000/docs`** (หรือ IP ของเครื่องเซิร์ฟเวอร์ เช่น `http://192.168.x.x:8000/docs`)
2. เลื่อนหาหัวข้อหรือแถบ **`POST /api/system/logs/clear`** (หรือ `DELETE /api/system/logs`)
3. คลิกเปิดแถบ แล้วกดปุ่ม **"Try it out"** (มุมขวาบนของแถบ)
4. กดปุ่มสีน้ำเงิน **"Execute"**
5. เลื่อนดูด้านล่างในช่อง **Responses** จะเห็นผลลัพธ์ Code 200:
   ```json
   {
     "success": true,
     "cleared_count": 41
   }
   ```

#### 3.2 ทำผ่าน Terminal ด้วยคำสั่ง `curl`
เปิด Terminal บน macOS, Linux หรือ Command Prompt / PowerShell บน Windows แล้วรัน:

```bash
# 1. เคลียร์ System Action Logs ทั้งหมดใน timestamp_logs.db
curl -X POST http://localhost:8000/api/system/logs/clear

# หรือเรียกผ่านพอร์ต 80 ของ Nginx (ถ้าเข้าผ่านหน้าเว็บปกติ)
curl -X POST http://localhost/api/system/logs/clear
```

#### 3.3 API เส้นอื่นๆ สำหรับเคลียร์ข้อมูลผู้ป่วยและแดชบอร์ด (แถมให้สำหรับ Admin):
นอกจาก Logs แล้ว ระบบยังมี API สำหรับล้างสถานะผู้ป่วยสำหรับการเริ่มต้นรอบใหม่:
```bash
# เคลียร์/รีเซ็ตสถานะผู้ป่วยที่ผ่านการรักษาแล้ว (Reset แดชบอร์ดเป็น 0)
curl -X POST http://localhost:8000/api/admin/reset-dashboard

# เคลียร์เฉพาะประวัติผู้ป่วยที่รักษาเสร็จสิ้นแล้ว
curl -X POST http://localhost:8000/api/treatment-status/clear-treated
```

---

## ⚡ 4. คำสั่ง One-Liner (คำสั่งบรรทัดเดียวล้างทุกที่พร้อมกัน)

หากต้องการล้างทั้งบนเครื่อง Host และใน Docker พร้อมทั้งรีสตาร์ตระบบให้ใหม่เอี่ยมทันที สามารถ Copy คำสั่งนี้ไปวางใน Terminal ได้เลย:

```bash
cd /Users/phatchara/Desktop/Hospital && rm -f backend/data/rtsas_local.db backend/data/timestamp_logs.db && docker exec rtsas_backend rm -f /app/backend/data/rtsas_local.db /app/backend/data/timestamp_logs.db && docker compose restart backend
```

---

## ✅ 5. การตรวจสอบความถูกต้องหลังเคลียร์ข้อมูล (Verification)

1. **ตรวจสอบไฟล์บนเครื่อง Host:**
   ```bash
   ls -la backend/data/
   ```
   *ผลลัพธ์: จะไม่พบไฟล์ `rtsas_local.db` หรือขนาดไฟล์ `timestamp_logs.db` จะถูกรีเซ็ตใหม่*

2. **ตรวจสอบภายใน Docker Container:**
   ```bash
   docker exec rtsas_backend ls -la /app/backend/data/
   ```

3. **ตรวจสอบผ่านหน้าเว็บ:**
   - เข้าหน้าเว็บ `http://localhost/admin`
   - ดูที่แถบ **System Diagnostic Logs** หรือ **Database Status** จะเห็นจำนวน Logs รีเซ็ตเริ่มต้นใหม่เป็น 0

---

## 📊 6. ทำไมลบ `rtsas_local.db` และ `timestamp_logs.db` แล้วข้อมูลใน Dashboard ยังไม่หาย?

### คำตอบ: ข้อมูลใน Dashboard ไม่ได้อยู่ในไฟล์ SQLite 2 ไฟล์นี้!

ไฟล์ `rtsas_local.db` และ `timestamp_logs.db` เป็นเพียงฐานข้อมูลเก็บ **System Action Logs (บันทึกการทำงานของระบบ)** เท่านั้น

ข้อมูลผู้ป่วยและการรักษาใน Dashboard ถูกเก็บอยู่ใน **3 แหล่งจริง** ดังนี้:

| แหล่งข้อมูล | ตำแหน่งจัดเก็บ | ข้อมูลที่เก็บ |
| :--- | :--- | :--- |
| **1. MySQL `rtsas_dashboard`** | MySQL Server (พอร์ต 3306) | ตาราง `treated_patient_archive` (เคสที่รักษาแล้ว) และ `patient_treatment_status` (สถานะการรักษา) |
| **2. MySQL `sepsis_db` / HOSxP** | MySQL Server (พอร์ต 3306) | ตาราง `patient_visits` หรือ `opdscreen` (ข้อมูลสัญญาณชีพดิบของผู้ป่วย) |
| **3. Browser LocalStorage** | แคชในเว็บเบราว์เซอร์ของคุณ | คีย์ `rtsas-storage` บันทึกสถานะ Checklist และตัวนับถอยหลังไว้ในเครื่อง Client เพื่อไม่ให้หายเวลารีเฟรช |

### 🧹 วิธีลบ/รีเซ็ตข้อมูลใน Dashboard ให้กลายเป็น 0 หมดเกลี้ยง:

#### ขั้นที่ 1: ล้างข้อมูลใน MySQL ผ่าน API (1 วินาทีเสร็จ)
```bash
curl -X POST http://localhost:8000/api/admin/reset-dashboard
```
> *(หรือเข้า Swagger: `http://localhost:8000/docs` -> หมวด `System Reset & Maintenance` -> เลือก `POST /api/admin/reset-dashboard` -> Try it out -> Execute)*  
> คำสั่งนี้จะล้างทั้งตาราง `treated_patient_archive` และ `patient_treatment_status` ให้เกลี้ยงทันที!

#### ขั้นที่ 2: เคลียร์แคช LocalStorage บนเว็บเบราว์เซอร์
- บนหน้าเว็บเบราว์เซอร์ ให้กดปุ่ม `F12` (หรือ `Cmd + Option + I` บน Mac)
- ไปที่แท็บ **Application** -> เมนูด้านซ้ายเลือก **Storage** หรือ **Local Storage**
- กดปุ่ม **Clear site data** (หรือกดปุ่มลัด `Cmd + Shift + R` บน Mac เพื่อ Hard Refresh ล้างแคชหน้าเว็บ)

