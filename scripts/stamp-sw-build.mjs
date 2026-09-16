import fs from "node:fs";
import path from "node:path";

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  "dev";

const swPath = path.join(process.cwd(), "public", "sw.js");
let content = fs.readFileSync(swPath, "utf8");
content = content.replace(/\/\/ BUILD_STAMP:.*$/m, "");
content = `${content.trimEnd()}\n// BUILD_STAMP: ${sha}\n`;
fs.writeFileSync(swPath, content);

console.log(`[stamp-sw-build] BUILD_STAMP=${sha}`);
