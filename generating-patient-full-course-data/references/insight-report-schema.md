# 洞察报告中间数据契约

`extract_insight_sources.py` 输出 `insight.json`。输入必须包含患者主表、健康管理方案、跟踪提醒、智能随访、症状自评和用药清单六类必填工作簿，不良反应清单为选填（合计6或7份）；角色按表头识别，日期事件按服务周期闭区间过滤。

`metadata` 保存产品、周期、患者数、地区数、疾病数及合同目标；`metrics` 保存画像、服务执行、随访、症状、用药、不良反应、风险和目标指标。所有比例对象包含 `numerator`、`denominator`、`value`、`display`，空集合保留零计数和实际分母。患者主表 `userid` 必须非空且唯一，其他表使用 `userid` 或 `患者ID` 关联。症状评分按 A-E 映射为 1-5 分。

服务响应率按照各患者的响应率对提醒次数加权估算，报告中必须标明该统计口径；症状自评按有效六维度答卷次数统计，并报告有效答卷数。风险分层为：存在人工干预或重度/严重不良反应患者为高风险，其余发生不良反应患者为中风险，未发生不良反应患者为低风险。

不良反应清单省略时，`sourceDiagnostics.roles.adverseEvents.provided=false`，路径、表头行和行数为 `null`；`records.adverseEvents=[]` 仅维持记录结构。`metrics.adverseEvents.provided=false`，事件人数、例数及 `adverseEventRate` 为 `null`，分布与 `riskDistribution` 为空，`serviceGoals` 不包含不良反应监测比例。已提供清单（含仅表头的空表）时 `provided=true`，按周期内实际记录统计；零条事件仍保留实际患者分母。两种状态不能混同。
