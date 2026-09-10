import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const CANDIDATE_NODE_MODULES_DIRS = [
  () => process.env.CODEX_NODE_MODULES,
  () => path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"),
];

function hasArtifactTool(nodeModulesDir) {
  return fs.existsSync(path.join(nodeModulesDir, "@oai", "artifact-tool", "package.json"));
}

function resolveNodeModulesDir() {
  for (const candidate of CANDIDATE_NODE_MODULES_DIRS) {
    const dir = candidate();
    if (dir && hasArtifactTool(dir)) return dir;
  }
  return null;
}

let cached;

export async function loadArtifactTool() {
  if (cached) return cached;

  const nodeModulesPath = resolveNodeModulesDir();
  if (!nodeModulesPath) {
    throw new Error(
      "未找到依赖包 @oai/artifact-tool。\n" +
        "- 在 Codex 中运行：请先调用 load_workspace_dependencies 获取 Node.js packages 路径。\n" +
        "- 在 Claude Code 或其他环境中运行：请安装 Codex CLI 后重试（脚本会自动从本机 Codex 运行时缓存中定位该依赖），" +
        "或手动设置环境变量 CODEX_NODE_MODULES 指向包含 @oai/artifact-tool 的 node_modules 目录。"
    );
  }

  const runtimeRequire = createRequire(path.join(nodeModulesPath, "package.json"));
  const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
  const mod = await import(pathToFileURL(artifactToolPath).href);

  cached = { ...mod, nodeModulesPath };
  return cached;
}
