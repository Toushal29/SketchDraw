import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn("tauri", ["dev", "--config", "src-tauri/tauri.windows-dev.conf.json"], {
  cwd: process.cwd(),
  env: { ...process.env, CARGO_TARGET_DIR: resolve("src-tauri/target-windows-dev") },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", error => {
  console.error("Could not start the Windows Tauri dev command:", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
