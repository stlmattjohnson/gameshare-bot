import fs from "fs";
import path from "path";
import { build } from "esbuild";

const pkgPath = path.resolve(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const deps = Object.keys(pkg.dependencies || {});

const outdir = path.resolve(process.cwd(), "dist");
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node20"],
  outfile: path.join(outdir, "index.js"),
  sourcemap: true,
  external: deps,
  tsconfig: "tsconfig.json",
  metafile: true,
});

// copy package.json (so top-level fields like "type" and runtime deps remain available)
fs.mkdirSync(outdir, { recursive: true });
fs.copyFileSync(pkgPath, path.join(outdir, "package.json"));

console.log("esbuild: wrote", path.join(outdir, "index.js"));
