import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const ROOT = process.cwd();

function extensionBuildPlugin(target) {
  const outDir = resolve(ROOT, "dist", target);
  const manifestName = target === "firefox" ? "manifest.firefox.json" : "manifest.json";
  const filesToCopy = ["popup.css", "popup.html"];
  const dirsToCopy = ["assets"];

  return {
    name: `vellum-extension-build-${target}`,
    buildStart() {
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
    },
    closeBundle() {
      for (const dir of dirsToCopy) {
        const source = resolve(ROOT, dir);
        const destination = resolve(outDir, dir);
        if (existsSync(source)) {
          cpSync(source, destination, { recursive: true });
        }
      }

      for (const file of filesToCopy) {
        const source = resolve(ROOT, file);
        const destination = resolve(outDir, file);
        if (existsSync(source)) {
          copyFileSync(source, destination);
        }
      }

      copyFileSync(resolve(ROOT, manifestName), resolve(outDir, "manifest.json"));
    }
  };
}

export default defineConfig(({ mode }) => {
  const target = mode === "firefox" ? "firefox" : "chrome";
  return {
    plugins: [extensionBuildPlugin(target)],
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: false,
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        input: {
          background: resolve(ROOT, "background.js"),
          content: resolve(ROOT, "content.js"),
          popup: resolve(ROOT, "popup.js")
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]"
        }
      }
    }
  };
});
