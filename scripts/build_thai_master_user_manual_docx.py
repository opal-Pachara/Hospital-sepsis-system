#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_thai_master_user_manual_docx.py
=============================================================================
Comprehensive Official Clinical Operations & Master User Manual (.docx)
Real-Time Sepsis Alert System (RTSAS) — โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา

Standards Compliant:
- Font: TH Sarabun New (16pt body, 18pt heading, 20-24pt titles, 14pt captions/tables)
- Thai Healthcare / Institutional Standard (No individual names on cover; Institutional Attribution)
- Exhaustive Pop-up System Coverage with Pre-action Screenshots and Next-step Workflows
- Master Button & Control Directory (>35 Controls)
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
COLOR_NAVY = RGBColor(30, 58, 138)
COLOR_BLUE = RGBColor(37, 99, 235)
COLOR_RED = RGBColor(220, 38, 38)
COLOR_GREEN = RGBColor(22, 163, 74)

FOOTER_TEXT = "คู่มือการใช้งานระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (RTSAS) — รพ.บางคล้า"

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

def add_p(doc, text="", size_pt=16, bold=False, italic=False, color=COLOR_BLACK,
          align=WD_ALIGN_PARAGRAPH.LEFT, space_before=0, space_after=4, line_spacing=1.15, first_indent=0):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    if first_indent > 0:
        p.paragraph_format.first_line_indent = Inches(first_indent)
    if text:
        run = p.add_run(text)
        set_run_font(run, size_pt=size_pt, bold=bold, italic=italic, color=color)
    return p

def add_callout(doc, title, text, icon="💡", bg_hex="F0F9FF", border_hex="3B82F6"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, 80, 80, 120, 120)
    
    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'''
        <w:tcBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_hex}"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    r_icon = p.add_run(f"{icon} {title}: ")
    set_run_font(r_icon, size_pt=15, bold=True, color=COLOR_NAVY)
    r_text = p.add_run(text)
    set_run_font(r_text, size_pt=15, italic=False)
    
    add_p(doc, "", size_pt=6, space_after=4)

def add_toc_line(doc, title, page_str, bold=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.tab_stops.add_tab_stop(Inches(6.0), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    
    r_title = p.add_run(title)
    set_run_font(r_title, size_pt=15, bold=bold)
    
    r_tab = p.add_run('\t')
    set_run_font(r_tab, size_pt=15)
    
    r_page = p.add_run(page_str)
    set_run_font(r_page, size_pt=15, bold=bold)
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
    p_cap.paragraph_format.space_after = Pt(8)
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

def set_cell_margins(cell, top=80, bottom=80, left=100, right=100):
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

def generate_master_manual():
    print("Initializing Thai Standard Master Manual (.docx)...")
    doc = Document()
    
    # Set page standard (Left 1.5 in, Right 1.0 in, Top 1.0 in, Bottom 1.0 in)
    section = doc.sections[0]
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.5)
    section.right_margin = Inches(1.0)
    section.different_first_page_header_footer = True
    
    setup_footer(section)

    # ===========================================================================
    # COVER PAGE (Institutional Attribution Only, No Personal Names)
    # ===========================================================================
    add_p(doc, "", size_pt=16, space_before=72)
    add_p(doc, "คู่มือการใช้งานระบบและการปฏิบัติงานทางคลินิก", size_pt=24, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์", size_pt=20, bold=True, color=COLOR_NAVY, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "Real-Time Sepsis Alert System (RTSAS)", size_pt=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)
    
    add_p(doc, "ระบบสนับสนุนการตัดสินใจทางคลินิก (Clinical Decision Support System: CDSS)", size_pt=16, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
    add_p(doc, "มาตรฐาน Surviving Sepsis Campaign (SSC 2021) และ National Early Warning Score 2 (NEWS 2)", size_pt=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=160)
    
    add_p(doc, "กลุ่มงานอุบัติเหตุและฉุกเฉิน", size_pt=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา", size_pt=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "สำนักงานสาธารณสุขจังหวัดฉะเชิงเทรา กระทรวงสาธารณสุข", size_pt=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_p(doc, "ปีงบประมาณ 2569", size_pt=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    doc.add_page_break()

    # ===========================================================================
    # PREFACE (คำนำ)
    # ===========================================================================
    add_p(doc, "คำนำ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=16)
    
    add_p(doc, "การจัดทำคู่มือการใช้งานระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (Real-Time Sepsis Alert System: RTSAS) ฉบับสมบูรณ์นี้ มีเป้าหมายสำคัญเพื่อเป็นมาตรฐานการปฏิบัติงานทางคลินิก (Standard Operating Procedures: SOP) และคู่มืออ้างอิงการใช้งานระบบคอมพิวเตอร์อย่างละเอียดทีละขั้นตอน สำหรับแพทย์ พยาบาลวิชาชีพ เภสัชกร และบุคลากรทางการแพทย์ทุกระดับ เพื่อให้ผู้ใช้งานสามารถทำความเข้าใจ เรียนรู้ และปฏิบัติการดูแลรักษาผู้ป่วยภาวะติดเชื้อในกระแสเลือด (Sepsis) ได้อย่างถูกต้อง แม่นยำ และรวดเร็วตามเกณฑ์เวลาวิกฤต Golden Hour",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "ระบบ RTSAS เป็นนวัตกรรมเว็บแอปพลิเคชันทางการแพทย์ที่พัฒนาขึ้นตามหลักการยศาสตร์คลินิก (Clinical Ergonomics) เชื่อมโยงข้อมูลเวชระเบียนผู้ป่วยแบบเรียลไทม์จากระบบฐานข้อมูลโรงพยาบาล (HOSxP) ทำการประมวลผลสัญญาณชีพและคำนวณคะแนนเตือนภัยล่วงหน้า (NEWS 2) อัตโนมัติ โดยมีจุดเด่นสำคัญคือระบบหน้าต่างป๊อปอัปแจ้งเตือนฉุกเฉิน (Emergency Pop-up Modals) ที่ส่งสัญญาณภาพและเสียงเตือนภัยทันทีที่ตรวจพบผู้ป่วยวิกฤต พร้อมทั้งมีระบบคิวแจ้งเตือนหลายราย (Multi-Alert Queue), นาฬิกานับถอยหลังการให้ยาปฏิชีวนะภายใน 60 นาที (1-Hour Sepsis Bundle Countdown), ตารางติดตามสัญญาณชีพซ้ำทุก 15 นาที 4 รอบแรก และทุก 30 นาทีในรอบถัดไป (Q15/Q30 Reassessment Schedule) ตลอดจนระบบบันทึกไทม์ไลน์คลินิกที่สามารถคัดลอกลงระบบ HOSxP ได้ 100% โดยไม่ต้องพิมพ์ซ้ำ",
          size_pt=16, first_indent=0.5, space_after=8)
          
    add_p(doc, "คู่มือฉบับนี้ถูกเรียบเรียงขึ้นโดยครอบคลุมทุกฟังก์ชัน ทุกหน้าจอ ทุกปุ่มกด และเน้นการอธิบายระบบหน้าต่างป๊อปอัป (Pop-up Systems) ก่อนเข้าสู่ขั้นตอนปฏิบัติ เพื่อให้ผู้ปฏิบัติงานเห็นภาพหน้าต่างจริงและเข้าใจว่าการกดปุ่มแต่ละปุ่มจะส่งผลอย่างไรและต้องทำสิ่งใดต่อไป คณะผู้จัดทำหวังเป็นอย่างยิ่งว่าคู่มือนี้จะเป็นประโยชน์สูงสุดต่อการปฏิบัติงาน ณ จุดดูแลผู้ป่วย และช่วยลดอัตราการเสียชีวิตจากภาวะติดเชื้อในกระแสเลือดได้อย่างยั่งยืน",
          size_pt=16, first_indent=0.5, space_after=36)
          
    add_p(doc, "คณะผู้จัดทำ", size_pt=16, bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=2)
    add_p(doc, "กลุ่มงานอุบัติเหตุและฉุกเฉิน โรงพยาบาลบางคล้า", size_pt=16, align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=2)
    add_p(doc, "กันยายน 2569", size_pt=16, align=WD_ALIGN_PARAGRAPH.RIGHT)

    doc.add_page_break()

    # ===========================================================================
    # TABLE OF CONTENTS (สารบัญ)
    # ===========================================================================
    add_p(doc, "สารบัญ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=12)
    add_toc_line(doc, "เรื่อง", "หน้า", bold=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    
    add_toc_line(doc, "คำนำ", "ก")
    add_toc_line(doc, "สารบัญภาพ", "ข")
    add_toc_line(doc, "สารบัญตาราง", "ค")
    add_toc_line(doc, "1. สถาปัตยกรรมระบบ บทบาทผู้ใช้งาน และการเข้าสู่ระบบ (System Roles & Auth)", "1")
    add_toc_line(doc, "2. ระบบหน้าต่างแจ้งเตือนฉุกเฉินและป๊อปอัปวิกฤต (Emergency Pop-up Alert Systems)", "3")
    add_toc_line(doc, "3. ภาพรวมหน้าจอหลักและการยศาสตร์คลินิก (Main Clinical Dashboard Layout)", "6")
    add_toc_line(doc, "4. การคัดแยกและการจัดการคิวผู้ป่วยในแผนก (Triage Queue & Sidebar)", "8")
    add_toc_line(doc, "5. แผงข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS (Patient Detail & NEWS Logic)", "10")
    add_toc_line(doc, "6. กระบวนการกู้ชีพ Sepsis Bundle — 4 ระยะการรักษา (4-Phase Sepsis Workflow)", "13")
    add_toc_line(doc, "7. ระบบป๊อปอัปการติดตามสัญญาณชีพและการสิ้นสุดการรักษา (Reassessment & Discharge)", "17")
    add_toc_line(doc, "8. แผงไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ HOSxP (Clinical Timeline & Export)", "20")
    add_toc_line(doc, "9. แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว (Treated Cases Dashboard)", "23")
    add_toc_line(doc, "10. การจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin (IT Admin Panel)", "25")
    add_toc_line(doc, "11. สารบัญไดเรกทอรีปุ่มกด การควบคุม และป๊อปอัปทั้งหมดของระบบ (Master Control Directory)", "27")
    add_toc_line(doc, "12. การแก้ไขปัญหาเบื้องต้นและคำถามที่พบบ่อย (Troubleshooting & FAQ)", "30")
    add_toc_line(doc, "ภาคผนวก: เกณฑ์มาตรฐาน SSC 2021, NEWS 2 และ PDPA ในเวชระเบียนฉุกเฉิน", "32")
    
    doc.add_page_break()

    # ===========================================================================
    # LIST OF FIGURES (สารบัญภาพ)
    # ===========================================================================
    add_p(doc, "สารบัญภาพ", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=12)
    add_toc_line(doc, "ภาพที่", "หน้า", bold=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    
    figures_list = [
        ("ภาพที่ 1-1 ภาพหน้าต่างเข้าสู่ระบบสำหรับบุคลากรทางการแพทย์ (Login Tab)", "2"),
        ("ภาพที่ 1-2 ภาพหน้าต่างสมัครสมาชิกและกำหนดสิทธิ์ผู้ใช้งานใหม่ (Register Tab)", "2"),
        ("ภาพที่ 2-1 ภาพหน้าต่างแจ้งเตือนฉุกเฉินภาวะเสี่ยงติดเชื้อในกระแสเลือด (Single Sepsis Alert Modal)", "4"),
        ("ภาพที่ 2-2 ภาพหน้าต่างคิวแจ้งเตือนผู้ป่วยวิกฤตพร้อมกันหลายราย (Multi-Alert Queue Modal)", "5"),
        ("ภาพที่ 3-1 ภาพรวมหน้าจอหลักระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (Clinical Ergonomics Layout)", "7"),
        ("ภาพที่ 3-2 ภาพแถบเมนูด้านบนและปุ่มควบคุมหลัก (Header Bar Controls)", "7"),
        ("ภาพที่ 4-1 ภาพแถบรายชื่อและการจำแนกคิวผู้ป่วยในแผนก (Sidebar Queue & Triage)", "9"),
        ("ภาพที่ 5-1 ภาพข้อมูลผู้ป่วยและสัญญาณชีพ 6 พารามิเตอร์ (Patient Info & Vitals Grid)", "11"),
        ("ภาพที่ 5-2 ภาพแผงตรรกะการคำนวณคะแนนเตือนภัยล่วงหน้า (NEWS Calculation Logic)", "12"),
        ("ภาพที่ 6-1 ภาพหน้าต่างยืนยันการวินิจฉัย Sepsis ของแพทย์ (Doctor Confirm Yes Dialog)", "14"),
        ("ภาพที่ 6-2 ภาพหน้าต่างยืนยันการวินิจฉัยแยกโรคไม่ใช่ Sepsis (Doctor Rule Out Dialog)", "14"),
        ("ภาพที่ 6-3 ภาพรายการ Sepsis Bundle Phase 3 ช่องกรอกข้อมูลและปุ่มข้าม", "15"),
        ("ภาพที่ 6-4 ภาพตารางการติดตามสัญญาณชีพ ทุก 15 นาที 4 รอบ และทุก 30 นาที (Reassessment Table)", "16"),
        ("ภาพที่ 7-1 ภาพหน้าต่างกระดิ่งเตือนเมื่อถึงกำหนดรอบประเมินสัญญาณชีพ (Reminder Modal)", "18"),
        ("ภาพที่ 7-2 ภาพแบบฟอร์มบันทึกสัญญาณชีพซ้ำและการคำนวณ NEWS สด (Assessment Form Modal)", "18"),
        ("ภาพที่ 7-3 ภาพหน้าต่างยืนยันการสิ้นสุดการรักษา Sepsis (End of Treatment Modal)", "19"),
        ("ภาพที่ 7-4 ภาพสถานะการรักษาเสร็จสิ้นสมบูรณ์ แถบสีเขียวและการล็อกข้อมูล (Completed Banner)", "19"),
        ("ภาพที่ 8-1 ภาพแถบไทม์ไลน์บันทึกขั้นตอนการรักษาและปุ่มคัดลอกลง HIS (Clinical Timeline & HIS Copy)", "21"),
        ("ภาพที่ 8-2 ภาพหน้าต่างสรุปรายงานสถิติประจำเวรและส่งออกข้อมูล (Export Report Modal)", "22"),
        ("ภาพที่ 9-1 ภาพแดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้วและตัวชี้วัดรายวัน (Treated Cases Dashboard)", "24"),
        ("ภาพที่ 9-2 ภาพหน้าต่างแสดงประวัติและขั้นตอนการรักษาละเอียดในหน้ารักษาแล้ว (Treated Case Timeline Modal)", "24"),
        ("ภาพที่ 10-1 ภาพหน้าจอการจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin (IT Admin Panel)", "26"),
        ("ภาพที่ 10-2 ภาพหน้าต่างยืนยันการล้างแคชปลอดภัย (Safe Sepsis Guard Dialog)", "26"),
    ]
    for fig_t, fig_p in figures_list:
        add_toc_line(doc, fig_t, fig_p)
        
    doc.add_page_break()

    # ===========================================================================
    # LIST OF TABLES (สารบัญตาราง)
    # ===========================================================================
    add_p(doc, "สารบัญตาราง", size_pt=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=12)
    add_toc_line(doc, "ตารางที่", "หน้า", bold=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    
    tables_list = [
        ("ตารางที่ 1-1 สรุปสิทธิ์และหน้าที่ของแต่ละบทบาทในระบบ RTSAS (Role-Based Access Control)", "3"),
        ("ตารางที่ 2-1 รายละเอียดปุ่มกดและการทำงานในระบบหน้าต่างแจ้งเตือนฉุกเฉิน (Alert Action Directory)", "5"),
        ("ตารางที่ 5-1 เกณฑ์การประเมินคะแนนเตือนภัยล่วงหน้า (National Early Warning Score: NEWS 2)", "12"),
        ("ตารางที่ 6-1 สถานะ 7 รูปแบบของรอบเวลาติดตามสัญญาณชีพ (Reassessment Schedule States)", "16"),
        ("ตารางที่ 11-1 สารบัญไดเรกทอรีปุ่มกดและการควบคุมทั้งหมดของระบบ RTSAS (>35 ปุ่ม)", "27"),
        ("ตารางที่ 12-1 แนวทางการแก้ไขปัญหาทางเทคนิคและคลินิกตามอาการ 8 กรณี (Troubleshooting Matrix)", "30"),
    ]
    for tab_t, tab_p in tables_list:
        add_toc_line(doc, tab_t, tab_p)
        
    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 1: สถาปัตยกรรมระบบ บทบาทผู้ใช้งาน และการเข้าสู่ระบบ
    # ===========================================================================
    add_p(doc, "1. สถาปัตยกรรมระบบ บทบาทผู้ใช้งาน และการเข้าสู่ระบบ (System Roles & Auth)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือดแบบเรียลไทม์ (Real-Time Sepsis Alert System: RTSAS) ได้รับการออกแบบขึ้นเพื่อเป็นระบบสนับสนุนการตัดสินใจทางคลินิก (Clinical Decision Support System: CDSS) ประจำห้องอุบัติเหตุและฉุกเฉิน โรงพยาบาลบางคล้า โดยทำหน้าที่เฝ้าระวังสัญญาณชีพของผู้ป่วยทุกคนที่เข้ารับการตรวจ ณ จุดคัดแยก (Triage) และห้องฉุกเฉิน (ER) เชื่อมโยงข้อมูลตรงกับระบบฐานข้อมูลโรงพยาบาล HOSxP MySQL Connection Pool แบบอัตโนมัติ โดยระบบจะคำนวณคะแนน National Early Warning Score 2 (NEWS 2) ทันทีที่มีการบันทึกหรืออัปเดตสัญญาณชีพ และแจ้งเตือนทีมแพทย์พยาบาลแบบเรียลไทม์เมื่อตรวจพบความเสี่ยง",
          size_pt=16, first_indent=0.5, space_after=6)
          
    add_p(doc, "โครงสร้างการรักษาความปลอดภัยของระบบกำหนดการเข้าถึงข้อมูลตามบทบาท (Role-Based Access Control: RBAC) แบ่งออกเป็น 3 ระดับ เพื่อให้สอดคล้องกับมาตรฐานวิชาชีพเวชกรรมและการพยาบาล:",
          size_pt=16, first_indent=0.5, space_after=4)
          
    add_p(doc, "1. แพทย์ (Doctor - 🩺): มีสิทธิ์สูงสุดในการวินิจฉัยทางคลินิก ประกอบด้วยการยืนยันภาวะติดเชื้อในกระแสเลือด (Doctor Confirmation) เพื่อสั่งเริ่มกระบวนการ Sepsis Bundle และเริ่มนับเวลาถอยหลัง 60 นาที หรือวินิจฉัยแยกโรคว่าไม่ใช่ Sepsis (Rule Out) ตลอดจนการสั่งการรักษาด้วยยาปฏิชีวนะและสารน้ำ", size_pt=16, space_after=4)
    add_p(doc, "2. พยาบาล (Nurse - 💉): มีหน้าที่หลักในการคัดแยกผู้ป่วยที่จุด Triage, บันทึกการรับเข้าห้องฉุกเฉิน, ดำเนินการตาม Sepsis Bundle (เจาะเลือดเพาะเชื้อ, ให้สารน้ำ, ให้ยาปฏิชีวนะตามคำสั่งแพทย์), บันทึกสัญญาณชีพซ้ำตามรอบเวลา (Q15/Q30), และคัดลอกบันทึกทางการพยาบาลลงระบบ HIS", size_pt=16, space_after=4)
    add_p(doc, "3. เจ้าหน้าที่ IT (IT Admin - 💻): มีสิทธิ์ในการเข้าถึงหน้าจอ Admin Panel เพื่อตรวจสอบสถานะการเชื่อมต่อฐานข้อมูล HOSxP, ตรวจสอบสถิติหน่วยความจำแคช, และการล้างแคชระบบอย่างปลอดภัยด้วย Safe Sepsis Guard", size_pt=16, space_after=8)

    add_p(doc, "1.1 ระบบหน้าต่างเข้าสู่ระบบและสมัครสมาชิก (Authentication Modals)", size_pt=17, bold=True, space_before=4, space_after=6)
    add_p(doc, "เมื่อเปิดเว็บแอปพลิเคชัน ผู้ใช้งานสามารถกดปุ่ม \"เข้าสู่ระบบ / สลับผู้ใช้งาน\" บริเวณมุมขวาบนของแถบ Header Bar เพื่อเปิดหน้าต่างป๊อปอัปจัดการบัญชีผู้ใช้งาน โดยมี 2 แท็บหลัก:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 1-1 & 1-2
    add_image_figure(doc, "pop_09_auth_login_tab.png", "ภาพที่ 1-1 ภาพหน้าต่างเข้าสู่ระบบสำหรับบุคลากรทางการแพทย์ (Login Tab)")
    
    add_p(doc, "รายละเอียดองค์ประกอบในหน้าต่างเข้าสู่ระบบ (Login Tab):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ช่องกรอกรหัสผู้ใช้งาน (Username): ระบุรหัสประจำตัวบุคลากร หรือชื่อผู้ใช้งานที่ลงทะเบียนไว้ในระบบ", size_pt=16, space_after=2)
    add_p(doc, "• ช่องกรอกรหัสผ่าน (Password): กรอกรหัสผ่าน โดยมีปุ่มไอคอนรูปดวงตา (👁️) เพื่อเปิด/ปิดการแสดงตัวอักษรรหัสผ่าน", size_pt=16, space_after=2)
    add_p(doc, "• ตัวเลือกจดจำการเข้าสู่ระบบ (Remember Me): บันทึกข้อมูล Session ในเครื่องเพื่อความสะดวกรวดเร็วในการเข้าใช้งานครั้งต่อไป", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"เข้าสู่ระบบ (Sign In)\": ตรวจสอบความถูกต้องของบัญชี เมื่อสำเร็จระบบจะปิดหน้าต่างป๊อปอัปและแสดงชื่อผู้ใช้งานพร้อมไอคอนบทบาทบน Header ทันที", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่มโปรไฟล์จำลองด่วน (Quick Demo Profiles): สำหรับการทดสอบและฝึกอบรม สามารถคลิกเลือกเพื่อสลับบทบาทได้ทันที ประกอบด้วย:", size_pt=16, space_after=2)
    add_p(doc, "   - นพ.เกียรติศักดิ์ อัศวรังสิมันต์ (สิทธิ์แพทย์ 🩺)", size_pt=16, space_after=2)
    add_p(doc, "   - พย.สุกัญญา มีชัย (สิทธิ์พยาบาล 💉)", size_pt=16, space_after=2)
    add_p(doc, "   - นายวิชา บริหารระบบ (สิทธิ์ IT Admin 💻)", size_pt=16, space_after=6)

    add_image_figure(doc, "pop_10_auth_register_tab.png", "ภาพที่ 1-2 ภาพหน้าต่างสมัครสมาชิกและกำหนดสิทธิ์ผู้ใช้งานใหม่ (Register Tab)")

    add_p(doc, "รายละเอียดองค์ประกอบในหน้าต่างสมัครสมาชิก (Register Tab):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• การเลือกบทบาทผู้ใช้งาน (Role Selector Cards): คลิกเลือก 1 ใน 3 การ์ดบทบาท ได้แก่ แพทย์ (กรอบสีเขียว), พยาบาล (กรอบสีฟ้า), หรือเจ้าหน้าที่ IT (กรอบสีม่วง)", size_pt=16, space_after=2)
    add_p(doc, "• ข้อมูลระบุตัวตน: กรอกชื่อจริง, นามสกุล, และเลขที่ใบอนุญาตประกอบวิชาชีพ (Medical License / Nursing License No.) เพื่อใช้ในการประทับตราดิจิทัลใน Audit Trail", size_pt=16, space_after=2)
    add_p(doc, "• การตั้งชื่อผู้ใช้และรหัสผ่าน: กำหนด Username และ Password พร้อมช่องยืนยันรหัสผ่าน (Confirm Password) ให้ตรงกัน", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"สมัครสมาชิก (Register)\": บันทึกข้อมูลบุคลากรลงฐานข้อมูล เมื่อลงทะเบียนสำเร็จจะได้รับสิทธิ์เข้าใช้งานตามบทบาททันที", size_pt=16, space_after=8)

    add_p(doc, "ตารางที่ 1-1 สรุปสิทธิ์และหน้าที่ของแต่ละบทบาทในระบบ RTSAS (Role-Based Access Control)", size_pt=15, bold=True, space_after=4)
    
    # Table 1-1
    t1 = doc.add_table(rows=1, cols=4)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    t1_headers = ["ฟังก์ชันการทำงาน", "แพทย์ (Doctor 🩺)", "พยาบาล (Nurse 💉)", "เจ้าหน้าที่ IT (Admin 💻)"]
    for i, h in enumerate(t1_headers):
        cell = t1.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    t1_rows = [
        ["รับทราบการแจ้งเตือนฉุกเฉิน (Alert Modal)", "✅ ทำได้", "✅ ทำได้", "👁 ดูได้อย่างเดียว"],
        ["ยืนยันการวินิจฉัย Sepsis (เริ่มนับ 60 นาที)", "✅ สิทธิ์เฉพาะแพทย์", "❌ ไม่มีสิทธิ์", "❌ ไม่มีสิทธิ์"],
        ["วินิจฉัยแยกโรคไม่ใช่ Sepsis (Rule Out)", "✅ สิทธิ์เฉพาะแพทย์", "❌ ไม่มีสิทธิ์", "❌ ไม่มีสิทธิ์"],
        ["บันทึกการคัดแยก & รับเข้า ER (Phase 1)", "✅ ทำได้", "✅ หน้าที่หลัก", "❌ ไม่มีสิทธิ์"],
        ["บันทึกหัตถการ Sepsis Bundle (Phase 3)", "✅ สั่งการรักษา", "✅ ผู้บันทึกปฏิบัติ", "❌ ไม่มีสิทธิ์"],
        ["บันทึกสัญญาณชีพซ้ำ Q15/Q30 (Phase 4)", "✅ ทำได้", "✅ หน้าที่หลัก", "❌ ไม่มีสิทธิ์"],
        ["ยืนยันสิ้นสุดการรักษา (End Treatment)", "✅ ทำได้", "✅ ทำได้", "❌ ไม่มีสิทธิ์"],
        ["คัดลอกข้อความขั้นตอนลง HIS (HOSxP)", "✅ ทำได้", "✅ ทำได้", "✅ ทำได้"],
        ["ส่งออกรายงานประจำเวร (CSV/PDF)", "✅ ทำได้", "✅ ทำได้", "✅ ทำได้"],
        ["ดูแดชบอร์ดเคสที่รักษาแล้ว (KPI Audit)", "✅ ทำได้", "✅ ทำได้", "✅ ทำได้"],
        ["เข้าถึง Admin Panel & ล้างแคชปลอดภัย", "❌ ไม่มีสิทธิ์", "❌ ไม่มีสิทธิ์", "✅ สิทธิ์เฉพาะ IT Admin"],
    ]
    for r_idx, r_data in enumerate(t1_rows):
        row = t1.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 60, 60, 80, 80)
            if r_idx % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=13, bold=True)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                color = COLOR_GREEN if "✅" in val else (COLOR_RED if "❌" in val else COLOR_BLACK)
                set_run_font(run, size_pt=13, bold=("เฉพาะ" in val or "หน้าที่" in val), color=color)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 2: ระบบหน้าต่างแจ้งเตือนฉุกเฉินและป๊อปอัปวิกฤต
    # ===========================================================================
    add_p(doc, "2. ระบบหน้าต่างแจ้งเตือนฉุกเฉินและป๊อปอัปวิกฤต (Emergency Pop-up Alert Systems)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "หัวใจสำคัญที่สุดในการช่วยชีวิตผู้ป่วยภาวะติดเชื้อในกระแสเลือด คือ \"ความรวดเร็วในการตรวจพบและเริ่มการรักษา\" ระบบ RTSAS จึงได้รับการออกแบบให้มีระบบป๊อปอัปแจ้งเตือนฉุกเฉินแบบอัตโนมัติ (Automated Emergency Pop-up System) ซึ่งจะปรากฏขึ้นขัดจังหวะหน้าจอทำงานทันทีที่ระบบตรวจพบว่าผู้ป่วยมีคะแนน NEWS 2 รวมตั้งแต่ 5 คะแนนขึ้นไป หรือมีสัญญาณชีพพารามิเตอร์ใดตัวหนึ่งวิกฤตในระดับสีแดง (Red Alert = 3 คะแนน)",
          size_pt=16, first_indent=0.5, space_after=6)
          
    add_p(doc, "2.1 หน้าต่างแจ้งเตือนฉุกเฉินกรณีผู้ป่วยเดี่ยว (Single Sepsis Alert Modal)", size_pt=17, bold=True, space_before=4, space_after=6)
    add_p(doc, "เมื่อมีผู้ป่วยเสี่ยง Sepsis ตรวจพบ ณ จุดคัดแยกหรือในห้องฉุกเฉิน หน้าต่างป๊อปอัปแจ้งเตือนสีแดงสดพร้อมเสียงไซเรนเตือนภัยจะปรากฏขึ้นบนหน้าจอของบุคลากรทุกคนในแผนกทันที:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 2-1
    add_image_figure(doc, "pop_01_sepsis_alert_modal.png", "ภาพที่ 2-1 ภาพหน้าต่างแจ้งเตือนฉุกเฉินภาวะเสี่ยงติดเชื้อในกระแสเลือด (Single Sepsis Alert Modal)")

    add_p(doc, "การแจกแจงองค์ประกอบและปุ่มกดใน Single Sepsis Alert Modal:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. แถบหัวเรื่องสีแดง (Red Header Banner): แสดงไอคอนไซเรนกระพริบ 🚨 ข้อความเตือน \"🔴 แจ้งเตือน — เสี่ยงติดเชื้อในกระแสเลือด\" พร้อมคำชี้แจง \"ระบบตรวจพบคะแนน NEWS เกินเกณฑ์ — ต้องประเมินทันที\"", size_pt=16, space_after=3)
    add_p(doc, "2. ป้ายคิวแจ้งเตือน (Pending Queue Badge): หากมีเคสวิกฤตอื่นรออยู่ บริเวณมุมขวาบนของหน้าจอจะมีป้ายสีแดงแสดงว่า \"🔔 รอแจ้งเตือนอีก X ราย\"", size_pt=16, space_after=3)
    add_p(doc, "3. การ์ดข้อมูลผู้ป่วย (Patient Info Card): แสดงรหัส HN ปิดบัง (เช่น HN****0187 - นายสมศักดิ์ วรเดช), เพศ, อายุ, เวลาที่คัดกรองเข้ามายัง ER และกล่องข้อความอาการสำคัญ (Chief Complaint) ที่คัดลอกมาจากระบบ HOSxP เช่น \"มีไข้สูง หนาวสั่น ซึมลง สับสน หายใจหอบเหนื่อย\"", size_pt=16, space_after=3)
    add_p(doc, "4. การ์ดคะแนนเตือนภัย NEWS Score ขนาดใหญ่: แสดงตัวเลขคะแนนรวม เช่น 16 คะแนน พร้อมชิปแสดงค่าสัญญาณชีพที่ผิดปกติและคะแนนย่อย เช่น [RR 26 bpm +3], [SpO₂ 90% +3], [TEMP 39.5°C +2], [SBP 86 mmHg +3], [HR 126 bpm +2], [GCS 13 (V) +3] ทำให้ทีมแพทย์ทราบสาเหตุวิกฤตได้ภายในเสี้ยววินาที", size_pt=16, space_after=3)
    add_p(doc, "5. กล่องสรุปเกณฑ์และขั้นตอนต่อไป: ชี้แจงแนวปฏิบัติ \"NEWS ≥ 5 → เสี่ยงติดเชื้อในกระแสเลือด; ขั้นตอนต่อไป: ประเมินซ้ำที่จุดคัดแยก → นำเข้าห้อง ER → รายงานแพทย์เวรทันที\"", size_pt=16, space_after=3)
    add_p(doc, "6. ปุ่มแอ็กชันหลัก \"✅ รับทราบ — เริ่มกระบวนการดูแลภาวะติดเชื้อในกระแสเลือด\":", size_pt=16, bold=True, color=COLOR_RED, space_after=2)
    add_p(doc, "   • การทำงานเมื่อกดปุ่ม: ระบบจะทำการปิดหน้าต่างป๊อปอัป, ปิดเสียงไซเรน, ไฮไลต์เลือกผู้ป่วยรายนี้ใน Sidebar โดยอัตโนมัติ, เปิดแผงกู้ชีพ Sepsis Bundle ขึ้นมาที่คอลัมน์กลาง, ปลดล็อก Phase 1 (Initial Response), และบันทึกประทับเวลาการรับทราบเคส (Acknowledgement Timestamp) ส่งไปยังฐานข้อมูล MySQL", size_pt=16, space_after=3)
    add_p(doc, "7. ปุ่มปิดหน้าต่าง [✕] และระบบความปลอดภัย Smart Dismissal Guard: หากผู้ใช้กดปุ่ม [✕] เพื่อปิดหน้าต่าง ระบบจะบันทึกสถานะว่ารับทราบแล้วเช่นกันเพื่อไม่ให้เกิดการแจ้งเตือนซ้ำซ้อน แต่ผู้ป่วยจะยังคงถูกติดป้ายสีแดง \"🔴 เสี่ยงติดเชื้อในกระแสเลือด\" ค้างไว้ในคิวเพื่อป้องกันเคสตกหล่น (Zero Missed Sepsis Guarantee)", size_pt=16, space_after=8)

    add_p(doc, "2.2 หน้าต่างคิวแจ้งเตือนผู้ป่วยวิกฤตพร้อมกันหลายราย (Multi-Alert Queue Modal)", size_pt=17, bold=True, space_before=4, space_after=6)
    add_p(doc, "ในกรณีที่มีผู้ป่วยภาวะวิกฤตสงสัย Sepsis ถูกนำส่งเข้ามาหรือมีอาการทรุดลงพร้อมกันมากกว่า 1 รายในหอผู้ป่วยฉุกเฉิน ระบบ RTSAS จะเปิดหน้าต่างคิวแจ้งเตือนวิกฤตหลายราย (Multi-Alert Queue) เพื่อให้หัวหน้าเวรหรือแพทย์เวรสามารถจัดลำดับความเร่งด่วนในการช่วยเหลือได้อย่างเป็นระบบ:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 2-2
    add_image_figure(doc, "pop_02_multi_alert_queue.png", "ภาพที่ 2-2 ภาพหน้าต่างคิวแจ้งเตือนผู้ป่วยวิกฤตพร้อมกันหลายราย (Multi-Alert Queue Modal)")

    add_p(doc, "รายละเอียดองค์ประกอบและการควบคุมใน Multi-Alert Queue Modal:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ส่วนหัว (Header): แสดงข้อความ \"🚨 คิวผู้ป่วยเสี่ยง Sepsis ระดับสูง\" พร้อมระบุจำนวนเคส เช่น \"พบผู้ป่วย 2 ราย ที่ต้องได้รับการประเมินทันที\"", size_pt=16, space_after=2)
    add_p(doc, "• รายการการ์ดผู้ป่วยในคิว (Patient Queue Cards): แสดงรายการผู้ป่วยเรียงตามลำดับความรุนแรงของคะแนน NEWS โดยแต่ละการ์ดแสดงรหัส HN, เพศ, อายุ, คะแนน NEWS สีแดงเด่นชัด, และอาการสำคัญของแต่ละราย", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"รับทราบ\" ประจำการ์ดแต่ละราย: เมื่อกดปุ่มนี้ ระบบจะรับทราบเคสของผู้ป่วยรายนั้นทันที และสลับคอลัมน์การทำงานหลักไปยังผู้ป่วยรายดังกล่าวเพื่อเริ่มขั้นตอนการรักษา", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"✅ รับทราบทั้งหมด (X ราย)\": ปุ่มสีแดงขนาดใหญ่บริเวณด้านล่าง ช่วยให้แพทย์หรือพยาบาลสามารถกดรับทราบเคสทั้งหมดพร้อมกันในคลิกเดียว โดยระบบจะทำการบันทึก Audit Log และเปิดกระบวนการ Sepsis Workflow ให้กับผู้ป่วยทุกรายในคิวทันที", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ปิด\": ปิดหน้าต่างคิวเพื่อกลับสู่หน้าจอหลัก โดยเคสผู้ป่วยทั้งหมดยังคงแสดงป้ายเตือนสีแดงเด่นชัดอยู่ใน Sidebar", size_pt=16, space_after=8)

    add_p(doc, "ตารางที่ 2-1 รายละเอียดปุ่มกดและการทำงานในระบบหน้าต่างแจ้งเตือนฉุกเฉิน (Alert Action Directory)", size_pt=15, bold=True, space_after=4)
    
    # Table 2-1
    t2 = doc.add_table(rows=1, cols=4)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    t2_headers = ["หน้าต่างป๊อปอัป", "ชื่อปุ่มกด / สวิตช์", "สิทธิ์การกด", "ผลลัพธ์การทำงานและขั้นตอนถัดไป"]
    for i, h in enumerate(t2_headers):
        cell = t2.cell(0, i)
        set_cell_background(cell, "DC2626")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    t2_rows = [
        ["Single Alert Modal", "✅ รับทราบ — เริ่มกระบวนการ...", "แพทย์ / พยาบาล", "ปิดป๊อปอัป, ปิดเสียงไซเรน, เลือกผู้ป่วยในคิว, ปลดล็อก Phase 1, ส่งประทับเวลาสู่ MySQL"],
        ["Single Alert Modal", "ปุ่มปิด [✕]", "ทุกบทบาท", "ปิดป๊อปอัป, บันทึกการรับทราบ, คงสถานะป้ายแดงบนการ์ดผู้ป่วยใน Sidebar"],
        ["Multi-Alert Modal", "รับทราบ (ประจำการ์ด)", "แพทย์ / พยาบาล", "รับทราบเฉพาะผู้ป่วยรายที่เลือก, สลับหน้าจอไปยังผู้ป่วยรายนั้น, นำออกจากคิวเตือน"],
        ["Multi-Alert Modal", "✅ รับทราบทั้งหมด (X ราย)", "แพทย์ / พยาบาล", "รับทราบผู้ป่วยทุกรายในคิวพร้อมกัน, เริ่มต้น Workflow ทุกเคส, ปิดหน้าต่าง"],
        ["Multi-Alert Modal", "ปุ่ม \"ปิด\"", "ทุกบทบาท", "ปิดหน้าต่างคิว, เคสทั้งหมดยังคงรออยู่ใน Sidebar Queue พร้อมป้ายสีแดง"],
        ["Header Bar", "ปุ่มควบคุมเสียงไซเรน 🔔 / 🔕", "ทุกบทบาท", "เปิดหรือปิดเสียงไซเรนแจ้งเตือนฉุกเฉิน (Mute / Unmute Audio Chime)"],
    ]
    for r_idx, r_data in enumerate(t2_rows):
        row = t2.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 60, 60, 80, 80)
            if r_idx % 2 == 1:
                set_cell_background(cell, "FEF2F2")
            p = cell.paragraphs[0]
            if c_idx == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=13, bold=True, color=COLOR_RED if "✅" in val else COLOR_BLACK)
            elif c_idx == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                set_run_font(run, size_pt=12, bold=True, color=COLOR_NAVY)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=13)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 3: ภาพรวมหน้าจอหลักและการยศาสตร์คลินิก
    # ===========================================================================
    add_p(doc, "3. ภาพรวมหน้าจอหลักและการยศาสตร์คลินิก (Main Clinical Dashboard Layout)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "แดชบอร์ดหลักของระบบ RTSAS ได้รับการออกแบบตามหลักการยศาสตร์คลินิก (Clinical Ergonomics) โดยจัดสรรพื้นที่หน้าจอออกเป็น 3 คอลัมน์หลักที่มีความสัมพันธ์กันอย่างลงตัว เพื่อให้ทีมแพทย์และพยาบาลสามารถมองเห็นข้อมูลสำคัญทั้งหมดได้ในหน้าจอเดียวโดยไม่ต้องเลื่อนหน้าจอไปมา (Zero Clutter, High Context):",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 3-1 & 3-2
    add_image_figure(doc, "scr_01_main_dashboard_layout.png", "ภาพที่ 3-1 ภาพรวมหน้าจอหลักระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (Clinical Ergonomics Layout)")

    add_p(doc, "โครงสร้าง 3 คอลัมน์บนแดชบอร์ดคลินิก:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. คอลัมน์ซ้าย (Sidebar Queue - ความกว้าง 260px): ศูนย์กลางการคัดแยกผู้ป่วยในแผนก แสดงรายชื่อผู้ป่วยทั้งหมด เรียงลำดับตามความเร่งด่วน พร้อมป้ายเตือนความเสี่ยงและคะแนน NEWS", size_pt=16, space_after=2)
    add_p(doc, "2. คอลัมน์กลาง (Workflow Panel - พื้นที่ยืดหยุ่น Flex-1): ศูนย์กลางการปฏิบัติการกู้ชีพ Sepsis Bundle แสดงแถบนับเวลาถอยหลัง 60 นาที, รายการเช็คลิสต์ 4 ระยะ, และแท็บประวัติการรักษา (Timeline)", size_pt=16, space_after=2)
    add_p(doc, "3. คอลัมน์ขวา (Detail Panel - ความกว้าง 360px): ศูนย์รวมข้อมูลทางคลินิก ประกอบด้วยการ์ดข้อมูลผู้ป่วย (Patient Info), กล่องอาการสำคัญ (Chief Complaint), การ์ดสัญญาณชีพ 6 พารามิเตอร์ (Vital Signs Grid), และแผงตรรกะการคิดคะแนน NEWS", size_pt=16, space_after=8)

    add_image_figure(doc, "scr_02_header_bar.png", "ภาพที่ 3-2 ภาพแถบเมนูด้านบนและปุ่มควบคุมหลัก (Header Bar Controls)", width_inches=6.0)

    add_p(doc, "รายละเอียดปุ่มกดและการควบคุมบนแถบเมนูด้านบน (Header Bar):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ตราสัญลักษณ์และชื่อหน่วยงาน: แสดงชื่อ \"ห้องอุบัติเหตุและฉุกเฉิน โรงพยาบาลบางคล้า\" เพื่อยืนยันบริบทการใช้งาน", size_pt=16, space_after=2)
    add_p(doc, "• นาฬิกาดิจิทัลแสดงเวลาปัจจุบัน: แสดงเวลาเรียลไทม์ระดับวินาที (เช่น 14:35:12 น.) พร้อมวันที่ เพื่อใช้เทียบเคียงกับเวลาการรักษา", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่มควบคุมเสียงแจ้งเตือน (🔔 / 🔕): คลิกเพื่อสลับเปิดหรือปิดเสียงไซเรนฉุกเฉิน เมื่อปิดเสียงจะมีไอคอนขีดฆ่าเตือนว่าปิดเสียงอยู่", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่มเข้าสู่ระบบ / โปรไฟล์ผู้ใช้งาน: แสดงไอคอนบทบาท (🩺/💉/💻) และชื่อบุคลากรผู้ใช้งานปัจจุบัน เมื่อคลิกจะเปิดหน้าต่าง Auth Modal", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"✅ แดชบอร์ดเคสที่รักษาแล้ว (Treated Dashboard)\": คลิกเพื่อสลับมุมมองไปยังหน้าจอสรุปสถิติผู้ป่วยที่เสร็จสิ้นการรักษา", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"💻 Admin Panel\": ปรากฏขึ้นเฉพาะผู้ใช้งานสิทธิ์ IT Admin เพื่อเข้าสู่หน้าจอตรวจสอบระบบและหน่วยความจำแคช", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"📊 ส่งออกรายงาน (Export Report)\": เปิดหน้าต่างสรุปตัวเลขสถิติประจำเวร และส่งออกไฟล์รายงานในรูปแบบ CSV หรือ PDF", size_pt=16, space_after=6)

    add_p(doc, "แถบแสดงสถานะระบบด้านล่างสุด (Bottom Status Bar):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "แถบ Status Bar สีเข้มบริเวณขอบล่างของหน้าจอ ทำหน้าที่รายงานสถานะทางเทคนิคแบบเรียลไทม์ ประกอบด้วย: สถานะการเชื่อมต่อฐานข้อมูล HOSxP MySQL (🟢 เชื่อมต่อปกติ), สถิติแคชในหน่วยความจำ (จำนวน Vitals และ Patients ที่เก็บอยู่), จำนวนเคส Sepsis ที่กำลังรักษาในระบบ, และเวลาที่ระบบทำการซิงค์ข้อมูลครั้งล่าสุด", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 4: การคัดแยกและการจัดการคิวผู้ป่วยในแผนก
    # ===========================================================================
    add_p(doc, "4. การคัดแยกและการจัดการคิวผู้ป่วยในแผนก (Triage Queue & Sidebar)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "แถบรายชื่อผู้ป่วยด้านซ้าย (Sidebar) ทำหน้าที่เป็นศูนย์กลางการคัดแยก (Triage Queue Management) ช่วยให้พยาบาลจุดคัดแยกและแพทย์เวรสามารถมองเห็นภาพรวมของผู้ป่วยทุกคนในแผนกได้อย่างชัดเจน โดยมีการอัปเดตข้อมูลจาก HOSxP อัตโนมัติทุกๆ 30 วินาที พร้อมระบบจัดลำดับความเร่งด่วนตามระดับความเสี่ยงทางการแพทย์",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 4-1
    add_image_figure(doc, "scr_03_sidebar_queue.png", "ภาพที่ 4-1 ภาพแถบรายชื่อและการจำแนกคิวผู้ป่วยในแผนก (Sidebar Queue & Triage)", width_inches=2.6)

    add_p(doc, "ฟังก์ชันการทำงานหลักในแถบ Sidebar Queue:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. แถบตัวกรองสถานะ 3 โหมด (Filter Tabs):", size_pt=16, bold=True, space_after=2)
    add_p(doc, "   • ปุ่ม \"กำลังรักษา\" (Active Patients): แสดงผู้ป่วยทั้งหมดที่อยู่ระหว่างรับการดูแลรักษาในห้องอุบัติเหตุและฉุกเฉิน", size_pt=16, space_after=2)
    add_p(doc, "   • ปุ่ม \"🔴 เสี่ยง\" (High Risk Cases): ตัวกรองด่วนเพื่อแสดงเฉพาะผู้ป่วยที่มีคะแนน NEWS ≥ 5 หรือติดป้ายเสี่ยง Sepsis", size_pt=16, space_after=2)
    add_p(doc, "   • ปุ่ม \"✅ รักษาแล้ว\" (Treated Cases): สลับไปยังแดชบอร์ดเคสที่เสร็จสิ้นการรักษาหรือถูก Rule Out เพื่อตรวจสอบประวัติย้อนหลัง", size_pt=16, space_after=4)
    add_p(doc, "2. ช่องค้นหาผู้ป่วย (Search Box): พยาบาลสามารถพิมพ์ค้นหาผู้ป่วยด้วยรหัส HN หรือหมายเลข VN ระบบจะทำการกรองรายชื่อแบบทันที (Instant Live Filter)", size_pt=16, space_after=2)
    add_p(doc, "3. ปุ่มดึงข้อมูลล่าสุด \"🔄 ดึงข้อมูล\" (Manual Pull Button): ในกรณีที่เพิ่งบันทึกสัญญาณชีพใน HOSxP และต้องการให้ระบบประมวลผลทันทีโดยไม่ต้องรอรอบ 30 วินาที พยาบาลสามารถกดปุ่มนี้เพื่อสั่งดึงข้อมูลล่าสุดได้ทันที", size_pt=16, space_after=4)
    add_p(doc, "4. องค์ประกอบบนการ์ดผู้ป่วย (Patient Card Elements):", size_pt=16, bold=True, space_after=2)
    add_p(doc, "   • รหัสประจำตัว HN ปิดบัง (HN Masked): แสดงรูปแบบ HN****0187 ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)", size_pt=16, space_after=2)
    add_p(doc, "   • ข้อมูลประชากร: เพศ, อายุ, และเวลาที่คัดกรองมาถึง (เช่น ชาย · อายุ 63 ปี · 13:45 น.)", size_pt=16, space_after=2)
    add_p(doc, "   • ป้ายเตือนความเสี่ยง (Risk Badge): ป้ายสีแดง \"🔴 เสี่ยงติดเชื้อในกระแสเลือด\" สำหรับเคสวิกฤต", size_pt=16, space_after=2)
    add_p(doc, "   • ป้ายคะแนน NEWS: ชิปตัวเลขคะแนนรวม เช่น NEWS: 16 พร้อมแถบสีตามระดับความเสี่ยง", size_pt=16, space_after=2)
    add_p(doc, "   • ป้ายนับเวลาถอยหลัง (Bundle Timer Badge): หากแพทย์ยืนยัน Sepsis แล้ว การ์ดจะแสดงเวลาที่เหลือ เช่น \"⏱️ 42:09 Sepsis Bundle\" เพื่อเตือนทุกคนในทีมให้เร่งให้ยาปฏิชีวนะให้ทัน", size_pt=16, space_after=4)
    add_p(doc, "5. ตรรกะการจัดเรียงคิวอัตโนมัติ (Urgency Auto-Sorting): ระบบจะนำผู้ป่วยที่มีภาวะ Sepsis Alert และมีคะแนน NEWS สูงสุดขึ้นมาไว้ด้านบนสุดของรายการเสมอ เพื่อให้ทีมรักษาเข้าช่วยเหลือผู้ป่วยรายที่วิกฤตที่สุดก่อน", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 5: ข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS
    # ===========================================================================
    add_p(doc, "5. แผงข้อมูลผู้ป่วย สัญญาณชีพ และการคำนวณคะแนน NEWS (Patient Detail & NEWS Logic)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "เมื่อผู้ใช้งานคลิกเลือกผู้ป่วยรายใดใน Sidebar คอลัมน์ขวาสุด (Detail Panel) จะแสดงข้อมูลรายละเอียดทางคลินิกอย่างครบถ้วน ประกอบด้วยข้อมูลเวชระเบียน, สัญญาณชีพ 6 ช่อง, และตรรกะการแจกแจงคะแนน NEWS 2 อย่างโปร่งใส ตรวจสอบได้:",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 5-1 & 5-2
    add_image_figure(doc, "scr_04_patient_vitals_cards.png", "ภาพที่ 5-1 ภาพข้อมูลผู้ป่วยและสัญญาณชีพ 6 พารามิเตอร์ (Patient Info & Vitals Grid)", width_inches=4.2)

    add_p(doc, "5.1 ข้อมูลผู้ป่วยและตารางสัญญาณชีพ 6 พารามิเตอร์:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• แถบข้อมูลผู้ป่วย (Patient Info Bar): แสดงรหัส HN ปิดบัง, เพศ, อายุ, หมายเลขเตียงฉุกเฉิน (Location: ER-01), แพทย์เจ้าของไข้, พยาบาลผู้ดูแล และป้ายเตือนการแพ้ยา (Allergies Badge) สีแดงเด่นชัด เช่น [⚠️ แพ้ยา Penicillin] เพื่อความปลอดภัยในการสั่งยาปฏิชีวนะ", size_pt=16, space_after=2)
    add_p(doc, "• กล่องอาการสำคัญ (Chief Complaint Box): แสดงข้อความอาการสำคัญที่พยาบาลคัดกรองบันทึกไว้ พร้อมระบบตัดคำข้อความยาวอัตโนมัติ (Text Wrapping) เพื่อให้อ่านง่าย ชัดเจน ไม่ล้นกรอบ", size_pt=16, space_after=2)
    add_p(doc, "• ตารางสัญญาณชีพ 6 ช่อง (Vital Signs Grid): แสดงผลค่าสัญญาณชีพล่าสุดแยกเป็นการ์ด 6 พารามิเตอร์หลัก พร้อมคะแนนย่อย:", size_pt=16, space_after=2)
    add_p(doc, "   1) อัตราการหายใจ (Respiratory Rate - RR): เช่น 26 ครั้ง/นาที (+3 คะแนน)", size_pt=16, space_after=2)
    add_p(doc, "   2) ความเข้มข้นออกซิเจนในเลือด (SpO₂): เช่น 90% (+3 คะแนน) พร้อมระบุการใช้ออกซิเจนเสริม", size_pt=16, space_after=2)
    add_p(doc, "   3) ความดันโลหิต (Blood Pressure - SBP/DBP): เช่น 86/50 mmHg (+3 คะแนน จาก SBP ต่ำ)", size_pt=16, space_after=2)
    add_p(doc, "   4) ชีพจร / อัตราการเต้นของหัวใจ (Heart Rate - HR): เช่น 126 ครั้ง/นาที (+2 คะแนน)", size_pt=16, space_after=2)
    add_p(doc, "   5) อุณหภูมิร่างกาย (Body Temperature - BT): เช่น 39.5 °C (+2 คะแนน)", size_pt=16, space_after=2)
    add_p(doc, "   6) ระดับความรู้สึกตัว (Consciousness): เช่น GCS 13 แปลงเป็น AVPU = Voice (+3 คะแนน)", size_pt=16, space_after=6)

    add_image_figure(doc, "scr_05_news_calculation_logic.png", "ภาพที่ 5-2 ภาพแผงตรรกะการคำนวณคะแนนเตือนภัยล่วงหน้า (NEWS Calculation Logic)", width_inches=4.2)

    add_p(doc, "5.2 ตรรกะการคำนวณคะแนน NEWS 2 (NEWS Calculation Logic):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "ระบบแสดงคะแนนรวมขนาดใหญ่ เช่น \"16 คะแนน — ความเสี่ยงสูงมาก\" พร้อมแสดงตารางแจกแจงเกณฑ์คะแนนตามมาตรฐาน Royal College of Physicians (NEWS 2) โดยมีกลไกสำคัญคือ Single-Parameter Red Alert หากมีค่าสัญญาณชีพตัวใดตัวหนึ่งผิดปกติรุนแรงจนได้คะแนน +3 ระบบจะจัดผู้ป่วยอยู่ในกลุ่มเสี่ยงสูงทันทีแม้คะแนนรวมจะยังไม่ถึง 5 คะแนนก็ตาม", size_pt=16, space_after=6)

    add_p(doc, "ตารางที่ 5-1 เกณฑ์การประเมินคะแนนเตือนภัยล่วงหน้า (National Early Warning Score: NEWS 2)", size_pt=15, bold=True, space_after=4)
    
    # Table 5-1
    t5 = doc.add_table(rows=1, cols=8)
    t5.alignment = WD_TABLE_ALIGNMENT.CENTER
    t5_headers = ["พารามิเตอร์", "3 คะแนน", "2 คะแนน", "1 คะแนน", "0 คะแนน", "1 คะแนน", "2 คะแนน", "3 คะแนน"]
    for i, h in enumerate(t5_headers):
        cell = t5.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 60, 60, 60, 60)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=11, bold=True, color=RGBColor(255, 255, 255))
        
    t5_rows = [
        ["อัตราการหายใจ (RR)", "≤ 8", "--", "9 - 11", "12 - 20", "--", "21 - 24", "≥ 25"],
        ["ความเข้มข้นออกซิเจน (SpO₂)", "≤ 91", "92 - 93", "94 - 95", "≥ 96", "--", "--", "--"],
        ["การให้ออกซิเจนเสริม", "--", "ใช้ออกซิเจน", "--", "Room Air", "--", "--", "--"],
        ["ความดันโลหิตตัวบน (SBP)", "≤ 90", "91 - 100", "101 - 110", "111 - 219", "--", "--", "≥ 220"],
        ["ชีพจร / HR (ครั้ง/นาที)", "≤ 40", "--", "41 - 50", "51 - 90", "91 - 110", "111 - 130", "≥ 131"],
        ["อุณหภูมิร่างกาย (°C)", "≤ 35.0", "--", "35.1 - 36.0", "36.1 - 38.0", "38.1 - 39.0", "≥ 39.1", "--"],
        ["ระดับความรู้สึกตัว (AVPU)", "--", "--", "--", "Alert (A)", "--", "--", "V / P / U"],
    ]
    for r_idx, r_data in enumerate(t5_rows):
        row = t5.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 40, 40, 40, 40)
            if r_idx % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if c_idx > 0 else WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(val)
            set_run_font(run, size_pt=11, bold=(c_idx == 0))

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 6: กระบวนการกู้ชีพ Sepsis Bundle — 4 ระยะการรักษา
    # ===========================================================================
    add_p(doc, "6. กระบวนการกู้ชีพ Sepsis Bundle — 4 ระยะการรักษา (4-Phase Sepsis Workflow)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "คอลัมน์กลางของหน้าจอเป็นศูนย์รวมการปฏิบัติการกู้ชีพ Sepsis Bundle ซึ่งถูกออกแบบเป็นระบบเช็คลิสต์ 4 ระยะ (4-Phase Clinical Checklist) ตามแนวทาง Surviving Sepsis Campaign (SSC 2021) 1-Hour Bundle โดยมีนาฬิกานับเวลาถอยหลัง 60:00 นาที Golden Hour กำกับอย่างเคร่งครัด:",
          size_pt=16, first_indent=0.5, space_after=6)

    add_p(doc, "6.1 Phase 1: การตอบสนองเบื้องต้นหลังแจ้งเตือน (Initial Response)", size_pt=17, bold=True, space_before=2, space_after=4)
    add_p(doc, "ประกอบด้วย 3 ขั้นตอนแรกของพยาบาลจุดคัดแยก เมื่อปฏิบัติสำเร็จให้คลิกเช็คลิสต์:", size_pt=16, first_indent=0.5, space_after=2)
    add_p(doc, "• ข้อ 1: \"ประเมินอาการผู้ป่วยซ้ำที่จุดคัดแยก\" — วัดสัญญาณชีพซ้ำเพื่อยืนยันความถูกต้อง", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 2: \"นำผู้ป่วยเข้ารับการรักษาในห้องอุบัติเหตุและฉุกเฉิน\" — ย้ายเข้าเตียงวิกฤต ER ทันที", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 3: \"รายงานแพทย์เวรทันที\" — รายงานแพทย์เพื่อขอการประเมินทางคลินิก", size_pt=16, space_after=6)

    add_p(doc, "6.2 Phase 2: การวินิจฉัยและตัดสินใจของแพทย์ (Doctor Confirmation vs Rule Out)", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เป็นจุดเปลี่ยนสำคัญทางคลินิก (Clinical Gatekeeper) เฉพาะผู้ใช้สิทธิ์แพทย์เท่านั้นที่จะสามารถกดปุ่มยืนยันหรือ Rule Out ได้ โดยมีหน้าต่างยืนยันเพื่อป้องกันความผิดพลาด:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 6-1 & 6-2
    add_image_figure(doc, "pop_05_doctor_confirm_dialog.png", "ภาพที่ 6-1 ภาพหน้าต่างยืนยันการวินิจฉัย Sepsis ของแพทย์ (Doctor Confirm Yes Dialog)")
    
    add_p(doc, "รายละเอียดกล่องยืนยันการวินิจฉัย Sepsis (Doctor Confirm Yes Dialog):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ข้อความเตือน: \"⚠️ ยืนยันว่าผู้ป่วยมีภาวะติดเชื้อในกระแสเลือด (Sepsis)? การยืนยันนี้จะเริ่มนับถอยหลัง 60 นาทีสำหรับ Sepsis Bundle ทันที\"", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ยืนยัน\": เมื่อแพทย์คลิกยืนยัน ระบบจะทำสิ่งต่อไปนี้ทันที:", size_pt=16, space_after=2)
    add_p(doc, "   1) เริ่มต้นนาฬิกานับเวลาถอยหลัง 60:00 นาที Golden Hour ทันที", size_pt=16, space_after=2)
    add_p(doc, "   2) ปลดล็อก Phase 3 (Hour-1 Sepsis Bundle) ให้พยาบาลเริ่มปฏิบัติการได้", size_pt=16, space_after=2)
    add_p(doc, "   3) บันทึกชื่อแพทย์ผู้ยืนยันและประทับเวลาลงใน Audit Trail", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ยกเลิก\": ปิดกล่องยืนยันเพื่อกลับไปตรวจสอบข้อมูลทางคลินิกเพิ่มเติม", size_pt=16, space_after=6)

    add_image_figure(doc, "pop_06_doctor_rule_out_dialog.png", "ภาพที่ 6-2 ภาพหน้าต่างยืนยันการวินิจฉัยแยกโรคไม่ใช่ Sepsis (Doctor Rule Out Dialog)")

    add_p(doc, "รายละเอียดกล่องยืนยัน Rule Out Sepsis (Doctor Rule Out Dialog):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ข้อความเตือน: \"🛑 ยืนยันว่าไม่ใช่ภาวะติดเชื้อในกระแสเลือด (Rule Out)? กระบวนการ Sepsis จะยุติลงสำหรับผู้ป่วยรายนี้\"", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ยืนยัน Rule Out\": เมื่อแพทย์คลิก ระบบจะยุติกระบวนการ Sepsis ทั้งหมดทันที, ลบแถบนับถอยหลัง 60 นาที, บันทึกเหตุผลการ Rule Out, และย้ายเคสนี้ไปจัดเก็บในแดชบอร์ดเคสที่รักษาแล้วในสถานะ \"Rule Out Sepsis\"", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ยกเลิก\": ปิดกล่องยืนยันเพื่อกลับสู่หน้าจอปกติ", size_pt=16, space_after=8)

    add_p(doc, "6.3 Phase 3: Hour-1 Sepsis Bundle ปฏิบัติการกู้ชีพภายใน 60 นาที", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เมื่อแพทย์ยืนยัน Sepsis แล้ว Phase 3 จะปลดล็อกทันที พยาบาลและทีมกู้ชีพต้องปฏิบัติการ 7 ข้อให้ครบถ้วนภายใน 60 นาที:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 6-3
    add_image_figure(doc, "scr_07_sepsis_bundle_phase3.png", "ภาพที่ 6-3 ภาพรายการ Sepsis Bundle Phase 3 ช่องกรอกข้อมูลและปุ่มข้าม")

    add_p(doc, "รายละเอียดรายการใน Sepsis Bundle Phase 3:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ข้อ 1: \"เจาะเลือดเพาะเชื้อ (Hemoculture 1)\" — พร้อมช่องกรอกตำแหน่งหลอดเลือดดำ เช่น Left median cubital vein แล้วกดบันทึก", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 2: \"เจาะเลือดเพาะเชื้อ (Hemoculture 2)\" — ช่องกรอกตำแหน่งหลอดเลือดดำ เช่น Right cephalic vein แล้วกดบันทึก", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 3: \"ให้สารน้ำทางหลอดเลือดดำ (IV Fluid Loading)\" — ช่องกรอกชนิดและปริมาณ เช่น NSS 1,000 ml IV load in 1 hr แล้วกดบันทึก", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 4: \"ให้ยาปฏิชีวนะ (Antibiotics 1)\" — ช่องกรอกชื่อยาและขนาดยา เช่น Ceftriaxone 2g IV drip in 30 min แล้วกดบันทึก", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 5: \"ให้ยาปฏิชีวนะ (Antibiotics 2 - Optional)\" — หากแพทย์สั่งยาเพียงตัวเดียว สามารถคลิกปุ่ม \"⏭ ข้ามขั้นตอนนี้\" ได้อย่างถูกต้อง", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 6: \"ใส่สายสวนปัสสาวะ (Foley Catheter - Optional)\" — สามารถกดบันทึกหรือคลิก \"⏭ ข้ามขั้นตอนนี้\" ตามดุลยพินิจของแพทย์", size_pt=16, space_after=2)
    add_p(doc, "• ข้อ 7: \"ส่ง Lactate Level\" — ตรวจระดับ Lactate ในเลือดเพื่อประเมินภาวะ Tissue Hypoperfusion", size_pt=16, space_after=8)

    add_p(doc, "6.4 Phase 4: การติดตามสัญญาณชีพซ้ำตามรอบเวลา (Vital Signs Reassessment Schedule)", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เมื่อหัตถการกู้ชีพใน Phase 3 ดำเนินการเรียบร้อยแล้ว ระบบจะปลดล็อก Phase 4 เพื่อเข้าสู่กระบวนการติดตามสัญญาณชีพซ้ำตามเกณฑ์มาตรฐานสากล โดยแบ่งโครงสร้างรอบเวลาออกเป็น:", size_pt=16, first_indent=0.5, space_after=4)
    add_p(doc, "• 4 รอบแรก (รอบที่ 1 ถึง 4): ติดตามสัญญาณชีพซ้ำทุก 15 นาที (Q15)", size_pt=16, space_after=2)
    add_p(doc, "• รอบที่ 5 เป็นต้นไป: ติดตามสัญญาณชีพซ้ำทุก 30 นาที (Q30)", size_pt=16, space_after=6)

    # FIGURE 6-4
    add_image_figure(doc, "scr_08_reassessment_table.png", "ภาพที่ 6-4 ภาพตารางการติดตามสัญญาณชีพ ทุก 15 นาที 4 รอบ และทุก 30 นาที (Reassessment Table)")

    add_p(doc, "ตารางที่ 6-1 สถานะ 7 รูปแบบของรอบเวลาติดตามสัญญาณชีพ (Reassessment Schedule States)", size_pt=15, bold=True, space_after=4)
    
    # Table 6-1
    t6 = doc.add_table(rows=1, cols=4)
    t6.alignment = WD_TABLE_ALIGNMENT.CENTER
    t6_headers = ["สถานะรอบเวลา", "สัญลักษณ์ / ป้ายสี", "เงื่อนไขเวลา", "การทำงานของปุ่มและการปฏิบัติ"]
    for i, h in enumerate(t6_headers):
        cell = t6.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    t6_rows = [
        ["Completed (เสร็จแล้ว)", "🟢 สีเขียว (✓)", "บันทึกข้อมูลเรียบร้อยแล้ว", "แสดงคะแนน NEWS และประทับเวลาที่บันทึกเสร็จ ไม่สามารถแก้ไขได้"],
        ["Due Now (ถึงกำหนด)", "🟡 สีส้ม (⚡ ถึงเวลา)", "ตรงกับเวลาเป้าหมาย ±5 นาที", "ส่งเสียงเตือนกระดิ่ง แสดงปุ่ม \"[บันทึก]\" สีส้มเด่นชัดเพื่อเปิดฟอร์ม"],
        ["Overdue (เกินกำหนด)", "🔴 สีแดง (⚠️ เกินเวลา)", "เวลาปัจจุบันเลยเป้าหมาย > 5 นาที", "แสดงเวลานับเกิน เช่น \"เกิน 04:12 นาที\" เพื่อเร่งเตือนให้พยาบาลบันทึก"],
        ["Pending (รอรอบถัดไป)", "⚪ สีเทา (⏱ รอเวลา)", "ยังไม่ถึงเวลาเป้าหมาย", "แสดงเวลานับถอยหลัง สามารถคลิกบันทึกล่วงหน้าได้หากจำเป็น"],
        ["Skipped (ข้ามรอบ)", "🔘 สีเทาขีดฆ่า", "แพทย์สั่งยุติหรือส่งต่อผู้ป่วย", "ระบุเหตุผลการข้ามรอบ และข้ามไปยังการสรุปผลการรักษา"],
    ]
    for r_idx, r_data in enumerate(t6_rows):
        row = t6.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 60, 60, 80, 80)
            if r_idx % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            if c_idx == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                set_run_font(run, size_pt=12, bold=True)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 7: ระบบป๊อปอัปการติดตามสัญญาณชีพและการสิ้นสุดการรักษา
    # ===========================================================================
    add_p(doc, "7. ระบบป๊อปอัปการติดตามสัญญาณชีพและการสิ้นสุดการรักษา (Reassessment & Discharge)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "ในระหว่างการดูแลผู้ป่วยตามรอบเวลา ระบบ RTSAS จะมีหน้าต่างป๊อปอัปสำคัญ 3 ชุด ที่คอยอำนวยความสะดวกและควบคุมความปลอดภัยทางคลินิก ได้แก่ ป๊อปอัปกระดิ่งเตือนรอบประเมิน, ป๊อปอัปแบบฟอร์มบันทึกสัญญาณชีพซ้ำ, และป๊อปอัปยืนยันการสิ้นสุดการรักษา:",
          size_pt=16, first_indent=0.5, space_after=6)

    add_p(doc, "7.1 หน้าต่างกระดิ่งเตือนเมื่อถึงกำหนดรอบประเมิน (Reminder Modal)", size_pt=17, bold=True, space_before=2, space_after=4)
    add_p(doc, "เมื่อนาฬิกาของระบบนับเวลาถอยหลังจนถึงกำหนดรอบประเมินสัญญาณชีพ (เช่น ครบ 15 นาที) ระบบจะส่งเสียงกระดิ่งเตือน (Chime) และแสดงหน้าต่างป๊อปอัป Reminder Modal:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 7-1
    add_image_figure(doc, "pop_03_reassessment_reminder.png", "ภาพที่ 7-1 ภาพหน้าต่างกระดิ่งเตือนเมื่อถึงกำหนดรอบประเมินสัญญาณชีพ (Reminder Modal)")

    add_p(doc, "รายละเอียดองค์ประกอบและการกดปุ่มใน Reminder Modal:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• ส่วนหัว: แสดงไอคอนกระดิ่งสั่นไหว 🔔 ข้อความ \"ถึงเวลาประเมินสัญญาณชีพ\" พร้อมระบุหมายเลขรอบ เช่น \"รอบที่ 4\" และเวลาเป้าหมาย เช่น \"เป้าหมาย 14:45 น.\"", size_pt=16, space_after=2)
    add_p(doc, "• ข้อมูลเคส: แสดงรหัส HN ปิดบังของผู้ป่วย และข้อความเตือนให้กรอกข้อมูลสัญญาณชีพเพื่อคำนวณคะแนน NEWS", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่มหลัก \"📝 บันทึกสัญญาณชีพ\": เมื่อคลิก ระบบจะปิดหน้าต่างกระดิ่งและเปิดแบบฟอร์ม Assessment Form Modal ขึ้นมาให้กรอกข้อมูลทันที", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่มรอง \"เลื่อนออกไป\": หากพยาบาลติดหัตถการฉุกเฉินเร่งด่วนอื่น สามารถกดปุ่มนี้เพื่อปิดหน้าต่างเตือนชั่วคราว โดยรอบเวลาจะยังคงแสดงสถานะสีส้มรออยู่", size_pt=16, space_after=6)

    add_p(doc, "7.2 แบบฟอร์มบันทึกสัญญาณชีพซ้ำและการคำนวณ NEWS สด (Assessment Form Modal)", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เป็นหน้าต่างสำหรับให้พยาบาลกรอกค่าสัญญาณชีพทั้ง 6 พารามิเตอร์ โดยมีจุดเด่นคือการคำนวณคะแนน NEWS แบบสดทันทีที่พิมพ์ (Live Calculation) และการแปลงค่าระดับความรู้สึกตัวจาก GCS เป็น AVPU อัตโนมัติ:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 7-2
    add_image_figure(doc, "pop_04_assessment_form.png", "ภาพที่ 7-2 ภาพแบบฟอร์มบันทึกสัญญาณชีพซ้ำและการคำนวณ NEWS สด (Assessment Form Modal)")

    add_p(doc, "รายละเอียดช่องกรอกและปุ่มกดใน Assessment Form Modal:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. ช่องกรอกสัญญาณชีพ 6 ช่อง:", size_pt=16, space_after=2)
    add_p(doc, "   • RR: อัตราการหายใจ (ครั้ง/นาที)", size_pt=16, space_after=2)
    add_p(doc, "   • SpO₂: ความเข้มข้นออกซิเจนในเลือด (%)", size_pt=16, space_after=2)
    add_p(doc, "   • SBP & DBP: ความดันโลหิตตัวบนและตัวล่าง (mmHg)", size_pt=16, space_after=2)
    add_p(doc, "   • HR: อัตราการเต้นของหัวใจ / ชีพจร (ครั้ง/นาที)", size_pt=16, space_after=2)
    add_p(doc, "   • BT: อุณหภูมิร่างกาย (°C)", size_pt=16, space_after=2)
    add_p(doc, "2. ช่องกรอก GCS และระบบแปลง AVPU อัตโนมัติ: กรอกตัวเลข GCS (3-15) ระบบจะแปลงเป็นป้ายตัวอักษร AVPU พร้อมแสดงสีและคะแนนทันที (GCS 15 = A [0 คะแนน], GCS 9-14 = V [+3 คะแนน], GCS 4-8 = P [+3 คะแนน], GCS 3 = U [+3 คะแนน])", size_pt=16, space_after=2)
    add_p(doc, "3. แผง Live NEWS Score Card: แสดงตัวเลขคะแนน NEWS รวมขนาดใหญ่ พร้อมป้ายระดับความเสี่ยงและสูตรการบวกคะแนนย่อยแบบเรียลไทม์", size_pt=16, space_after=2)
    add_p(doc, "4. ปุ่ม \"💾 บันทึกการประเมิน\": ตรวจสอบความครบถ้วนของข้อมูล หากครบถ้วนจะบันทึกผลลงตารางรอบเวลา, อัปเดตไปยัง Audit Trail, ส่ง Toast แจ้งเตือนสำเร็จ และคำนวณเวลารอบถัดไปทันที", size_pt=16, space_after=2)
    add_p(doc, "5. ปุ่ม \"✅ รักษาเสร็จแล้ว\": ในกรณีที่ผู้ป่วยมีสัญญาณชีพคงที่เป็นปกติและแพทย์มีคำสั่งจำหน่าย พยาบาลสามารถกดปุ่มนี้จากในฟอร์มเพื่อเริ่มขั้นตอนการสิ้นสุดการรักษาได้ทันที", size_pt=16, space_after=2)
    add_p(doc, "6. ปุ่ม \"ยกเลิก\": ปิดฟอร์มโดยไม่บันทึกข้อมูล", size_pt=16, space_after=6)

    add_p(doc, "7.3 หน้าต่างยืนยันการสิ้นสุดการรักษา (End of Treatment Confirmation Modal)", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เมื่อการรักษาเสร็จสิ้นสมบูรณ์ แพทย์หรือพยาบาลสามารถกดปุ่ม \"✅ สิ้นสุดการรักษา (รักษาเสร็จแล้ว)\" ที่อยู่ด้านล่างสุดของแผงเช็คลิสต์ ระบบจะแสดงหน้าต่าง In-app Confirmation Modal เพื่อตรวจสอบความเรียบร้อยขั้นสุดท้าย:", size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 7-3 & 7-4
    add_image_figure(doc, "pop_07_treatment_complete_modal.png", "ภาพที่ 7-3 ภาพหน้าต่างยืนยันการสิ้นสุดการรักษา Sepsis (End of Treatment Modal)")

    add_p(doc, "รายละเอียดในหน้าต่างยืนยันการสิ้นสุดการรักษา:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• การตรวจสอบความครบถ้วนของ Bundle: สรุปจำนวนหัตถการที่ทำเสร็จแล้วและข้อที่ถูกข้าม", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"✅ ยืนยันสิ้นสุดการรักษา\": เมื่อคลิกยืนยัน ระบบจะปิดแฟ้มประวัติเคสนี้, บันทึกเวลาสิ้นสุดการรักษา, แสดงแถบแบนเนอร์สีเขียว \"✓ การรักษา Sepsis เสร็จสิ้นครบถ้วนแล้ว\" (ดังภาพที่ 7-4), ปรับเปลี่ยนหน้าจอเช็คลิสต์เป็นโหมดอ่านอย่างเดียว (Read-Only Mode) ป้องกันการแก้ไขข้อมูลย้อนหลังโดยไม่ตั้งใจ, และย้ายข้อมูลเคสเข้าสู่แดชบอร์ดเคสที่รักษาแล้ว (Treated Cases Dashboard)", size_pt=16, space_after=6)

    add_image_figure(doc, "scr_09_treatment_completed_banner.png", "ภาพที่ 7-4 ภาพสถานะการรักษาเสร็จสิ้นสมบูรณ์ แถบสีเขียวและการล็อกข้อมูล (Completed Banner)")

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 8: แผงไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ HOSxP
    # ===========================================================================
    add_p(doc, "8. แผงไทม์ไลน์คลินิกและการส่งออกข้อมูลสู่ HOSxP (Clinical Timeline & Export)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "การบันทึกเวชระเบียนทางการพยาบาลเป็นภาระงานที่ใช้เวลาสูง ระบบ RTSAS จึงพัฒนาระบบไทม์ไลน์คลินิกอัตโนมัติ (Automated Clinical Timeline) ที่บันทึกทุกเหตุการณ์ หัตถการ และผลการประเมิน พร้อมประทับเวลาระดับวินาที (Timestamped Audit Trail) โดยสามารถคัดลอกข้อความ Nursing Note ทั้งหมดไปวางในระบบ HOSxP ได้ 100% ภายใน 1 วินาที:",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 8-1 & 8-2
    add_image_figure(doc, "scr_10_clinical_timeline_panel.png", "ภาพที่ 8-1 ภาพแถบไทม์ไลน์บันทึกขั้นตอนการรักษาและปุ่มคัดลอกลง HIS (Clinical Timeline & HIS Copy)")

    add_p(doc, "8.1 โครงสร้างไทม์ไลน์คลินิกและฟังก์ชันคัดลอกลง HIS (HOSxP Copy Feature):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "• การสลับแท็บ: บริเวณด้านบนของคอลัมน์กลาง ผู้ใช้งานสามารถคลิกแท็บ \"📋 ไทม์ไลน์ (Timeline)\" เพื่อดูรายการกิจกรรมทั้งหมด", size_pt=16, space_after=2)
    add_p(doc, "• ลำดับเหตุการณ์ประทับเวลา: แสดงหมายเลขขั้นตอน 1..N, วงกลมสีสถานะ (เขียว/ฟ้า/ส้ม/แดง), ข้อความการปฏิบัติ, เวลาที่ดำเนินการระดับวินาที, และชื่อผู้ปฏิบัติอย่างชัดเจน", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"📋 คัดลอกขั้นตอนการรักษาเพื่อบันทึกใน HIS\": เมื่อพยาบาลคลิกปุ่มนี้ ระบบจะนำข้อมูลขั้นตอนทั้งหมดมาจัดรูปแบบเป็นข้อความ Nursing Progress Note มาตรฐานของโรงพยาบาลบางคล้า แล้วคัดลอกลงคลิปบอร์ด (Clipboard) พร้อมส่ง Toast สีเขียวแจ้งเตือน พยาบาลเพียงเปิดโปรแกรม HOSxP แล้วกดปุ่ม Ctrl+V (หรือ Cmd+V) เพื่อวางข้อความได้ทันทีโดยไม่ต้องเสียเวลาพิมพ์ซ้ำ", size_pt=16, space_after=6)

    add_p(doc, "ตัวอย่างข้อความ Nursing Note ที่ระบบสร้างให้โดยอัตโนมัติ:", size_pt=15, bold=True, color=COLOR_NAVY, space_after=2)
    add_callout(doc, "ตัวอย่าง Nursing Note สำหรับบันทึกในระบบ HOSxP",
                "=== บันทึกการพยาบาลผู้ป่วย Sepsis (RTSAS) ===\n"
                "ผู้ป่วย: HN****0187 (นายสมศักดิ์ วรเดช เพศชาย อายุ 63 ปี) | เวลามาถึง ER: 13:37 น.\n"
                "อาการสำคัญ: มีไข้สูง หนาวสั่น ซึมลง สับสน หายใจหอบเหนื่อย สงสัยติดเชื้อในกระแสเลือด\n"
                "[13:46:12] Triage Assessment: RR 26, SpO2 90%, BP 86/50, HR 126, BT 39.5°C, GCS 13 (V) -> NEWS = 16 (Red Alert)\n"
                "[13:47:05] นำผู้ป่วยเข้ารับการรักษาในห้องฉุกเฉิน (ER-01) โดย พย.สุกัญญา\n"
                "[13:48:20] รายงานแพทย์เวรทันที (นพ.เกียรติศักดิ์)\n"
                "[13:50:00] แพทย์ตรวจประเมิน ยืนยันภาวะติดเชื้อในกระแสเลือด (Sepsis Confirmed) -> เริ่ม 1-Hour Sepsis Bundle\n"
                "[13:54:10] Hemoculture x 2 bottles: Site 1 (Lt. median cubital vein), Site 2 (Rt. cephalic vein) โดย พย.สุกัญญา\n"
                "[13:58:30] ให้สารน้ำ NSS 1,000 ml IV load in 1 hr ตามแผนการรักษา\n"
                "[14:05:15] ให้ยาปฏิชีวนะ Ceftriaxone 2g IV drip in 30 min (ครบตาม Golden Hour ภายใน 15 นาที)\n"
                "[14:20:00] Reassessment Q15 รอบที่ 1: RR 22, SpO2 93%, BP 95/60, HR 108, BT 38.8°C -> NEWS = 8 (สัญญาณชีพตอบสนองดี)\n"
                "ผลลัพธ์: การรักษาครบถ้วนตามเกณฑ์ SSC 2021 ภายใน 1 ชั่วโมง สัญญาณชีพคงที่ ย้ายสังเกตอาการหอผู้ป่วยใน",
                icon="📋", bg_hex="F8FAFC", border_hex="2563EB")

    add_image_figure(doc, "pop_08_export_report_modal.png", "ภาพที่ 8-2 ภาพหน้าต่างสรุปรายงานสถิติประจำเวรและส่งออกข้อมูล (Export Report Modal)")

    add_p(doc, "8.2 หน้าต่างสรุปสถิติประจำเวรและส่งออกข้อมูล (Export Report Modal):", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "เมื่อกดปุ่ม \"📊 ส่งออกรายงาน\" บน Header หน้าต่างรายงานสรุปประจำเวรจะเปิดขึ้นมา โดยมีรายละเอียดดังนี้:", size_pt=16, first_indent=0.5, space_after=4)
    add_p(doc, "• การเลือกช่วงเวรปฏิบัติงาน (Shift Selector): เลือกเวรเช้า (07:00–15:00 น.), เวรบ่าย (15:00–23:00 น.), หรือเวรดึก (23:00–07:00 น.) ระบบมีกลไก Auto-Detect ตรวจจับเวรปัจจุบันให้อัตโนมัติ", size_pt=16, space_after=2)
    add_p(doc, "• การ์ดสรุปตัวชี้วัดสำคัญ 4 ด้าน (Shift KPI Cards):", size_pt=16, space_after=2)
    add_p(doc, "   1) ผู้ป่วยทั้งหมดในกะ (Total Patients in Shift)", size_pt=16, space_after=2)
    add_p(doc, "   2) จำนวนผู้ป่วยที่ยืนยัน Sepsis (Confirmed Cases)", size_pt=16, space_after=2)
    add_p(doc, "   3) เวลาเฉลี่ยในการเริ่ม Sepsis Bundle (Average Bundle Minutes)", size_pt=16, space_after=2)
    add_p(doc, "   4) อัตราความครบถ้วนของเช็คลิสต์เฉลี่ย (Average Checklist Completion %)", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"📥 ดาวน์โหลดรายงาน CSV\": ส่งออกไฟล์ CSV สำหรับนำไปวิเคราะห์ในโปรแกรม Excel หรือโปรแกรมสถิติ", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"🖨️ พิมพ์รายงานสรุป / PDF\": สั่งพิมพ์รายงานส่งต่อเวร หรือบันทึกเป็นเอกสาร PDF ทางการ", size_pt=16, space_after=2)
    add_p(doc, "• ปุ่ม \"ปิดหน้าต่าง\": ปิดหน้าต่างเพื่อกลับสู่แดชบอร์ดคลินิก", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 9: แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว
    # ===========================================================================
    add_p(doc, "9. แดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้ว (Treated Cases Dashboard)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "สำหรับการติดตามผลการดำเนินงานเชิงคุณภาพ (Quality Improvement & Clinical Audit) และการส่งต่อข้อมูลเวร ผู้บริหาร คณะกรรมการ Service Plan Sepsis และหัวหน้าเวรสามารถเข้าสู่หน้าจอ Treated Dashboard ได้ตลอดเวลาผ่านปุ่ม \"✅ แดชบอร์ดเคสที่รักษาแล้ว\" บน Header:",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 9-1 & 9-2
    add_image_figure(doc, "scr_11_treated_dashboard_page.png", "ภาพที่ 9-1 ภาพแดชบอร์ดสรุปสถิติเคสผู้ป่วยที่รักษาแล้วและตัวชี้วัดรายวัน (Treated Cases Dashboard)")

    add_p(doc, "องค์ประกอบหลักในหน้าจอ Treated Cases Dashboard:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. การ์ดสรุปตัวชี้วัดประจำวัน (Daily KPI Cards): แสดงตัวเลขสถิติรวม 5 การ์ด ได้แก่ ผู้ป่วยทั้งหมดในวัน, ผู้ป่วยกลุ่มเสี่ยงสูง (NEWS ≥ 5), ผู้ป่วยที่รักษาเสร็จสิ้นสมบูรณ์, ผู้ป่วยที่แพทย์ Rule Out, และอัตราความสอดคล้องตามเกณฑ์มาตรฐาน (Compliance Rate %)", size_pt=16, space_after=2)
    add_p(doc, "2. แถบประวัติย้อนหลัง 7 วัน (7-Day Historical Trend Bar): แสดงสถิติรายวันย้อนหลังเพื่อเปรียบเทียบแนวโน้มจำนวนผู้ป่วยและประสิทธิภาพการดูแลรักษาในแต่ละวัน", size_pt=16, space_after=2)
    add_p(doc, "3. แท็บตัวกรองประเภทเคส (Filter Tabs): เลือกแสดง \"ทั้งหมด (All)\", \"เฉพาะเคสรักษาเสร็จ (Treated Only)\", หรือ \"เฉพาะเคสเสี่ยงสูง (High Risk)\"", size_pt=16, space_after=2)
    add_p(doc, "4. ตารางประวัติรายบุคคล (Treated Patients Table): แสดงรหัส HN ปิดบัง, เพศ, อายุ, คะแนน NEWS, วันที่เวลาที่มาถึง, เวลาที่รักษาเสร็จ, บุคลากรผู้รับผิดชอบ, และป้ายผลลัพธ์การรักษา", size_pt=16, space_after=4)

    add_image_figure(doc, "pop_11_treated_case_timeline_modal.png", "ภาพที่ 9-2 ภาพหน้าต่างแสดงประวัติและขั้นตอนการรักษาละเอียดในหน้ารักษาแล้ว (Treated Case Timeline Modal)")

    add_p(doc, "ป๊อปอัปแสดงประวัติและขั้นตอนการรักษาละเอียดในหน้ารักษาแล้ว (Treated Case Timeline Modal):", size_pt=16, bold=True, space_after=4)
    add_p(doc, "เมื่อผู้ใช้งานคลิกปุ่ม \"ดูขั้นตอน / ไทม์ไลน์\" บนแถวผู้ป่วยรายใดในตาราง หน้าต่างป๊อปอัป Timeline Modal จะเปิดขึ้นมา โดยแสดงลำดับขั้นตอนการรักษาทั้งหมดตั้งแต่ต้นจนจบ พร้อมป้ายระบุจำนวนขั้นตอน เช่น \"8 ขั้นตอน\" โดยมีปุ่ม \"📋 คัดลอก Nursing Note ลง HIS\" เพื่อให้สามารถคัดลอกประวัติย้อนหลังไปบันทึกใน HOSxP ได้ตลอดเวลา และปุ่ม \"ปิดหน้าต่าง\"", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 10: การจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin
    # ===========================================================================
    add_p(doc, "10. การจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin (IT Admin Panel)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "สำหรับผู้ดูแลระบบสารสนเทศโรงพยาบาล (IT Administrator) สามารถเข้าถึงหน้าจอจัดการระบบได้โดยการล็อกอินด้วยสิทธิ์ IT Admin และคลิกปุ่ม \"💻 Admin Panel\" บนแถบ Header Bar เพื่อตรวจสอบความพร้อมของระบบและการเชื่อมต่อฐานข้อมูล:",
          size_pt=16, first_indent=0.5, space_after=6)

    # FIGURE 10-1 & 10-2
    add_image_figure(doc, "scr_12_admin_management_page.png", "ภาพที่ 10-1 ภาพหน้าจอการจัดการระบบและหน่วยความจำแคชสำหรับ IT Admin (IT Admin Panel)")

    add_p(doc, "ฟังก์ชันการควบคุมหลักในหน้า IT Admin Panel:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "1. การตรวจสอบสถานะฐานข้อมูล (Database Connection Pool Status): แสดงสถานะการเชื่อมต่อกับฐานข้อมูล HOSxP MySQL Connection Pool แบบสด โดยแสดงสถานะ 🟢 Healthy พร้อมรายงานจำนวน Connection ที่ใช้งานอยู่", size_pt=16, space_after=2)
    add_p(doc, "2. สถิติหน่วยความจำแคช (Cache Statistics): แสดงจำนวนชุดสัญญาณชีพ (Vitals Cache) และจำนวนผู้ป่วย (Patients Cache) ที่จัดเก็บอยู่ในหน่วยความจำ Memory Cache", size_pt=16, space_after=2)
    add_p(doc, "3. ปุ่มล้างแคชหน่วยความจำ \"ล้างแคชทั้งหมด\" (Clear Cache Button): ใช้สำหรับเคลียร์ข้อมูลเก่าที่ค้างอยู่ในหน่วยความจำเมื่อมีการเปลี่ยนเวรหรือขึ้นวันใหม่", size_pt=16, space_after=4)

    add_image_figure(doc, "pop_12_admin_clear_cache_modal.png", "ภาพที่ 10-2 ภาพหน้าต่างยืนยันการล้างแคชปลอดภัย (Safe Sepsis Guard Dialog)")

    add_p(doc, "กลไกความปลอดภัย Safe Sepsis Guard ในหน้าต่างยืนยันการล้างแคช:", size_pt=16, bold=True, space_after=4)
    add_p(doc, "เพื่อป้องกันอุบัติการณ์ข้อมูลผู้ป่วยวิกฤตสูญหายในระหว่างการดูแลรักษา ระบบ RTSAS ได้ติดตั้งกลไกความปลอดภัยระดับสูงที่เรียกว่า \"Safe Sepsis Guard\" โดยเมื่อผู้ดูแลระบบกดปุ่มล้างแคช หน้าต่างป๊อปอัปยืนยันจะเปิดขึ้นมาเพื่อแจ้งเตือนว่า:", size_pt=16, space_after=2)
    add_p(doc, "• ระบบจะทำการล้างเฉพาะแคชของผู้ป่วยทั่วไปที่เสร็จสิ้นการรักษาแล้วเท่านั้น", size_pt=16, space_after=2)
    add_p(doc, "• ระบบจะ \"ไม่ล้าง\" ข้อมูล สัญญาณชีพ หรือนาฬิกานับถอยหลังของผู้ป่วยที่กำลังอยู่ระหว่างการรักษาภาวะ Sepsis (Active Sepsis Cases) โดยเด็ดขาด ทำให้การรักษาสามารถดำเนินต่อไปได้อย่างต่อเนื่องและปลอดภัย 100%", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 11: สารบัญไดเรกทอรีปุ่มกด การควบคุม และป๊อปอัปทั้งหมดของระบบ
    # ===========================================================================
    add_p(doc, "11. สารบัญไดเรกทอรีปุ่มกด การควบคุม และป๊อปอัปทั้งหมดของระบบ (Master Control Directory)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "ตารางที่ 11-1 รวบรวมและแจกแจงหน้าที่ของปุ่มกด สวิตช์ ช่องกรอกข้อมูล และการควบคุมทั้งหมดในระบบ RTSAS กว่า 35 รายการ เพื่อให้บุคลากรทางการแพทย์ทุกท่านสามารถเปิดอ้างอิงได้อย่างสะดวกรวดเร็ว:",
          size_pt=16, first_indent=0.5, space_after=6)

    # Master Button Directory Table
    t11 = doc.add_table(rows=1, cols=4)
    t11.alignment = WD_TABLE_ALIGNMENT.CENTER
    t11_headers = ["ส่วนงาน (Module)", "ชื่อปุ่ม / การควบคุม", "บทบาทที่กดได้", "หน้าที่การทำงานและผลลัพธ์ขั้นตอนถัดไป"]
    for i, h in enumerate(t11_headers):
        cell = t11.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    master_controls = [
        ["Header Bar", "🔔 / 🔕 สวิตช์ควบคุมเสียง", "ทุกบทบาท", "เปิดหรือปิดเสียงสัญญาณไซเรนฉุกเฉินและเสียงกระดิ่งเตือนรอบประเมิน"],
        ["Header Bar", "เข้าสู่ระบบ / โปรไฟล์", "ทุกบทบาท", "เปิดหน้าต่าง Auth Modal สำหรับล็อกอิน, สมัครสมาชิก หรือเลือก Demo Profile"],
        ["Header Bar", "✅ Treated Dashboard", "ทุกบทบาท", "สลับมุมมองหน้าจอไปยังแดชบอร์ดเคสผู้ป่วยที่รักษาเสร็จแล้วและตัวชี้วัด KPI"],
        ["Header Bar", "💻 Admin Panel", "IT Admin", "สลับมุมมองหน้าจอไปยังหน้าตรวจสอบสถานะ MySQL และการจัดการแคช"],
        ["Header Bar", "📊 ส่งออกรายงาน", "ทุกบทบาท", "เปิดหน้าต่าง Export Report Modal เพื่อดูสรุปข้อมูลเวรและดาวน์โหลด CSV/PDF"],
        ["Sidebar Queue", "ปุ่ม \"กำลังรักษา\"", "ทุกบทบาท", "กรองแสดงเฉพาะผู้ป่วยทั้งหมดที่ยังอยู่ระหว่างการรักษาในห้องฉุกเฉิน ER"],
        ["Sidebar Queue", "ปุ่ม \"🔴 เสี่ยง\"", "ทุกบทบาท", "กรองแสดงเฉพาะผู้ป่วยวิกฤตที่มีคะแนน NEWS ≥ 5 หรือมี Sepsis Alert"],
        ["Sidebar Queue", "ปุ่ม \"✅ รักษาแล้ว\"", "ทุกบทบาท", "สลับมุมมองไปยังเคสที่เสร็จสิ้นการรักษาหรือถูกแพทย์ Rule Out Sepsis"],
        ["Sidebar Queue", "ช่องค้นหา (Search)", "ทุกบทบาท", "พิมพ์ค้นหาผู้ป่วยตามรหัส HN หรือหมายเลข VN กรองรายชื่อสดทันที"],
        ["Sidebar Queue", "ปุ่ม \"🔄 ดึงข้อมูล\"", "ทุกบทบาท", "สั่งดึงข้อมูลสัญญาณชีพล่าสุดจากฐานข้อมูล HOSxP ทันทีโดยไม่ต้องรอรอบเวลา"],
        ["Sidebar Queue", "การ์ดผู้ป่วย (Patient Card)", "ทุกบทบาท", "คลิกเลือกผู้ป่วย เพื่อเปิดแผงข้อมูล สัญญาณชีพ และเช็คลิสต์ Sepsis"],
        ["Alert Modal", "✅ รับทราบ — เริ่ม...", "แพทย์ / พยาบาล", "ปิดป๊อปอัป, ไฮไลต์ผู้ป่วย, ปลดล็อก Phase 1, ส่งเวลาบันทึกลง MySQL"],
        ["Alert Modal", "ปุ่มปิด [✕]", "ทุกบทบาท", "ปิดป๊อปอัปแจ้งเตือนโดยยังคงป้ายสีแดงบนการ์ดผู้ป่วยเพื่อป้องกันเคสตกหล่น"],
        ["Multi-Alert", "รับทราบ (ประจำการ์ด)", "แพทย์ / พยาบาล", "รับทราบเฉพาะเคสที่เลือก, สลับไปดูแลเคสนั้น, นำเคสออกจากคิวเตือน"],
        ["Multi-Alert", "✅ รับทราบทั้งหมด", "แพทย์ / พยาบาล", "รับทราบทุกเคสในคิวพร้อมกัน, เริ่มต้นกระบวนการดูแลรักษาทุกเคสคู่ขนาน"],
        ["Checklist P1", "ประเมินอาการซ้ำ", "พยาบาล", "บันทึกว่าได้ทำการวัดสัญญาณชีพซ้ำที่จุดคัดแยกเรียบร้อยแล้ว"],
        ["Checklist P1", "นำผู้ป่วยเข้า ER", "พยาบาล", "บันทึกว่าได้นำผู้ป่วยเข้าเตียงวิกฤตห้องฉุกเฉินเรียบร้อยแล้ว"],
        ["Checklist P1", "รายงานแพทย์เวร", "พยาบาล", "บันทึกว่าได้รายงานแพทย์เวรทันทีเพื่อขอการประเมินทางคลินิก"],
        ["Checklist P2", "🔴 ยืนยัน — ติดเชื้อ", "แพทย์เวร", "เปิดกล่องยืนยัน Sepsis -> เริ่มนับ 60 นาที Golden Hour, ปลดล็อก Phase 3"],
        ["Checklist P2", "🟢 ไม่ยืนยัน — Rule Out", "แพทย์เวร", "เปิดกล่องยืนยัน Rule Out -> หยุดเวลานับถอยหลัง, จบกระบวนการ Sepsis"],
        ["Checklist P3", "Hemoculture Site 1-2", "พยาบาล", "กรอกตำแหน่งหลอดเลือดดำที่เจาะเลือดเพาะเชื้อ แล้วกดบันทึกหัตถการ"],
        ["Checklist P3", "IV Fluid Loading", "พยาบาล", "กรอกชนิดและปริมาณสารน้ำ (เช่น NSS 1,000 ml IV load) แล้วกดบันทึก"],
        ["Checklist P3", "Antibiotics Dose 1", "พยาบาล", "กรอกชื่อยาปฏิชีวนะและขนาดยา (เช่น Ceftriaxone 2g) แล้วกดบันทึก"],
        ["Checklist P3", "⏭ ข้ามขั้นตอนนี้", "พยาบาล", "ข้ามยาขนานที่ 2 หรือสายสวนปัสสาวะในกรณีที่แพทย์ไม่ได้มีคำสั่ง"],
        ["Checklist P4", "ปุ่ม \"[บันทึก]\" ในรอบ", "พยาบาล", "เปิดหน้าต่างแบบฟอร์ม Assessment Form Modal เพื่อกรอกสัญญาณชีพประจำรอบ"],
        ["Reminder Modal", "📝 บันทึกสัญญาณชีพ", "พยาบาล", "ปิดหน้าต่างเตือนและเปิดแบบฟอร์มบันทึกสัญญาณชีพซ้ำขึ้นมาทันที"],
        ["Reminder Modal", "เลื่อนออกไป", "พยาบาล", "เลื่อนการเตือนรอบเวลาออกไปชั่วคราวเพื่อทำหัตถการฉุกเฉินก่อน"],
        ["Assessment Form", "💾 บันทึกการประเมิน", "พยาบาล", "บันทึกค่าสัญญาณชีพ, อัปเดตตารางรอบเวลา, บันทึก Audit Log, นับรอบถัดไป"],
        ["Assessment Form", "✅ รักษาเสร็จแล้ว", "แพทย์ / พยาบาล", "สิ้นสุดการรักษาจากในฟอร์มเมื่อสัญญาณชีพผู้ป่วยคงที่เป็นปกติ"],
        ["Checklist Bottom", "✅ สิ้นสุดการรักษา", "แพทย์ / พยาบาล", "เปิดหน้าต่างยืนยันสิ้นสุดการรักษา Sepsis อย่างเป็นทางการ"],
        ["End Modal", "✅ ยืนยันสิ้นสุด...", "แพทย์ / พยาบาล", "ปิดเคส, แสดงแบนเนอร์เขียว, ล็อกเป็นโหมดอ่านอย่างเดียว, ย้ายไปแดชบอร์ด"],
        ["Timeline Panel", "📋 คัดลอกลง HIS", "ทุกบทบาท", "จัดรูปแบบ Nursing Note ทั้งหมดลงคลิปบอร์ดเพื่อนำไปวางใน HOSxP"],
        ["Export Modal", "📥 ดาวน์โหลด CSV", "ทุกบทบาท", "ส่งออกข้อมูลสรุปเคสประจำเวรเป็นไฟล์ CSV สำหรับนำไปวิเคราะห์ใน Excel"],
        ["Export Modal", "🖨️ พิมพ์ PDF", "ทุกบทบาท", "เปิดหน้าต่างพิมพ์รายงานสรุปประจำเวร หรือบันทึกเป็นเอกสาร PDF"],
        ["Treated Page", "ดูขั้นตอน / ไทม์ไลน์", "ทุกบทบาท", "เปิดหน้าต่าง Timeline Modal เพื่อดูประวัติการรักษาละเอียดของเคสในอดีต"],
        ["Admin Panel", "ล้างแคชทั้งหมด", "IT Admin", "เปิดหน้าต่างยืนยันการล้างแคช พร้อมทำงานร่วมกับ Safe Sepsis Guard"],
    ]
    
    for r_idx, r_data in enumerate(master_controls):
        row = t11.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 50, 50, 60, 60)
            if r_idx % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=11, bold=True, color=COLOR_BLUE)
            elif c_idx == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=11, bold=True)
            elif c_idx == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(val)
                color = COLOR_GREEN if "แพทย์" in val else (COLOR_NAVY if "พยาบาล" in val else COLOR_BLACK)
                set_run_font(run, size_pt=11, bold=True, color=color)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=11)

    doc.add_page_break()

    # ===========================================================================
    # CHAPTER 12: การแก้ไขปัญหาเบื้องต้นและคำถามที่พบบ่อย
    # ===========================================================================
    add_p(doc, "12. การแก้ไขปัญหาเบื้องต้นและคำถามที่พบบ่อย (Troubleshooting & FAQ)", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "ตารางที่ 12-1 รวบรวมแนวทางการแก้ไขปัญหาทางเทคนิคและคลินิกที่อาจเกิดขึ้นระหว่างการปฏิบัติงาน เพื่อให้ทีมผู้ใช้งานสามารถแก้ไขสถานการณ์เฉพาะหน้าได้อย่างถูกต้องและไม่กระทบต่อความปลอดภัยของผู้ป่วย:",
          size_pt=16, first_indent=0.5, space_after=6)

    # Troubleshooting Table
    t12 = doc.add_table(rows=1, cols=3)
    t12.alignment = WD_TABLE_ALIGNMENT.CENTER
    t12_headers = ["อาการขัดข้องที่พบ", "สาเหตุที่เป็นไปได้", "แนวทางการแก้ไขปัญหาอย่างละเอียด"]
    for i, h in enumerate(t12_headers):
        cell = t12.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        set_run_font(run, size_pt=13, bold=True, color=RGBColor(255, 255, 255))
        
    t12_rows = [
        ["เสียงไซเรนเตือนภัยไม่ดังเมื่อมีเคสวิกฤต", "1. สวิตช์เสียงบน Header ถูกปิดอยู่ (🔕)\n2. เบราว์เซอร์บล็อกการเล่นเสียงอัตโนมัติ (Autoplay)", "1. คลิกปุ่มกระดิ่งบน Header ให้เปลี่ยนเป็น 🔔\n2. คลิกที่ใดก็ได้บนหน้าจอ 1 ครั้งเพื่อปลดล็อก Autoplay หรือตั้งค่า Site Settings ใน Chrome ให้ Allow Sound"],
        ["หน้าต่างป๊อปอัปแจ้งเตือนไม่เด้งขึ้นมา", "เคสดังกล่าวได้รับการกดรับทราบไปแล้วโดยบุคลากรท่านอื่น", "ตรวจสอบรายชื่อผู้ป่วยใน Sidebar ด้านซ้าย จะพบการ์ดผู้ป่วยรายดังกล่าวติดป้าย \"🔴 เสี่ยงติดเชื้อ\" และมีคะแนน NEWS สูง สามารถคลิกเปิดดูได้ทันที"],
        ["กดปุ่มดึงข้อมูลแล้วสัญญาณชีพไม่อัปเดต", "เจ้าหน้าที่จุดคัดแยกยังไม่ได้กดบันทึกข้อมูลในระบบ HOSxP", "ประสานงานจุดคัดแยกให้ทำการกด Save ข้อมูลสัญญาณชีพใน HOSxP ให้เสร็จสิ้น แล้วกลับมากดปุ่ม \"🔄 ดึงข้อมูล\" ใน Sidebar อีกครั้ง"],
        ["ปุ่มยืนยัน Sepsis ใน Phase 2 กดไม่ได้", "ผู้ใช้งานปัจจุบันล็อกอินอยู่ในสิทธิ์ \"พยาบาล\" หรือ \"IT Admin\"", "การยืนยันหรือ Rule Out Sepsis เป็นสิทธิ์เฉพาะของแพทย์เวร กรุณาให้แพทย์เข้าสู่ระบบด้วยสิทธิ์ Doctor หรือกดสลับโปรไฟล์เพื่อดำเนินการ"],
        ["แถบนับถอยหลัง 60 นาทีเปลี่ยนเป็นสีแดงติดลบ", "การให้ยาปฏิชีวนะเกินกำหนด Golden Hour (> 60 นาที)", "รีบรายงานแพทย์เวรทันที และเร่งรัดการให้ยาปฏิชีวนะโดยด่วน พร้อมบันทึกเหตุผลความล่าช้าในช่องหมายเหตุทางการพยาบาลเพื่อใช้ใน Clinical Audit"],
        ["กดปุ่มคัดลอกลง HIS แล้วข้อความไม่เข้าคลิปบอร์ด", "เบราว์เซอร์ไม่อนุญาตให้เข้าถึง Clipboard API", "ตรวจสอบการอนุญาตสิทธิ์ Clipboard ใน URL Bar ของเบราว์เซอร์ให้เป็น Allow หรือใช้วิธีลากแถบคลุมข้อความในกล่องพรีวิวแล้วกด Ctrl+C ด้วยตนเอง"],
        ["สถานะ Database Connection Pool ขึ้นสีแดง", "ระบบเครือข่ายโรงพยาบาลขัดข้อง หรือฐานข้อมูล MySQL หยุดทำงาน", "1. ตรวจสอบสาย LAN หรือสัญญาณ WiFi\n2. สลับไปใช้โหมดเวชระเบียนกระดาษชั่วคราว\n3. ติดต่อเจ้าหน้าที่ศูนย์คอมพิวเตอร์ (IT Admin) ทันที"],
        ["หน้าจอค้างหรือไม่ตอบสนองต่อการคลิก", "หน่วยความจำแคชของเบราว์เซอร์เต็ม หรือมี Session ค้าง", "กดปุ่ม Ctrl+F5 (หรือ Cmd+Shift+R) เพื่อโหลดหน้าจอใหม่ทั้งหมด ข้อมูลที่บันทึกไว้จะไม่สูญหายเนื่องจากถูกซิงค์ไว้ในฐานข้อมูลอย่างสมบูรณ์"],
    ]
    for r_idx, r_data in enumerate(t12_rows):
        row = t12.add_row()
        for c_idx, val in enumerate(r_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, 60, 60, 80, 80)
            if r_idx % 2 == 1:
                set_cell_background(cell, "F8FAFC")
            p = cell.paragraphs[0]
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12, bold=True, color=COLOR_RED)
            elif c_idx == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12)
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                run = p.add_run(val)
                set_run_font(run, size_pt=12)

    add_p(doc, "", size_pt=12, space_after=8)
    add_p(doc, "คำถามที่พบบ่อย (Clinical & Technical FAQ):", size_pt=17, bold=True, space_before=4, space_after=4)
    add_p(doc, "Q1: หากผู้ป่วยมีคะแนน NEWS สูงจากโรคอื่นที่ไม่ใช่การติดเชื้อ เช่น ภาวะช็อกจากการเสียเลือด (Hypovolemic Shock) ต้องทำอย่างไร?", size_pt=16, bold=True, space_after=2)
    add_p(doc, "A1: แพทย์เวรสามารถคลิกปุ่ม \"🟢 ไม่ยืนยัน — Rule Out\" ใน Phase 2 เพื่อระบุว่าไม่ใช่ Sepsis พร้อมบันทึกการวินิจฉัยจริง ระบบจะยุติกระบวนการ Sepsis และนำเคสเข้าสู่การรักษาภาวะช็อกตามแนวทางเฉพาะโรคนั้นต่อไป", size_pt=16, space_after=4)
    
    add_p(doc, "Q2: ยาปฏิชีวนะตัวที่ 2 และสายสวนปัสสาวะ จำเป็นต้องทำทุกรายหรือไม่?", size_pt=16, bold=True, space_after=2)
    add_p(doc, "A2: ไม่จำเป็น ขึ้นอยู่กับดุลยพินิจของแพทย์ หากแพทย์สั่งยาปฏิชีวนะเพียงขนานเดียว พยาบาลสามารถคลิกปุ่ม \"⏭ ข้ามขั้นตอนนี้\" เพื่อให้ระบบรับทราบว่าผ่านเกณฑ์อย่างถูกต้องโดยไม่นับเป็นข้อผิดพลาด", size_pt=16, space_after=4)
    
    add_p(doc, "Q3: การคัดลอกลง HIS สามารถนำไปวางในโปรแกรมใดได้บ้าง?", size_pt=16, bold=True, space_after=2)
    add_p(doc, "A3: สามารถนำไปวางในระบบเวชระเบียนอิเล็กทรอนิกส์ได้ทุกโปรแกรม เช่น HOSxP V3, HOSxP V4, โปรแกรมบันทึกการพยาบาล IPD/ER, หรือกระทั่งโปรแกรมจัดการเอกสารทั่วไป", size_pt=16, space_after=8)

    doc.add_page_break()

    # ===========================================================================
    # APPENDICES (ภาคผนวก)
    # ===========================================================================
    add_p(doc, "ภาคผนวก: ข้อมูลอ้างอิงและมาตรฐานวิชาการ", size_pt=18, bold=True, space_before=6, space_after=10)
    
    add_p(doc, "ภาคผนวก ก: เกณฑ์มาตรฐาน Surviving Sepsis Campaign (SSC 2021) 1-Hour Bundle", size_pt=16, bold=True, color=COLOR_NAVY, space_after=4)
    add_p(doc, "แนวทางเวชปฏิบัติสากลกำหนดให้เริ่มปฏิบัติการกู้ชีพ 5 ประการทันทีที่ตรวจพบหรือสงสัยภาวะติดเชื้อในกระแสเลือด โดยต้องดำเนินการให้แล้วเสร็จภายใน 60 นาทีแรก (Time Zero = เวลาที่แพทย์ยืนยันการวินิจฉัย):", size_pt=16, first_indent=0.5, space_after=2)
    add_p(doc, "1. ส่งตรวจวัดระดับ Lactate ในเลือดทันที และส่งตรวจซ้ำหากค่าแรกเริ่ม > 2 mmol/L", size_pt=16, space_after=2)
    add_p(doc, "2. เจาะเลือดเพาะเชื้อ (Blood Hemoculture อย่างน้อย 2 ตำแหน่ง) ก่อนเริ่มให้ยาปฏิชีวนะ", size_pt=16, space_after=2)
    add_p(doc, "3. ให้ยาปฏิชีวนะทางหลอดเลือดดำที่มีฤทธิ์ครอบคลุมเชื้อกว้าง (Broad-Spectrum IV Antibiotics) ให้เร็วที่สุดภายใน 1 ชั่วโมง", size_pt=16, space_after=2)
    add_p(doc, "4. ให้สารน้ำชนิด Crystalloid ในอัตรา 30 ml/kg ทางหลอดเลือดดำอย่างรวดเร็วในกรณีที่มีความดันโลหิตตก (Hypotension SBP < 90 mmHg หรือ MAP < 65 mmHg) หรือ Lactate ≥ 4 mmol/L", size_pt=16, space_after=2)
    add_p(doc, "5. ให้ยากระตุ้นความดันโลหิต (Vasopressors) หากความดันโลหิตยังไม่ตอบสนองหลังให้สารน้ำเพียงพอ เพื่อรักษา MAP ≥ 65 mmHg", size_pt=16, space_after=8)

    add_p(doc, "ภาคผนวก ข: มาตรฐานการคุ้มครองข้อมูลส่วนบุคคล (PDPA) ในระบบ RTSAS", size_pt=16, bold=True, color=COLOR_NAVY, space_after=4)
    add_p(doc, "เพื่อปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ระบบ RTSAS ได้ใช้มาตรฐานการรักษาความปลอดภัยข้อมูลเวชระเบียนดังนี้:", size_pt=16, first_indent=0.5, space_after=2)
    add_p(doc, "1. การปิดบังรหัสประจำตัวผู้ป่วย (HN Masking): รหัส HN ทั้งหมดบนหน้าจอแดชบอร์ด, แถบรายชื่อ, ป๊อปอัปแจ้งเตือน และรายงานส่งออก จะถูกปิดบังตัวเลข 4 หลักกลางเสมอ (เช่น HN****0187)", size_pt=16, space_after=2)
    add_p(doc, "2. บันทึกประวัติการเข้าถึง (Access & Audit Trail Logging): ทุกการเข้าดูข้อมูล การกดรับทราบ การสั่งการรักษา และการคัดลอกข้อมูล จะถูกบันทึกรหัสประจำตัวผู้ใช้งาน (User ID), เวลา (Timestamp), และ IP Address ไว้อย่างครบถ้วน", size_pt=16, space_after=2)
    add_p(doc, "3. สิทธิ์การเข้าถึงข้อมูลตามบทบาทหน้าที่ (Minimum Necessary Principle): บุคลากรจะเห็นเฉพาะข้อมูลที่จำเป็นต่อการช่วยชีวิตผู้ป่วย ณ จุดดูแลเท่านั้น", size_pt=16, space_after=12)

    add_p(doc, "-------------------------------------------------------------------------------------------------------", size_pt=12, align=WD_ALIGN_PARAGRAPH.CENTER, color=COLOR_GRAY, space_after=4)
    add_p(doc, "คู่มือการปฏิบัติงานคลินิกและการใช้งานระบบ RTSAS ฉบับสมบูรณ์ — โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา", size_pt=14, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, color=COLOR_GRAY)

    # Save documents
    print(f"Saving to {OUTPUT_DOCX_DOCS} ...")
    doc.save(OUTPUT_DOCX_DOCS)
    print(f"✅ Successfully saved: {OUTPUT_DOCX_DOCS} ({os.path.getsize(OUTPUT_DOCX_DOCS) / 1024:.1f} KB)")
    
    print(f"Saving copy to {OUTPUT_DOCX_DESKTOP} ...")
    doc.save(OUTPUT_DOCX_DESKTOP)
    print(f"✅ Successfully saved: {OUTPUT_DOCX_DESKTOP} ({os.path.getsize(OUTPUT_DOCX_DESKTOP) / 1024:.1f} KB)")

if __name__ == "__main__":
    generate_master_manual()
