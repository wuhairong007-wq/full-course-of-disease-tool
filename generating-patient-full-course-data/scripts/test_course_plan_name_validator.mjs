import assert from "node:assert/strict";
import { validateCoursePlanName } from "./course_plan_name_validator.mjs";

assert.doesNotThrow(() => validateCoursePlanName({
  userid: "U-AGE",
  disease: "老年高血压",
  coursePlanName: "老年高血压规范管理方案",
  productName: "氨氯地平片",
}));

assert.throws(() => validateCoursePlanName({
  userid: "U-AGE",
  disease: "老年高血压",
  coursePlanName: "年龄相关高血压规范管理方案",
  productName: "氨氯地平片",
}), /必须保留源疾病名称/);

assert.throws(() => validateCoursePlanName({
  userid: "U-GENERIC",
  disease: "慢性肾脏病",
  coursePlanName: "心血管-代谢-肾脏联合管理方案",
  productName: "缬沙坦片",
}), /必须体现源疾病名称/);

assert.throws(() => validateCoursePlanName({
  userid: "U-PRODUCT",
  disease: "原发性高血压",
  coursePlanName: "原发性高血压氨氯地平片管理方案",
  productName: "氨氯地平片",
}), /不得出现产品名称/);

console.log(JSON.stringify({ status: "passed" }));
