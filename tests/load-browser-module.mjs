import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function stripQueryString(specifier = "") {
  return String(specifier || "").replace(/\?.*$/, "");
}

function transformModuleSource(modulePath, seen = new Set(), isEntry = false) {
  const safePath = path.resolve(modulePath);
  if (seen.has(safePath)) {
    return { code: "", exportNames: [] };
  }
  seen.add(safePath);

  let sourceText = readFileSync(safePath, "utf8");
  const dependencyBlocks = [];

  sourceText = sourceText.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["'](.+?)["'];?\s*/g, (_match, bindings, specifier) => {
    const resolvedPath = path.resolve(path.dirname(safePath), stripQueryString(specifier));
    const dependency = transformModuleSource(resolvedPath, new Set([safePath]), false);
    const importedBindings = String(bindings || "")
      .split(",")
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((item) => {
        const [imported, local = imported] = item
          .split(/\s+as\s+/i)
          .map((part) => String(part || "").trim())
          .filter(Boolean);
        return imported && local ? `${imported}: ${local}` : "";
      })
      .filter(Boolean)
      .join(", ");
    return `const { ${importedBindings} } = (() => {
const module = { exports: {} };
const exports = module.exports;
${dependency.code}
module.exports = {
  ${dependency.exportNames.join(",\n  ")}
};
return module.exports;
})();
`;
  });

  const exportNames = [];
  sourceText = sourceText.replace(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `async function ${name}`;
  });
  sourceText = sourceText.replace(/export function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `function ${name}`;
  });
  sourceText = sourceText.replace(/export const\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `const ${name}`;
  });
  sourceText = sourceText.replace(/export\s*\{([^}]+)\};?\s*/g, (_match, names) => {
    if (isEntry) {
      for (const item of String(names || "").split(",")) {
        const [localName] = item.split(/\s+as\s+/i).map((part) => String(part || "").trim());
        if (localName) exportNames.push(localName);
      }
    }
    return "";
  });

  return {
    code: `${dependencyBlocks.filter(Boolean).join("\n")}\n${sourceText}`,
    exportNames,
  };
}

export async function loadBrowserModule(relativePath, parentUrl = import.meta.url) {
  const baseDir = path.dirname(fileURLToPath(parentUrl));
  const sourcePath = path.resolve(baseDir, relativePath);
  const { code, exportNames } = transformModuleSource(sourcePath, new Set(), true);
  const transformedSource = `${code}
module.exports = {
  ${exportNames.join(",\n  ")}
};`;
  const context = {
    module: { exports: {} },
    exports: {},
    console,
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return context.module.exports;
}
