import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(source, destination) {
  if (!(await exists(source))) {
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function main() {
  const rootDir = process.cwd();
  const standaloneDir = path.join(rootDir, ".next", "standalone");

  await copyIfPresent(path.join(rootDir, "public"), path.join(standaloneDir, "public"));
  await copyIfPresent(path.join(rootDir, ".next", "static"), path.join(standaloneDir, ".next", "static"));

  console.log("Standalone bundle prepared at .next/standalone");
}

main().catch((error) => {
  console.error("Failed to prepare standalone bundle:", error);
  process.exit(1);
});
