import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
console.log('📊 [Mermaid] Validando sintaxe e delimitadores de diagramas...');

let errors = [];

function checkMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
      checkMarkdownFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let inMermaid = false;
      let startLine = 0;

      lines.forEach((line, idx) => {
        if (line.trim().startsWith('```mermaid')) {
          inMermaid = true;
          startLine = idx + 1;
        } else if (inMermaid && line.trim().startsWith('```')) {
          inMermaid = false;
        }
      });

      if (inMermaid) {
        errors.push(`Bloco mermaid não fechado em ${path.relative(rootDir, fullPath)} iniciado na linha ${startLine}`);
      }
    }
  }
}

checkMarkdownFiles(rootDir);

if (errors.length > 0) {
  console.error('❌ Falhas em diagramas Mermaid:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('✅ Todos os diagramas Mermaid nos arquivos .md estão com delimitadores válidos.');
  process.exit(0);
}
