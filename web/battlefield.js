import { DEFAULT_SETTINGS } from '../src/engine/constants.js';

// Geometry identity shared by the picker and compiler suggestions.
export function fieldKey(settings) {
  return settings.topology === 'torus' ? `torus:${settings.sizeX}x${settings.sizeY}${(settings.sizeZ ?? 1) > 1 ? `x${settings.sizeZ}` : ''}` : 'ring';
}

export function fieldSettings(key) {
  if (!key.startsWith('torus:')) return { topology: 'ring', sizeX: undefined, sizeY: undefined, sizeZ: undefined };
  const [x, y, z = 1] = key.slice(6).split('x').map(Number);
  return { topology: 'torus', sizeX: x, sizeY: y, sizeZ: z, coreSize: x * y * z };
}

export const NO_HILL_RULES = Object.freeze({ rulesName: '', dialect: undefined, pSpace: undefined, assertErrors: undefined });

// A battlefield with standard rules; the ring also restores its default sizes.
export function battlefieldSettings(field) {
  return field === 'ring'
    ? { ...DEFAULT_SETTINGS, ...fieldSettings('ring'), ...NO_HILL_RULES }
    : { ...NO_HILL_RULES, ...fieldSettings(field) };
}
