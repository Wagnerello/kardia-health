import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
console.log('📋 [SDD] Avaliando fidelidade entre Especificações e Código...');

const docsDir = path.join(rootDir, 'docs');
const srcDir = path.join(rootDir, 'src');

let checks = [
  { name: 'Monitoramento Cardiovascular (docs/03 -> src/services/afericoes.ts)', doc: '03-monitoramento-cardiovascular.md', src: 'services/afericoes.ts' },
  { name: 'Visão Computacional OCR (docs/04 -> src/services/ocr.ts)', doc: '04-visao-computacional-ocr.md', src: 'services/ocr.ts' },
  { name: 'Controle Glicêmico (docs/05 -> src/services/glicemia.ts)', doc: '05-controle-glicemico-e-diabetes.md', src: 'services/glicemia.ts' },
  { name: 'Gestão de Hidratação (docs/06 -> src/services/agua.ts)', doc: '06-gestao-de-hidratacao.md', src: 'services/agua.ts' },
  { name: 'Gestão Farmacológica (docs/07 -> src/services/medications.ts)', doc: '07-gestao-farmacologica.md', src: 'services/medications.ts' },
];

let missing = [];

for (const check of checks) {
  const docPath = path.join(docsDir, check.doc);
  const codePath = path.join(srcDir, check.src);

  const docExists = fs.existsSync(docPath);
  const codeExists = fs.existsSync(codePath);

  if (!docExists || !codeExists) {
    missing.push(`Inconsistência em: ${check.name} (Doc: ${docExists ? 'OK' : 'FALTOU'}, Código: ${codeExists ? 'OK' : 'FALTOU'})`);
  } else {
    console.log(`  ✓ ${check.name}`);
  }
}

if (missing.length > 0) {
  console.error('❌ Falhas de fidelidade SDD:');
  missing.forEach(m => console.error(`  - ${m}`));
  process.exit(1);
} else {
  console.log('✅ Fidelidade SDD 100% comprovada entre especificações e código.');
  process.exit(0);
}
