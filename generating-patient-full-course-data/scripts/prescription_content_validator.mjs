const extraDescriptionPattern = /禁用|慎用|不宜久服|不宜长期|不良反应|过敏|禁忌|相互作用|监测|观察|就医|复诊|咨询|复核|肌酐清除率|肝肾功能|药理|机制|适应证|适用于|用于(?:治疗|缓解|改善|控制|预防)|本品含|避免与|不(?:得|宜|可|能|应)与|不叠加|不与|(?:出现|若|如|一旦|发生)[^；;。]*(?:停药|停用)/;

export function validatePrescriptionContent({ userid, medication, prescriptionEntry }) {
  // Administration instructions such as "不得咀嚼" remain part of the prescription.
  const text = String(prescriptionEntry ?? "").trim();
  const description = text.startsWith(medication) ? text.slice(medication.length) : text;
  if (extraDescriptionPattern.test(description)) {
    throw new Error(`${userid}的${medication}处方清单只允许药品名称、规格、用法用量、服用方式、频次及疗程，不得包含警示、禁忌、监测或其他说明`);
  }
}
