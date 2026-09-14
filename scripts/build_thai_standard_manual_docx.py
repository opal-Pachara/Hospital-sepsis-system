#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_thai_standard_manual_docx.py
=============================================================================
Comprehensive User & Clinical Operations Manual Builder (.docx)
Real-Time Sepsis Alert System (RTSAS) — โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา

Standards Compliant:
- Font: TH Sarabun New (16pt body, 18pt heading, 20-24pt titles, 14pt captions)
- Layout: Thai University / Institutional Report Standard
- Cover Page: NO Logos, NO Personal Names (Institutional Attribution Only)
- Running Footer: Top-bordered rule with system title
- Table of Contents & List of Figures: Tab stops with Dotted Leaders (WD_TAB_LEADER.DOTS)
- Exhaustive Functional Coverage:
  1. User Roles & Access Control (Doctor, Nurse, IT Admin)
  2. Main Dashboard & Clinical Ergonomics
  3. Triage Queue & Sidebar Filtering
  4. Patient Detail, Chief Complaint Text-Wrap & 6 Vitals Grid
  5. Emergency Alert System (Single & Multi-Alert Modals, Smart Dismissal)
  6. Sepsis Bundle Checklist & Doctor Decisions (Confirm vs Rule Out)
  7. Vital Signs Reassessment Schedule (Q15 x 4 rounds, Q30 onwards, Reminder Alarm, Assessment Form)
  8. End of Treatment & Discharge System
  9. Clinical Timeline & HIS Copy (HOSxP Integration)
  10. Treated Cases Dashboard & KPI Audit
  11. IT Admin Panel & Safe Cache Management
  12. Master Button & Control Reference Directory
=============================================================================
"""

import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

DOCS_DIR = "/Users/phatchara/Desktop/Hospital/docs"
IMAGES_DIR = os.path.join(DOCS_DIR, "images/manual")
OUTPUT_DOCX_DOCS = os.path.join(DOCS_DIR, "RTSAS_User_Manual.docx")
OUTPUT_DOCX_DESKTOP = "/Users/phatchara/Desktop/RTSAS_User_Manual.docx"

FONT_NAME = "TH Sarabun New"
COLOR_BLACK = RGBColor(0, 0, 0)
COLOR_GRAY = RGBColor(80, 80, 80)
FOOTER_TEXT = "คู่มือการใช้งานระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (RTSAS)"

def set_run_font(run, size_pt=16, bold=False, italic=False, color=COLOR_BLACK):
    run.font.name = FONT_NAME
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), FONT_NAME)
    rFonts.set(qn('w:hAnsi'), FONT_NAME)
    rFonts.set(qn('w:cs'), FONT_NAME)
    rPr.append(rFonts)

def add_p(doc, text="", size_pt=16, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT,
          space_before=0, space_after=4, line_spacing=1.15, first_indent=0):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    if first_indent > 0:
        p.paragraph_format.first_line_indent = Inches(first_indent)
    if text:
        run = p.add_run(text)
        set_run_font(run, size_pt=size_pt, bold=bold, italic=italic)
    return p

def add_toc_line(doc, title, page_str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.tab_stops.add_tab_stop(Inches(6.2), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    
    r_title = p.add_run(title)
    set_run_font(r_title, size_pt=15)
    
    r_tab = p.add_run('\t')
    set_run_font(r_tab, size_pt=15)
    
    r_page = p.add_run(page_str)
    set_run_font(r_page, size_pt=15)
    return p

def add_image_figure(doc, img_filename, fig_caption, width_inches=5.6):
    img_path = os.path.join(IMAGES_DIR, img_filename)
    if not os.path.exists(img_path):
        print(f"Warning: image not found {img_path}")
        return
        
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(8)
    p_img.paragraph_format.space_after = Pt(2)
    p_img.paragraph_format.keep_with_next = True
    
    run_img = p_img.add_run()
    run_img.add_picture(img_path, width=Inches(width_inches))
    
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(2)
    p_cap.paragraph_format.space_after = Pt(10)
    run_cap = p_cap.add_run(fig_caption)
    set_run_font(run_cap, size_pt=14, bold=True)

def setup_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(0)
    
    pBdr = parse_xml(r'''
        <w:pBdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:top w:val="single" w:sz="6" w:space="4" w:color="000000"/>
        </w:pBdr>
    ''')
    p._p.get_or_add_pPr().append(pBdr)
    run = p.add_run(FOOTER_TEXT)
    set_run_font(run, size_pt=12, color=COLOR_BLACK)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:val="clear" w:color="auto" w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def generate_manual():
    doc = Document()
    
    # ---------------------------------------------------------------------------
    # Page Setup (A4 Margins: Top 1", Bottom 1", Left 1.25", Right 1")
    # ---------------------------------------------------------------------------
    section = doc.sections[0]
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.2)
    section.right_margin = Inches(1.0)
    section.different_first_page_header_footer = True
    setup_footer(section)

    # ===========================================================================
    # PAGE 1: หน้าปก (COVER PAGE) — NO LOGOS, NO PERSONAL NAMES
    # ===========================================================================
    add_p(doc, "", space_after=120)
    
    add_p(doc, "คู่มือการใช้งาน", size_pt=24, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)
    add_p(doc, "ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
    add_p(doc, "Real-Time Sepsis Alert System (RTSAS)", size_pt=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=180)
    
    add_p(doc, "คู่มือการปฏิบัติงานคลินิกและการใช้งานระบบสนับสนุนการตัดสินใจ (CDSS)", size_pt=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "กลุ่มงานอุบัติเหตุและฉุกเฉิน", size_pt=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา", size_pt=17, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "ปีงบประมาณ 2569", size_pt=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    
    doc.add_page_break()

    # ===========================================================================
    # PAGE 2: คำนำ (PREFACE)
    # ===========================================================================
    add_p(doc, "คำนำ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=24)
    
    add_p(doc, "การจัดทำคู่มือการใช้งาน ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (Real-Time Sepsis Alert System: RTSAS) จัดทำขึ้นเพื่อเป็นแนวทางและมาตรฐานการปฏิบัติงานทางคลินิก (Standard Clinical Operations Manual) สำหรับแพทย์ พยาบาลวิชาชีพ และบุคลากรทางการแพทย์ ในการเฝ้าระวัง คัดกรอง วินิจฉัย และให้การรักษาผู้ป่วยที่มีภาวะสงสัยติดเชื้อในกระแสเลือด (Sepsis) ได้อย่างถูกต้อง รวดเร็ว และมีประสิทธิภาพสูงสุดตามเกณฑ์มาตรฐานสากล Surviving Sepsis Campaign (SSC 2021) และ National Early Warning Score (NEWS 2)",
          size_pt=16, first_indent=0.5, space_after=10)
          
    add_p(doc, "ระบบนี้พัฒนาขึ้นในรูปแบบ Web Application ซึ่งออกแบบตามหลักการยศาสตร์คลินิก (Clinical Ergonomics) เชื่อมโยงข้อมูลเวชระเบียนกับระบบสารสนเทศโรงพยาบาล (HOSxP) แบบเรียลไทม์ ประมวลผลคะแนนเตือนภัยล่วงหน้า (NEWS) อัตโนมัติ พร้อมระบบแจ้งเตือนฉุกเฉินทั้งภาพและสัญญาณเสียงเตือน (Audio Chime) ครอบคลุมการควบคุม Golden Hour ผ่านนาฬิกานับถอยหลังการให้ยาปฏิชีวนะภายใน 60 นาที (1-Hour Sepsis Bundle) การติดตามสัญญาณชีพซ้ำตามรอบเวลา (ทุก 15 นาที 4 รอบแรก และทุก 30 นาทีในรอบถัดไป) ตลอดจนระบบบันทึกประวัติการรักษาที่สามารถคัดลอกลงระบบ HOSxP ได้ทันที 100%",
          size_pt=16, first_indent=0.5, space_after=10)
          
    add_p(doc, "ในการดำเนินงานครั้งนี้ ได้รับความร่วมมือและการสนับสนุนข้อมูลเพื่อนำมาพัฒนาระบบจากคณะทำงานพัฒนาระบบบริการสุขภาพ (Service Plan) สาขาภาวะติดเชื้อในกระแสเลือด และบุคลากรทางการแพทย์ห้องอุบัติเหตุและฉุกเฉิน โรงพยาบาลบางคล้า ในการร่วมทดสอบระบบและให้ข้อเสนอแนะ คณะผู้จัดทำหวังเป็นอย่างยิ่งว่าคู่มือฉบับนี้จะเป็นประโยชน์ต่อการปฏิบัติงานและช่วยลดอัตราการเสียชีวิตของผู้ป่วยภาวะติดเชื้อในกระแสเลือดได้อย่างเป็นรูปธรรม",
          size_pt=16, first_indent=0.5, space_after=36)
          
    add_p(doc, "คณะผู้จัดทำ", size_pt=16, align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=4)
    add_p(doc, "กันยายน 2569", size_pt=16, align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=0)
    
    doc.add_page_break()

    # ===========================================================================
    # PAGE 3: สารบัญ (TABLE OF CONTENTS)
    # ===========================================================================
    add_p(doc, "สารบัญ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)
    
    p_th = doc.add_paragraph()
    p_th.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_th.paragraph_format.space_after = Pt(8)
    r_th = p_th.add_run("หน้า")
    set_run_font(r_th, size_pt=16, bold=True)
    
    add_toc_line(doc, "คำนำ", "ก")
    add_toc_line(doc, "สารบัญภาพ", "ข")
    add_toc_line(doc, "1.โครงสร้างบทบาทผู้ใช้งานและการเข้าสู่ระบบ (User Roles & Access)", "1")
    add_toc_line(doc, "2.การเริ่มต้นใช้งานและภาพรวมหน้าจอหลัก (Main Dashboard)", "2")
    add_toc_line(doc, "3.การคัดแยกและการจัดการคิวผู้ป่วยในแผนก (Triage Queue)", "4")
    add_toc_line(doc, "4.ข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS", "5")
    add_toc_line(doc, "5.ระบบแจ้งเตือนภาวะวิกฤตฉุกเฉิน (Emergency Alerts)", "7")
    add_toc_line(doc, "6.ขั้นตอนปฏิบัติ Sepsis Bundle และการตัดสินใจของแพทย์", "9")
    add_toc_line(doc, "7.ระบบการติดตามสัญญาณชีพซ้ำตามรอบเวลา (Reassessment)", "11")
    add_toc_line(doc, "8.ระบบสิ้นสุดการรักษาและการส่งต่อ (End of Treatment)", "13")
    add_toc_line(doc, "9.ไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ระบบ HIS (Timeline & HIS Copy)", "14")
    add_toc_line(doc, "10.แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว (Treated Dashboard)", "15")
    add_toc_line(doc, "11.การจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin", "16")
    add_toc_line(doc, "12.สารบัญไดเรกทอรีปุ่มกดและฟังก์ชันทั้งหมดของระบบ (Master Directory)", "17")
    
    doc.add_page_break()

    # ===========================================================================
    # PAGE 4: สารบัญภาพ (LIST OF FIGURES)
    # ===========================================================================
    add_p(doc, "สารบัญภาพ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)
    
    p_fth = doc.add_paragraph()
    p_fth.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_fth.paragraph_format.space_after = Pt(8)
    r_fth = p_fth.add_run("หน้า")
    set_run_font(r_fth, size_pt=16, bold=True)
    
    add_toc_line(doc, "ภาพที่ 1-1 ภาพหน้าต่างคัดเลือกระดับบทบาทผู้ใช้งาน (User Roles)", "1")
    add_toc_line(doc, "ภาพที่ 2-1 ภาพหน้าจอหลักระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด", "2")
    add_toc_line(doc, "ภาพที่ 2-2 ภาพหน้าจอระบบในสถานะเริ่มต้นพร้อมใช้งาน (Clean Slate)", "3")
    add_toc_line(doc, "ภาพที่ 3-1 ภาพแถบรายชื่อและการจำแนกคิวผู้ป่วยในแผนก", "4")
    add_toc_line(doc, "ภาพที่ 4-1 ภาพการแสดงผลข้อมูลผู้ป่วยและสัญญาณชีพ 6 ช่อง", "5")
    add_toc_line(doc, "ภาพที่ 4-2 ภาพกล่องอาการสำคัญและการตัดคำข้อความยาว", "6")
    add_toc_line(doc, "ภาพที่ 5-1 ภาพหน้าต่างแจ้งเตือนด่วนภาวะติดเชื้อในกระแสเลือด", "7")
    add_toc_line(doc, "ภาพที่ 5-2 ภาพหน้าต่างคิวแจ้งเตือนผู้ป่วยเสี่ยงสูงหลายราย", "8")
    add_toc_line(doc, "ภาพที่ 6-1 ภาพการตัดสินใจของแพทย์ใน Phase 2 ยืนยันหรือ Rule Out", "9")
    add_toc_line(doc, "ภาพที่ 6-2 ภาพรายการ Sepsis Bundle Phase 3 และการกรอกข้อมูล", "10")
    add_toc_line(doc, "ภาพที่ 7-1 ภาพตารางการติดตามสัญญาณชีพ ทุก 15 นาที 4 รอบ และทุก 30 นาที", "11")
    add_toc_line(doc, "ภาพที่ 7-2 ภาพแบบฟอร์มบันทึกสัญญาณชีพและการคำนวณ NEWS สด", "12")
    add_toc_line(doc, "ภาพที่ 7-3 ภาพหน้าต่างกระดิ่งเตือนเมื่อถึงกำหนดรอบประเมินสัญญาณชีพ", "12")
    add_toc_line(doc, "ภาพที่ 8-1 ภาพหน้าต่างยืนยันการสิ้นสุดการรักษา Sepsis", "13")
    add_toc_line(doc, "ภาพที่ 8-2 ภาพสถานะการรักษาเสร็จสิ้นสมบูรณ์ (Green Banner)", "13")
    add_toc_line(doc, "ภาพที่ 9-1 ภาพแถบไทม์ไลน์บันทึกขั้นตอนการรักษาและปุ่มคัดลอกลง HIS", "14")
    add_toc_line(doc, "ภาพที่ 10-1 ภาพแดชบอร์ดสรุปสถิติผู้ป่วยที่รักษาแล้วและตัวชี้วัด", "15")
    add_toc_line(doc, "ภาพที่ 11-1 ภาพหน้าจอการจัดการระบบและแคชสำหรับ IT Admin", "16")
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 1: โครงสร้างบทบาทผู้ใช้งานและการเข้าสู่ระบบ (USER ROLES & ACCESS)
    # ===========================================================================
    add_p(doc, "1.โครงสร้างบทบาทผู้ใช้งานและการเข้าสู่ระบบ (User Roles & Access)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "ระบบ RTSAS ออกแบบโครงสร้างการเข้าถึงข้อมูลตามมาตรฐานการควบคุมการเข้าถึงตามบทบาท (Role-Based Access Control: RBAC) เพื่อความปลอดภัยของข้อมูลผู้ป่วยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) และแบ่งแยกหน้าที่ทางคลินิกอย่างชัดเจน โดยแบ่งออกเป็น 3 บทบาทหลักดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. แพทย์ (Doctor - 🩺): มีสิทธิ์ในการรับทราบการแจ้งเตือน, วินิจฉัยและยืนยันภาวะติดเชื้อในกระแสเลือด (Doctor Confirmation) เพื่อเริ่มนับเวลา 60 นาที หรือกดปฏิเสธว่าไม่ใช่ภาวะติดเชื้อ (Rule Out Sepsis), สั่งการรักษาเพิ่มเติม (ยาปฏิชีวนะตัวที่ 2 และสายสวนปัสสาวะ), และกดยืนยันสิ้นสุดกระบวนการรักษา (Treatment Complete)",
          size_pt=15, first_indent=0.5, space_after=4)
          
    add_p(doc, "2. พยาบาล (Nurse - 💉): มีหน้าที่ปฏิบัติการพยาบาลตาม Protocol, คัดกรองและประเมินอาการซ้ำที่จุดคัดแยก, ปฏิบัติการ Sepsis Bundle (เจาะเลือดเพาะเชื้อ 2 ขวด, บริหารสารน้ำ IV, ให้ยาปฏิชีวนะตามคำสั่งแพทย์), บันทึกตำแหน่งที่เจาะและอัตราเร็วสารน้ำ, กดปุ่มข้ามขั้นตอนที่แพทย์ไม่ได้สั่ง, บันทึกการประเมินสัญญาณชีพซ้ำทุก 15 นาที และทุก 30 นาที, จัดการกระดิ่งแจ้งเตือนสัญญาณชีพ, และกดคัดลอกประวัติการรักษาทั้งหมดส่งออกเป็น Nursing Note เข้าสู่ระบบ HOSxP",
          size_pt=15, first_indent=0.5, space_after=4)
          
    add_p(doc, "3. เจ้าหน้าที่ IT (IT Admin - 💻): มีสิทธิ์เข้าถึงหน้า Admin Panel เพื่อตรวจสอบสถานะการเชื่อมต่อฐานข้อมูล HOSxP MySQL Pool, มอนิเตอร์หน่วยความจำแคช, ดำเนินการล้างแคชอย่างปลอดภัย (Safe Cache Flush) โดยไม่กระทบผู้ป่วยที่กำลังรับการรักษา, และจัดการผู้ใช้งานระบบ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_1_1_auth_roles.png", "ภาพที่ 1-1 ภาพหน้าต่างคัดเลือกระดับบทบาทผู้ใช้งาน (User Roles)", width_inches=4.8)
    
    add_p(doc, "ตารางที่ 1-1 สรุปสิทธิ์และหน้าที่ของแต่ละบทบาทในระบบ RTSAS", size_pt=14, bold=True, space_before=6, space_after=4)
    
    # Table: Role Permissions
    table_role = doc.add_table(rows=5, cols=4)
    table_role.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["ฟังก์ชันงานในระบบ", "แพทย์ (Doctor)", "พยาบาล (Nurse)", "เจ้าหน้าที่ IT"]
    for i, h in enumerate(headers):
        cell = table_role.cell(0, i)
        set_cell_background(cell, "EFF6FF")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(37, 99, 235))
        
    role_data = [
        ["ยืนยัน Sepsis / Rule Out Sepsis", "✅ ดำเนินการได้ (สิทธิ์เฉพาะ)", "❌ ดูได้อย่างเดียว", "❌ ไม่มีสิทธิ์"],
        ["ปฏิบัติการ Sepsis Bundle & Vitals", "✅ ดูและกำกับการรักษา", "✅ ดำเนินการและบันทึก", "❌ ไม่มีสิทธิ์"],
        ["สิ้นสุดการรักษา (Treatment Complete)", "✅ สั่งการและยืนยัน", "✅ บันทึกตามคำสั่งแพทย์", "❌ ไม่มีสิทธิ์"],
        ["จัดการฐานข้อมูล & ล้างแคชระบบ", "❌ ไม่มีสิทธิ์", "❌ ไม่มีสิทธิ์", "✅ ดำเนินการได้ (สิทธิ์เฉพาะ)"],
    ]
    for r_idx, row in enumerate(role_data):
        for c_idx, val in enumerate(row):
            cell = table_role.cell(r_idx + 1, c_idx)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=13, bold=True)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                set_run_font(run, size_pt=12)
                
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 2: การเริ่มต้นใช้งานและภาพรวมหน้าจอหลัก (MAIN DASHBOARD)
    # ===========================================================================
    add_p(doc, "2.การเริ่มต้นใช้งานและภาพรวมหน้าจอหลัก (Main Dashboard)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "หลังจากเข้าสู่ระบบสำเร็จ ผู้ใช้งานจะเข้าสู่หน้าจอหลักของแดชบอร์ด (Clinical Dashboard) ซึ่งจัดสรรพื้นที่แสดงผลออกเป็น 3 คอลัมน์หลักตามหลักสรีรศาสตร์สายตาทางการแพทย์ (Clinical Ergonomics) เพื่อให้บุคลากรเห็นภาพรวมของแผนกและรายละเอียดของผู้ป่วยได้อย่างต่อเนื่อง",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. แถบเมนูด้านบน (Header Bar): แสดงชื่อโรงพยาบาลบางคล้า ห้องอุบัติเหตุและฉุกเฉิน, นาฬิกาดิจิทัลแสดงเวลาปัจจุบันระดับวินาที, ไฟสถานะการเชื่อมต่อฐานข้อมูล HOSxP (🟢 เชื่อมต่อ HIS), ปุ่มออกรายงาน Shift ประจำวัน, ปุ่ม Admin Panel (สำหรับ IT), ป้ายแสดงชื่อและ Role ของผู้ใช้งานปัจจุบัน, และปุ่มออกจากระบบ",
          size_pt=15, first_indent=0.5, space_after=5)
          
    add_p(doc, "2. คอลัมน์ซ้าย (Sidebar - 260px): แสดงคิวรายชื่อผู้ป่วยทั้งหมดในแผนก เรียงตามลำดับความเร่งด่วน พร้อมคะแนน NEWS ชิปเตือนความเสี่ยง และป้ายนับถอยหลัง",
          size_pt=15, first_indent=0.5, space_after=5)
          
    add_p(doc, "3. คอลัมน์กลาง (Workflow Panel): ศูนย์กลางการกู้ชีพ Sepsis Bundle แสดงแถบนับเวลาถอยหลัง 60 นาที, รายการปฏิบัติการ 10 ข้อใน 4 ระยะ, ตารางติดตามสัญญาณชีพซ้ำ และแท็บ Clinical Timeline",
          size_pt=15, first_indent=0.5, space_after=5)
          
    add_p(doc, "4. คอลัมน์ขวา (Detail Panel): แสดงการ์ดข้อมูลผู้ป่วย, กล่องอาการสำคัญ (Chief Complaint) ที่ตัดคำข้อความยาวอย่างเรียบร้อย, ตารางสัญญาณชีพ 6 พารามิเตอร์ และแผงตรรกะการคำนวณคะแนน NEWS",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "01_main_dashboard.png", "ภาพที่ 2-1 ภาพหน้าจอหลักระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด", width_inches=5.8)
    
    doc.add_page_break()
    
    add_p(doc, "ในกรณีที่เริ่มต้นวันใหม่หรือยังไม่มีข้อมูลผู้ป่วยที่ถูกส่งเข้ามาจากจุดคัดกรอง หน้าจอหลักจะแสดงผลในสถานะเริ่มต้นพร้อมใช้งาน (Clean Slate) อย่างเรียบร้อย เพื่อรอรับข้อมูลผู้ป่วยจากระบบ HOSxP โดยไม่มีการแจ้งเตือนรบกวน",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_image_figure(doc, "11_clean_slate_dashboard.png", "ภาพที่ 2-2 ภาพหน้าจอระบบในสถานะเริ่มต้นพร้อมใช้งาน (Clean Slate)", width_inches=5.8)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 3: การคัดแยกและการจัดการคิวผู้ป่วยในแผนก (TRIAGE QUEUE)
    # ===========================================================================
    add_p(doc, "3.การคัดแยกและการจัดการคิวผู้ป่วยในแผนก (Triage Queue)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "แถบรายชื่อผู้ป่วยด้านซ้าย (Sidebar) ทำหน้าที่เป็นศูนย์กลางการคัดแยก (Triage Queue) ช่วยให้ทีมแพทย์และพยาบาลตรวจพบและจัดลำดับความสำคัญของผู้ป่วยวิกฤตได้อย่างรวดเร็ว โดยมีฟังก์ชันการทำงานหลักดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. แถบตัวกรองสถานะ 3 รูปแบบ:", size_pt=16, first_indent=0.5, space_after=4)
    add_p(doc, "   • ปุ่ม \"กำลังรักษา\" (Active Patients): แสดงผู้ป่วยทั้งหมดที่ยังอยู่ระหว่างการดูแลรักษาในห้องฉุกเฉิน", size_pt=15, first_indent=0.8, space_after=3)
    add_p(doc, "   • ปุ่ม \"🔴 เสี่ยง\" (High Risk / Sepsis Alert): กรองเฉพาะผู้ป่วยที่มีคะแนน NEWS ≥ 5 เพื่อให้ทีมแพทย์เข้าช่วยเหลือทันที", size_pt=15, first_indent=0.8, space_after=3)
    add_p(doc, "   • ปุ่ม \"✅ รักษาแล้ว\" (Treated Cases): แสดงเคสที่เสร็จสิ้นกระบวนการรักษาแล้ว หรือถูก Rule Out เพื่อเปิดดูประวัติย้อนหลัง", size_pt=15, first_indent=0.8, space_after=6)
          
    add_p(doc, "2. การแสดงผลบนการ์ดผู้ป่วย (Patient Card): แสดงรหัส HN ปิดบัง (HN Masked), เพศ, อายุ, ป้ายเตือนความเสี่ยง (🔴 เสี่ยงติดเชื้อ / ⚪ รอประเมิน / 🟢 ปกติ), ชิปคะแนน NEWS และเวลาที่มาถึง",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "3. ป้ายนับเวลาถอยหลัง Sepsis Bundle บนการ์ดผู้ป่วย: แสดงเวลาที่เหลือ เช่น \"⏱️ 42:09 Sepsis Bundle\" บนการ์ดผู้ป่วยใน Sidebar ทำให้ทีมงานติดตามความคืบหน้าของเคสวิกฤตได้ตลอดเวลา แม้จะกำลังคลิกดูข้อมูลของผู้ป่วยรายอื่นอยู่ก็ตาม",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "4. ปุ่มดึงข้อมูล (Manual Pull): ปุ่ม \"🔄 ดึงข้อมูล\" ช่วยให้พยาบาลสามารถสั่งดึงข้อมูลล่าสุดจากระบบ HOSxP ได้ทันทีโดยไม่ต้องรอรอบรีเฟรชอัตโนมัติ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_3_1_sidebar.png", "ภาพที่ 3-1 ภาพแถบรายชื่อและการจำแนกคิวผู้ป่วยในแผนก", width_inches=3.4)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 4: ข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS
    # ===========================================================================
    add_p(doc, "4.ข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "หัวใจสำคัญของการประเมินทางคลินิกคือการตรวจดูสัญญาณชีพและที่มาของคะแนนเตือนภัย โดยเมื่อคลิกเลือกผู้ป่วยรายใด คอลัมน์ด้านขวาจะแสดงข้อมูลอย่างครบถ้วนตามรายละเอียดดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. การ์ดข้อมูลผู้ป่วย (Patient Info Bar): แสดงรหัสประจำตัวผู้ป่วยที่ปิดบังตัวเลขเพื่อความปลอดภัยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (HN Masked เช่น HN****0187), เพศ, อายุ, เวลาคัดกรอง, หมายเลขตรวจ (VN) และเวลาที่อยู่ในห้องฉุกเฉิน (เวลาใน ER) ซึ่งนับเดินหน้าแบบวินาทีต่อวินาที",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "2. ตารางสัญญาณชีพ 6 พารามิเตอร์ (Vital Signs Grid): แสดงผลค่าสัญญาณชีพแยกเป็นการ์ด 6 ช่อง ได้แก่ อัตราการหายใจ (RR), ระดับออกซิเจนในเลือด (SpO₂), อุณหภูมิร่างกาย (TEMP), ความดันโลหิต (SBP/DBP), อัตราชีพจร (HR) และระดับความรู้สึกตัว (GCS/AVPU) พร้อมแต้มคะแนนความผิดปกติกำกับไว้ที่มุมขวาบนของการ์ดแต่ละใบ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "02_patient_detail_vitals.png", "ภาพที่ 4-1 ภาพการแสดงผลข้อมูลผู้ป่วยและสัญญาณชีพ 6 ช่อง", width_inches=5.8)
    
    doc.add_page_break()

    add_p(doc, "3. กล่องแสดงอาการสำคัญ (Chief Complaint Box): แสดงข้อความอาการสำคัญที่คัดกรองมาจากจุดคัดกรอง พร้อมไอคอน 🩺 โดยมีระบบตัดคำอัตโนมัติ (Responsive Text Wrap) รองรับข้อความที่มีขนาดยาว เช่น \"มีไข้สูง หนาวสั่น ซึมลง สับสน หายใจหอบเหนื่อย ความดันตก สงสัยภาวะติดเชื้อในกระแสเลือด (Septic Shock)\" โดยข้อความจะตัดขึ้นบรรทัดใหม่อย่างสวยงาม ไม่ยืดออกไปด้านข้างและไม่ล้นออกนอกจอ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_4_2_chief_complaint.png", "ภาพที่ 4-2 ภาพกล่องอาการสำคัญและการตัดคำข้อความยาว", width_inches=5.5)
    
    add_p(doc, "4. แผงตรรกะการคำนวณคะแนน NEWS (NEWS Calculation Logic): แสดงคะแนนรวมขนาดใหญ่ เช่น 16 / 18 คะแนน พร้อมตารางแจกแจงเกณฑ์คะแนนตามมาตรฐาน Royal College of Physicians (RCP 2017) อย่างโปร่งใสและตรวจสอบย้อนหลังได้",
          size_pt=15, first_indent=0.5, space_after=12)
          
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 5: ระบบแจ้งเตือนภาวะวิกฤตฉุกเฉิน (EMERGENCY ALERTS)
    # ===========================================================================
    add_p(doc, "5.ระบบแจ้งเตือนภาวะวิกฤตฉุกเฉิน (Emergency Alerts)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "เมื่อระบบตรวจพบข้อมูลสัญญาณชีพของผู้ป่วยที่เข้าเกณฑ์เสี่ยงติดเชื้อในกระแสเลือด (คะแนนรวม NEWS ≥ 5 หรือมีสัญญาณชีพบกพร่องวิกฤตเดี่ยว Single Parameter Alert) ระบบจะส่งสัญญาณเตือนทั้งภาพและเสียง Audio Chime ทันที",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. หน้าต่างแจ้งเตือนเดี่ยว (Single Sepsis Alert Modal): สำหรับกรณีพบผู้ป่วยวิกฤตรายใหม่ 1 ราย หน้าต่างจะแสดงคะแนน NEWS ขนาดใหญ่, ข้อมูลผู้ป่วย, อาการสำคัญ และตารางสัญญาณชีพที่ผิดปกติ พร้อมปุ่ม \"รับทราบและเริ่มการรักษา\" เพื่อเข้าสู่กระบวนการ Sepsis Bundle ทันที",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "03_sepsis_alert_modal.png", "ภาพที่ 5-1 ภาพหน้าต่างแจ้งเตือนด่วนภาวะติดเชื้อในกระแสเลือด", width_inches=5.4)
    
    doc.add_page_break()

    add_p(doc, "2. หน้าต่างคิวแจ้งเตือนหลายรายพร้อมกัน (Multi-Alert Queue Modal): สำหรับกรณีตรวจพบผู้ป่วยวิกฤตหลายรายในเวลาใกล้เคียงกัน ระบบจะรวบรวมคิวแจ้งเตือนไว้ในหน้าต่างเดียว โดยบุคลากรสามารถเลือกกด \"รับทราบ\" รายบุคคล หรือกด \"รับทราบทั้งหมด\" เพื่อจัดการคิวได้อย่างรวดเร็ว",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "04_multi_alert_queue.png", "ภาพที่ 5-2 ภาพหน้าต่างคิวแจ้งเตือนผู้ป่วยเสี่ยงสูงหลายราย", width_inches=5.4)
    
    add_p(doc, "3. ระบบป้องกันการแจ้งเตือนซ้ำ (Smart Dismissal Guard): เมื่อผู้ใช้งานเคยกดรับทราบ หรือปิดหน้าต่างแจ้งเตือนไปแล้ว การกดรีเฟรชหน้าเว็บ (F5 / Reload) จะไม่ส่งเสียงเตือนหรือเปิดป๊อปอัปแจ้งเตือนซ้ำขึ้นมารบกวนอีก โดยระบบจะคงสถานะเวลานับถอยหลังและการดูแลรักษาไว้อย่างต่อเนื่อง",
          size_pt=15, first_indent=0.5, space_after=12)
          
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 6: ขั้นตอนปฏิบัติ SEPSIS BUNDLE และการตัดสินใจของแพทย์
    # ===========================================================================
    add_p(doc, "6.ขั้นตอนปฏิบัติ Sepsis Bundle และการตัดสินใจของแพทย์", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "หัวใจสำคัญของการลดอัตราการเสียชีวิตจากภาวะติดเชื้อในกระแสเลือด คือการปฏิบัติตามมาตรฐาน 1-Hour Sepsis Bundle (Golden Hour) ภายใน 60 นาทีแรกหลังจากแพทย์ยืนยันการวินิจฉัยโรค โดยระบบมี 4 Clinical Phases ที่ทำงานอย่างรัดกุมดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. Phase 1: การตอบสนองเบื้องต้น (Initial Response): ประกอบด้วยการประเมินอาการผู้ป่วยซ้ำที่จุดคัดแยก, นำส่งห้องฉุกเฉิน ER, และรายงานแพทย์เวรทันที เมื่อดำเนินการครบทั้ง 3 ข้อ Phase 2 จะปลดล็อกทันที",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "2. Phase 2: การยืนยันการวินิจฉัยโดยแพทย์ (Doctor Confirmation): ในระยะนี้แพทย์เวรจะเป็นผู้ตัดสินใจผ่าน 2 ตัวเลือกหลัก:", size_pt=15, first_indent=0.5, space_after=4)
    add_p(doc, "   • ปุ่มสีแดง \"🔴 ยืนยัน — ติดเชื้อ เริ่มนับ 60 นาที\": เมื่อแพทย์กดยืนยัน ระบบจะเปิดนาฬิกานับถอยหลังจาก 60:00 นาที ปลดล็อก Phase 3 และสร้างตารางประเมินสัญญาณชีพ Phase 4 อัตโนมัติ", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • ปุ่มสีเขียว \"🟢 ไม่ยืนยัน — Rule Out จบกระบวนการ\": หากแพทย์วินิจฉัยว่าไม่ใช่ภาวะติดเชื้อในกระแสเลือด เมื่อกดปุ่มนี้ระบบจะบันทึกสถานะ Ruled Out จบกระบวนการสำหรับเคสนี้ทันที และย้ายผู้ป่วยไปอยู่ในแท็บ \"รักษาแล้ว\"", size_pt=14, first_indent=0.8, space_after=10)

    add_image_figure(doc, "fig_5_1_phase2_doctor_decision.png", "ภาพที่ 6-1 ภาพการตัดสินใจของแพทย์ใน Phase 2 ยืนยันหรือ Rule Out", width_inches=5.6)
    
    doc.add_page_break()

    add_p(doc, "3. Phase 3: Hour-1 Sepsis Bundle (การรักษาภายใน 60 นาที): มีรายการปฏิบัติและช่องกรอกข้อมูลดังนี้:", size_pt=15, first_indent=0.5, space_after=6)
    add_p(doc, "   • เจาะเลือดเพาะเชื้อ ครั้งที่ 1 (Hemoculture 1): บังคับทำก่อนให้ยาปฏิชีวนะ ต้องกรอกช่อง \"ตำแหน่งที่เจาะ:\" เช่น Left median cubital vein", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • เจาะเลือดเพาะเชื้อ ครั้งที่ 2 (Hemoculture 2): บังคับทำ ต้องกรอกช่อง \"ตำแหน่งที่เจาะ:\" เช่น Right cephalic vein", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • ให้สารน้ำทางหลอดเลือดดำ (IV Fluid): บังคับทำ ต้องกรอกช่อง \"ชนิดสารน้ำ / อัตราเร็ว:\" เช่น NSS 1,000 ml IV load in 1 hr", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 1: บังคับให้ภายใน 60 นาที ต้องกรอกช่อง \"ชนิดยา / ขนาด / วิธีให้:\" เช่น Ceftriaxone 2g IV drip in 30 min", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • ยาปฏิชีวนะตัวที่ 2 (ถ้ามี) [ไม่บังคับ]: หากแพทย์ไม่ได้สั่ง พยาบาลสามารถกดปุ่ม \"⏭ ข้ามขั้นตอนนี้ — ไม่มียาตัวที่ 2\" ได้ทันทีโดยไม่ทำให้ Bundle ผิดพลาด", size_pt=14, first_indent=0.8, space_after=3)
    add_p(doc, "   • ใส่สายสวนปัสสาวะ Retain Foley cath [ไม่บังคับ]: ทำเฉพาะเมื่อมีข้อบ่งชี้ หากไม่มีข้อบ่งชี้สามารถกดปุ่ม \"⏭ ข้ามขั้นตอนนี้\" ได้", size_pt=14, first_indent=0.8, space_after=10)

    add_image_figure(doc, "fig_5_2_phase3_bundle_inputs.png", "ภาพที่ 6-2 ภาพรายการ Sepsis Bundle Phase 3 และการกรอกข้อมูล", width_inches=5.6)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 7: ระบบการติดตามสัญญาณชีพซ้ำตามรอบเวลา (REASSESSMENT SCHEDULE)
    # ===========================================================================
    add_p(doc, "7.ระบบการติดตามสัญญาณชีพซ้ำตามรอบเวลา (Reassessment)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "การประเมินสัญญาณชีพซ้ำอย่างเป็นระบบเป็นหัวใจสำคัญของการประเมินการตอบสนองต่อการรักษา โดยระบบ RTSAS ได้วางตารางการติดตามสัญญาณชีพอัตโนมัติไว้ตามเกณฑ์มาตรฐานสากลดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. ตรรกะรอบเวลาการติดตามสัญญาณชีพ (Reassessment Schedule Logic):", size_pt=16, first_indent=0.5, space_after=4)
    add_p(doc, "   • รอบที่ 1 ถึง 4: ประเมินทุก 15 นาที (Q15 x 4 รอบ) ในชั่วโมงแรกหลังการรักษา (นาทีที่ 15, 30, 45 และ 60)", size_pt=15, first_indent=0.8, space_after=3)
    add_p(doc, "   • รอบที่ 5 เป็นต้นไป: ประเมินทุก 30 นาที (Q30 ต่อครั้ง) ไปเรื่อยๆ จนกว่าแพทย์จะสิ้นสุดการรักษา (นาทีที่ 90, 120, 150...)", size_pt=15, first_indent=0.8, space_after=6)
          
    add_p(doc, "2. ตารางแสดงสถานะรอบการประเมิน: ตารางจะแสดงหมายเลขครั้งที่, เวลาเป้าหมาย, ชนิดรอบ (Q15/Q30), คะแนน NEWS ที่ได้, และปุ่มสถานะ (✓ บันทึกแล้ว, 🔒 รอครั้งก่อนหน้า, ⚡ บันทึกด่วน เมื่อถึงกำหนดเวลา)",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_6_1_assessment_table_q15_q30.png", "ภาพที่ 7-1 ภาพตารางการติดตามสัญญาณชีพ ทุก 15 นาที 4 รอบ และทุก 30 นาที", width_inches=5.6)
    
    doc.add_page_break()

    add_p(doc, "3. แบบฟอร์มบันทึกสัญญาณชีพ (Assessment Form Modal): เมื่อกดปุ่มบันทึกในรอบเวลา หน้าต่างจะเปิดขึ้นมาเพื่อให้พยาบาลกรอกค่าสัญญาณชีพ 6 พารามิเตอร์ ได้แก่ RR, SpO2, SBP, DBP, HR, BT และค่า GCS (3-15) ซึ่งระบบจะแปลงเป็นระดับ AVPU (A, V, P, U) ให้อัตโนมัติ พร้อมบัตรแสดงคะแนน Live NEWS Score ที่คำนวณคะแนนรวมและแยกแจงคะแนนแบบเรียลไทม์",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_6_2_assessment_form_modal.png", "ภาพที่ 7-2 ภาพแบบฟอร์มบันทึกสัญญาณชีพและการคำนวณ NEWS สด", width_inches=5.2)
    
    add_p(doc, "4. หน้าต่างกระดิ่งเตือนรอบประเมิน (Reminder Modal): เมื่อถึงเวลาเป้าหมายในแต่ละรอบ ระบบจะส่งเสียงแจ้งเตือนและแสดงหน้าต่างกระดิ่งเตือนสีส้ม โดยพยาบาลสามารถกดปุ่ม \"📝 บันทึกสัญญาณชีพ\" เพื่อเปิดแบบฟอร์มบันทึกทันที หรือกดปุ่ม \"เลื่อนออกไป\" หากติดหัตถการฉุกเฉินอื่นอยู่",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_6_3_reminder_modal.png", "ภาพที่ 7-3 ภาพหน้าต่างกระดิ่งเตือนเมื่อถึงกำหนดรอบประเมินสัญญาณชีพ", width_inches=4.8)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 8: ระบบสิ้นสุดการรักษาและการส่งต่อ (END OF TREATMENT)
    # ===========================================================================
    add_p(doc, "8.ระบบสิ้นสุดการรักษาและการส่งต่อ (End of Treatment)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "เมื่อผู้ป่วยได้รับการดูแลรักษาภาวะติดเชื้อในกระแสเลือดครบถ้วน หรือมีสัญญาณชีพคงที่และพร้อมจำหน่าย/ส่งต่อไปยังหอผู้ป่วยใน (Ward) หรือส่งต่อไปยังโรงพยาบาลระดับตติยภูมิ ระบบมีกลไกสิ้นสุดกระบวนการรักษาดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. การกดยืนยันสิ้นสุดการรักษา: สามารถกดได้จากปุ่มใหญ่สีเขียว \"✅ สิ้นสุดการรักษา (รักษาเสร็จแล้ว)\" ที่อยู่ด้านล่างสุดของตาราง Checklist หรือกดจากภายในหน้าต่าง Assessment Form Modal",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "2. หน้าต่างยืนยันความถูกต้อง (Confirmation Modal): เพื่อป้องกันการกดผิดพลาด ระบบจะแสดงหน้าต่าง In-app Confirmation Modal ให้ยืนยันอีกครั้ง โดยระบุว่าจะหยุดตัวนับเวลา 60 นาทีและบันทึกประวัติลงใน Timeline อย่างถาวร",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_7_1_treatment_complete_modal.png", "ภาพที่ 8-1 ภาพหน้าต่างยืนยันการสิ้นสุดการรักษา Sepsis", width_inches=4.8)
    
    add_p(doc, "3. สถานะหลังการสิ้นสุดการรักษา: ระบบจะแสดงแถบแบนเนอร์สีเขียว \"✓ การรักษา Sepsis เสร็จสิ้นครบถ้วนแล้ว\" พร้อมระบุเวลาเสร็จสิ้น และย้ายผู้ป่วยจากการ์ดผู้ป่วยใน ER ไปยังแท็บ \"✅ รักษาแล้ว\" โดยอัตโนมัติ เพื่อส่งต่อข้อมูลไปยังแดชบอร์ดสรุปสถิติ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_7_2_treatment_completed_state.png", "ภาพที่ 8-2 ภาพสถานะการรักษาเสร็จสิ้นสมบูรณ์ (Green Banner)", width_inches=5.6)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 9: ไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ระบบ HIS (TIMELINE & HIS COPY)
    # ===========================================================================
    add_p(doc, "9.ไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ระบบ HIS (Timeline & HIS Copy)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "ทุกขั้นตอน กิจกรรมการพยาบาล และหัตถการที่ดำเนินการในระบบ จะถูกบันทึกประทับเวลา (Timestamped Audit Trail) ระดับวินาทีในแท็บ Clinical Timeline เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้ 100%",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. แถบแสดงลำดับขั้นตอนการรักษา: แสดงหมายเลขขั้นตอนที่ 1..N, ป้ายสีสถานะ, ข้อความการปฏิบัติ, เวลาที่ดำเนินการระดับวินาที และชื่อบุคลากรผู้ปฏิบัติงาน",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "2. ฟังก์ชันคัดลอกลง HIS (HIS Copy Feature): เมื่อกดปุ่มสีเข้ม \"📋 คัดลอกขั้นตอนการรักษาเพื่อบันทึกใน HIS\" ระบบจะจัดรูปแบบข้อความทั้งหมดให้เป็น Nursing Note / Doctor Note ตามมาตรฐานเวชระเบียน เพื่อให้พยาบาลนำไปกดวาง (Ctrl+V) ลงในช่องบันทึกของโปรแกรม HOSxP ได้ทันทีโดยไม่ต้องพิมพ์ซ้ำ",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_8_1_clinical_timeline_detail.png", "ภาพที่ 9-1 ภาพแถบไทม์ไลน์บันทึกขั้นตอนการรักษาและปุ่มคัดลอกลง HIS", width_inches=5.6)
    
    add_p(doc, "3. หน้าต่างส่งออกรายงานกะประจำวัน (Export Report Modal): สามารถเปิดดูตัวเลขสถิติภาพรวมของผู้ป่วย Sepsis ประจำเวร อัตราการให้ยาทันเวลา และดาวน์โหลดเป็นไฟล์ CSV หรือสั่งพิมพ์ได้",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "07_export_report_modal.png", "ภาพที่ 9-2 ภาพหน้าต่างสรุปรายงานสถิติประจำวันและส่งออก CSV", width_inches=5.4)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 10: แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว (TREATED DASHBOARD)
    # ===========================================================================
    add_p(doc, "10.แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว (Treated Dashboard)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "สำหรับการติดตามผลการดำเนินงานเชิงคุณภาพ (Quality Improvement & Clinical Audit) ผู้บริหารและหัวหน้าแผนกสามารถเข้าสู่หน้าจอ Treated Dashboard ทางปุ่ม \"✅ รักษาแล้ว\" ใน Sidebar หรือ URL \"/treated\" เพื่อดูตัวชี้วัดสำคัญดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. การ์ดสรุปตัวชี้วัดประจำวัน (Daily KPI Metrics): แสดงจำนวนผู้ป่วยทั้งหมดในแผนก, ผู้ป่วยเสี่ยงสูง (High Risk Cases), ผู้ป่วยที่รักษา Sepsis สำเร็จ (Treated Completed), ผู้ป่วยที่แพทย์วินิจฉัยไม่ใช่ภาวะติดเชื้อ (Ruled Out), และอัตราความสอดคล้องตามมาตรฐาน (Compliance Rate %)",
          size_pt=15, first_indent=0.5, space_after=5)
          
    add_p(doc, "2. แถบประวัติย้อนหลัง 7 วัน: แสดงตัวเลขสถิติรายวันย้อนหลังเพื่อเปรียบเทียบแนวโน้มการให้บริการ", size_pt=15, first_indent=0.5, space_after=5)
    add_p(doc, "3. ตัวกรองประเภทเคส (Filter Tabs): เลือกดู \"ทั้งหมด\", \"เฉพาะเคสที่รักษาแล้ว\" หรือ \"เฉพาะเคสเสี่ยงสูง\"", size_pt=15, first_indent=0.5, space_after=5)
    add_p(doc, "4. ตารางประวัติรายบุคคล: แสดง Masked HN, เพศ, อายุ, คะแนน NEWS, เวลาที่มาถึง, เวลาที่รักษาเสร็จ, ผู้ดูแล และผลลัพธ์การรักษา", size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_9_1_treated_cases_dashboard.png", "ภาพที่ 10-1 ภาพแดชบอร์ดสรุปสถิติผู้ป่วยที่รักษาแล้วและตัวชี้วัด", width_inches=5.8)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 11: การจัดการระบบและหน่วยความจำแคชสำหรับ IT ADMIN
    # ===========================================================================
    add_p(doc, "11.การจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "สำหรับผู้ดูแลระบบสารสนเทศโรงพยาบาล สามารถเข้าสู่หน้าจอ Admin ได้ผ่านทางปุ่ม \"💻 Admin Panel\" บน Header (เฉพาะผู้ใช้งาน Role IT Admin) หรือเปิดไปยัง URL \"/admin\" เพื่อตรวจสอบความพร้อมของระบบและบริหารจัดการแคช โดยมีฟังก์ชันดังนี้",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "1. การตรวจสอบสถานะฐานข้อมูล (Database Connection Status): ตรวจสอบการเชื่อมต่อกับฐานข้อมูล HOSxP MySQL Connection Pool แสดง Host, Port, ชื่อฐานข้อมูล และค่า Ping Latency",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "2. สถิติหน่วยความจำแคช (Cache Statistics): แสดงจำนวนสัญญาณชีพและจำนวนผู้ป่วยที่เก็บอยู่ในหน่วยความจำ Memory Cache",
          size_pt=15, first_indent=0.5, space_after=6)
          
    add_p(doc, "3. การล้างแคชอย่างปลอดภัย (Safe Sepsis Guard): ปุ่ม \"ล้างแคชทั้งหมด\" มีกลไกป้องกันพิเศษ โดยจะไม่ล้างข้อมูลของผู้ป่วยที่กำลังอยู่ระหว่างการรักษา (มีนาฬิกา 60 นาทีทำงานอยู่) ป้องกันไม่ให้การดูแลผู้ป่วยในห้องฉุกเฉินสะดุด",
          size_pt=15, first_indent=0.5, space_after=10)

    add_image_figure(doc, "fig_10_1_admin_cache_panel.png", "ภาพที่ 11-1 ภาพหน้าจอการจัดการระบบและแคชสำหรับ IT Admin", width_inches=5.8)
    
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 12: สารบัญไดเรกทอรีปุ่มกดและฟังก์ชันทั้งหมดของระบบ (MASTER DIRECTORY)
    # ===========================================================================
    add_p(doc, "12.สารบัญไดเรกทอรีปุ่มกดและฟังก์ชันทั้งหมดของระบบ (Master Directory)", size_pt=18, bold=True, space_before=6, space_after=12)
    
    add_p(doc, "ตารางที่ 12-1 รวบรวมและแจกแจงหน้าที่ของปุ่มกด สวิตช์ และการควบคุมทั้งหมดในระบบ RTSAS เพื่อให้บุคลากรทางการแพทย์สามารถอ้างอิงการใช้งานได้อย่างสะดวกรวดเร็ว",
          size_pt=16, first_indent=0.5, space_after=8)

    # Master Button Directory Table
    btn_table = doc.add_table(rows=1, cols=4)
    btn_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    btn_headers = ["ส่วนงาน (Module)", "ชื่อปุ่ม / การควบคุม", "บทบาทที่กดได้", "หน้าที่การทำงานและความสำคัญ"]
    for i, h in enumerate(btn_headers):
        cell = btn_table.cell(0, i)
        set_cell_background(cell, "1E293B")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    master_buttons = [
        ["Header Bar", "📊 รายงาน Shift", "ทุกบทบาท", "เปิดหน้าต่างสรุปตัวเลขสถิติและส่งออกไฟล์ CSV"],
        ["Header Bar", "💻 Admin Panel", "IT Admin", "เปิดหน้าจอตรวจสอบการเชื่อมต่อฐานข้อมูลและการจัดการแคช"],
        ["Header Bar", "ออกจากระบบ", "ทุกบทบาท", "เคลียร์ Session การใช้งานและกลับสู่หน้าล็อกอิน"],
        ["Sidebar", "กำลังรักษา", "ทุกบทบาท", "กรองแสดงผู้ป่วยทั้งหมดที่กำลังรับการรักษาในห้องฉุกเฉิน"],
        ["Sidebar", "🔴 เสี่ยง", "ทุกบทบาท", "กรองเฉพาะผู้ป่วยวิกฤตที่มีคะแนน NEWS ≥ 5"],
        ["Sidebar", "✅ รักษาแล้ว", "ทุกบทบาท", "สลับมุมมองไปยังแดชบอร์ดเคสที่รักษาเสร็จสิ้นหรือ Rule Out"],
        ["Sidebar", "🔄 ดึงข้อมูล", "ทุกบทบาท", "สั่งดึงข้อมูลล่าสุดจากฐานข้อมูล HOSxP ทันที"],
        ["Emergency Alert", "รับทราบและเริ่มการรักษา", "แพทย์ / พยาบาล", "ปิดหน้าต่างแจ้งเตือนและนำเคสเข้าสู่ Sepsis Bundle ทันที"],
        ["Checklist Phase 2", "🔴 ยืนยัน — ติดเชื้อ", "แพทย์เวร", "ยืนยันการวินิจฉัย Sepsis, เริ่มนับ 60:00 นาที, ปลดล็อก Phase 3"],
        ["Checklist Phase 2", "🟢 ไม่ยืนยัน — Rule Out", "แพทย์เวร", "ยืนยันไม่ใช่ภาวะติดเชื้อ จบกระบวนการและย้ายเคสไปรักษาแล้ว"],
        ["Checklist Phase 3", "บันทึก (ตำแหน่งเจาะ/ยา)", "พยาบาล", "บันทึกข้อมูลเฉพาะของแต่ละหัตถการใน Sepsis Bundle"],
        ["Checklist Phase 3", "⏭ ข้ามขั้นตอนนี้", "พยาบาล", "ข้ามยาตัวที่ 2 หรือสายสวนปัสสาวะที่แพทย์ไม่ได้สั่ง"],
        ["Assessment Table", "⚡ บันทึกด่วน / [บันทึก]", "พยาบาล", "เปิดแบบฟอร์มกรอกสัญญาณชีพซ้ำตามรอบเวลา (Q15 / Q30)"],
        ["Assessment Form", "💾 บันทึกการประเมิน", "พยาบาล", "บันทึกค่าสัญญาณชีพ คำนวณ NEWS และบันทึกลงตาราง"],
        ["Assessment Form", "✅ รักษาเสร็จแล้ว", "แพทย์ / พยาบาล", "สิ้นสุดกระบวนการดูแลรักษาสำหรับผู้ป่วยรายนี้"],
        ["Reminder Modal", "📝 บันทึกสัญญาณชีพ", "พยาบาล", "รับทราบการเตือนรอบเวลาและเปิดฟอร์มกรอกสัญญาณชีพ"],
        ["Reminder Modal", "เลื่อนออกไป", "พยาบาล", "เลื่อนการเตือนรอบเวลาออกไปชั่วคราว"],
        ["Checklist Bottom", "✅ สิ้นสุดการรักษา", "แพทย์ / พยาบาล", "เปิดหน้าต่างยืนยันสิ้นสุดการรักษา Sepsis อย่างเป็นทางการ"],
        ["Timeline Panel", "📋 คัดลอกขั้นตอนการรักษา", "ทุกบทบาท", "ฟอร์แมตข้อความ Nursing Note ทั้งหมดลงคลิปบอร์ดเพื่อวางใน HOSxP"],
        ["IT Admin Panel", "ล้างแคชทั้งหมด", "IT Admin", "ล้างแคชหน่วยความจำอย่างปลอดภัยโดยไม่กระทบเคสที่กำลังรักษา"],
    ]
    
    for r_i, row_data in enumerate(master_buttons):
        row = btn_table.add_row()
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 60, 60, 80, 80)
            if r_i % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12, bold=True, color=RGBColor(37, 99, 235))
            elif c_idx == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12, bold=True)
            elif c_idx == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                set_run_font(run, size_pt=11, bold=True, color=RGBColor(5, 150, 105) if "แพทย์" in val else RGBColor(100, 116, 139))
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12)

    # Save document
    doc.save(OUTPUT_DOCX_DOCS)
    print(f"Saved: {OUTPUT_DOCX_DOCS} ({os.path.getsize(OUTPUT_DOCX_DOCS) / 1024:.1f} KB)")
    
    doc.save(OUTPUT_DOCX_DESKTOP)
    print(f"Saved: {OUTPUT_DOCX_DESKTOP} ({os.path.getsize(OUTPUT_DOCX_DESKTOP) / 1024:.1f} KB)")

if __name__ == "__main__":
    generate_manual()
