// One canonical instruction representation for live core cells and saved code.
// Ring fields are signed scalars; torus fields use the geometry's vector syntax.
function signed(value, size) {
  const normalized = ((value % size) + size) % size;
  return normalized > size / 2 ? normalized - size : normalized;
}

export function formatInstruction(instruction, size, geometry = null) {
  const field = geometry ? geometry.format : value => signed(value, size);
  return `${instruction.op}.${instruction.mod} ${instruction.aMode}${field(instruction.a)}, ${instruction.bMode}${field(instruction.b)}`;
}
