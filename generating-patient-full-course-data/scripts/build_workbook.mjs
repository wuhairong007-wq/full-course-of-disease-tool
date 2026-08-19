import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { validateDrugSpecification } from "./drug_specification_validator.mjs";
import { validateGeneratedContent } from "./generated_content_validator.mjs";
import { validateClinicalMedicationSelection } from "./clinical_medication_validator.mjs";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

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
  for (const required of ["input", "records", "template", "output"]) {
    if (!args[required]) throw new Error(`缺少参数：--${required}`);
  }
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

function validateRecord(record, patient) {
  const { userid: expectedUserid, age, gender, disease, sourceAllergy, productName, productType } = patient;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${expectedUserid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${expectedUserid}必须且只能包含六个生成字段`);
  if (record.userid !== expectedUserid) throw new Error(`${expectedUserid}的userid被改变`);
  if (record.allergyHistory !== sourceAllergy) throw new Error(`${expectedUserid}的过敏史必须保留源表值`);
  if (!Array.isArray(record.combinedMedication) || record.combinedMedication.length < 3 || record.combinedMedication.length > 5) {
    throw new Error(`${expectedUserid}的combinedMedication必须为3～5项数组`);
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
const actualTemplateHeaders = templateSheet.getRange("A1:Q1").values[0].map(normalize);
const records = JSON.parse(await fs.readFile(args.records, "utf8"));

if (JSON.stringify(actualTemplateHeaders) !== JSON.stringify(templateHeaders)) throw new Error("模板必须使用固定17列表头");
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
const outputRows = sourceRows.slice(1).map((sourceRow) => {
  const baseValues = baseHeaders.map((header) => sourceRow[indexes[header]]);
  const userid = normalize(sourceRow[indexes.userid]);
  const sourceAllergy = normalize(sourceRow[indexes["既往过敏史"]]) || "无";
  const age = Number(sourceRow[indexes["年龄"]]);
  const gender = normalize(sourceRow[indexes["性别"]]);
  const disease = normalize(sourceRow[indexes["疾病"]]);
  const productName = normalize(sourceRow[indexes["产品名称"]]);
  const productType = normalize(sourceRow[indexes["产品类型"]]);
  const record = recordByUserid.get(userid);
  if (!record) throw new Error(`缺少userid记录：${userid}`);
  validateRecord(record, { userid, age, gender, disease, sourceAllergy, productName, productType });
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
}));
