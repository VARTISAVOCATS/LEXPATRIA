import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const racine = path.resolve(".");
const alias = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(racine, "demo/shims/next-link.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(racine, "demo/shims/next-navigation.ts") }));
    b.onResolve({ filter: /^@\/i18n\/client$/ }, () => ({ path: path.join(racine, "demo/shims/i18n-client.tsx") }));
    b.onResolve({ filter: /^@\// }, async (a) => b.resolve("./" + a.path.slice(2), { resolveDir: path.join(racine, "src"), kind: a.kind }));
  },
};
const r = await esbuild.build({
  entryPoints: ["demo/main.tsx"],
  bundle: true,
  minify: true,
  write: false,
  outdir: "demo/dist",
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  loader: { ".jpg": "dataurl", ".woff2": "dataurl", ".woff": "empty", ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "undefined", "process.env.NEXT_PUBLIC_TELEPHONE_CABINET": '"+33 1 83 81 51 23"' },
  plugins: [alias],
  logLevel: "warning",
});
const js = r.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = r.outputFiles.find((f) => f.path.endsWith(".css")).text;
const page = `<title>Démo Lexpatria</title>
<style>${css}
.bandeau-demo{background:#fcf1dc;color:#7a4a00;font-size:12.5px;text-align:center;padding:6px 16px;display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center;align-items:center}.bd-liens{display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:center}.bd-liens button{font:inherit;font-weight:600;background:#0f1e3d;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer}
</style>
<div id="racine"></div>
<script>${js.replace(/<\/script/g, "<\\/script")}</script>
`;
writeFileSync("demo/dist/lexpatria-demo.html", page);
console.log("taille", (page.length / 1024 / 1024).toFixed(2), "Mo");
