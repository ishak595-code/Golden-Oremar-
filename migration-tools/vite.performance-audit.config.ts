import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import baseConfig from '../vite.config';

const auditPlugin: Plugin = {
  name: 'golden-oremar-startup-bundle-audit',
  generateBundle(_options, bundle) {
    const chunks = Object.values(bundle)
      .filter((item): item is Extract<typeof item, { type: 'chunk' }> => item.type === 'chunk')
      .map(chunk => ({
        fileName: chunk.fileName,
        isEntry: chunk.isEntry,
        dynamicImports: chunk.dynamicImports,
        imports: chunk.imports,
        codeBytes: Buffer.byteLength(chunk.code),
        modules: Object.entries(chunk.modules)
          .map(([id, info]) => ({ id, renderedLength: info.renderedLength ?? 0 }))
          .sort((a, b) => b.renderedLength - a.renderedLength),
      }))
      .sort((a, b) => b.codeBytes - a.codeBytes);

    const report = {
      generatedAt: new Date().toISOString(),
      chunks,
      topModules: chunks
        .flatMap(chunk => chunk.modules.map(module => ({ ...module, chunk: chunk.fileName, isEntryChunk: chunk.isEntry })))
        .sort((a, b) => b.renderedLength - a.renderedLength)
        .slice(0, 100),
    };
    fs.writeFileSync('bundle-audit.json', JSON.stringify(report, null, 2));

    console.log('BUNDLE_AUDIT_CHUNKS');
    for (const chunk of chunks) {
      console.log(JSON.stringify({ fileName: chunk.fileName, isEntry: chunk.isEntry, codeBytes: chunk.codeBytes, imports: chunk.imports.length, dynamicImports: chunk.dynamicImports.length }));
    }
    console.log('BUNDLE_AUDIT_TOP_MODULES');
    for (const module of report.topModules.slice(0, 40)) console.log(JSON.stringify(module));
  },
};

export default defineConfig(async env => {
  const resolved = typeof baseConfig === 'function' ? await baseConfig(env) : baseConfig;
  return {
    ...resolved,
    plugins: [...(resolved.plugins || []), auditPlugin],
  };
});
