import fs from "node:fs/promises";
import { selectOsteoarthritisMedication } from "./osteoarthritis_medication_selector.mjs";

const coursePlans = {
  "原发性膝骨关节炎": "原发性膝骨关节炎关节保护与症状管理方案",
  "创伤后骨关节炎": "创伤后骨关节炎关节保护与症状管理方案",
  "原发性髋骨关节炎": "原发性髋骨关节炎关节保护与症状管理方案",
  "继发性膝骨关节炎": "继发性膝骨关节炎关节保护与症状管理方案",
  "髋关节继发性骨关节炎": "髋关节继发性骨关节炎关节保护与症状管理方案",
  "肩骨关节炎": "肩骨关节炎关节保护与症状管理方案",
  "手骨关节炎": "手骨关节炎关节保护与症状管理方案",
  "踝骨关节炎": "踝骨关节炎关节保护与症状管理方案",
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  for (const required of ["input", "output", "simulation-authorized"]) {
    if (!args[required]) throw new Error(`缺少参数：--${required}`);
  }
  if (args["simulation-authorized"] !== "yes") {
    throw new Error("仅在用户明确授权模拟疼痛和炎症分层时可运行");
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const patients = JSON.parse(await fs.readFile(args.input, "utf8"));
const records = patients.map((patient) => {
  const coursePlanName = coursePlans[patient.disease];
  if (!coursePlanName) throw new Error(`${patient.userid}未配置骨关节炎方案：${patient.disease}`);
  const selection = selectOsteoarthritisMedication(patient);
  return {
    userid: patient.userid,
    allergyHistory: patient.allergyHistory,
    combinedMedication: selection.combinedMedication,
    prescriptionList: selection.prescriptionList,
    surgeryName: "",
    coursePlanName,
  };
});

await fs.writeFile(args.output, JSON.stringify(records, null, 2), "utf8");
console.log(JSON.stringify({ status: "passed", patients: records.length }));
