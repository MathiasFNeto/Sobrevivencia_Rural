export const SAVE_VERSION = 1;

function serializeCell(cell){
  return [
    cell.t,
    cell.hp ?? -1,
    cell.pd ?? -1,
    cell.main ? 1 : 0,
    cell.part ? 1 : 0,
    cell.rockPart || '',
    cell.housePart || ''
  ].join(',');
}

function deserializeCell(value, defaultTile){
  const parts = String(value || '').split(',');
  const cell = {t:Number(parts[0])};
  const hpValue = Number(parts[1]);
  const plantedDay = Number(parts[2]);
  const main = Number(parts[3]);
  const part = Number(parts[4]);
  const rockPart = parts[5] || '';
  const housePart = parts[6] || '';

  if(!Number.isFinite(cell.t))cell.t=defaultTile;
  if(hpValue>=0)cell.hp=hpValue;
  if(plantedDay>=0)cell.pd=plantedDay;
  if(main===1)cell.main=true;
  if(part===1)cell.part=true;
  if(rockPart)cell.rockPart=rockPart;
  if(housePart)cell.housePart=housePart;

  return cell;
}

export function serializeWorld(world){
  return world.map(row=>row.map(serializeCell).join('|')).join(';');
}

export function applySerializedWorld(world, savedWorld, width, height, defaultTile){
  if(!savedWorld)return;

  savedWorld.split(';').forEach((row,r)=>{
    if(r<0 || r>=height || !world[r])return;

    row.split('|').forEach((cell,c)=>{
      if(c<0 || c>=width)return;
      world[r][c]=deserializeCell(cell, defaultTile);
    });
  });
}

export function serializePoints(points){
  return points.map(point=>point.join(',')).join('|');
}

export function deserializePoints(value){
  if(!value)return [];

  return value
    .split('|')
    .map(item=>item.split(',').map(Number))
    .filter(([r,c])=>Number.isFinite(r) && Number.isFinite(c));
}

export function parseSavedJson(value, fallback){
  if(!value)return fallback;

  try {
    return JSON.parse(value);
  } catch(e) {
    console.error('Save JSON invalido:', e);
    return fallback;
  }
}
