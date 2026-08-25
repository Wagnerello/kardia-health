import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG_TECH.md');

try {
  const commitMsg = execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim();
  const commitHash = execSync('git log -1 --pretty=%h', { encoding: 'utf8' }).trim();

  if (!commitMsg || !commitHash) {
    process.exit(0);
  }

  // Identifica o tipo convencional
  const match = commitMsg.match(/^([a-zA-Z]+)(\([^)]+\))?:\s*(.*)$/);
  const type = match ? match[1].toLowerCase() : 'chore';
  const desc = match ? match[3] : commitMsg;

  const newEntry = `- [${type}] ${desc} (commit: ${commitHash}) — Refs: auto`;

  if (fs.existsSync(changelogPath)) {
    let content = fs.readFileSync(changelogPath, 'utf8');
    if (content.includes('## [Unreleased]')) {
      content = content.replace('## [Unreleased]', `## [Unreleased]\n${newEntry}`);
      fs.writeFileSync(changelogPath, content, 'utf8');
      console.log(`📝 [CHANGELOG_TECH] Entrada adicionada: ${newEntry}`);
    }
  }
} catch (e) {
  // Post commit hook não deve quebrar a experiência do desenvolvedor
  console.warn(`[Changelog Hook] Aviso: ${e.message}`);
}
