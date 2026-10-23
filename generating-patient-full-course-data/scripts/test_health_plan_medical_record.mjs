import assert from "node:assert/strict";
import { validateMedicalRecordContent } from "./health_plan_content_validator.mjs";

const patient = {
  userid: "U-HTN",
  disease: "老年高血压",
  coursePlanName: "老年高血压治疗与随访方案",
  surgeryName: "",
};
const summary = [
  "就诊科室：心血管内科",
  "就诊日期：2026年10月23日",
  "主诉：间断头晕伴血压升高3天",
  "体征：T 36.5℃，P 80次/分，BP 156/94mmHg，双下肢无水肿",
  "处置：围绕老年高血压复核血压及用药执行情况，安排家庭血压记录，评估心血管风险。",
  "复诊：1周后复诊评估血压记录；胸痛或肢体无力时立即就医。",
].join("\n");
const validate = (text, context = patient, mode = "fictional-test") =>
  validateMedicalRecordContent(text, context.userid, { patient: context, mode });

assert.doesNotThrow(() => validate(summary));
assert.throws(() => validate(summary.replace("156/94", "120/80")), /高血压.*血压|血压.*高血压/);
assert.throws(() => validate(summary.replace("BP 156/94mmHg，", "")), /高血压.*血压|血压.*高血压/);
assert.doesNotThrow(() => validate(summary.replace("156/94", "148/82")));
assert.doesNotThrow(() => validate(summary.replace("156/94", "134/94")));
assert.throws(() => validate(summary.replace("156/94", "90/156")), /血压/);
assert.throws(() => validate(summary.replace("间断头晕伴血压升高3天", "门诊拟询问头晕及血压情况")), /主诉.*典型就诊/);
assert.throws(() => validate(summary.replace("间断头晕伴血压升高3天", "间断头晕伴血压升高")), /主诉.*病程|主诉.*持续时间/);
assert.throws(() => validate(summary.replace(/体征：[^\n]+/, "体征：门诊拟检查血压")), /体征.*具体/);
assert.throws(() => validate(summary.replace(/处置：[^\n]+/, "处置：安排胃镜评估胃黏膜。")), /处置.*疾病/);
assert.throws(() => validate(summary.replace(/复诊：[^\n]+/, "")), /缺少：复诊/);
assert.throws(() => validate(`${summary}\n体征：BP 150/90mmHg`), /重复|六段/);
assert.throws(() => validate(summary.replace("体征：", "体征：模拟检查提示，非已观察结果，")), /事实状态说明/);

const postoperativePatient = {
  userid: "U-POST",
  disease: "胆囊结石",
  coursePlanName: "胆囊结石腹腔镜胆囊切除术后随访方案",
  surgeryName: "腹腔镜胆囊切除术",
};
const postoperativeSummary = [
  "就诊科室：普外科",
  "就诊日期：2026年10月23日",
  "主诉：腹腔镜胆囊切除术后1周复查，切口轻微不适2天",
  "体征：T 36.5℃，P 80次/分，BP 125/78mmHg，腹软，切口干燥",
  "处置：围绕胆囊结石术后恢复评估切口与进食耐受，指导循序恢复日常活动。",
  "复诊：1周后复查切口，发热或腹痛加重时提前就医。",
].join("\n");
assert.doesNotThrow(() => validate(postoperativeSummary, postoperativePatient));
assert.throws(
  () => validate(postoperativeSummary.replace("腹腔镜胆囊切除术后1周复查，切口轻微不适2天", "右上腹痛4小时，尚未接受手术"), postoperativePatient),
  /术后.*矛盾|阶段.*矛盾/,
);
assert.throws(
  () => validate(postoperativeSummary, { ...postoperativePatient, coursePlanName: "膝骨关节炎康复随访方案" }),
  /疾病.*方案|方案.*疾病/,
);

const prospective = summary
  .replace("间断头晕伴血压升高3天", "门诊拟询问头晕及家庭血压记录")
  .replace(/体征：[^\n]+/, "体征：门诊拟检查血压、心率及下肢水肿");
assert.doesNotThrow(() => validate(prospective, patient, "real"));
assert.throws(() => validate(summary, patient, "real"), /拟询问|伪造/);
assert.throws(() => validate(prospective, patient, "unknown"), /模式/);

console.log(JSON.stringify({ status: "passed", suite: "health-plan-medical-record" }));
