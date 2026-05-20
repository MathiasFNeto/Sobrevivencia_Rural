function loadImage(src){
  const img = new Image();
  img.src = src;
  return img;
}

function loadSpriteMap(basePath, files){
  const sprites = {};

  files.forEach(name=>{
    sprites[name] = loadImage(`${basePath}/${name}`);
  });

  return sprites;
}

const playerSpriteFiles = [
  'adventurer_idle.png',
  'adventurer_back.png',
  'adventurer_walk1.png',
  'adventurer_walk2.png',
  'adventurer_action1.png',
  'adventurer_action2.png',
  'adventurer_hurt.png',
  'adventurer_kick.png'
];

const zombieSpriteFiles = [
  'zombie_idle.png',
  'zombie_walk1.png',
  'zombie_walk2.png',
  'zombie_hurt.png',
  'zombie_action1.png',
  'zombie_action2.png'
];

export const playerSprites = loadSpriteMap('assets/sprites/player', playerSpriteFiles);
export const zombieSprites = loadSpriteMap('assets/sprites/zombie', zombieSpriteFiles);
export const houseImg = loadImage('assets/sprites/house/house.png');
export const chickenFrames = [
  loadImage('assets/sprites/galinha/sprite_04.png'),
  loadImage('assets/sprites/galinha/sprite_05.png'),
  loadImage('assets/sprites/galinha/sprite_06.png'),
  loadImage('assets/sprites/galinha/sprite_07.png')
];
