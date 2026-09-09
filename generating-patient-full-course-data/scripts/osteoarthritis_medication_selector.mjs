import { selectEquivalentCandidate } from "./equivalent_medication_selector.mjs";

const sourceProductPrescription = "硫酸氨基葡萄糖胶囊 规格0.25g/粒，每次0.5g，口服，每日3次，餐后服用，连续84天；请由临床医师复核用药方案";
const acetaminophenPrescription = "对乙酰氨基酚片 规格0.5g/片，每次0.5g，口服，每日2次，早晚餐后服用，连续7天；请由临床医师复核用药方案";
const topicalNsaidCandidates = [
  {
    name: "双氯芬酸二乙胺乳胶剂",
    prescription: "双氯芬酸二乙胺乳胶剂 规格1%（20g/支），每次2g，外用，每日3次，早中晚涂抹，连续14天；请由临床医师复核用药方案",
  },
  {
    name: "氟比洛芬凝胶贴膏",
    prescription: "氟比洛芬凝胶贴膏 规格40mg/贴，每次1贴，外用，每日1次，贴于疼痛部位，连续7天；请由临床医师复核用药方案",
  },
];

function stableBucket(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 10;
}

function hasNsaidAllergy(allergyHistory) {
  return /(?:非甾体(?:类)?抗炎药|NSAIDs?|双氯芬酸|氟比洛芬)/i.test(String(allergyHistory ?? ""));
}

export function determineOsteoarthritisStratum({ userid, disease }) {
  const bucket = stableBucket(`${userid}|${disease}`);
  if (bucket <= 2) return "轻度疼痛";
  if (bucket <= 6) return "中度疼痛伴炎症表现";
  return "重度持续疼痛伴炎症表现";
}

export function selectOsteoarthritisMedication(patient) {
  const { userid, disease, allergyHistory, productName, productType } = patient;
  if (!String(disease).includes("骨关节炎")) throw new Error(`${userid}不是骨关节炎患者`);
  if (productType !== "用药" || productName !== "硫酸氨基葡萄糖胶囊") {
    throw new Error(`${userid}不适用硫酸氨基葡萄糖胶囊骨关节炎分层规则`);
  }

  const stratum = determineOsteoarthritisStratum({ userid, disease });
  const combinedMedication = [productName];
  const prescriptions = [sourceProductPrescription];
  const canUseTopicalNsaid = !hasNsaidAllergy(allergyHistory);

  if (stratum !== "轻度疼痛" && canUseTopicalNsaid) {
    const topicalNsaid = selectEquivalentCandidate({
      userid,
      disease,
      therapyRole: "外用抗炎镇痛",
      candidates: topicalNsaidCandidates,
    });
    combinedMedication.push(topicalNsaid.name);
    prescriptions.push(topicalNsaid.prescription);
  }
  if (stratum === "重度持续疼痛伴炎症表现") {
    combinedMedication.push("对乙酰氨基酚片");
    prescriptions.push(acetaminophenPrescription);
  }

  return {
    stratum,
    combinedMedication,
    prescriptionList: prescriptions.join(" + "),
  };
}
