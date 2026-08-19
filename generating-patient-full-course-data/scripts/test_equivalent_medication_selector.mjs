import assert from "node:assert/strict";
import { selectEquivalentCandidate } from "./equivalent_medication_selector.mjs";

const candidates = [
  { name: "药物甲", prescription: "药物甲处方" },
  { name: "药物乙", prescription: "药物乙处方" },
  { name: "药物丙", prescription: "药物丙处方" },
];

const first = selectEquivalentCandidate({
  userid: "U001",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates,
});
const repeated = selectEquivalentCandidate({
  userid: "U001",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates: [...candidates].reverse(),
});
assert.deepEqual(first, repeated, "同一患者在候选顺序变化后仍应得到相同选择");

const selections = new Set(Array.from({ length: 100 }, (_, index) => selectEquivalentCandidate({
  userid: `U${String(index).padStart(3, "0")}`,
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates,
}).name));
assert.ok(selections.size > 1, "不同userid应能在同一等效候选组中形成稳定差异");

assert.deepEqual(selectEquivalentCandidate({
  userid: "U001",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates: [candidates[0]],
}), candidates[0], "单一安全候选必须直接使用");

assert.throws(() => selectEquivalentCandidate({
  userid: "U001",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates: [],
}), /至少包含一个候选药物/);

assert.throws(() => selectEquivalentCandidate({
  userid: "U001",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates: [{ name: "药物甲" }, { name: "药物甲" }],
}), /候选药物名称不能重复/);

assert.throws(() => selectEquivalentCandidate({
  userid: "",
  disease: "示例疾病",
  therapyRole: "镇痛",
  candidates,
}), /userid、疾病和治疗作用不能为空/);

console.log(JSON.stringify({ status: "passed", selections: selections.size }));
