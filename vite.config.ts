import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildTimestamp = Date.now();

function versionGeneratorPlugin() {
  return {
    name: 'version-generator',
    buildStart() {
      let pkgVersion = '2.0.0';
      const localPkgPath = path.resolve(__dirname, 'package.json');

      if (fs.existsSync(localPkgPath)) {
        pkgVersion = JSON.parse(fs.readFileSync(localPkgPath, 'utf-8')).version || pkgVersion;
      }

      const now = new Date(buildTimestamp);
      const versionData = {
        version: pkgVersion,
        buildTime: buildTimestamp,
        buildDate: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      };

      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.resolve(publicDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf-8');
    },
  };
}

export default defineConfig({
  plugins: [versionGeneratorPlugin()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date(buildTimestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })),
    __BUILD_TIME__: buildTimestamp,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
