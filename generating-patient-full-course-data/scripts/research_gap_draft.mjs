import assert from "node:assert/strict";

const nonempty = value => typeof value === "string" && value.trim().length > 0;
const text = value => String(value ?? "").trim();

export function createResearchGapDraft({ review, patients, sourceSHA256 }) {
  assert.equal(review?.kind, "fictional-draft-review/v1", "草稿需要专用检索缺口记录");
  assert.equal(review.sourceSHA256, sourceSHA256, "草稿检索记录与源文件不一致");
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(review.searchedOn ?? "")
      && Number.isFinite(Date.parse(review.searchedOn))
      && new Date(review.searchedOn).toISOString().slice(0, 10) === review.searchedOn,
    "草稿必须记录有效检索日期",
  );
  assert(Array.isArray(review.queries) && review.queries.length && review.queries.every(nonempty), "草稿缺少实际检索词");
  assert(Array.isArray(review.sources) && review.sources.length, "草稿缺少已查阅来源");
  for (const source of review.sources) {
    assert(nonempty(source?.title) && nonempty(source?.url) && nonempty(source?.finding), "草稿来源必须包含标题、网址和查阅结果");
    assert(["https:", "http:"].includes(new URL(source.url).protocol), "草稿来源必须为网页网址");
  }
  assert(Array.isArray(patients) && patients.length, "草稿不能使用空患者表");
  const userids = patients.map(patient => text(patient.userid));
  assert(userids.every(nonempty) && new Set(userids).size === patients.length, "草稿源表存在空或重复userid");
  assert(Array.isArray(review.unresolved) && review.unresolved.length === patients.length, "草稿必须按源表顺序记录全部患者的未完成审核");
  const records = patients.map((patient, index) => {
    const userid = userids[index];
    const gap = review.unresolved[index];
    assert.equal(gap?.userid, userid, "草稿缺口患者覆盖或顺序不一致");
    assert(Array.isArray(gap.parameters) && gap.parameters.length && gap.parameters.every(nonempty), `${userid}未记录具体核实缺口`);
    assert(nonempty(gap.reason), `${userid}未记录审核未完成的原因`);
    assert(Number.isFinite(Number(patient["年龄"])) && Number(patient["年龄"]) >= 0 && text(patient["年龄"]), `${userid}年龄无效`);
    assert(nonempty(text(patient["疾病"])), `${userid}疾病不能为空`);
    assert(nonempty(text(patient["产品名称"])) && ["用药", "器械"].includes(text(patient["产品类型"])), `${userid}产品资料无效`);
    return {
      userid,
      allergyHistory: text(patient["既往过敏史"]) || "无",
      combinedMedication: [],
      prescriptionList: "",
      surgeryName: "",
      consumableName: "",
      coursePlanName: text(patient["疾病"]),
    };
  });
  return { records, unresolvedPatients: records.length, clinicalValidation: "not-completed" };
}
