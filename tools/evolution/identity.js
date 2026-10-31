// Stable instruction genome identity, shared with fresh-seed validation.
import { createHash } from 'node:crypto';

export const genomeId = (g) => createHash('sha256').update(JSON.stringify(g)).digest('hex').slice(0, 16);
