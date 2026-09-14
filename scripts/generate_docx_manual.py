#!/usr/bin/env python3
"""
generate_docx_manual.py
Converts docs/USER_MANUAL.md into an executive, beautifully styled Microsoft Word (.docx) manual
for Bang Khla Hospital's Real-Time Sepsis Alert System (RTSAS).
"""

import os
import re
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

DOCS_DIR = "/Users/phatchara/Desktop/Hospital/docs"
INPUT_MD = os.path.join(DOCS_DIR, "USER_MANUAL.md")
OUTPUT_DOCX_DOCS = os.path.join(DOCS_DIR, "RTSAS_User_Manual.docx")
OUTPUT_DOCX_DESKTOP = "/Users/phatchara/Desktop/RTSAS_User_Manual.docx"
IMAGES_DIR = os.path.join(DOCS_DIR, "images/manual")

# Color Palette
COLOR_PRIMARY_BLUE = RGBColor(0, 75, 135)     # #004b87
COLOR_SECONDARY_BLUE = RGBColor(26, 54, 93)   # #1a365d
COLOR_SUB_BLUE = RGBColor(43, 108, 176)       # #2b6cb0
COLOR_ALERT_RED = RGBColor(197, 48, 48)       # #c53030
COLOR_DARK_TEXT = RGBColor(45, 55, 72)        # #2d3748
COLOR_MUTED_GRAY = RGBColor(113, 128, 150)    # #718096
HEX_HEADER_BG = "004b87"
HEX_ROW_ALT_BG = "f7fafc"
HEX_CALLOUT_BG = "f0f7ff"
HEX_BORDER = "cbd5e0"

def set_cell_background(cell, hex_color):
    """Sets background color of a docx table cell."""
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets internal padding for a cell (in dxa: 1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_border(cell, **kwargs):
    """
    kwargs: top, bottom, left, right
    values: dict(sz=12, val='single', color='FF0000')
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = 'w:{}'.format(edge)
            element = OxmlElement(tag)
            element.set(qn('w:val'), edge_data.get('val', 'single'))
            element.set(qn('w:sz'), str(edge_data.get('sz', 4)))
            element.set(qn('w:space'), '0')
            element.set(qn('w:color'), edge_data.get('color', 'auto'))
            tcBorders.append(element)
    tcPr.append(tcBorders)

def add_formatted_text(paragraph, text, default_color=COLOR_DARK_TEXT, default_size=11, is_bold=False):
    """Parses inline bold (**bold**), code (`code`), and normal text."""
    pattern = re.compile(r'(\*\*.*?\*\*|`.*?`|\*.*?\*)')
    parts = pattern.split(text)
    
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.color.rgb = default_color
            run.font.size = Pt(default_size)
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            run.font.name = 'Consolas'
            run.font.color.rgb = COLOR_ALERT_RED
            run.font.size = Pt(default_size - 0.5)
            run.bold = True
        elif part.startswith('*') and part.endswith('*') and not part.startswith('**'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.color.rgb = default_color
            run.font.size = Pt(default_size)
        else:
            run = paragraph.add_run(part)
            run.bold = is_bold
            run.font.color.rgb = default_color
            run.font.size = Pt(default_size)

def build_manual_docx():
    doc = Document()
    
    # Page Margins (A4 standard: 2.5cm left/right, 2cm top/bottom)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)
        
        # Header & Footer setup
        header = section.header
        hp = header.paragraphs[0]
        hp.text = "ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (RTSAS) — โรงพยาบาลบางคล้า"
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hp.runs[0].font.size = Pt(8.5)
        hp.runs[0].font.color.rgb = COLOR_MUTED_GRAY
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.text = "คู่มือการใช้งานระบบทางคลินิก (Clinical Operations Manual) v2.0"
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.runs[0].font.size = Pt(8.5)
        fp.runs[0].font.color.rgb = COLOR_MUTED_GRAY

    # Set normal style font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'TH Sarabun New'
    font.size = Pt(11.5)
    font.color.rgb = COLOR_DARK_TEXT

    with open(INPUT_MD, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_code_block = False
    code_lines = []
    in_table = False
    table_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i].rstrip('\r\n')
        
        # Code Block Handling
        if line.startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                # Render code block in a shaded single-cell table
                tbl = doc.add_table(rows=1, cols=1)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell = tbl.cell(0, 0)
                set_cell_background(cell, "f8fafc")
                set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
                set_cell_border(cell, 
                    top=dict(val='single', sz=6, color='e2e8f0'),
                    bottom=dict(val='single', sz=6, color='e2e8f0'),
                    left=dict(val='single', sz=12, color=HEX_HEADER_BG),
                    right=dict(val='single', sz=6, color='e2e8f0')
                )
                
                cp = cell.paragraphs[0]
                cp.paragraph_format.space_before = Pt(2)
                cp.paragraph_format.space_after = Pt(2)
                cp.paragraph_format.line_spacing = 1.15
                code_text = "\n".join(code_lines)
                c_run = cp.add_run(code_text)
                c_run.font.name = 'Consolas'
                c_run.font.size = Pt(9.5)
                c_run.font.color.rgb = RGBColor(30, 41, 59)
                
                p_space = doc.add_paragraph()
                p_space.paragraph_format.space_after = Pt(4)
                code_lines = []
            i += 1
            continue
            
        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Markdown Table Handling
        if line.strip().startswith('|') and '|' in line.strip()[1:]:
            if not in_table:
                in_table = True
                table_lines = [line.strip()]
            else:
                table_lines.append(line.strip())
            i += 1
            continue
        elif in_table:
            # End of table detected, process table_lines
            in_table = False
            parsed_rows = []
            for tl in table_lines:
                # Skip separator lines like |---|---|
                if re.match(r'^\|[\s\-:|]+\|$', tl):
                    continue
                cols = [c.strip() for c in tl.split('|')[1:-1]]
                if cols:
                    parsed_rows.append(cols)
            
            if parsed_rows:
                num_cols = max(len(r) for r in parsed_rows)
                tbl = doc.add_table(rows=len(parsed_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                
                for r_idx, row_data in enumerate(parsed_rows):
                    is_header = (r_idx == 0)
                    row = tbl.rows[r_idx]
                    
                    # Prevent row breaking across pages
                    trPr = row._tr.get_or_add_trPr()
                    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
                    if is_header:
                        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
                    
                    for c_idx in range(num_cols):
                        cell = row.cells[c_idx]
                        cell_text = row_data[c_idx] if c_idx < len(row_data) else ""
                        
                        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
                        set_cell_border(cell,
                            top=dict(val='single', sz=4, color=HEX_BORDER),
                            bottom=dict(val='single', sz=6 if is_header else 4, color=HEX_HEADER_BG if is_header else HEX_BORDER),
                            left=dict(val='single', sz=4, color=HEX_BORDER),
                            right=dict(val='single', sz=4, color=HEX_BORDER)
                        )
                        
                        if is_header:
                            set_cell_background(cell, HEX_HEADER_BG)
                        elif r_idx % 2 == 1:
                            set_cell_background(cell, HEX_ROW_ALT_BG)
                            
                        cp = cell.paragraphs[0]
                        cp.paragraph_format.space_before = Pt(2)
                        cp.paragraph_format.space_after = Pt(2)
                        
                        if is_header:
                            run = cp.add_run(cell_text)
                            run.bold = True
                            run.font.color.rgb = RGBColor(255, 255, 255)
                            run.font.size = Pt(10)
                        else:
                            add_formatted_text(cp, cell_text, default_size=10)
                            
                p_space = doc.add_paragraph()
                p_space.paragraph_format.space_after = Pt(6)
            table_lines = []
            # continue evaluating current line below

        # Header 1: Document Title
        if line.startswith('# '):
            title_text = line[2:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(title_text)
            run.bold = True
            run.font.size = Pt(22)
            run.font.color.rgb = COLOR_PRIMARY_BLUE
            i += 1
            continue

        # Header 2 / Subtitle: ### Subtitle
        if line.startswith('### '):
            subtitle_text = line[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(subtitle_text)
            run.font.size = Pt(14)
            run.bold = True
            run.font.color.rgb = COLOR_SUB_BLUE
            i += 1
            continue

        # Header 2: ## Section Title
        if line.startswith('## '):
            h2_text = line[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(h2_text)
            run.bold = True
            run.font.size = Pt(16)
            run.font.color.rgb = COLOR_PRIMARY_BLUE
            i += 1
            continue

        # Header 3: ### Subsection
        if line.startswith('### '):
            h3_text = line[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(h3_text)
            run.bold = True
            run.font.size = Pt(13)
            run.font.color.rgb = COLOR_SECONDARY_BLUE
            i += 1
            continue

        # Horizontal Divider
        if line.strip() == '---':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            p_border = p.paragraph_format
            run = p.add_run('━' * 55)
            run.font.color.rgb = RGBColor(203, 213, 224)
            run.font.size = Pt(10)
            i += 1
            continue

        # Image Detection: ![Caption](path)
        img_match = re.search(r'!\[(.*?)\]\((.*?)\)', line)
        if img_match:
            caption = img_match.group(1)
            img_path = img_match.group(2).strip()
            
            # Resolve image file
            target_img_file = None
            if img_path.startswith('/'):
                target_img_file = img_path
            elif 'images/manual/' in img_path:
                filename = os.path.basename(img_path)
                target_img_file = os.path.join(IMAGES_DIR, filename)
            else:
                target_img_file = os.path.join(DOCS_DIR, img_path)
                
            if target_img_file and os.path.exists(target_img_file):
                p_img = doc.add_paragraph()
                p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_img.paragraph_format.space_before = Pt(8)
                p_img.paragraph_format.space_after = Pt(2)
                p_img.paragraph_format.keep_with_next = True
                
                run_img = p_img.add_run()
                run_img.add_picture(target_img_file, width=Inches(6.2))
                
                # Check next line for italic caption if not already present
                caption_text = caption
                if i + 1 < len(lines) and lines[i+1].strip().startswith('*รูปที่'):
                    caption_text = lines[i+1].strip().strip('*')
                    i += 1 # consume caption line
                    
                p_cap = doc.add_paragraph()
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.paragraph_format.space_before = Pt(2)
                p_cap.paragraph_format.space_after = Pt(10)
                run_cap = p_cap.add_run(caption_text)
                run_cap.italic = True
                run_cap.font.size = Pt(9.5)
                run_cap.font.color.rgb = COLOR_MUTED_GRAY
            i += 1
            continue

        # Callout Alert Boxes: > [!TIP], > [!NOTE], >
        if line.startswith('>'):
            callout_text = line[1:].strip()
            # If multi-line callout, collect subsequent > lines
            while i + 1 < len(lines) and lines[i+1].startswith('>'):
                i += 1
                callout_text += " " + lines[i][1:].strip()
                
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl.cell(0, 0)
            set_cell_background(cell, "f0f9ff")
            set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
            set_cell_border(cell,
                top=dict(val='single', sz=4, color='bae6fd'),
                bottom=dict(val='single', sz=4, color='bae6fd'),
                left=dict(val='single', sz=16, color='0284c7'),
                right=dict(val='single', sz=4, color='bae6fd')
            )
            cp = cell.paragraphs[0]
            cp.paragraph_format.space_before = Pt(2)
            cp.paragraph_format.space_after = Pt(2)
            cp.paragraph_format.line_spacing = 1.2
            add_formatted_text(cp, callout_text, default_size=10.5)
            
            p_space = doc.add_paragraph()
            p_space.paragraph_format.space_after = Pt(4)
            i += 1
            continue

        # Bullet List Items
        if re.match(r'^\s*[-*]\s+', line):
            indent_level = (len(line) - len(line.lstrip())) // 2
            bullet_text = re.sub(r'^\s*[-*]\s+', '', line)
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.2
            if indent_level > 0:
                p.paragraph_format.left_indent = Inches(0.25 * (indent_level + 1))
            add_formatted_text(p, bullet_text)
            i += 1
            continue

        # Numbered List Items
        num_match = re.match(r'^\s*(\d+)\.\s+(.*)', line)
        if num_match:
            num_str = num_match.group(1)
            num_text = num_match.group(2)
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.2
            add_formatted_text(p, num_text)
            i += 1
            continue

        # Standard Paragraph Text
        if line.strip():
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.25
            add_formatted_text(p, line.strip())
            
        i += 1

    # Save to both target locations
    doc.save(OUTPUT_DOCX_DOCS)
    print(f"Saved: {OUTPUT_DOCX_DOCS} ({os.path.getsize(OUTPUT_DOCX_DOCS) / 1024:.1f} KB)")
    
    doc.save(OUTPUT_DOCX_DESKTOP)
    print(f"Saved: {OUTPUT_DOCX_DESKTOP} ({os.path.getsize(OUTPUT_DOCX_DESKTOP) / 1024:.1f} KB)")

if __name__ == "__main__":
    build_manual_docx()
