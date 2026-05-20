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
export const terrainTiles = {
  grass: loadImage('assets/sprites/terrain/grass.png'),
  dirt: loadImage('assets/sprites/terrain/dirt.png'),
  water: loadImage('assets/sprites/terrain/water.png')
};
export const objectSprites = {
  umbrella: loadImage('assets/sprites/objects/umbrella.png'),
  boat: loadImage('assets/sprites/objects/boat.png'),
  duckRight: loadImage('assets/sprites/objects/duck_right.png'),
  duckLeft: loadImage('assets/sprites/objects/duck_left.png'),
  rock: loadImage('assets/sprites/objects/rock.png')
};
export const houseImg = loadImage('assets/sprites/house/house.png');
export const dogSprites = {
  walk_right: [
    loadImage('assets/sprites/dog/walk_right_1.png'),
    loadImage('assets/sprites/dog/walk_right_2.png'),
    loadImage('assets/sprites/dog/walk_right_3.png')
  ],
  walk_left: [
    loadImage('assets/sprites/dog/walk_left_1.png'),
    loadImage('assets/sprites/dog/walk_left_2.png'),
    loadImage('assets/sprites/dog/walk_left_3.png')
  ],
  walk_up: [
    loadImage('assets/sprites/dog/walk_up_1.png'),
    loadImage('assets/sprites/dog/walk_up_2.png'),
    loadImage('assets/sprites/dog/walk_up_3.png')
  ],
  walk_down: [
    loadImage('assets/sprites/dog/walk_down_1.png'),
    loadImage('assets/sprites/dog/walk_down_2.png'),
    loadImage('assets/sprites/dog/walk_down_3.png')
  ],
  idle_right: loadImage('assets/sprites/dog/idle_right.png'),
  idle_left:  loadImage('assets/sprites/dog/idle_left.png'),
  eat: [
    loadImage('assets/sprites/dog/eat_1.png'),
    loadImage('assets/sprites/dog/eat_2.png'),
    loadImage('assets/sprites/dog/eat_3.png'),
    loadImage('assets/sprites/dog/eat_4.png')
  ]
};
export const chickenFrames = [
  loadImage('assets/sprites/galinha/sprite_04.png'),
  loadImage('assets/sprites/galinha/sprite_05.png'),
  loadImage('assets/sprites/galinha/sprite_06.png'),
  loadImage('assets/sprites/galinha/sprite_07.png')
];
