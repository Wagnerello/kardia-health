/**
 * Serviço de Telemetria e Monitoramento de Erros Frontend (KardIA Health)
 * Captura exceções não tratadas, rejeições de Promises e erros críticos da aplicação.
 */

export interface TelemetryError {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  userAgent: string;
  context?: string;
}

const errorBuffer: TelemetryError[] = [];
const MAX_BUFFER_SIZE = 50;

/**
 * Registra um erro no buffer de telemetria e emite no console de monitoramento.
 */
export function reportError(error: unknown, context?: string): TelemetryError {
  const errObj = error instanceof Error ? error : new Error(String(error));
  const telemetryItem: TelemetryError = {
    message: errObj.message || 'Erro desconhecido',
    stack: errObj.stack,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
    context: context || 'global',
  };

  errorBuffer.unshift(telemetryItem);
  if (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.pop();
  }

  console.error(`[Telemetria] Erro capturado [${telemetryItem.context}]:`, telemetryItem.message, telemetryItem);
  return telemetryItem;
}

/**
 * Retorna os últimos erros capturados na sessão para auditoria ou diagnóstico.
 */
export function getRecentErrors(): readonly TelemetryError[] {
  return [...errorBuffer];
}

/**
 * Limpa o buffer de erros em memória.
 */
export function clearErrorBuffer(): void {
  errorBuffer.length = 0;
}

/**
 * Inicializa os listeners globais de erro no navegador.
 */
export function initTelemetry(): void {
  if (typeof window === 'undefined') return;

  // Erros JavaScript síncronos / globais
  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error || event.message, `window.onerror (${event.filename}:${event.lineno})`);
  });

  // Rejeições de Promises não tratadas
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, 'window.onunhandledrejection');
  });

  console.info('[Telemetria] Sistema de observabilidade e monitoramento de erros ativo.');
}
