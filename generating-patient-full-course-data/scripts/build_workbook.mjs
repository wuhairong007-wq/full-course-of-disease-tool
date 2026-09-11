import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";
import { validateDrugSpecification } from "./drug_specification_validator.mjs";
import { validateGeneratedContent } from "./generated_content_validator.mjs";
import { shouldExcludeMedicinalProduct, validateClinicalMedicationSelection } from "./clinical_medication_validator.mjs";
import { validateMedicationReviews } from "./medication_review_validator.mjs";
import { validateFictionalReview } from "./fictional_test_mode.mjs";

const { FileBlob, SpreadsheetFile } = await loadArtifactTool();

const templateHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const baseHeaders = templateHeaders.slice(0, 11);
const sourceRequiredHeaders = [...baseHeaders, "产品名称", "产品类型"];
const recordKeys = ["userid", "allergyHistory", "combinedMedication", "prescriptionList", "surgeryName", "coursePlanName"];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  for (const required of ["input", "records", "template", "output", "review"]) {
    if (!args[required]) throw new Error(`缺少参数：--${required}`);
  }
  if (args["min-medications"] !== undefined && !/^[1-5]$/.test(args["min-medications"])) {
    throw new Error("--min-medications（最少种数）必须为1～5的整数");
  }
  args.minimumMedications = Number(args["min-medications"] ?? 1);
  args.mode ??= "real";
  if (!["real", "fictional-test"].includes(args.mode)) throw new Error("--mode必须为real或fictional-test");
  if (args.mode === "fictional-test" && !path.basename(args.output).includes("虚构测试")) throw new Error("虚构输出文件名必须含“虚构测试”");
  if (path.resolve(args.input) === path.resolve(args.output) || path.resolve(args.template) === path.resolve(args.output)) throw new Error("输出不得覆盖源文件或模板");
  return args;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function validatePrescriptionMapping(userid, medications, prescriptionList) {
  const prescriptionEntries = prescriptionList.split(" + ").map(normalize);
  if (prescriptionEntries.length !== medications.length) {
    throw new Error(`${userid}的处方清单必须与联合用药按顺序一一对应`);
  }
  for (let index = 0; index < medications.length; index += 1) {
    const medication = medications[index];
    const entry = prescriptionEntries[index];
    if (entry !== medication && !entry.startsWith(`${medication} `)) {
      throw new Error(`${userid}的处方清单必须与联合用药按顺序一一对应`);
    }
    validateDrugSpecification({ userid, medication, prescriptionEntry: entry });
  }
}

function filterCompanyProduct(record, patient, company) {
  if (!shouldExcludeMedicinalProduct({ company, productType: patient.productType })) return record;
  if (!Array.isArray(record?.combinedMedication) || typeof record?.prescriptionList !== "string") return record;
  const productName = normalize(patient.productName);
  const medications = record.combinedMedication.filter((medication) => normalize(medication) !== productName);
  const prescriptionEntries = normalize(record.prescriptionList).split(" + ").map(normalize);
  const filteredPrescriptionEntries = prescriptionEntries.filter((entry) => (
    entry !== productName && !entry.startsWith(`${productName} `)
  ));
  return {
    ...record,
    combinedMedication: medications,
    prescriptionList: filteredPrescriptionEntries.join(" + "),
  };
}

function validateRecord(record, patient, company) {
  const { userid: expectedUserid, age, gender, disease, sourceAllergy, productName, productType } = patient;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${expectedUserid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${expectedUserid}必须且只能包含六个生成字段`);
  if (record.userid !== expectedUserid) throw new Error(`${expectedUserid}的userid被改变`);
  if (record.allergyHistory !== sourceAllergy) throw new Error(`${expectedUserid}的过敏史必须保留源表值`);
  if (!Array.isArray(record.combinedMedication) || record.combinedMedication.length < 1 || record.combinedMedication.length > 5) {
    throw new Error(`${expectedUserid}的combinedMedication必须为1～5项数组`);
  }
  if (record.combinedMedication.some((medication) => !normalize(medication) || medication === "无")) throw new Error(`${expectedUserid}的combinedMedication必须填写有效药物通用名`);
  if (new Set(record.combinedMedication).size !== record.combinedMedication.length) throw new Error(`${expectedUserid}的用药存在重复`);
  validateClinicalMedicationSelection({
    userid: expectedUserid,
    age,
    gender,
    disease,
    allergyHistory: sourceAllergy,
    productName,
    productType,
    company,
    medications: record.combinedMedication,
  });
  if (!normalize(record.prescriptionList)) throw new Error(`${expectedUserid}的prescriptionList不能为空`);
  if (!normalize(record.coursePlanName)) throw new Error(`${expectedUserid}的coursePlanName不能为空`);
  validateGeneratedContent({
    userid: expectedUserid,
    fields: {
      combinedMedication: record.combinedMedication,
      prescriptionList: record.prescriptionList,
      surgeryName: record.surgeryName,
      coursePlanName: record.coursePlanName,
    },
  });
  validatePrescriptionMapping(expectedUserid, record.combinedMedication, record.prescriptionList);
  if (/\b(?:tid|bid|qd|q8h|prn|ivgtt|im|po)\b|适量|酌情|必要时/i.test(record.prescriptionList)) {
    throw new Error(`${expectedUserid}的处方含禁用缩写或模糊词`);
  }
  if (/高龄|老年|中老年|青年|中年|男性|女性|男患者|女患者/.test(record.coursePlanName)) {
    throw new Error(`${expectedUserid}的方案名称含年龄或性别标识`);
  }
  if (productType === "器械") {
    if (!normalize(record.surgeryName)) throw new Error(`${expectedUserid}的器械产品必须填写手术名称`);
    if (!record.surgeryName.includes(productName)) throw new Error(`${expectedUserid}的手术名称未体现器械产品`);
  } else if (normalize(record.surgeryName)) {
    throw new Error(`${expectedUserid}的非器械产品手术名称必须为空`);
  }
}

const args = parseArgs(process.argv.slice(2));
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const templateWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.template));
const sourceSheet = sourceWorkbook.worksheets.getItemAt(0);
const templateSheet = templateWorkbook.worksheets.getItemAt(0);
const sourceRows = sourceSheet.getUsedRange(true).values;
const sourceHeaders = sourceRows[0].map(normalize);
const actualTemplateHeaders = templateSheet.getUsedRange(true).values[0].map(normalize);
const records = JSON.parse(await fs.readFile(args.records, "utf8"));
const reviews = JSON.parse(await fs.readFile(args.review, "utf8"));

if (JSON.stringify(actualTemplateHeaders) !== JSON.stringify(templateHeaders)) throw new Error("模板必须使用固定17列表头");
if (templateWorkbook.worksheets.items.length !== 1) throw new Error("患者明细模板必须仅含一个工作表，不能附加评估工作表");
for (const header of sourceRequiredHeaders) {
  if (!sourceHeaders.includes(header)) throw new Error(`基础数据缺少必需字段：${header}`);
}
if (!Array.isArray(records)) throw new Error("records文件必须是JSON数组");
if (records.length !== sourceRows.length - 1) throw new Error("生成记录数量与患者数量不一致");

const indexes = Object.fromEntries(sourceHeaders.map((header, index) => [header, index]));
const recordByUserid = new Map();
for (const record of records) {
  if (recordByUserid.has(record.userid)) throw new Error(`重复userid：${record.userid}`);
  recordByUserid.set(record.userid, record);
}

let allergyCount = 0;
const finalRecords = [];
const outputRows = sourceRows.slice(1).map((sourceRow) => {
  const baseValues = baseHeaders.map((header) => sourceRow[indexes[header]]);
  const userid = normalize(sourceRow[indexes.userid]);
  const sourceAllergy = normalize(sourceRow[indexes["既往过敏史"]]) || "无";
  const age = Number(sourceRow[indexes["年龄"]]);
  const gender = normalize(sourceRow[indexes["性别"]]);
  const disease = normalize(sourceRow[indexes["疾病"]]);
  const productName = normalize(sourceRow[indexes["产品名称"]]);
  const productType = normalize(sourceRow[indexes["产品类型"]]);
  const sourceRecord = recordByUserid.get(userid);
  if (!sourceRecord) throw new Error(`缺少userid记录：${userid}`);
  const record = filterCompanyProduct(sourceRecord, { productName, productType }, args.company);
  validateRecord(record, { userid, age, gender, disease, sourceAllergy, productName, productType }, args.company);
  finalRecords.push(record);
  if (record.allergyHistory !== "无") allergyCount += 1;
  return [
    ...baseValues,
    record.combinedMedication.join("+"),
    record.prescriptionList,
    record.surgeryName,
    record.coursePlanName,
    "已生成",
    "待确认",
  ];
});

const reviewPatients = sourceRows.slice(1).map(row => Object.fromEntries(sourceHeaders.map((header, index) => [header, row[index]])));
let fictionalMetrics;
if (args.mode === "fictional-test") {
  fictionalMetrics = validateFictionalReview({
    review: reviews, records: finalRecords, patients: reviewPatients,
    sourceSHA256: crypto.createHash("sha256").update(await fs.readFile(args.input)).digest("hex"),
    company: args.company ?? "", minimumMedications: args.minimumMedications, output: args.output,
  });
} else {
  if (reviews?.kind === "fictional-test-review/v1") throw new Error("虚构情境记录不能用于真实患者模式；需要显式指定--mode fictional-test");
  validateMedicationReviews({ reviews, records: finalRecords, patients: reviewPatients });
}

// Count the final, validated medications after company exclusions, not search candidates.
// Fail before touching the output path so a previous valid workbook remains intact.
const belowMinimum = finalRecords.filter(record => record.combinedMedication.length < args.minimumMedications);
if (belowMinimum.length) {
  const affected = belowMinimum.map(record => `${record.userid}（实际${record.combinedMedication.length}种）`).join("；");
  throw new Error(`联合用药未达到最少种数${args.minimumMedications}：${affected}。未生成患者明细，不输出替代评估文件。`);
}

const existingRows = templateSheet.getUsedRange(true).values.length;
if (existingRows > 1) templateSheet.getRange(`A2:Q${existingRows}`).clear({ applyTo: "contents" });
if (outputRows.length + 1 > existingRows) {
  const styleSource = templateSheet.getRange(`A${existingRows}:Q${existingRows}`);
  for (let rowNumber = existingRows + 1; rowNumber <= outputRows.length + 1; rowNumber += 1) {
    templateSheet.getRange(`A${rowNumber}:Q${rowNumber}`).copyFrom(styleSource, "all");
  }
}
templateSheet.getRangeByIndexes(1, 0, outputRows.length, templateHeaders.length).values = outputRows;
templateSheet.freezePanes.freezeRows(1);
templateSheet.showGridLines = false;

for (const table of [...(templateSheet.tables.items ?? [])]) table.delete();
templateSheet.tables.add(`A1:Q${outputRows.length + 1}`, true, "PatientFullCourseData");

if (args.mode === "fictional-test") {
  // Preserve the template schema, with room for three complete prescriptions.
  templateSheet.getRange(`A1:Q${outputRows.length + 1}`).format.wrapText = true;
  templateSheet.getRange(`A1:Q${outputRows.length + 1}`).format.verticalAlignment = "top";
  const widths = [65,335,95,180,55,55,195,130,185,140,165,280,850,90,245,90,90];
  widths.forEach((width,i) => { templateSheet.getRangeByIndexes(0,i,outputRows.length+1,1).format.columnWidthPx = width; });
  templateSheet.getRange(`A2:Q${outputRows.length + 1}`).format.rowHeightPx = 216;
}
templateWorkbook.recalculate();

await fs.mkdir(path.dirname(args.output), { recursive: true });
await (await SpreadsheetFile.exportXlsx(templateWorkbook)).save(args.output);

if (args.preview) {
  const preview = await templateWorkbook.render({
    sheetName: templateSheet.name,
    range: `A1:Q${Math.min(outputRows.length + 1, 12)}`,
    scale: 1,
    format: "png",
  });
  await fs.mkdir(path.dirname(args.preview), { recursive: true });
  await fs.writeFile(args.preview, new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({
  status: "passed",
  output: args.output,
  patients: outputRows.length,
  fields: templateHeaders.length,
  allergyCount,
  minimumMedications: args.minimumMedications,
  minimumActualMedications: Math.min(...finalRecords.map(record => record.combinedMedication.length)),
  mode: args.mode,
  ...(fictionalMetrics ?? {}),
}));
