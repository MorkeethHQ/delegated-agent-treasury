import type { AuditEvent } from '../../shared/src/index.js';
export declare function appendAuditEvent(logPath: string, event: AuditEvent): Promise<void>;
