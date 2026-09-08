#!/usr/bin/env python3
"""Generate print-safe PNG charts using Pillow only."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PALETTE = ["#176B87", "#D95D39", "#6A4C93", "#2A9D8F", "#E9C46A", "#F4A261", "#264653", "#C44536", "#457B9D", "#8AB17D"]
BG, GRID, TEXT = "#FFFFFF", "#D9E2E8", "#25313A"


def _font(size):
    for path in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Supplemental/Songti.ttc"):
        try:
            return ImageFont.truetype(path, size=size, index=0)
        except OSError:
            pass
    return ImageFont.load_default()


def _text(draw, xy, value, size=22, anchor=None, fill=TEXT):
    draw.text(xy, str(value), font=_font(size), fill=fill, anchor=anchor)


def _canvas(width=1400, height=760):
    return Image.new("RGB", (width, height), BG)


def _bar_chart(path, labels, values, ylabel="人数", horizontal=False):
    labels = list(labels) or ["无记录"]
    values = [float(v or 0) for v in (list(values) or [0])]
    image, draw = _canvas(), None
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = 165, 55, 1335, 660
    max_value = max(max(values), 1)
    if horizontal:
        row_h = max(34, min(58, (bottom - top) / len(labels)))
        max_label = max((draw.textbbox((0, 0), str(label), font=_font(22))[2] for label in labels), default=0)
        chart_left, chart_width = left + min(max_label, 270) + 20, right - left - min(max_label, 270) - 20
        for index, (label, value) in enumerate(zip(labels, values)):
            y = top + index * row_h + row_h / 2
            draw.line((chart_left, y, right, y), fill=GRID, width=2)
            _text(draw, (chart_left - 14, y), label, anchor="rm")
            width = chart_width * value / max_value
            draw.rectangle((chart_left, y - row_h * .28, chart_left + width, y + row_h * .28), fill=PALETTE[index % len(PALETTE)], outline="white", width=2)
            _text(draw, (chart_left + width + 9, y), f"{value:g}", size=20, anchor="lm")
        _text(draw, (chart_left, bottom + 30), ylabel, size=20, anchor="lm")
    else:
        chart_height, slot = bottom - top, (right - left) / len(labels)
        for tick in range(5):
            y = bottom - tick * chart_height / 4
            draw.line((left, y, right, y), fill=GRID, width=2)
            _text(draw, (left - 14, y), f"{max_value * tick / 4:g}", size=18, anchor="rm")
        for index, (label, value) in enumerate(zip(labels, values)):
            x = left + slot * (index + .5)
            height = chart_height * value / max_value
            draw.rectangle((x - slot * .3, bottom - height, x + slot * .3, bottom), fill=PALETTE[index % len(PALETTE)], outline="white", width=2)
            _text(draw, (x, bottom - height - 12), f"{value:g}", size=19, anchor="ms")
            _text(draw, (x, bottom + 18), label, size=20, anchor="ma")
        _text(draw, (left - 120, top), ylabel, size=20, anchor="lm")
    draw.line((left, bottom, right, bottom), fill="#9BAAB4", width=2)
    image.save(path, format="PNG", optimize=True)


def _donut_chart(path, labels, values):
    labels, values = list(labels) or ["无记录"], [float(v or 0) for v in (list(values) or [0])]
    image, draw = Image.new("RGB", (1200, 760), BG), None
    draw = ImageDraw.Draw(image)
    box, total = (125, 90, 675, 640), sum(values)
    if total <= 0:
        draw.ellipse(box, outline=GRID, width=80)
    else:
        start = -90
        for index, value in enumerate(values):
            extent = 360 * value / total
            draw.arc(box, start, start + extent, fill=PALETTE[index % len(PALETTE)], width=115)
            start += extent
    _text(draw, (400, 350), f"{int(total):,}", size=34, anchor="mm")
    _text(draw, (400, 400), "患者", size=20, anchor="mm")
    for index, (label, value) in enumerate(zip(labels, values)):
        y = 150 + index * 62
        draw.rectangle((780, y - 13, 810, y + 17), fill=PALETTE[index % len(PALETTE)])
        _text(draw, (830, y), f"{label}  {value:g}", size=22, anchor="lm")
    image.save(path, format="PNG", optimize=True)


def _radar_chart(path, labels, values):
    labels, values = list(labels) or ["无记录"], [float(v or 0) for v in (list(values) or [0])]
    image, draw = Image.new("RGB", (1200, 820), BG), None
    draw = ImageDraw.Draw(image)
    cx, cy, radius, count = 520, 395, 260, len(labels)
    angles = [-math.pi / 2 + 2 * math.pi * i / count for i in range(count)]
    for level in range(1, 6):
        points = [(cx + radius * level / 5 * math.cos(a), cy + radius * level / 5 * math.sin(a)) for a in angles]
        draw.line(points + [points[0]], fill=GRID, width=2)
    for angle in angles:
        draw.line((cx, cy, cx + radius * math.cos(angle), cy + radius * math.sin(angle)), fill=GRID, width=2)
    points = [(cx + radius * min(v, 5) / 5 * math.cos(a), cy + radius * min(v, 5) / 5 * math.sin(a)) for a, v in zip(angles, values)]
    draw.polygon(points, fill="#B8DDE1", outline=PALETTE[0])
    draw.line(points + [points[0]], fill=PALETTE[0], width=4)
    for angle, label in zip(angles, labels):
        _text(draw, (cx + (radius + 35) * math.cos(angle), cy + (radius + 35) * math.sin(angle)), str(label).split("、", 1)[-1][:12], size=19, anchor="mm")
    image.save(path, format="PNG", optimize=True)


def _grouped_bar_chart(path, labels, series, ylabel="覆盖率（%）"):
    labels = list(labels) or ["无记录"]
    series = [(str(name), [float(v or 0) for v in values]) for name, values in series]
    image = _canvas(1500, 820)
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = 190, 55, 1400, 690
    max_value = max(100.0, max((max(values or [0]) for _, values in series), default=0))
    slot = (right - left) / max(len(labels), 1)
    group_width = slot * 0.72
    bar_width = group_width / max(len(series), 1)
    for tick in range(5):
        y = bottom - tick * (bottom - top) / 4
        draw.line((left, y, right, y), fill=GRID, width=2)
        _text(draw, (left - 14, y), f"{max_value * tick / 4:g}", size=18, anchor="rm")
    for i, label in enumerate(labels):
        base = left + slot * (i + 0.5) - group_width / 2
        for j, (name, values) in enumerate(series):
            value = values[i] if i < len(values) else 0
            height = (bottom - top) * value / max_value
            x0 = base + j * bar_width + 2
            x1 = base + (j + 1) * bar_width - 2
            draw.rectangle((x0, bottom - height, x1, bottom), fill=PALETTE[j % len(PALETTE)], outline="white", width=2)
            if value:
                _text(draw, ((x0 + x1) / 2, bottom - height - 10), f"{value:.1f}", size=15, anchor="ms")
        _text(draw, (left + slot * (i + 0.5), bottom + 20), str(label)[:12], size=18, anchor="ma")
    legend_x = left
    for j, (name, _) in enumerate(series):
        draw.rectangle((legend_x, 18, legend_x + 22, 40), fill=PALETTE[j % len(PALETTE)])
        _text(draw, (legend_x + 30, 29), name, size=18, anchor="lm")
        legend_x += 170
    _text(draw, (left - 130, top), ylabel, size=20, anchor="lm")
    draw.line((left, bottom, right, bottom), fill="#9BAAB4", width=2)
    image.save(path, format="PNG", optimize=True)


def _entries(metric, limit=None):
    values = metric or []
    return values[:limit] if limit else values


def generate_charts(insight, output_dir):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    metrics, manifest = insight["metrics"], []

    def add(chart_id, chart_type, caption, core, filename, source):
        manifest.append({"id": chart_id, "type": chart_type, "file": filename, "caption": caption, "coreInformation": core, "sourceMetrics": source})

    sex = metrics.get("sexDistribution", []); filename = "01-sex-distribution.png"
    _donut_chart(output / filename, [x["label"] for x in sex], [x["count"] for x in sex]); add("sex", "环形图", "患者性别分布", "展示服务患者中不同性别的人数构成。", filename, "metrics.sexDistribution")
    age = metrics.get("ageDistribution", []); filename = "02-age-distribution.png"
    _bar_chart(output / filename, [x["label"] for x in age], [x["count"] for x in age]); add("age", "柱状图", "患者年龄段分布", "展示各年龄段患者数量，识别主要服务年龄层。", filename, "metrics.ageDistribution")
    sex_age = metrics.get("sexAgeDistribution", []); filename = "03-sex-age-cross.png"
    _bar_chart(output / filename, [f"{x['sex']}·{x['age']}" for x in sex_age], [x["count"] for x in sex_age], horizontal=True); add("sex-age", "横向条形图", "性别与年龄交叉分布", "展示不同性别在各年龄组中的患者数量，识别结构性集中区间。", filename, "metrics.sexAgeDistribution")
    disease = _entries(metrics.get("diseaseDistribution"), 10); filename = "03-disease-distribution.png"
    _bar_chart(output / filename, [x["label"] for x in disease], [x["count"] for x in disease], horizontal=True); add("disease", "横向条形图", "患者疾病分型分布", "展示主要疾病类型及患者数量。", filename, "metrics.diseaseDistribution")
    allergy = _entries(metrics.get("allergyDistribution"), 10); filename = "04-allergy-distribution.png"
    _bar_chart(output / filename, [x["label"] for x in allergy], [x["count"] for x in allergy], horizontal=True); add("allergy", "横向条形图", "患者既往过敏史分布", "展示有无既往过敏史及主要过敏史记录的患者构成。", filename, "metrics.allergyDistribution")
    service = metrics.get("serviceExecution", {}); labels = ["用药提醒", "体温监测", "血压心率监测", "AI随访", "症状自评"]; values = [service.get("medicationReminders", 0), service.get("temperatureMonitoring", 0), service.get("vitalMonitoring", 0), service.get("followupRecords", 0), service.get("symptomRecords", 0)]; filename = "05-service-execution.png"
    _bar_chart(output / filename, labels, values); add("service", "柱状图", "患者服务执行量", "比较用药提醒、生命体征监测、智能随访和症状自评的服务次数。", filename, "metrics.serviceExecution")
    medication = _entries(metrics.get("medications", {}).get("drugDistribution"), 10); filename = "06-medication-distribution.png"
    _bar_chart(output / filename, [x["label"] for x in medication], [x["count"] for x in medication], horizontal=True); add("medications", "横向条形图", "主要药品使用分布", "展示用药记录中使用频次最高的药品。", filename, "metrics.medications.drugDistribution")
    modes = _entries(metrics.get("medications", {}).get("combinationModeDistribution"), 8); filename = "07-combination-modes.png"
    _bar_chart(output / filename, [x["label"] for x in modes], [x["count"] for x in modes], horizontal=True); add("combination-modes", "横向条形图", "联合用药模式分布", "展示患者实际用药组合的主要模式及其患者数。", filename, "metrics.medications.combinationModeDistribution")
    followup = metrics.get("followups", {}).get("questions", []); filename = "08-followup-positive-rate.png"
    _bar_chart(output / filename, [f"Q{i + 1}" for i in range(len(followup))], [x["positiveRate"].get("value", 0) * 100 for x in followup], ylabel="正向回答率（%）"); add("followup", "柱状图", "智能随访十维度正向回答率", "展示十个随访维度中正向回答比例，识别服务表现较好和需关注的维度。", filename, "metrics.followups.questions[].positiveRate")
    symptoms = metrics.get("symptoms", {}); filename = "09-symptom-dimensions.png"
    _radar_chart(output / filename, symptoms.get("questions", []), symptoms.get("dimensionMeans", [])); add("symptoms", "雷达图", "症状自评六维度均值", "展示六个症状维度的平均评分，评分越高代表症状负担越重。", filename, "metrics.symptoms.dimensionMeans")
    disease_scores = _entries(symptoms.get("diseaseDistribution"), 10); filename = "10-disease-symptom-scores.png"
    _bar_chart(output / filename, [x["label"] for x in disease_scores], [x["totalMean"] for x in disease_scores], ylabel="总分均值", horizontal=True); add("disease-symptom", "横向条形图", "按疾病分型的症状自评总分均值", "展示各疾病分型有效自评记录的总分均值，辅助定位分层复测重点。", filename, "metrics.symptoms.diseaseDistribution")
    risk = metrics.get("riskDistribution", []); filename = "11-risk-distribution.png"
    _bar_chart(output / filename, [x["label"] for x in risk], [x["count"] for x in risk]); add("risk", "柱状图", "患者风险分层分布", "展示低风险、中风险和高风险患者数量。", filename, "metrics.riskDistribution")
    ae = metrics.get("adverseEvents", {}).get("severityDistribution") or [{"label": "无记录", "count": 0}]; filename = "12-adverse-event-severity.png"
    _bar_chart(output / filename, [x["label"] for x in ae], [x["count"] for x in ae]); add("adverse-events", "柱状图", "不良反应严重程度分布", "展示服务周期内不良反应记录的严重程度构成。", filename, "metrics.adverseEvents.severityDistribution")
    for metric_key, filename, chart_id, caption in [("moduleCoverageByDisease", "13-disease-module-coverage.png", "disease-coverage", "各疾病分型服务模块覆盖率"), ("moduleCoverageByAge", "14-age-module-coverage.png", "age-coverage", "各年龄组服务模块覆盖率")]:
        groups = metrics.get(metric_key, [])
        labels = [x["label"] for x in groups]
        series_names = ["健康管理方案", "用药提醒", "智能随访", "症状自评"]
        series = [(name, [x["modules"].get(name, {}).get("value", 0) * 100 for x in groups]) for name in series_names]
        _grouped_bar_chart(output / filename, labels, series)
        add(chart_id, "分组柱状图", caption, "比较各分组中健康管理方案、用药提醒、智能随访和症状自评的患者覆盖率。", filename, f"metrics.{metric_key}")
    manifest_path = output / "chart-manifest.json"; manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"); return str(manifest_path)


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--insight", required=True); parser.add_argument("--output-dir", required=True); args = parser.parse_args()
    print(generate_charts(json.loads(Path(args.insight).read_text(encoding="utf-8")), args.output_dir))


if __name__ == "__main__":
    main()
