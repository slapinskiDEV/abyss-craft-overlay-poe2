// Validation of renderer -> main payloads (spec 001). The renderer is untrusted input.
import { DEBUG_REPORT_MAX_BYTES } from '../shared/ipc-channels';

export function validDebugReport(text: unknown): text is string {
  return typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= DEBUG_REPORT_MAX_BYTES;
}

export function validAcceleratorPayload(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}
