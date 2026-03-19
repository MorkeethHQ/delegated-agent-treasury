import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export async function appendAuditEvent(logPath, event) {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, `${JSON.stringify(event)}\n`, 'utf8');
}
