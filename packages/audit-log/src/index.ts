import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AuditEvent } from '../../shared/src/index.js';

export async function appendAuditEvent(
  logPath: string,
  event: AuditEvent,
): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(event)}\n`, 'utf8');
}
