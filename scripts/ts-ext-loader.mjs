import { isBuiltin } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier) || specifier.startsWith("node:")) {
    return nextResolve(specifier, context);
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return nextResolve(specifier, context);
  }
  const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
  const base = dirname(parent);
  const candidates = [
    specifier,
    `${specifier}.ts`,
    `${specifier}.tsx`,
    `${specifier}/index.ts`,
  ];
  for (const candidate of candidates) {
    const absolute = resolvePath(base, candidate);
    if (existsSync(absolute) && !absolute.endsWith("/")) {
      try {
        return await nextResolve(pathToFileURL(absolute).href, context);
      } catch {
        /* try next */
      }
    }
  }
  return nextResolve(specifier, context);
}
