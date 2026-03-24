#!/usr/bin/env python3
import json
import sys
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def as_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def safe_days(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    cleaned: List[Dict[str, Any]] = []
    for row in value:
        if not isinstance(row, dict):
            continue
        cleaned.append({
            "day": as_text(row.get("day"), ""),
            "action": as_text(row.get("action"), ""),
            "do": as_text(row.get("do"), ""),
            "say": as_text(row.get("say"), ""),
        })
    return cleaned


def build_pdf(payload: Dict[str, Any], output_path: str) -> None:
    cadence = payload.get("cadence") or {}
    metadata = payload.get("metadata") or {}
    enhancements = payload.get("enhancements") or {}

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=colors.HexColor("#0f2f52"),
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "SubtitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#38516c"),
        leading=14,
    )
    section_style = ParagraphStyle(
        "SectionStyle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.HexColor("#0f2f52"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#1f2f40"),
        leading=14,
    )

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.6 * inch,
        title="Follow-Up Cadence",
        author="AutoDriveCX",
    )

    story = []

    story.append(Paragraph("Follow-Up Cadence", title_style))
    story.append(Paragraph("AutoDriveCX Tool Shop", subtitle_style))
    story.append(Spacer(1, 8))

    scenario_line = (
        f"<b>Status:</b> {as_text(metadata.get('dealStatus'), 'N/A')} &nbsp;&nbsp;"
        f"<b>Length:</b> {as_text(metadata.get('days'), 'N/A')} days &nbsp;&nbsp;"
        f"<b>Customer Type:</b> {as_text(metadata.get('customerType'), 'Neutral')}"
    )
    story.append(Paragraph(scenario_line, body_style))

    notes = as_text(metadata.get("notes"), "")
    if notes:
        story.append(Paragraph(f"<b>Notes:</b> {notes}", body_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph(f"<b>Goal:</b> {as_text(cadence.get('goal'), 'N/A')}", body_style))
    story.append(Paragraph(f"<b>Cadence Summary:</b> {as_text(cadence.get('summary'), 'N/A')}", body_style))

    days = safe_days(cadence.get("days"))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Day-by-Day Plan", section_style))

    for row in days:
      day_label = as_text(row.get("day"), "")
      action = as_text(row.get("action"), "")
      do_text = as_text(row.get("do"), "")
      say_text = as_text(row.get("say"), "")

      table_data = [
          [Paragraph(f"<b>Day {day_label}</b>", body_style), Paragraph(f"<b>Action:</b> {action}", body_style)],
          [Paragraph(f"<b>Do:</b> {do_text}", body_style), Paragraph(f"<b>Say:</b> {say_text}", body_style)],
      ]
      table = Table(table_data, colWidths=[3.4 * inch, 3.2 * inch])
      table.setStyle(TableStyle([
          ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#b9c9d8")),
          ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9e4ee")),
          ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef5fb")),
          ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 6),
          ("RIGHTPADDING", (0, 0), (-1, -1), 6),
          ("TOPPADDING", (0, 0), (-1, -1), 5),
          ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
      ]))
      story.append(table)
      story.append(Spacer(1, 7))

    sprocket = enhancements.get("sprocket") if isinstance(enhancements, dict) else None
    autodrive = enhancements.get("autodrive") if isinstance(enhancements, dict) else None

    if isinstance(sprocket, dict) or isinstance(autodrive, dict):
        story.append(Spacer(1, 8))
        story.append(Paragraph("Coaching Add-Ons", section_style))

    if isinstance(sprocket, dict):
        story.append(Paragraph("<b>Sprocket</b>", body_style))
        story.append(Paragraph(f"- Likely Stall Reason: {as_text(sprocket.get('likelyStallReason'), 'N/A')}", body_style))
        story.append(Paragraph(f"- Smarter Shift: {as_text(sprocket.get('smarterCadenceShift'), 'N/A')}", body_style))
        story.append(Paragraph(f"- Message Tip: {as_text(sprocket.get('messageRewriteTip'), 'N/A')}", body_style))
        story.append(Paragraph(f"- Delivery Coaching: {as_text(sprocket.get('deliveryCoaching'), 'N/A')}", body_style))

    if isinstance(autodrive, dict):
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>AutoDriveCX</b>", body_style))
        story.append(Paragraph(f"- Tailored Reason: {as_text(autodrive.get('tailoredReason'), 'N/A')}", body_style))
        story.append(Paragraph(f"- Adjustment: {as_text(autodrive.get('cadenceAdjustment'), 'N/A')}", body_style))
        story.append(Paragraph(f"- Focus Skill: {as_text(autodrive.get('focusSkillTag'), 'N/A')}", body_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("AutoDriveCX", ParagraphStyle(
        "BrandLine",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.HexColor("#5a728c"),
    )))

    doc.build(story)


def main() -> int:
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: generate_followup_pdf.py <input_json_path> <output_pdf_path>\n")
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as fp:
        payload = json.load(fp)

    build_pdf(payload, output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
