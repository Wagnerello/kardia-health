Você agora é responsável por fazer uma auditoria completa de pré-lançamento deste projeto.

Analise o código, configuração, banco de dados e arquitetura disponível no repositório.

Não faça alterações automaticamente.

Primeiro, faça uma auditoria e gere um relatório.

Avalie as seguintes áreas:

1. SEGURANÇA E SEGREDOS

Procure:
- arquivos .env;
- API keys;
- tokens;
- secrets;
- service keys;
- credenciais hardcoded;
- URLs privadas;
- dados sensíveis em logs;
- secrets enviados para o frontend;
- variáveis NEXT_PUBLIC, VITE_ ou equivalentes contendo dados que deveriam permanecer privados.

Identifique qualquer segredo que possa estar sendo exposto no navegador.

2. AUTENTICAÇÃO E AUTORIZAÇÃO

Verifique:
- rotas privadas;
- endpoints protegidos;
- permissões por usuário;
- permissões administrativas;
- acesso a dados de outros usuários;
- APIs acessíveis sem autenticação;
- possibilidade de alteração de IDs ou parâmetros para acessar recursos de terceiros.

Se o projeto usar Supabase:
- analise todas as políticas de RLS;
- identifique tabelas sem RLS;
- identifique políticas excessivamente permissivas;
- procure uso inseguro de service_role.

3. CASOS DE ERRO E EDGE CASES

Procure fluxos que possam quebrar com:
- campos vazios;
- valores muito grandes;
- caracteres inesperados;
- arquivos inválidos;
- uploads grandes;
- duplo clique;
- múltiplas requisições;
- refresh durante uma operação;
- internet lenta;
- timeout;
- API externa indisponível;
- resposta inesperada;
- estado parcialmente salvo.

Identifique fluxos críticos sem tratamento de erro adequado.

4. MOBILE E RESPONSIVIDADE

Revise a interface pensando principalmente nas larguras:
- 375px;
- 390px;
- 768px.

Procure:
- overflow horizontal;
- elementos cortados;
- modais fora da tela;
- botões pequenos ou inacessíveis;
- textos muito pequenos;
- tabelas quebrando;
- menus problemáticos;
- teclado mobile cobrindo inputs ou botões;
- layouts que dependem de hover.

5. PERFORMANCE

Analise:
- imagens grandes ou não otimizadas;
- bundles JavaScript desnecessários;
- imports muito pesados;
- requisições duplicadas;
- chamadas sequenciais que poderiam ser paralelas;
- fontes desnecessárias;
- componentes renderizando excessivamente;
- queries lentas;
- carregamentos sem lazy loading;
- recursos bloqueando renderização.

Quando possível, sugira verificações com:
- Lighthouse;
- Core Web Vitals;
- LCP;
- INP;
- CLS.

6. BANCO DE DADOS

Revise:
- tabelas sem proteção;
- RLS;
- constraints;
- foreign keys;
- índices;
- queries sem LIMIT;
- N+1 queries;
- registros duplicados;
- cascades perigosos;
- exclusões destrutivas;
- armazenamento desnecessário de dados sensíveis;
- migrations;
- estratégia de backup.

Informe também se seria possível restaurar o sistema caso dados fossem perdidos.

7. SEO E INDEXAÇÃO

Para páginas públicas, verifique:
- title;
- meta description;
- canonical;
- robots.txt;
- sitemap.xml;
- Open Graph;
- Twitter cards;
- dados estruturados;
- headings;
- páginas importantes bloqueadas por robots ou noindex;
- URLs inadequadas;
- conteúdo que depende completamente de JavaScript para ser descoberto.

Avalie se mecanismos de busca conseguem descobrir e entender as páginas públicas.

8. MONITORAMENTO E ANALYTICS

Verifique se existem:
- logs úteis;
- tratamento de exceções;
- monitoramento de erros;
- rastreamento de erros frontend;
- rastreamento de erros backend;
- analytics;
- eventos de conversão;
- identificação de falhas em checkout ou cadastro;
- alertas para erros críticos.

Responda:
"Se uma função crítica quebrar amanhã, como o responsável pelo projeto descobriria?"

FORMATO DO RELATÓRIO

Para cada problema encontrado, use:

STATUS:
CRÍTICO / ATENÇÃO / APROVADO

ÁREA:

ARQUIVO OU LOCAL:

PROBLEMA:

RISCO:

COMO CORRIGIR:

PRIORIDADE:
P0 / P1 / P2 / P3

No final, gere:

RESUMO DE PRÉ-LANÇAMENTO

Segurança: APROVADO / ATENÇÃO / CRÍTICO
Permissões: APROVADO / ATENÇÃO / CRÍTICO
Erros: APROVADO / ATENÇÃO / CRÍTICO
Mobile: APROVADO / ATENÇÃO / CRÍTICO
Performance: APROVADO / ATENÇÃO / CRÍTICO
Banco: APROVADO / ATENÇÃO / CRÍTICO
SEO: APROVADO / ATENÇÃO / CRÍTICO
Monitoramento: APROVADO / ATENÇÃO / CRÍTICO

Depois responda:

PODE IR PARA PRODUÇÃO?
SIM
SIM, MAS CORRIJA ESTES ITENS PRIMEIRO
NÃO

Não altere nenhum arquivo até eu aprovar o relatório.