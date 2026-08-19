import { createHash } from "node:crypto";

const normalize = (value) => String(value ?? "").trim();
const candidateName = (candidate) => normalize(typeof candidate === "string" ? candidate : candidate?.name);

export function selectEquivalentCandidate({ userid, disease, therapyRole, candidates }) {
  const keyParts = [userid, disease, therapyRole].map(normalize);
  if (keyParts.some((part) => !part)) throw new Error("userid、疾病和治疗作用不能为空");
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("至少包含一个候选药物");

  const sorted = [...candidates].sort((left, right) => candidateName(left).localeCompare(candidateName(right), "zh-CN"));
  const names = sorted.map(candidateName);
  if (names.some((name) => !name)) throw new Error("候选药物名称不能为空");
  if (new Set(names).size !== names.length) throw new Error("候选药物名称不能重复");

  const digest = createHash("sha256").update(keyParts.join("\u001f"), "utf8").digest();
  const value = digest.readUInt32BE(0);
  return sorted[value % sorted.length];
}
