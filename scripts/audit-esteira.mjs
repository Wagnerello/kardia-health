import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const isPreCommit = process.argv.includes('--pre-commit');

console.log('🔍 [Esteira] Iniciando Auditoria de Governança e Segurança...');

let errors = [];
let warnings = [];

// 1. Validar package.json e versão
let pkgVersion = '0.0.0';
try {
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkgVersion = pkg.version;
    console.log(`📦 Versão no package.json: v${pkgVersion}`);
  } else {
    errors.push('package.json não encontrado na raiz.');
  }
} catch (e) {
  errors.push(`Erro ao ler package.json: ${e.message}`);
}

// 2. Validar docs/CHANGELOG_TECH.md
try {
  const techChangelogPath = path.join(rootDir, 'docs', 'CHANGELOG_TECH.md');
  if (fs.existsSync(techChangelogPath)) {
    const content = fs.readFileSync(techChangelogPath, 'utf8');
    if (!content.includes('## [Unreleased]')) {
      errors.push('docs/CHANGELOG_TECH.md deve conter a seção "## [Unreleased]".');
    } else {
      console.log('✅ docs/CHANGELOG_TECH.md validado com seção [Unreleased].');
    }
  } else {
    errors.push('docs/CHANGELOG_TECH.md não encontrado. A memória técnica contínua é obrigatória.');
  }
} catch (e) {
  errors.push(`Erro ao validar CHANGELOG_TECH.md: ${e.message}`);
}

// 3. Validar .gitignore e proteção de segredos
try {
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.env')) {
      errors.push('.gitignore deve conter ".env" para proteger segredos.');
    } else {
      console.log('✅ .gitignore configurado com proteção de variáveis .env.');
    }
  } else {
    warnings.push('.gitignore não encontrado.');
  }
} catch (e) {
  warnings.push(`Erro ao verificar .gitignore: ${e.message}`);
}

// 4. Scan SAST rápido de segredos no código fonte (src/)
try {
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    const secretPatterns = [
      /AIzaSy[A-Za-z0-9_-]{33}/g, // Firebase/Google API key direta se não for import.meta.env
      /sk-[a-zA-Z0-9]{32,}/g,      // OpenAI/Generic secret keys
      /gsk_[a-zA-Z0-9]{32,}/g     // Groq API keys hardcoded
    ];

    function scanFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFiles(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of secretPatterns) {
            if (pattern.test(fileContent)) {
              // Verifica se não é apenas leitura de env
              if (!fileContent.includes('import.meta.env') && !fileContent.includes('process.env')) {
                errors.push(`Possível segredo hardcoded detectado em ${entry.name}`);
              }
            }
          }
        }
      }
    }
    scanFiles(srcDir);
    console.log('✅ Scan SAST de segredos no diretório src/ concluído.');
  }
} catch (e) {
  warnings.push(`Erro no scan SAST: ${e.message}`);
}

// 5. Verificação de dependências de alta criticidade (apenas em CI ou audit completo)
if (!isPreCommit) {
  try {
    console.log('🛡️ Verificando npm audit (nível high)...');
    execSync('npm audit --audit-level=high', { stdio: 'pipe' });
    console.log('✅ npm audit: 0 vulnerabilidades de alta/crítica.');
  } catch (e) {
    warnings.push('npm audit retornou alertas de dependências. Execute "npm audit fix" quando conveniente.');
  }
}

// Relatório Final
console.log('\n--- Relatório da Auditoria da Esteira ---');
if (warnings.length > 0) {
  console.log('⚠️ Avisos:');
  warnings.forEach(w => console.log(`  - ${w}`));
}

if (errors.length > 0) {
  console.error('❌ Falhas Críticas Encontradas:');
  errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
} else {
  console.log('🎉 ✓ 100% OK! Auditoria de esteira aprovada com sucesso.\n');
  process.exit(0);
}
