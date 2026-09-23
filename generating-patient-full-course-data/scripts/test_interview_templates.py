import unittest
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile


SKILL_DIR = Path(__file__).resolve().parents[1]
NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def first_table_rows(path):
    with ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    table = root.find(".//w:body/w:tbl", NAMESPACE)
    return [
        [
            "".join(node.text or "" for node in cell.findall(".//w:t", NAMESPACE)).strip()
            for cell in row.findall("./w:tc", NAMESPACE)
        ]
        for row in table.findall("./w:tr", NAMESPACE)
    ]


class InterviewTemplateTest(unittest.TestCase):
    def test_overview_tables_start_with_continuous_sequence_then_name(self):
        templates = [
            SKILL_DIR / "assets" / "patient-interview-analysis-template.docx",
            SKILL_DIR / "assets" / "patient-interview-records-template.docx",
        ]
        for template in templates:
            rows = first_table_rows(template)
            self.assertEqual(rows[0][:2], ["序号", "姓名"])
            self.assertEqual([row[0] for row in rows[1:]], [str(index) for index in range(1, len(rows))])


if __name__ == "__main__":
    unittest.main()
