import * as esbuild from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

// 1. Tailwind, scanning the same sources the Next build does.
execSync(
  "npx tailwindcss -i app/globals.css -o dist/app.css --minify",
  { stdio: "inherit" },
);

// 2. Bundle the app. React goes in the bundle rather than a CDN because a
//    published artifact has to render on its own with no network.
await esbuild.build({
  entryPoints: ["standalone/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  outfile: "dist/app.js",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.TRIP_AGENT_MODEL": '""',
    "__TRIP_AGENT_STANDALONE__": "true",
  },
  alias: { "@": "." },
  loader: { ".svg": "text" },
  logLevel: "warning",
});

const css = readFileSync("dist/app.css", "utf8");
const js = readFileSync("dist/app.js", "utf8");

// The charset meta matters for the local file:// copy — the artifact host adds
// its own, but without one here the place names and any non-ASCII in the
// bundle get decoded as latin-1.
writeFileSync("dist/trip-agent.html", `<meta charset="utf-8">
<title>Trip Agent</title>
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + "KB";
console.log(`\ncss ${kb(css)}  js ${kb(js)}  page ${kb(readFileSync("dist/trip-agent.html", "utf8"))}`);
