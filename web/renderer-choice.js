// Renderer choice and its control labels, independent of scene construction.
export function selectRenderer(state, views, avatars3dState) {
  const {avatars,avatars3d,renderer2d,renderer3d} = views;
  const geo = state.vm?.geo ?? null;
  const want3d = !state.avatars && !!geo && (state.view3d ?? geo.Z > 1);
  const flat = !!state.avatarsFlat || avatars3dState === 'failed';
  const avatarView = !flat && avatars3d ? avatars3d : avatars;
  const next = state.avatars ? avatarView : want3d ? renderer3d : renderer2d;
  return {geo,want3d,flat,next};
}
export function updateRendererControls($, state, choice, renderer3d, avatars3dState) {
  const {want3d,flat,geo}=choice;
  $('viewToggle').hidden = state.avatars ? avatars3dState === 'failed' : !geo;
  $('avatarToggle').setAttribute('aria-pressed', String(!!state.avatars));
  if (state.avatars) {
    $('viewToggle').textContent = flat ? '3D' : 'Flat';
    $('viewToggle').title = flat ? 'Show the avatars in 3D (WebGL)' : 'Show the avatars on a flat canvas';
  } else {
    $('viewToggle').textContent = want3d ? '2D' : '3D';
    $('viewToggle').title = want3d ? 'Show the flat grid' : 'Show the battlefield in 3D (drag to turn it)';
  }
  for (const id of ['spinToggle', 'zoomOut', 'zoomIn', 'fitView', 'actionView', 'sliceToggle']) $(id).hidden = !want3d;

  $('sliceBar').hidden = !want3d || renderer3d.slice.axis < 0;
  $('actionView').setAttribute('aria-pressed', String(renderer3d.follow));
  $('spinToggle').setAttribute('aria-pressed', String(renderer3d.spin));
}
