import { chickenFrames, houseImg, playerSprites, zombieSprites } from "./assets.js";
import { setupControls } from "./controls.js";
import { listenAuthState, loadGameDocument, loginAnonymously, loginWithGoogle, logoutFirebase, saveGameDocument } from "./firebase-service.js";
import { SAVE_VERSION, applySerializedWorld, deserializePoints, parseSavedJson, serializePoints, serializeWorld } from "./save-system.js";

let currentUser = null;

window.loginGoogle = async () => { try { await loginWithGoogle(); } catch(e) { alert(e.message); } };
window.loginAnon   = async () => { try { await loginAnonymously(); } catch(e) { alert(e.message); } };

function buildSaveData(){
  return {
    saveVersion: SAVE_VERSION,
    px: Math.round(player.x), py: Math.round(player.y),
    day, phase, hp, stamina, food, water, wood, stone, money, eggs, milk,
    chickenCount: chickens.length,
    cowCount: cows.length,
    wd: serializeWorld(world),
    ft: serializePoints(fixedTrees),
    fr: serializePoints(fixedRocks),
    fw: serializePoints(fixedWater),
    gt: JSON.stringify(growTimers),
    ap: JSON.stringify(APPEARANCE)
  };
}

function applySaveData(d){
  player.x=d.px||player.x;
  player.y=d.py||player.y;
  day=d.day||1;
  phase=d.phase||'day';
  hp=d.hp??MAX_HP;
  stamina=d.stamina??MAX_ST;
  food=d.food??5;
  water=d.water??8;
  wood=d.wood??3;
  stone=d.stone??2;
  money=d.money??0;
  eggs=d.eggs??0;
  milk=d.milk??0;

  applySerializedWorld(world, d.wd, WW, WH, G);
  if(d.ft)fixedTrees=deserializePoints(d.ft);
  if(d.fr)fixedRocks=deserializePoints(d.fr);
  if(d.fw)fixedWater=deserializePoints(d.fw);
  growTimers=parseSavedJson(d.gt, growTimers);
  Object.assign(APPEARANCE,parseSavedJson(d.ap, {}));
  createCampLayout();

  const savedChickens = d.chickenCount ?? 2;
  const savedCows = d.cowCount ?? 2;

  while(chickens.length < savedChickens) addChicken();
  while(cows.length < savedCows) addCow();
}

window.saveGame = async () => {
  if (!currentUser) return;
  try {
    await saveGameDocument(currentUser.uid, buildSaveData());
  } catch(e) { console.error(e); }
};

window.loadSave = async (uid) => {
  try {
    const d = await loadGameDocument(uid);
    if (d) {
      applySaveData(d);
      showMsg('Jogo carregado! Dia '+day);
      return true;
    }
  } catch(e) { console.error(e); }
  return false;
};

listenAuthState(async user => {
  currentUser = user;

  if (user) {
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('hud').style.display='flex';
    document.getElementById('action-panel').style.display='flex';
    document.getElementById('joystick-zone').style.display='block';
    document.getElementById('attack-btn').style.display='flex';

    startGame();

    const loaded = await window.loadSave(user.uid);
    if (!loaded) generateWorld();

    updateHUD();
    syncPhaseUI();
    positionFloatingControls();

  } else {
    gameRunning = false;

    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('hud').style.display='none';
    document.getElementById('action-panel').style.display='none';
    document.getElementById('joystick-zone').style.display='none';
    document.getElementById('attack-btn').style.display='none';
  }
});

// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const TILE=48, WW=60, WH=60;
const MAX_HP=20, MAX_ST=20;
const DAY_DUR=120, NIGHT_DUR=120;
const T_RANGE=3*TILE, T_HP=10, H_HP=200;
const LIGHT_RADIUS = 320;
const MAX_INV = 30;
const PLAYER_RANGE = 5 * TILE;

const G=0,DIRT=1,TREE=2,ROCK=3,WATER=4,MINE=5,CS=6,CM=7,CR=8,WELL=9,TWR=10,STUMP=11,HOUSE=12,HDOOR=13,PATH=14,FENCE=15,FIRE=16,BARN=17,SILO=18,BIGROCK=19,SAND=20,FENCE_H=21,FENCE_L=22,FENCE_R=23,GATE=24,UMBRELLA=25,BOAT=26,SIGN=27;
const SOLID=new Set([TREE,ROCK,WATER,MINE,WELL,TWR,HOUSE,BIGROCK,FENCE,FENCE_H,FENCE_L,FENCE_R]);
const TCLR={0:'#3a7a2a',1:'#7a5a2a',2:'#1a5a1a',3:'#5a5a6a',4:'#1a4a8a',5:'#4a3a5a',6:'#4a7a2a',7:'#3a8a1a',8:'#2aaa1a',9:'#2a5a9a',10:'#6a5a1a',11:'#6a4a1a',12:'#5a4a3a',13:'#3a2a1a',14:'#d8b36a',
15:'#8b5a2b',16:'#d96a2a',17:'#a85a2a',18:'#b0b0b0',19:'#3a7a2a',20:'#d9c27a',21:'#3a7a2a',22:'#3a7a2a',23:'#3a7a2a',24:'#3a7a2a',27:'#d2a679'};

// Draw tile objects as canvas shapes instead of emoji (cross-platform)
function drawTileObject(type, sx, sy, cell) {
  const cx = sx+TILE/2, cy = sy+TILE/2, h = TILE*0.7;
  ctx.save();
  if (type===TREE) {

    // grama por baixo
    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);


    // sombra
    ctx.fillStyle='rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, sy+TILE-7, 14, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // tronco
    ctx.fillStyle='#6b3a1f';
    ctx.beginPath();
    ctx.moveTo(cx-5, sy+TILE-6);
    ctx.lineTo(cx+5, sy+TILE-6);
    ctx.lineTo(cx+3, sy+24);
    ctx.lineTo(cx-3, sy+24);
    ctx.closePath();
    ctx.fill();

    // galhos
    ctx.strokeStyle='#6b3a1f';
    ctx.lineWidth=3;
    ctx.lineCap='round';

    ctx.beginPath();
    ctx.moveTo(cx, sy+31);
    ctx.lineTo(cx-12, sy+22);

    ctx.moveTo(cx, sy+29);
    ctx.lineTo(cx+12, sy+19);

    ctx.moveTo(cx, sy+24);
    ctx.lineTo(cx-8, sy+14);

    ctx.stroke();

    // copa principal
    ctx.fillStyle='#5daf3b';

    ctx.beginPath();
    ctx.arc(cx, sy+17, 17, 0, Math.PI*2);
    ctx.arc(cx-13, sy+22, 13, 0, Math.PI*2);
    ctx.arc(cx+13, sy+22, 13, 0, Math.PI*2);
    ctx.arc(cx-7, sy+9, 13, 0, Math.PI*2);
    ctx.arc(cx+8, sy+8, 14, 0, Math.PI*2);
    ctx.fill();

    // bolinhas/detalhes da copa
    ctx.fillStyle='rgba(60,130,45,0.55)';

    const dots=[
      [-12,10],[2,8],[13,14],
      [-16,24],[0,23],[15,27],
      [-5,32],[8,31]
    ];

    dots.forEach(([dx,dy])=>{
      ctx.beginPath();
      ctx.arc(cx+dx, sy+dy, 2, 0, Math.PI*2);
      ctx.fill();
    });
  } else if (type===ROCK||type===MINE) {
    ctx.fillStyle=type===MINE?'#6a5a7a':'#7a7a8a';
    ctx.beginPath();ctx.ellipse(cx,cy+2,15,11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=type===MINE?'#8a7a9a':'#9a9aaa';
    ctx.beginPath();ctx.ellipse(cx-3,cy-1,10,8,-.3,0,Math.PI*2);ctx.fill();
    // sparkle for mine
    if(type===MINE){ctx.fillStyle='#d4aaff';ctx.font='10px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('◆',cx+4,cy+3);}
  } else if (type===WATER) {
    ctx.fillStyle='#1a6aaa';ctx.fillRect(sx,sy,TILE,TILE);
    for(let w=0;w<3;w++){ctx.beginPath();ctx.ellipse(sx+8+w*14,cy,6,3,0,0,Math.PI*2);ctx.fill();}
  } else if (type===STUMP) {
    ctx.fillStyle='#6B3A1F';ctx.beginPath();ctx.ellipse(cx,cy,10,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8B5A2F';ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fill();
  } else if(type===CS){

    // terra
    ctx.fillStyle='#6b4a24';
    ctx.fillRect(sx,sy,TILE,TILE);

    // broto
    ctx.strokeStyle='#7ed957';
    ctx.lineWidth=3;

    ctx.beginPath();
    ctx.moveTo(cx,sy+34);
    ctx.lineTo(cx,sy+22);

    ctx.moveTo(cx,sy+28);
    ctx.lineTo(cx-6,sy+22);

    ctx.moveTo(cx,sy+28);
    ctx.lineTo(cx+6,sy+22);

    ctx.stroke();

  } else if(type===CM){

    // terra
    ctx.fillStyle='#6b4a24';
    ctx.fillRect(sx,sy,TILE,TILE);

    // caule
    ctx.strokeStyle='#4f9f2f';
    ctx.lineWidth=5;

    ctx.beginPath();
    ctx.moveTo(cx,sy+40);
    ctx.lineTo(cx,sy+12);
    ctx.stroke();

    // folhas
    ctx.strokeStyle='#6fdc45';
    ctx.lineWidth=4;

    for(let i=0;i<3;i++){

      const yy=sy+34-(i*8);

      ctx.beginPath();
      ctx.moveTo(cx,yy);
      ctx.lineTo(cx-10,yy-4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx,yy-2);
      ctx.lineTo(cx+10,yy-7);
      ctx.stroke();
    }

  } else if(type===CR){

    // terra
    ctx.fillStyle='#6b4a24';
    ctx.fillRect(sx,sy,TILE,TILE);

    // caule principal
    ctx.strokeStyle='#4a9a2a';
    ctx.lineWidth=6;

    ctx.beginPath();
    ctx.moveTo(cx,sy+42);
    ctx.lineTo(cx,sy+8);
    ctx.stroke();

    // folhas grandes
    ctx.strokeStyle='#76d94f';
    ctx.lineWidth=5;

    for(let i=0;i<4;i++){

      const yy=sy+38-(i*8);

      ctx.beginPath();
      ctx.moveTo(cx,yy);
      ctx.lineTo(cx-14,yy-6);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx,yy-2);
      ctx.lineTo(cx+14,yy-8);
      ctx.stroke();
    }

    // espigas
    ctx.fillStyle='#f5c842';

    ctx.beginPath();
    ctx.ellipse(cx+8,sy+22,4,8,0,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx-7,sy+30,4,8,0,0,Math.PI*2);
    ctx.fill();

    // cabelinho da espiga
    ctx.strokeStyle='#d89d1f';
    ctx.lineWidth=1;

    ctx.beginPath();
    ctx.moveTo(cx+8,sy+14);
    ctx.lineTo(cx+5,sy+10);

    ctx.moveTo(cx+10,sy+14);
    ctx.lineTo(cx+12,sy+10);

    ctx.stroke();
  } else if (type===WELL) {
    ctx.fillStyle='#5a7aaa';ctx.fillRect(cx-10,cy,20,10);
    ctx.fillStyle='#3a5a8a';ctx.fillRect(cx-12,cy-2,24,4);
    ctx.fillStyle='#2a3a5a';ctx.fillRect(cx-8,cy-12,4,12);ctx.fillRect(cx+4,cy-12,4,12);
    ctx.fillStyle='#7aaad4';ctx.beginPath();ctx.arc(cx,cy+5,6,0,Math.PI*2);ctx.fill();
  }else if(type===TWR){

    // sombra
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, sy+TILE-3, 20, 7, 0, 0, Math.PI*2);
    ctx.fill();

    // corpo cônico de madeira
    const grad = ctx.createLinearGradient(sx+6, sy, sx+TILE-6, sy);
    grad.addColorStop(0,'#6b3a17');
    grad.addColorStop(0.45,'#b47532');
    grad.addColorStop(1,'#4a260f');

    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(cx-18, sy+TILE-5);
    ctx.lineTo(cx-11, sy+10);
    ctx.quadraticCurveTo(cx, sy+6, cx+11, sy+10);
    ctx.lineTo(cx+18, sy+TILE-5);
    ctx.closePath();
    ctx.fill();

    // tábuas verticais
    ctx.strokeStyle='rgba(55,25,8,0.45)';
    ctx.lineWidth=1;
    for(let i=-10;i<=10;i+=5){
      ctx.beginPath();
      ctx.moveTo(cx+i, sy+12);
      ctx.lineTo(cx+i*1.4, sy+TILE-7);
      ctx.stroke();
    }

    // aro inferior
    ctx.fillStyle='#3b1e0c';
    ctx.fillRect(cx-18, sy+TILE-9, 36, 4);

    // topo circular
    ctx.fillStyle='#8b4f20';
    ctx.beginPath();
    ctx.ellipse(cx, sy+9, 23, 9, 0, 0, Math.PI*2);
    ctx.fill();

    // plataforma superior
    ctx.fillStyle='#a8672c';
    ctx.fillRect(cx-21, sy+4, 42, 10);

    // ameias
    ctx.fillStyle='#5a2d12';
    for(let i=-18;i<=18;i+=9){
      ctx.beginPath();
      ctx.rect(cx+i-3, sy-3, 6, 13, 2);
      ctx.fill();
    }

    // aro preto/ferro
    ctx.fillStyle='#2a1608';
    ctx.fillRect(cx-22, sy+13, 44, 4);

    // rebites
    ctx.fillStyle='#c08a48';
    for(let i=-16;i<=16;i+=8){
      ctx.beginPath();
      ctx.arc(cx+i, sy+15, 1.5, 0, Math.PI*2);
      ctx.fill();
    }

    // janela arqueada
    ctx.fillStyle='#1c0d05';
    ctx.beginPath();
    ctx.moveTo(cx-5, sy+27);
    ctx.lineTo(cx-5, sy+21);
    ctx.arc(cx, sy+21, 5, Math.PI, 0);
    ctx.lineTo(cx+5, sy+27);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle='#d19a55';
    ctx.lineWidth=2;
    ctx.stroke();

    // porta arqueada
    ctx.fillStyle='#3a1c0b';
    ctx.beginPath();
    ctx.moveTo(cx-7, sy+TILE-7);
    ctx.lineTo(cx-7, sy+36);
    ctx.arc(cx, sy+36, 7, Math.PI, 0);
    ctx.lineTo(cx+7, sy+TILE-7);
    ctx.closePath();
    ctx.fill();

    // detalhes da porta
    ctx.strokeStyle='#9b622e';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(cx, sy+31);
    ctx.lineTo(cx, sy+TILE-8);
    ctx.moveTo(cx-6, sy+40);
    ctx.lineTo(cx+6, sy+40);
    ctx.stroke();

    // brilho lateral
    ctx.fillStyle='rgba(255,220,150,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx-8, sy+27, 3, 18, 0.1, 0, Math.PI*2);
    ctx.fill();
  } else if(type===HOUSE){

    // desenha a casa só uma vez, usando a porta como ponto central
    if(cell?.housePart !== 'door') return;

    if(houseImg.complete){
      ctx.drawImage(
        houseImg,
        sx - TILE,
        sy - TILE * 1.6,
        TILE * 3,
        TILE * 3
      );
    }

  } else if(type===BIGROCK){

    const p = cell?.rockPart;

    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);

    // sombra por parte
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx+24,sy+38,22,7,0,0,Math.PI*2);
    ctx.fill();

    if(p==='tl'){
      ctx.fillStyle='#b9c0c7';
      ctx.beginPath();
      ctx.moveTo(sx+8,sy+46);
      ctx.lineTo(sx+18,sy+18);
      ctx.lineTo(sx+40,sy+8);
      ctx.lineTo(sx+48,sy+32);
      ctx.lineTo(sx+36,sy+48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx+30,sy+20,5,12,-0.4,0,Math.PI*2);
      ctx.fill();
    }

    if(p==='tr'){
      ctx.fillStyle='#8f989f';
      ctx.beginPath();
      ctx.moveTo(sx,sy+30);
      ctx.lineTo(sx+24,sy+8);
      ctx.lineTo(sx+44,sy+20);
      ctx.lineTo(sx+40,sy+46);
      ctx.lineTo(sx+4,sy+48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle='rgba(70,80,90,0.35)';
      ctx.beginPath();
      ctx.moveTo(sx+12,sy+24);
      ctx.lineTo(sx+34,sy+26);
      ctx.lineTo(sx+28,sy+42);
      ctx.closePath();
      ctx.fill();
    }

    if(p==='bl'){
      ctx.fillStyle='#aeb6bd';
      ctx.beginPath();
      ctx.moveTo(sx+10,sy+2);
      ctx.lineTo(sx+46,sy+4);
      ctx.lineTo(sx+42,sy+40);
      ctx.lineTo(sx+14,sy+46);
      ctx.lineTo(sx+4,sy+20);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle='#59636c';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(sx+22,sy+18);
      ctx.lineTo(sx+30,sy+12);
      ctx.lineTo(sx+36,sy+20);
      ctx.stroke();
    }

    if(p==='br'){
      ctx.fillStyle='#c8cdd2';
      ctx.beginPath();
      ctx.moveTo(sx+2,sy+8);
      ctx.lineTo(sx+32,sy+2);
      ctx.lineTo(sx+46,sy+26);
      ctx.lineTo(sx+38,sy+46);
      ctx.lineTo(sx+8,sy+42);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle='#59636c';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(sx+16,sy+24);
      ctx.lineTo(sx+24,sy+18);
      ctx.lineTo(sx+32,sy+26);
      ctx.stroke();
    }
  }
    else if(type===FENCE_H){

    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);

    ctx.fillStyle='#6f4322';
    ctx.fillRect(sx+6,sy+14,6,28);
    ctx.fillRect(sx+TILE-12,sy+14,6,28);

    ctx.fillStyle='#9b6a3a';
    ctx.fillRect(sx,sy+18,TILE,5);
    ctx.fillRect(sx,sy+30,TILE,5);
  }

  else if(type===FENCE_L){

    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);

    // poste vertical
    ctx.fillStyle='#7a431d';
    ctx.fillRect(sx+TILE-12,sy,8,TILE);

    // sombra
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(sx+TILE-7,sy,3,TILE);

    // brilho
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(sx+TILE-11,sy+2,1,TILE-4);

    // divisões da madeira
    ctx.strokeStyle='#5a2d12';
    ctx.lineWidth=1;

    ctx.beginPath();
    ctx.moveTo(sx+TILE-12,sy+14);
    ctx.lineTo(sx+TILE-4,sy+14);

    ctx.moveTo(sx+TILE-12,sy+30);
    ctx.lineTo(sx+TILE-4,sy+30);

    ctx.stroke();
  }

  else if(type===FENCE_R){

    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);

    // poste vertical
    ctx.fillStyle='#7a431d';
    ctx.fillRect(sx+4,sy,8,TILE);

    // sombra
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(sx+9,sy,3,TILE);

    // brilho
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(sx+5,sy+2,1,TILE-4);

    // divisões da madeira
    ctx.strokeStyle='#5a2d12';
    ctx.lineWidth=1;

    ctx.beginPath();
    ctx.moveTo(sx+4,sy+14);
    ctx.lineTo(sx+12,sy+14);

    ctx.moveTo(sx+4,sy+30);
    ctx.lineTo(sx+12,sy+30);

    ctx.stroke();
  }

  else if(type===GATE){

    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(sx,sy,TILE,TILE);

    // porteira aberta
    ctx.strokeStyle='#8b4a1f';
    ctx.lineWidth=4;
    ctx.lineCap='round';

    ctx.beginPath();
    ctx.moveTo(sx+6,sy+36);
    ctx.lineTo(sx+18,sy+24);
    ctx.lineTo(sx+28,sy+36);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx+42,sy+36);
    ctx.lineTo(sx+30,sy+24);
    ctx.lineTo(sx+20,sy+36);
    ctx.stroke();

    // arco superior
    ctx.strokeStyle='#9b5a24';
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.arc(sx+24,sy+28,20,Math.PI,0);
    ctx.stroke();
  }
  else if(type===UMBRELLA){

    ctx.fillStyle='#d9c27a';
    ctx.fillRect(sx,sy,TILE,TILE);

    ctx.strokeStyle='#8b5a2b';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(cx,sy+20);
    ctx.lineTo(cx,sy+42);
    ctx.stroke();

    ctx.fillStyle='#e53935';
    ctx.beginPath();
    ctx.moveTo(cx,sy+6);
    ctx.arc(cx,sy+20,20,Math.PI,0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle='#f5c842';
    ctx.beginPath();
    ctx.moveTo(cx,sy+6);
    ctx.lineTo(cx,sy+20);
    ctx.lineTo(cx-20,sy+20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle='#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx,sy+6);
    ctx.lineTo(cx,sy+20);
    ctx.lineTo(cx+20,sy+20);
    ctx.closePath();
    ctx.fill();
  }

  else if(type===BOAT){
    ctx.fillStyle='#1a6aaa';
    ctx.fillRect(sx,sy,TILE,TILE);

    ctx.fillStyle='#8b4a1f';
    ctx.beginPath();
    ctx.moveTo(sx+8,sy+30);
    ctx.lineTo(sx+40,sy+30);
    ctx.lineTo(sx+34,sy+40);
    ctx.lineTo(sx+14,sy+40);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle='#5a2d12';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(cx,sy+30);
    ctx.lineTo(cx,sy+10);
    ctx.stroke();

    ctx.fillStyle='#fff7d6';
    ctx.beginPath();
    ctx.moveTo(cx,sy+11);
    ctx.lineTo(cx,sy+28);
    ctx.lineTo(sx+36,sy+25);
    ctx.closePath();
    ctx.fill();
  }
  else if(type===SIGN){

    // poste
    ctx.fillStyle='#6b3e1f';
    ctx.fillRect(sx+21,sy+20,6,16);

    // placa
    ctx.fillStyle='#d8b07a';
    ctx.fillRect(sx+6,sy+2,36,20);

    ctx.strokeStyle='#4a2a12';
    ctx.lineWidth=2;
    ctx.strokeRect(sx+6,sy+2,36,20);

    // texto
    ctx.fillStyle='#2b1a0d';
    ctx.font='bold 8px Arial';
    ctx.textAlign='center';

    ctx.fillText('CASA',sx+24,sy+10);
    ctx.fillText('MERC.',sx+24,sy+18);
  }

  ctx.restore();
}

let world=[], fixedTrees=[], fixedRocks=[], fixedWater=[];
let growTimers={}, enemies=[], particles=[], arrows=[], ducks=[], chickens=[], cows=[];
let day=1, phase='day', hp=MAX_HP, stamina=MAX_ST;
const musicDay = document.getElementById('musicDay');
const musicNight = document.getElementById('musicNight');

musicDay.volume = 0.35;
musicNight.volume = 0.25;

let currentMusic = '';
let food=5, water=8, wood=3, stone=2;
let money=0, eggs=0, milk=0;
let gameRunning=false, inHouse=false, runHeld=false;
let phaseTimer=DAY_DUR, lastAutoSave=0;
let camX=0, camY=0;
let scythe={on:false,angle:0,t:0};

const dogBark = document.getElementById('dogBark');

const dog = {
  x: 0,
  y: 0,
  barkCd: 0,
  atkCd: 0,
  isWalking: false,
  dir:'right'
};

const APPEARANCE={base:0,skin:'#f5c496',shirt:'#4a7a2a',hat:'#8B4513',hair:'#3a2a1a'};
const BASES=[{n:'Fazendeiro',hs:'wide'},{n:'Fazendeira',hs:'ponytail'},{n:'Guerreiro',hs:'helmet'},{n:'Mago',hs:'wizard'}];
const SKC=['#f5c496','#e8a875','#c68642','#8d5524','#fde0c8','#d4956a'];
const SHC=['#4a7a2a','#2a5a9a','#9a2a2a','#7a2a9a','#9a7a2a','#2a8a8a','#555','#c8702a'];
const HAC=['#8B4513','#2a2a2a','#9a2a2a','#2a5a9a','#4a7a2a','#c8a830','#888','#5a3a8a'];
const HRC=['#3a2a1a','#1a1a1a','#c8a830','#e8c090','#8a3a1a','#cc4444','#4a6aaa','#aaa'];

const player={
  x:WW/2*TILE+TILE/2,
  y:WH/2*TILE+TILE/2,
  sz:20,
  tx:null,
  ty:null,
  atkCd:0,
  action:'',
  actionTimer:0,
  dir:'right'
};

const keys={};
const joy={on:false,dx:0,dy:0,sx:0,sy:0};

// ══════════════════════════════════════
// WORLD GENERATION
// ══════════════════════════════════════
function generateWorld(){
  fixedTrees=[];
  fixedRocks=[];
  fixedWater=[];
  ducks=[];

  world=[];

  for(let r=0;r<WH;r++){
    world[r]=[];
    for(let c=0;c<WW;c++){
      world[r][c]={t:G};
    }
  }

  for(let r=0;r<WH;r++){
    for(let c=0;c<WW;c++){

      // água fixa à esquerda
      if(c<7){
        world[r][c]={t:WATER};
        fixedWater.push([r,c]);
        continue;
      }

      // areia depois da água
      if(c>=7 && c<10){
        world[r][c]={t:SAND};
        continue;
      }

      // árvores aleatórias
      const d=Math.random();
      if(d<0.11){
        world[r][c]={t:TREE};
        fixedTrees.push([r,c]);
      }
    }
  }

    // guarda-sóis espalhados na praia
  for(let i=0;i<12;i++){
    const r=5+Math.floor(Math.random()*(WH-10));
    const c=7+Math.floor(Math.random()*3);

    if(world[r][c].t===SAND){
      world[r][c]={t:UMBRELLA};
    }
  }

  // barquinhos espalhados no mar
  for(let i=0;i<8;i++){
    const r=5+Math.floor(Math.random()*(WH-10));
    const c=1+Math.floor(Math.random()*5);

    if(world[r][c].t===WATER){
      world[r][c]={t:BOAT};
    }
  }

  // limpar as 4 primeiras linhas para as rochas
  for(let r=0; r<4; r++){
    for(let c=0; c<WW; c++){
      world[r][c]={t:G};
    }
  }

  // pedras 2x2 na primeira e segunda linha
  for(let c=0; c<WW-1; c+=2){
    world[0][c]   ={t:BIGROCK,rockPart:'tl'};
    world[0][c+1] ={t:BIGROCK,rockPart:'tr'};
    world[1][c]   ={t:BIGROCK,rockPart:'bl'};
    world[1][c+1] ={t:BIGROCK,rockPart:'br'};

    fixedRocks.push([0,c]);
  }

  // pedras 2x2 intercaladas na terceira e quarta linha
  for(let c=1; c<WW-1; c+=2){
    world[2][c]   ={t:BIGROCK,rockPart:'tl'};
    world[2][c+1] ={t:BIGROCK,rockPart:'tr'};
    world[3][c]   ={t:BIGROCK,rockPart:'bl'};
    world[3][c+1] ={t:BIGROCK,rockPart:'br'};

    fixedRocks.push([2,c]);
  }

  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  // limpar área da base
  for(let dr=-3; dr<=3; dr++){
    for(let dc=-3; dc<=3; dc++){
      const rr=cr+dr;
      const rc=cc+dc;

      if(rr>=2 && rr<WH-2 && rc>=2 && rc<WW-2){
        world[rr][rc]={t:G};
      }
    }
  }

  // posição correta do lago
  const lakeR=cr-2;
  const lakeC=cc+8;

  window.lakeBounds={
    x:lakeC*TILE,
    y:lakeR*TILE,
    w:5*TILE,
    h:5*TILE
  };

  // areia em volta do lago
  for(let r=lakeR-1; r<=lakeR+5; r++){
    for(let c=lakeC-1; c<=lakeC+5; c++){
      world[r][c]={t:SAND};
    }
  }

  // lago 5x5 perto da base
  for(let r=lakeR; r<lakeR+5; r++){
    for(let c=lakeC; c<lakeC+5; c++){
      world[r][c]={t:WATER};
      fixedWater.push([r,c]);
    }
  }

  // patos dentro do lago
  ducks=[];

  for(let i=0;i<2;i++){
    ducks.push({
      x:window.lakeBounds.x + 40 + Math.random() * (window.lakeBounds.w - 80),
      y:window.lakeBounds.y + 40 + Math.random() * (window.lakeBounds.h - 80),
      dir:Math.random()*Math.PI*2,
      speed:0.3 + Math.random()*0.2,
      timer:0
    });
  }

  player.x=cc*TILE+TILE/2;
  player.y=cr*TILE+TILE/2;

  dog.x = player.x - 35;
  dog.y = player.y + 30;

  growTimers={};
  enemies=[];
  particles=[];
  arrows=[];

  day=1;
  phase='day';
  hp=MAX_HP;
  stamina=MAX_ST;
  food=5;
  water=8;
  wood=3;
  stone=2;
  money=0;
  eggs=0;
  milk=0;
  phaseTimer=DAY_DUR;
  inHouse=false;

  createCampLayout();
}

function createCampLayout(){
  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  // caminhos
  for(let r=cr-8;r<=cr+8;r++){
    world[r][cc]={t:PATH};
  }

  for(let c=cc-6;c<=cc+6;c++){
    world[cr][c]={t:PATH};
  }

  // casa 3x3 centralizada no caminho vertical
  for(let r=cr-9; r<=cr-7; r++){
    for(let c=cc-1; c<=cc+1; c++){
      world[r][c]={t:HOUSE,part:true,hp:H_HP};
    }
  }

  // linha do telhado / bloqueada
  world[cr-9][cc-1]={t:HOUSE,housePart:'roofL'};
  world[cr-9][cc]={t:HOUSE,housePart:'roofC'};
  world[cr-9][cc+1]={t:HOUSE,housePart:'roofR'};

  // linha do meio / bloqueada
  world[cr-8][cc-1]={t:HOUSE,housePart:'wallL'};
  world[cr-8][cc]={t:HOUSE,housePart:'wallC'};
  world[cr-8][cc+1]={t:HOUSE,housePart:'wallR'};

  // linha da porta/base
  world[cr-7][cc-1]={t:HOUSE,housePart:'baseL'};
  world[cr-7][cc]={t:HOUSE,housePart:'door'};
  world[cr-7][cc+1]={t:HOUSE,housePart:'baseR'};

  // placa mercado
  world[cr-7][cc+2]={t:SIGN};

  // torre / silo
  world[cr-5][cc+2]={t:TWR,hp:T_HP,st:0};

  // plantações
  for(let r=cr+2;r<=cr+6;r++){
    for(let c=cc-10;c<=cc-5;c++){
      world[r][c]={t:CR,pd:day};
    }
  }

  // cercas horizontais em cima e embaixo
  for(let c=cc-10;c<=cc-5;c++){
    world[cr+1][c]={t:FENCE_H};
    world[cr+7][c]={t:FENCE_H};
  }

  // cercas laterais
  for(let r=cr+2;r<=cr+6;r++){
    world[r][cc-11]={t:FENCE_L};
    world[r][cc-4]={t:FENCE_R};
  }

  // porteira aberta na parte de cima
  world[cr+1][cc-7]={t:GATE};
  // ═════════ GALINHEIRO ═════════
  const coopR = cr - 7;
  const coopC = cc - 10;

  // chão interno
  for(let r=coopR; r<=coopR+4; r++){
    for(let c=coopC; c<=coopC+5; c++){
      world[r][c]={t:DIRT};
    }
  }

  // cercas horizontais
  for(let c=coopC; c<=coopC+5; c++){
    world[coopR-1][c]={t:FENCE_H};
    world[coopR+5][c]={t:FENCE_H};
  }

  // cercas verticais
  for(let r=coopR; r<=coopR+4; r++){
    world[r][coopC-1]={t:FENCE_L};
    world[r][coopC+6]={t:FENCE_R};
  }

  // abertura
  world[coopR+5][coopC+2]={t:GATE};

  // galinhas
  chickens=[];

  for(let i=0;i<2;i++){
    chickens.push({
      x:(coopC+1+Math.random()*3)*TILE,
      y:(coopR+1+Math.random()*2)*TILE,
      dir: Math.random() < 0.5 ? -1 : 1,
      frame: 0,
      animTime: 0,
      speed: 20
    });
  }
  
  // ═════════ CURRAL DAS VACAS ═════════
  const cowR = cr + 5;
  const cowC = cc + 5;

  // chão interno
  for(let r=cowR; r<=cowR+4; r++){
    for(let c=cowC; c<=cowC+7; c++){
      world[r][c]={t:DIRT};
    }
  }

  // cercas horizontais
  for(let c=cowC; c<=cowC+7; c++){
    world[cowR-1][c]={t:FENCE_H};
    world[cowR+5][c]={t:FENCE_H};
  }

  // cercas laterais
  for(let r=cowR; r<=cowR+4; r++){
    world[r][cowC-1]={t:FENCE_L};
    world[r][cowC+8]={t:FENCE_R};
  }

  // porteira em cima
  world[cowR-1][cowC+3]={t:GATE};

  // vacas
  cows=[];

  for(let i=0;i<2;i++){
    cows.push({
      x:(cowC+1+Math.random()*5)*TILE,
      y:(cowR+1+Math.random()*2)*TILE,
      dir:Math.random()*Math.PI*2,
      speed:0.22+Math.random()*0.08,
      timer:0

    });
  }
}

function isFarmArea(r,c){
  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  return (
    r>=cr+2 &&
    r<=cr+6 &&
    c>=cc-10 &&
    c<=cc-5
  );
}

function isFixed(r,c){
  return fixedTrees.some(([a,b])=>a===r&&b===c)||fixedRocks.some(([a,b])=>a===r&&b===c)||fixedWater.some(([a,b])=>a===r&&b===c);
}

function respawn(){
  fixedTrees.forEach(([r,c])=>{const t=world[r][c].t;if(t===STUMP||t===G||t===DIRT)world[r][c]={t:TREE};});
  fixedRocks.forEach(([r,c])=>{if(world[r][c].t===G||world[r][c].t===DIRT)world[r][c]={t:ROCK};});
  fixedWater.forEach(([r,c])=>{world[r][c]={t:WATER};});
}

// ══════════════════════════════════════
// DRAW CHARACTER (canvas shapes only)
// ══════════════════════════════════════
function drawChar(cx,cy,s,ap,c2){

  const walking = player.isWalking;
  const t = Date.now() * 0.012;
  const swing = walking ? Math.sin(t) : 0;

  // sombra
  c2.fillStyle='rgba(0,0,0,0.22)';
  c2.beginPath();
  c2.ellipse(cx,cy+s*.95,s*.7,s*.22,0,0,Math.PI*2);
  c2.fill();

  // pernas e botas
  c2.save();
  c2.translate(cx-s*.22, cy+s*.35);
  c2.rotate(swing*.45);

  c2.fillStyle='#1f5fa8';
  c2.fillRect(-s*.13,0,s*.26,s*.62);

  c2.fillStyle='#6b3a1f';
  c2.fillRect(-s*.18,s*.56,s*.36,s*.18);

  c2.restore();

  c2.save();
  c2.translate(cx+s*.22, cy+s*.35);
  c2.rotate(-swing*.45);

  c2.fillStyle='#1f5fa8';
  c2.fillRect(-s*.13,0,s*.26,s*.62);

  c2.fillStyle='#6b3a1f';
  c2.fillRect(-s*.18,s*.56,s*.36,s*.18);

  c2.restore();

  // camisa
  c2.fillStyle='#55b878';
  c2.beginPath();
  c2.rect(cx-s*.48,cy-s*.32,s*.96,s*.72);
  c2.fill();

  // macacão
  c2.fillStyle='#1f6fbf';
  c2.beginPath();
  c2.rect(cx-s*.32,cy-s*.18,s*.64,s*.72);
  c2.fill();

  // bolso
  c2.fillStyle='#2d8bd8';
  c2.fillRect(cx-s*.16,cy+s*.02,s*.32,s*.18);

  // botões
  c2.fillStyle='#f5c842';
  c2.beginPath(); c2.arc(cx-s*.27,cy-s*.12,s*.05,0,Math.PI*2); c2.fill();
  c2.beginPath(); c2.arc(cx+s*.27,cy-s*.12,s*.05,0,Math.PI*2); c2.fill();

  // braços
  c2.strokeStyle='#55b878';
  c2.lineWidth=s*.18;
  c2.lineCap='round';

  c2.beginPath();
  c2.moveTo(cx-s*.45,cy-s*.15);
  c2.lineTo(cx-s*.68,cy+s*.25+swing*s*.1);
  c2.stroke();

  c2.beginPath();
  c2.moveTo(cx+s*.45,cy-s*.15);
  c2.lineTo(cx+s*.68,cy+s*.25-swing*s*.1);
  c2.stroke();

  // mãos
  c2.fillStyle=ap.skin;
  c2.beginPath(); c2.arc(cx-s*.68,cy+s*.28+swing*s*.1,s*.12,0,Math.PI*2); c2.fill();
  c2.beginPath(); c2.arc(cx+s*.68,cy+s*.28-swing*s*.1,s*.12,0,Math.PI*2); c2.fill();

  // pescoço
  c2.fillStyle=ap.skin;
  c2.fillRect(cx-s*.13,cy-s*.48,s*.26,s*.22);

  // cabeça
  c2.fillStyle=ap.skin;
  c2.beginPath();
  c2.rect(cx-s*.43,cy-s*1.05,s*.86,s*.72);
  c2.fill();

  // cabelo lateral
  c2.fillStyle='#c46a22';
  c2.fillRect(cx-s*.46,cy-s*.9,s*.13,s*.38);
  c2.fillRect(cx+s*.33,cy-s*.9,s*.13,s*.38);

  // barba
  c2.fillStyle='#a63f24';
  c2.beginPath();
  c2.moveTo(cx-s*.34,cy-s*.58);
  c2.quadraticCurveTo(cx,cy-s*.2,cx+s*.34,cy-s*.58);
  c2.lineTo(cx+s*.27,cy-s*.35);
  c2.quadraticCurveTo(cx,cy-s*.1,cx-s*.27,cy-s*.35);
  c2.closePath();
  c2.fill();

  // bigode
  c2.fillStyle='#8f321e';
  c2.beginPath();
  c2.ellipse(cx-s*.12,cy-s*.58,s*.16,s*.07,-.2,0,Math.PI*2);
  c2.ellipse(cx+s*.12,cy-s*.58,s*.16,s*.07,.2,0,Math.PI*2);
  c2.fill();

  // olhos
  c2.fillStyle='white';
  c2.beginPath(); c2.arc(cx-s*.15,cy-s*.76,s*.11,0,Math.PI*2); c2.fill();
  c2.beginPath(); c2.arc(cx+s*.15,cy-s*.76,s*.11,0,Math.PI*2); c2.fill();

  c2.fillStyle='#2676d2';
  c2.beginPath(); c2.arc(cx-s*.15,cy-s*.76,s*.055,0,Math.PI*2); c2.fill();
  c2.beginPath(); c2.arc(cx+s*.15,cy-s*.76,s*.055,0,Math.PI*2); c2.fill();

  c2.fillStyle='#111';
  c2.beginPath(); c2.arc(cx-s*.15,cy-s*.76,s*.025,0,Math.PI*2); c2.fill();
  c2.beginPath(); c2.arc(cx+s*.15,cy-s*.76,s*.025,0,Math.PI*2); c2.fill();

  // sobrancelhas
  c2.strokeStyle='#7a2a16';
  c2.lineWidth=2;
  c2.beginPath();
  c2.moveTo(cx-s*.25,cy-s*.9);
  c2.lineTo(cx-s*.06,cy-s*.87);
  c2.moveTo(cx+s*.06,cy-s*.87);
  c2.lineTo(cx+s*.25,cy-s*.9);
  c2.stroke();

  // nariz
  c2.fillStyle='rgba(160,90,50,0.35)';
  c2.beginPath();
  c2.arc(cx,cy-s*.67,s*.055,0,Math.PI*2);
  c2.fill();

  // chapéu
  c2.fillStyle='#b65a1c';
  c2.beginPath();
  c2.ellipse(cx,cy-s*1.05,s*.62,s*.16,0,0,Math.PI*2);
  c2.fill();

  c2.fillStyle='#c96b24';
  c2.beginPath();
  c2.rect(cx-s*.32,cy-s*1.38,s*.64,s*.34);
  c2.fill();

  c2.fillStyle='#3c8a5a';
  c2.fillRect(cx-s*.34,cy-s*1.13,s*.68,s*.08);

    // foice detalhada
  c2.save();

  c2.translate(cx+s*.62,cy-s*.02);

  if(scythe.on)c2.rotate(scythe.angle);

  c2.rotate(-0.18);

  // cabo
  c2.fillStyle='#8a552f';
  c2.beginPath();
  c2.rect(-s*.04,-s*.55,s*.08,s*1.15);
  c2.fill();

  // detalhe do cabo
  c2.fillStyle='#b97845';
  c2.fillRect(-s*.015,-s*.52,s*.02,s*1.08);

  // apoio lateral
  c2.fillStyle='#9a6038';
  c2.beginPath();
  c2.rect(s*.02,-s*.08,s*.22,s*.07);
  c2.fill();

  // ponta do apoio
  c2.fillStyle='#d7a15d';
  c2.beginPath();
  c2.arc(s*.24,-s*.045,s*.035,0,Math.PI*2);
  c2.fill();

  // encaixe metálico
  c2.fillStyle='#8f8f8f';
  c2.beginPath();
  c2.rect(-s*.08,-s*.68,s*.16,s*.16);
  c2.fill();

  // lâmina principal
  c2.fillStyle='#d8d8d8';

  c2.beginPath();

  c2.moveTo(0,-s*.63);

  c2.quadraticCurveTo(
    s*.62,-s*.72,
    s*.95,-s*.18
  );

  c2.quadraticCurveTo(
    s*.48,-s*.42,
    0,-s*.48
  );

  c2.closePath();

  c2.fill();

  // sombra da lâmina
  c2.fillStyle='#9f9f9f';

  c2.beginPath();

  c2.moveTo(s*.18,-s*.58);

  c2.quadraticCurveTo(
    s*.56,-s*.56,
    s*.82,-s*.25
  );

  c2.quadraticCurveTo(
    s*.5,-s*.38,
    s*.18,-s*.46
  );

  c2.closePath();

  c2.fill();

  // brilho
  c2.strokeStyle='rgba(255,255,255,0.7)';
  c2.lineWidth=1.5;

  c2.beginPath();
  c2.moveTo(s*.08,-s*.58);
  c2.quadraticCurveTo(
    s*.45,-s*.62,
    s*.76,-s*.26
  );
  c2.stroke();

  // contorno
  c2.strokeStyle='#444';
  c2.lineWidth=1;

  c2.beginPath();

  c2.moveTo(0,-s*.63);

  c2.quadraticCurveTo(
    s*.62,-s*.72,
    s*.95,-s*.18
  );

  c2.quadraticCurveTo(
    s*.48,-s*.42,
    0,-s*.48
  );

  c2.closePath();

  c2.stroke();

  c2.restore();
}
// ══════════════════════════════════════
// RESIZE & LAYOUT
// ══════════════════════════════════════
let hudH=0, panelH=0;

function resize(){
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  positionFloatingControls();
}
window.addEventListener('resize',resize);

function positionFloatingControls(){
  const hud=document.getElementById('hud');
  const panel=document.getElementById('action-panel');
  hudH=hud.offsetHeight||60;
  panelH=panel.offsetHeight||70;
  const gameH=window.innerHeight-hudH-panelH;
  const midY = hudH + gameH * 0.78;
  // joystick: left side, vertically centered in game area
  const jz=document.getElementById('joystick-zone');
  jz.style.top=(midY-44)+'px';
  // attack btn: right side, same vertical
  const ab=document.getElementById('attack-btn');
  ab.style.top=(midY-32)+'px';
  ab.style.bottom='auto';
}

// ══════════════════════════════════════
// DRAW WORLD
// ══════════════════════════════════════
function drawWorld(){
  const sc=Math.max(0,Math.floor(camX/TILE)-1);
  const sr=Math.max(0,Math.floor(camY/TILE)-1);
  const ec=Math.min(WW,sc+Math.ceil(canvas.width/TILE)+2);
  const er=Math.min(WH,sr+Math.ceil(canvas.height/TILE)+2);

  // 1ª PASSAGEM: desenha só o chão
  for(let r=sr;r<er;r++){
    for(let c=sc;c<ec;c++){
      const cell=world[r][c];
      const sx=Math.round(c*TILE-camX);
      const sy=Math.round(r*TILE-camY);

      ctx.fillStyle='#3a7a2a';
      ctx.fillRect(sx,sy,TILE,TILE);

      if(
        cell.t!==G &&
        cell.t!==FENCE &&
        cell.t!==FIRE &&
        cell.t!==TWR &&
        cell.t!==HOUSE &&
        cell.t!==HDOOR &&
        cell.t!==SIGN &&
        !cell.part
      ){
        ctx.fillStyle=TCLR[cell.t]||TCLR[0];
        ctx.fillRect(sx,sy,TILE,TILE);
      }
    }
  }

  // 2ª PASSAGEM: desenha objetos por cima
  for(let r=sr;r<er;r++){
    for(let c=sc;c<ec;c++){
      const cell=world[r][c];
      const sx=Math.round(c*TILE-camX);
      const sy=Math.round(r*TILE-camY);


      if(cell.t!==G && cell.t!==DIRT){
        drawTileObject(cell.t,sx,sy,cell);
      }

      if((cell.t===TWR || cell.t===HOUSE) && cell.hp!=null){
        const mh=cell.t===TWR ? T_HP : H_HP;

        ctx.fillStyle='#300';
        ctx.fillRect(sx+2,sy+2,TILE-4,5);

        ctx.fillStyle=cell.t===TWR ? '#f5c842' : '#8B4513';
        ctx.fillRect(sx+2,sy+2,(TILE-4)*(cell.hp/mh),5);
      }


      if(isFixed(r,c) && cell.t!==TREE && cell.t!==ROCK && cell.t!==WATER && cell.t!==MINE){
        ctx.strokeStyle='rgba(255,255,80,0.15)';
        ctx.lineWidth=1;
        ctx.strokeRect(sx+1,sy+1,TILE-2,TILE-2);
      }
    }
  }
}

function drawPlayer(){
  if(inHouse)return;

  let sprite = playerSprites['adventurer_idle.png'];

  if(player.isWalking){
    const frame = Math.floor(Date.now()/180) % 2;
    sprite = frame === 0
      ? playerSprites['adventurer_walk1.png']
      : playerSprites['adventurer_walk2.png'];
  }

  if(player.dir==='up' && player.action===''){
    sprite = player.isWalking ? sprite : playerSprites['adventurer_back.png'];
  }

  if(player.action==='chop' || player.action==='mine'){
    const frame = Math.floor(Date.now()/120) % 2;
    sprite = frame === 0
      ? playerSprites['adventurer_action1.png']
      : playerSprites['adventurer_action2.png'];
  }

  if(player.action==='attack'){
    const frame = Math.floor(Date.now()/120) % 2;

    sprite = frame === 0
      ? playerSprites['adventurer_action1.png']
      : playerSprites['adventurer_action2.png'];
  }

  if(player.action==='hurt'){
    sprite = playerSprites['adventurer_hurt.png'];
  }

  if(sprite && sprite.complete){
    const sx = player.x - camX;
    const sy = player.y - camY;
    const w = 48;
    const h = 58;

    ctx.save();

    if(player.dir==='left'){
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, -24, sy - 34, w, h);
    }else{
      ctx.drawImage(sprite, sx - 24, sy - 34, w, h);
    }

    ctx.restore();
  }else{
    drawChar(player.x-camX,player.y-camY,player.sz,APPEARANCE,ctx);
  }
}

function drawScytheSwing(){
  if(!scythe.on||inHouse)return;
  const sx=player.x-camX,sy=player.y-camY,s=player.sz;
  ctx.save();ctx.translate(sx,sy);
  ctx.strokeStyle='rgba(200,210,220,0.5)';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,s*1.6,-1.2+scythe.angle,-0.2+scythe.angle);ctx.stroke();
  ctx.restore();
}

function drawCows(){
  for(const cow of cows){
    const sx=cow.x-camX;
    const sy=cow.y-camY;

    const t=Date.now()*0.008;
    const walk=Math.sin(t+cow.x*0.02)*2;

    ctx.save();

    // sombra
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx,sy+19,25,7,0,0,Math.PI*2);
    ctx.fill();

    // pernas animadas
    ctx.strokeStyle='#f4ead7';
    ctx.lineWidth=6;
    ctx.lineCap='round';

    ctx.beginPath();
    ctx.moveTo(sx-16,sy+8);
    ctx.lineTo(sx-16+walk,sy+27);

    ctx.moveTo(sx-5,sy+9);
    ctx.lineTo(sx-5-walk,sy+28);

    ctx.moveTo(sx+8,sy+9);
    ctx.lineTo(sx+8+walk,sy+28);

    ctx.moveTo(sx+18,sy+8);
    ctx.lineTo(sx+18-walk,sy+27);
    ctx.stroke();

    // cascos
    ctx.fillStyle='#3a2a1a';
    ctx.fillRect(sx-20+walk,sy+27,8,4);
    ctx.fillRect(sx-9-walk,sy+28,8,4);
    ctx.fillRect(sx+4+walk,sy+28,8,4);
    ctx.fillRect(sx+14-walk,sy+27,8,4);

    // corpo branco
    ctx.fillStyle='#fff5df';
    ctx.beginPath();
    ctx.ellipse(sx,sy,28,17,0,0,Math.PI*2);
    ctx.fill();

    // manchas
    ctx.fillStyle='#4a3528';

    ctx.beginPath();
    ctx.ellipse(sx-12,sy-4,8,7,-0.4,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(sx+7,sy+3,9,6,0.3,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(sx+18,sy-5,5,6,0,0,Math.PI*2);
    ctx.fill();

    // rabo
    ctx.strokeStyle='#4a3528';
    ctx.lineWidth=4;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(sx-28,sy-5);
    ctx.lineTo(sx-39,sy-12);
    ctx.stroke();

    ctx.fillStyle='#4a3528';
    ctx.beginPath();
    ctx.ellipse(sx-41,sy-13,4,3,0,0,Math.PI*2);
    ctx.fill();

    // cabeça
    ctx.fillStyle='#fff5df';
    ctx.beginPath();
    ctx.ellipse(sx+30,sy-9,14,13,0,0,Math.PI*2);
    ctx.fill();

    // mancha na cabeça
    ctx.fillStyle='#4a3528';
    ctx.beginPath();
    ctx.ellipse(sx+24,sy-13,6,7,-0.4,0,Math.PI*2);
    ctx.fill();

    // focinho
    ctx.fillStyle='#e7b5a5';
    ctx.beginPath();
    ctx.ellipse(sx+36,sy-4,9,6,0,0,Math.PI*2);
    ctx.fill();

    // narinas
    ctx.fillStyle='#6a3a35';
    ctx.beginPath();
    ctx.arc(sx+33,sy-4,1.4,0,Math.PI*2);
    ctx.arc(sx+39,sy-4,1.4,0,Math.PI*2);
    ctx.fill();

    // orelhas
    ctx.fillStyle='#fff5df';
    ctx.beginPath();
    ctx.ellipse(sx+19,sy-14,6,4,-0.5,0,Math.PI*2);
    ctx.ellipse(sx+39,sy-15,6,4,0.5,0,Math.PI*2);
    ctx.fill();

    // chifrinhos
    ctx.strokeStyle='#d8c08a';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(sx+24,sy-20);
    ctx.lineTo(sx+21,sy-25);
    ctx.moveTo(sx+36,sy-20);
    ctx.lineTo(sx+39,sy-25);
    ctx.stroke();

    // olhos
    ctx.fillStyle='#111';
    ctx.beginPath();
    ctx.arc(sx+27,sy-11,1.8,0,Math.PI*2);
    ctx.arc(sx+37,sy-11,1.8,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
}

function drawChickens(){

  chickens.forEach(c=>{

    const img = chickenFrames[c.frame || 0];

    if(!img || !img.complete) return;

    const sx = c.x - camX;
    const sy = c.y - camY;

    ctx.save();

    if(c.dir === 1){

      ctx.translate(sx + 16, sy);
      ctx.scale(-1,1);

      ctx.drawImage(
        img,
        -16,
        0,
        32,
        32
      );

    }else{

      ctx.drawImage(
        img,
        sx,
        sy,
        32,
        32
      );

    }

    ctx.restore();

  });

}

function drawDucks(){
  for(const d of ducks){
    const sx=d.x-camX;
    const sy=d.y-camY;

    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx,sy+5,8,3,0,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='#ffd93b';
    ctx.beginPath();
    ctx.ellipse(sx,sy,10,7,0,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx+7,sy-5,5,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='#ff9f1a';
    ctx.beginPath();
    ctx.moveTo(sx+13,sy-5);
    ctx.lineTo(sx+18,sy-3);
    ctx.lineTo(sx+13,sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle='#222';
    ctx.beginPath();
    ctx.arc(sx+8,sy-6,1.2,0,Math.PI*2);
    ctx.fill();
  }
}

function drawDog(){
  if(inHouse) return;

  const sx = dog.x - camX;
  const sy = dog.y - camY;

  const t = Date.now() * 0.012;
  const walk = dog.isWalking ? Math.sin(t) : 0;

  ctx.save();

  ctx.translate(sx, sy);

  if(dog.dir === 'left'){
    ctx.scale(-0.5, 0.5);
  }else{
    ctx.scale(0.5, 0.5);
  }

  ctx.translate(-sx, -sy);

  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy+18, 18, 6, 0, 0, Math.PI*2);
  ctx.fill();

  // pernas
  ctx.strokeStyle='#8b5a36';
  ctx.lineWidth=5;
  ctx.lineCap='round';

  ctx.beginPath();
  ctx.moveTo(sx-10, sy+8);
  ctx.lineTo(sx-13+walk*4, sy+23);

  ctx.moveTo(sx+8, sy+8);
  ctx.lineTo(sx+11-walk*4, sy+23);

  ctx.moveTo(sx-2, sy+10);
  ctx.lineTo(sx-4-walk*3, sy+24);

  ctx.moveTo(sx+15, sy+8);
  ctx.lineTo(sx+17+walk*3, sy+22);
  ctx.stroke();

  // corpo
  ctx.fillStyle='#9b653a';
  ctx.beginPath();
  ctx.ellipse(sx+2, sy, 22, 15, 0, 0, Math.PI*2);
  ctx.fill();

  // peito branco
  ctx.fillStyle='#f1e6d0';
  ctx.beginPath();
  ctx.ellipse(sx+8, sy+3, 9, 13, -0.2, 0, Math.PI*2);
  ctx.fill();

  // rabo
  ctx.strokeStyle='#9b653a';
  ctx.lineWidth=8;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.arc(sx-22, sy-2, 12, Math.PI*0.9, Math.PI*1.8);
  ctx.stroke();

  // cabeça
  ctx.fillStyle='#f1e6d0';
  ctx.beginPath();
  ctx.ellipse(sx+22, sy-15, 18, 17, 0, 0, Math.PI*2);
  ctx.fill();

  // orelhas
  ctx.fillStyle='#5b3828';
  ctx.beginPath();
  ctx.ellipse(sx+10, sy-12, 8, 14, 0.4, 0, Math.PI*2);
  ctx.ellipse(sx+34, sy-12, 8, 14, -0.4, 0, Math.PI*2);
  ctx.fill();

  // focinho
  ctx.fillStyle='#ffffff';
  ctx.beginPath();
  ctx.ellipse(sx+22, sy-9, 10, 7, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle='#1d2b34';
  ctx.beginPath();
  ctx.arc(sx+22, sy-13, 3, 0, Math.PI*2);
  ctx.fill();

  // língua
  ctx.fillStyle='#e85b5b';
  ctx.beginPath();
  ctx.ellipse(sx+22, sy-4, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // olhos
  ctx.fillStyle='#23160f';
  ctx.beginPath();
  ctx.arc(sx+16, sy-19, 3, 0, Math.PI*2);
  ctx.arc(sx+28, sy-19, 3, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle='white';
  ctx.beginPath();
  ctx.arc(sx+17, sy-20, 1, 0, Math.PI*2);
  ctx.arc(sx+29, sy-20, 1, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawEnemies(){
  enemies.forEach(e=>{

    if(phase==='night'){
      const d=Math.sqrt((e.x-player.x)**2+(e.y-player.y)**2);
      if(d>LIGHT_RADIUS)return;
    }

    const sx=e.x-camX;
    const sy=e.y-camY;

    let sprite = zombieSprites['zombie_idle.png'];

    if(e.action==='attack'){
      const frame = Math.floor(Date.now()/120) % 2;
      sprite = frame === 0
        ? zombieSprites['zombie_action1.png']
        : zombieSprites['zombie_action2.png'];
    }else if(e.action==='hurt'){
      sprite = zombieSprites['zombie_hurt.png'];
    }else{
      const frame = Math.floor(Date.now()/180) % 2;
      sprite = frame === 0
        ? zombieSprites['zombie_walk1.png']
        : zombieSprites['zombie_walk2.png'];
    }

    if(sprite && sprite.complete){
      ctx.save();

      if(e.dir==='left'){
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -24, sy-34, 48, 58);
      }else{
        ctx.drawImage(sprite, sx-24, sy-34, 48, 58);
      }

      ctx.restore();
    }

    ctx.fillStyle='#300';
    ctx.fillRect(sx-17,sy-42,34,4);

    ctx.fillStyle='#e53935';
    ctx.fillRect(sx-17,sy-42,34*(e.hp/e.mhp),4);
  });
}

function drawArrows(){
  arrows.forEach(a=>{
    ctx.save();
    ctx.translate(a.x-camX,a.y-camY);
    ctx.rotate(a.angle);

    if(a.type==='stone'){
      ctx.fillStyle='#777';
      ctx.beginPath();
      ctx.ellipse(0,0,7,5,0,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle='#aaa';
      ctx.beginPath();
      ctx.ellipse(-2,-2,3,2,0,0,Math.PI*2);
      ctx.fill();
    }else{
      ctx.fillStyle='#8B5E3C';
      ctx.fillRect(-8,-1.5,16,3);

      ctx.fillStyle='#c8c8c8';
      ctx.beginPath();
      ctx.moveTo(8,0);
      ctx.lineTo(4,-4);
      ctx.lineTo(4,4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle='#cc4444';
      ctx.beginPath();
      ctx.moveTo(-8,0);
      ctx.lineTo(-4,-4);
      ctx.lineTo(-6,0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawParticles(){
  particles.forEach(p=>{
    ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.ml);
    // draw as colored circle+text fallback
    ctx.font=`${p.sz}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(p.em,p.x-camX,p.y-camY);
    ctx.restore();
  });
}

function getNightAlpha(){
  if(phase==='day'){
    const elapsed = DAY_DUR - phaseTimer;
    const pct = elapsed / DAY_DUR;

    if(pct < 0.75) return 0;
    return (pct - 0.75) / 0.25;
  }

  if(phase==='night'){
    const pct = phaseTimer / NIGHT_DUR;

    if(pct > 0.25) return 1;
    return pct / 0.25;
  }

  return 0;
}

function drawNight(){
  const nightAlpha = getNightAlpha();
  if(nightAlpha <= 0) return;
  if(inHouse) return;

  const sx = player.x - camX;
  const sy = player.y - camY;

  const lightR = 180;

  const darkness = ctx.createRadialGradient(
    sx, sy, lightR * 0.55,
    sx, sy, lightR * 1.9
  );

  darkness.addColorStop(0, `rgba(0,0,0,${0 * nightAlpha})`);
  darkness.addColorStop(0.45, `rgba(0,0,0,${0.25 * nightAlpha})`);
  darkness.addColorStop(0.70, `rgba(0,0,0,${0.75 * nightAlpha})`);
  darkness.addColorStop(1, `rgba(0,0,0,${0.98 * nightAlpha})`);

  ctx.fillStyle = darkness;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const glow = ctx.createRadialGradient(
    sx, sy, 10,
    sx, sy, lightR
  );

  glow.addColorStop(0, `rgba(255,210,90,${0.18 * nightAlpha})`);
  glow.addColorStop(1, 'rgba(255,210,90,0)');

  ctx.fillStyle = glow;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawHouseScreen(){
  if(!inHouse)return;

  ctx.fillStyle='rgba(20,12,6,0.55)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

// ══════════════════════════════════════
// UPDATE
// ══════════════════════════════════════
function updatePlayer(dt){

  const oldX = player.x;
  const oldY = player.y;

  if(inHouse){
    hp=Math.min(MAX_HP,hp+1*dt);
    updateHUD();
    return;
  }

  let dx=0,dy=0;

  if(keys['ArrowLeft']||keys['a']||keys['A'])dx-=1;
  if(keys['ArrowRight']||keys['d']||keys['D'])dx+=1;
  if(keys['ArrowUp']||keys['w']||keys['W'])dy-=1;
  if(keys['ArrowDown']||keys['s']||keys['S'])dy+=1;

  if(joy.on){
    dx+=joy.dx;
    dy+=joy.dy;
  }

  if(Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1){
    if(Math.abs(dx) > Math.abs(dy)){
      player.dir = dx < 0 ? 'left' : 'right';
    }else if(dy < -0.1){
      player.dir = 'up';
    }else if(dy > 0.1){
      player.dir = 'down';
    }
  }

  if(player.tx!==null&&Math.abs(dx)<0.1&&!joy.on){

    const tx=player.tx-player.x;
    const ty=player.ty-player.y;
    const dd=Math.sqrt(tx*tx+ty*ty);

    if(dd>5){
      dx=tx/dd;
      dy=ty/dd;
    }else{
      player.tx=null;
      player.ty=null;
    }
  }

  const len=Math.sqrt(dx*dx+dy*dy);

  if(len>1){
    dx/=len;
    dy/=len;
  }

  const isRun=(keys[' ']||keys['Shift']||runHeld)&&stamina>0;

  const spd=(isRun?5.5:3)*dt*60;

  if(isRun&&len>0.1){
    stamina=Math.max(0,stamina-0.25*dt*60);
    updateHUD();
  }

  const nx=player.x+dx*spd;
  const ny=player.y+dy*spd;

  const margin=6;

  if(!isSolid(nx,player.y))player.x=nx;
  if(!isSolid(player.x,ny))player.y=ny;

  player.x=Math.max(TILE,Math.min(WW*TILE-TILE,player.x));
  player.y=Math.max(TILE,Math.min(WH*TILE-TILE,player.y));

  if(player.atkCd>0)player.atkCd-=dt;

  if(player.actionTimer>0){
    player.actionTimer--;
  }else{
    player.action='';
  }
  player.isWalking =
    Math.abs(player.x - oldX) > 0.1 ||
    Math.abs(player.y - oldY) > 0.1;
}

function isSolid(wx,wy){
  // hitbox apenas dos pés do personagem
  const footW = 16;
  const footH = 10;

  const left   = wx - footW/2;
  const right  = wx + footW/2;
  const top    = wy + 12;
  const bottom = wy + 12 + footH;

  const points=[
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
    [wx, bottom]
  ];

  for(const [px,py] of points){
    const c=Math.floor(px/TILE);
    const r=Math.floor(py/TILE);

    if(r<0 || r>=WH || c<0 || c>=WW)return true;

    const cell = world[r][c];


    // todos os objetos sólidos bloqueiam o tile inteiro
    if(SOLID.has(cell.t)){
      return true;
    }
  }

  return false;
}

function updateCamera(){
  const tx=player.x-canvas.width/2,ty=player.y-canvas.height/2;
  camX+=(tx-camX)*.1;camY+=(ty-camY)*.1;
  camX=Math.max(0,Math.min(WW*TILE-canvas.width,camX));
  camY=Math.max(0,Math.min(WH*TILE-canvas.height,camY));
}

function addChicken(){
  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  const coopR = cr - 7;
  const coopC = cc - 10;

  chickens.push({
    x: coopC*TILE + TILE,
    y: coopR*TILE + TILE,
    
    dir: Math.random() < 0.5 ? -1 : 1,

    frame: 0,
    animTime: 0,
    speed: 20
  });
}

function addCow(){
  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  const cowR = cr + 5;
  const cowC = cc + 5;

  cows.push({
    x:(cowC+1+Math.random()*5)*TILE,
    y:(cowR+1+Math.random()*2)*TILE,
    dir:Math.random()*Math.PI*2,
    speed:0.22+Math.random()*0.08,
    timer:0
  });
}

function updateCows(){
  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  const cowR = cr + 5;
  const cowC = cc + 5;

  for(const cow of cows){
    cow.timer--;

    if(cow.timer<=0){
      cow.dir+=(Math.random()-0.5)*1.5;
      cow.timer=60+Math.random()*120;
    }

    const nx=cow.x+Math.cos(cow.dir)*cow.speed;
    const ny=cow.y+Math.sin(cow.dir)*cow.speed;

    const minX=cowC*TILE+16;
    const maxX=(cowC+7)*TILE+24;
    const minY=cowR*TILE+16;
    const maxY=(cowR+4)*TILE+24;

    if(nx>minX && nx<maxX) cow.x=nx;
    else cow.dir=Math.PI-cow.dir;

    if(ny>minY && ny<maxY) cow.y=ny;
    else cow.dir=-cow.dir;
  }
}

function updateChickens(dt){

  const cr=Math.floor(WH/2);
  const cc=Math.floor(WW/2);

  const coopR = cr - 7;
  const coopC = cc - 10;

  const minX = coopC*TILE + 12;
  const maxX = (coopC+6)*TILE - 32;

  const minY = coopR*TILE + 12;
  const maxY = (coopR+5)*TILE - 32;

  chickens.forEach(c=>{

    // inicialização
    if(c.vx === undefined){

      const angle = Math.random()*Math.PI*2;

      c.vx = Math.cos(angle);
      c.vy = Math.sin(angle);

      c.changeDirTimer = 0;
    }

    // movimento
    c.x += c.vx * c.speed * dt;
    c.y += c.vy * c.speed * dt;

    // direção sprite
    c.dir = c.vx >= 0 ? 1 : -1;

    // colisão horizontal
    if(c.x < minX){
      c.x = minX;
      c.vx *= -1;
    }

    if(c.x > maxX){
      c.x = maxX;
      c.vx *= -1;
    }

    // colisão vertical
    if(c.y < minY){
      c.y = minY;
      c.vy *= -1;
    }

    if(c.y > maxY){
      c.y = maxY;
      c.vy *= -1;
    }

    // troca direção aleatória
    c.changeDirTimer -= dt;

    if(c.changeDirTimer <= 0){

      const angle = Math.random()*Math.PI*2;

      c.vx = Math.cos(angle);
      c.vy = Math.sin(angle);

      c.changeDirTimer = 2 + Math.random()*3;
    }

    // animação
    c.animTime += dt;

    if(c.animTime > 0.15){

      c.animTime = 0;

      c.frame = (c.frame + 1) % 4;
    }

  });

}

function updateDucks(){

  if(!window.lakeBounds) return;

  const minX = window.lakeBounds.x + 18;
  const maxX = window.lakeBounds.x + window.lakeBounds.w - 18;

  const minY = window.lakeBounds.y + 18;
  const maxY = window.lakeBounds.y + window.lakeBounds.h - 18;

  for(const d of ducks){

    d.timer--;

    if(d.timer <= 0){
      d.dir += (Math.random() - 0.5) * 1.5;
      d.timer = 60 + Math.random() * 120;
    }

    d.x += Math.cos(d.dir) * d.speed;
    d.y += Math.sin(d.dir) * d.speed;

    if(d.x < minX){
      d.x = minX;
      d.dir = Math.PI - d.dir;
    }

    if(d.x > maxX){
      d.x = maxX;
      d.dir = Math.PI - d.dir;
    }

    if(d.y < minY){
      d.y = minY;
      d.dir = -d.dir;
    }

    if(d.y > maxY){
      d.y = maxY;
      d.dir = -d.dir;
    }
  }
}

function enemyCanMove(wx, wy, margin=8){
  const points=[
    [wx,wy],
    [wx+margin,wy],
    [wx-margin,wy],
    [wx,wy+margin],
    [wx,wy-margin]
  ];

  for(const [px,py] of points){
    const c=Math.floor(px/TILE);
    const r=Math.floor(py/TILE);

    if(r<0 || r>=WH || c<0 || c>=WW) return false;

    if(SOLID.has(world[r][c].t)){
      return false;
    }
  }

  return true;
}

function updateDog(dt){
  if(inHouse) return;

  const targetX = player.x - 34;
  const targetY = player.y + 28;

  const dx = targetX - dog.x;
  if(dx < -0.1){
    dog.dir='left';
  }

  if(dx > 0.1){
    dog.dir='right';
  }
  const dy = targetY - dog.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  

  dog.isWalking = dist > 3;

  if(dist > 4){
    dog.x += dx/dist * 2.8 * dt * 60;
    dog.y += dy/dist * 2.8 * dt * 60;
  }

  dog.barkCd = Math.max(0, dog.barkCd - dt);
  dog.atkCd = Math.max(0, dog.atkCd - dt);

  let nearest = null;
  let nearestD = 120;

  for(const e of enemies){
    const d = Math.sqrt((e.x-dog.x)**2 + (e.y-dog.y)**2);
    if(d < nearestD){
      nearest = e;
      nearestD = d;
    }
  }

  if(nearest){
    if(dog.barkCd <= 0){
      dogBark.currentTime = 0;
      dogBark.volume = 0.45;
      dogBark.play().catch(()=>{});
      dog.barkCd = 2.5;
      showMsg('Au au! Zumbi por perto!');
    }

    if(nearestD > 35){
      const dx = nearest.x - dog.x;
      const dy = nearest.y - dog.y;
      if(dx < -0.1){
        dog.dir='left';
      }

      if(dx > 0.1){
        dog.dir='right';
      }
      dog.x += dx/nearestD * 3.2 * dt * 60;
      dog.y += dy/nearestD * 3.2 * dt * 60;
    }

    if(nearestD < 42 && dog.atkCd <= 0){
      nearest.hp -= 1;
      dog.atkCd = 1.2;
      spawnP(nearest.x, nearest.y, '🐾', 22);

      if(nearest.hp <= 0){
        const idx = enemies.indexOf(nearest);
        if(idx >= 0) enemies.splice(idx,1);
        spawnP(nearest.x, nearest.y, '💀', 24);
      }
    }
  }
}

function isWalkableCell(r,c){
  if(r<0 || r>=WH || c<0 || c>=WW) return false;
  return !SOLID.has(world[r][c].t);
}

function findNextStep(sr,sc,tr,tc){
  const q=[[sr,sc]];
  const visited=new Set([sr+','+sc]);
  const parent={};

  const dirs=[
    [1,0],[-1,0],[0,1],[0,-1]
  ];

  while(q.length){
    const [r,c]=q.shift();

    if(r===tr && c===tc){
      let cur=tr+','+tc;
      let prev=null;

      while(parent[cur]){
        prev=cur;
        cur=parent[cur];
      }

      if(!prev) return null;

      return prev.split(',').map(Number);
    }

    for(const [dr,dc] of dirs){
      const nr=r+dr;
      const nc=c+dc;
      const key=nr+','+nc;

      if(visited.has(key)) continue;
      if(!isWalkableCell(nr,nc)) continue;

      visited.add(key);
      parent[key]=r+','+c;
      q.push([nr,nc]);
    }
  }

  return null;
}

function updateEnemies(dt){
  if(phase!=='night')return;

  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];

    e.atkT=(e.atkT||0)+dt;

    if(e.actionTimer>0){
      e.actionTimer--;
    }else{
      e.action='';
    }

    const dx=player.x-e.x;
    const dy=player.y-e.y;

    if(dx < -0.1){
      e.dir='left';
    }

    if(dx > 0.1){
      e.dir='right';
    }

    const dist=Math.sqrt(dx*dx+dy*dy);

    if(!inHouse && dist<TILE*.85){
      if(e.atkT>1.2){
        e.action='attack';
        e.actionTimer=18;

        hp=Math.max(0,hp-1);
        player.action='hurt';
        player.actionTimer=18;
        showMsg('-1 HP! Inimigo atacou!');
        e.atkT=0;

        if(hp<=0){
          triggerGameOver();
          return;
        }

        updateHUD();
      }

      continue;
    }

    let hitS=false;

    outer:
    for(let r=0;r<WH;r++){
      for(let c=0;c<WW;c++){
        if(world[r][c].t!==TWR)continue;

        const tx2=c*TILE+TILE/2;
        const ty2=r*TILE+TILE/2;

        if(Math.sqrt((e.x-tx2)**2+(e.y-ty2)**2)<TILE*1.2){
          if(e.atkT>1.5){
            e.action='attack';
            e.actionTimer=18;

            world[r][c].hp=Math.max(0,(world[r][c].hp||0)-1);
            e.atkT=0;

            spawnP(tx2,ty2,'💥',18);

            if(world[r][c].hp<=0){
              world[r][c]={t:G};
              showMsg('Estrutura destruida!');
            }
          }

          hitS=true;
          break outer;
        }
      }
    }
    if(!hitS){
      const er=Math.floor(e.y/TILE);
      const ec=Math.floor(e.x/TILE);

      const pr=Math.floor(player.y/TILE);
      const pc=Math.floor(player.x/TILE);

      const next=findNextStep(er,ec,pr,pc);

      if(next){
        const [nr,nc]=next;

        const targetX=nc*TILE+TILE/2;
        const targetY=nr*TILE+TILE/2;

        const mdx=targetX-e.x;
        const mdy=targetY-e.y;
        if(mdx < -0.1)e.dir='left';
        if(mdx > 0.1)e.dir='right';
        const mdist=Math.sqrt(mdx*mdx+mdy*mdy);

        if(mdist>1){
          const speed=e.spd*dt*60;

          const nx=e.x+(mdx/mdist)*speed;
          const ny=e.y+(mdy/mdist)*speed;

          if(enemyCanMove(nx,ny,8)){
            e.x=nx;
            e.y=ny;
          }
        }
      }
    }
  }
  // towers shoot arrows
  for(let r=0;r<WH;r++)for(let c=0;c<WW;c++){
    if(world[r][c].t!==TWR)continue;
    const cell=world[r][c];cell.st=(cell.st||0)+dt;
    if(cell.st<2)continue;
    const tx2=c*TILE+TILE/2,ty2=r*TILE+TILE/2;
    let target=null,minD=T_RANGE;
    enemies.forEach(e=>{
      const d=Math.sqrt((e.x-tx2)**2+(e.y-ty2)**2);
      if(d<minD){minD=d;target=e;}
    });
    if(target){
      cell.st=0;
      const angle=Math.atan2(target.y-ty2,target.x-tx2);
      arrows.push({x:tx2,y:ty2,angle,vx:Math.cos(angle)*6,vy:Math.sin(angle)*6,life:1.5,target});
    }
  }
  // move arrows
  arrows.forEach((a,i)=>{
    a.x+=a.vx*60/60;a.y+=a.vy*60/60;a.life-=1/60;
    // check hit
    if(a.target&&Math.sqrt((a.x-a.target.x)**2+(a.y-a.target.y)**2)<16){
      a.target.hp -= a.dmg || 1;spawnP(a.target.x,a.target.y,'✨',16);
      a.target.action='hurt';
      a.target.actionTimer=12;
      if(a.target.hp<=0){
        spawnP(a.target.x,a.target.y,'💀',24);
        const idx=enemies.indexOf(a.target);if(idx>=0)enemies.splice(idx,1);
      }
      a.life=-1;
    }
  });
  arrows=arrows.filter(a=>a.life>0);

  // FIX: if all enemies dead during night, start day immediately
  if(phase==='night'&&enemies.length===0&&arrows.length===0){
    showMsg('Todos os inimigos derrotados! Amanhecendo...');
    setTimeout(()=>endNight(),1500);
  }
}

function updateTimer(dt){
  if(!gameRunning)return;
  phaseTimer-=dt;
  const tot=phase==='day'?DAY_DUR:NIGHT_DUR;
  const pct=Math.max(0,phaseTimer/tot)*100;
  const tb=document.getElementById('timer-bar');
  tb.style.width=pct+'%';
  tb.style.background=phase==='day'?'#f5c842':'#7c6aaa';
  if(phaseTimer<=0){phaseTimer=0;if(phase==='day')startNight();else endNight();}
}

function updateSkyCycle(){

  const icon=document.getElementById('sky-icon');
  const arc=document.getElementById('sky-arc');
  if(!icon || !arc)return;

  const w=window.innerWidth;
  const h=260;

  arc.width=w;
  arc.height=h;
  arc.style.width=w+'px';
  arc.style.height=h+'px';

  const c=arc.getContext('2d');
  c.clearRect(0,0,w,h);

  const startX=60;
  const endX=w-60;
  const baseY=230;
  const arcH=190;

  // linha guia
  c.strokeStyle='rgba(255,255,255,0.28)';
  c.lineWidth=2;
  c.setLineDash([8,8]);

  c.beginPath();

  for(let i=0;i<=100;i++){
    const p=i/100;
    const x=startX+(endX-startX)*p;
    const y=baseY-Math.sin(Math.PI*p)*arcH;

    if(i===0)c.moveTo(x,y);
    else c.lineTo(x,y);
  }

  c.stroke();
  c.setLineDash([]);

  let pct;

  if(phase==='day'){
    icon.textContent='☀️';
    pct=1-(phaseTimer/DAY_DUR);
  }else{
    icon.textContent='🌙';
    pct=1-(phaseTimer/NIGHT_DUR);
  }

  const x=startX+(endX-startX)*pct;
  const y=baseY-Math.sin(Math.PI*pct)*arcH;

  icon.style.left=x+'px';
  icon.style.top=y+'px';
}

function updateScythe(dt){
  if(!scythe.on)return;
  scythe.t+=dt;scythe.angle=Math.sin(scythe.t*9)*1.3;
  if(scythe.t>0.45)scythe.on=false;
}

function updateParticles(dt){
  particles.forEach(p=>{p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.life-=dt;});
  particles=particles.filter(p=>p.life>0);
}

// ══════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════
function nearCells(){
  const pc=Math.floor(player.x/TILE);
  const pr=Math.floor(player.y/TILE);

  let tr = pr;
  let tc = pc;

  if(keys['ArrowUp'] || keys['w'] || keys['W']) tr--;
  else if(keys['ArrowDown'] || keys['s'] || keys['S']) tr++;
  else if(keys['ArrowLeft'] || keys['a'] || keys['A']) tc--;
  else if(keys['ArrowRight'] || keys['d'] || keys['D']) tc++;
  else tc++;

  return [[pr,pc],[pr-1,pc],[pr+1,pc],[pr,pc-1],[pr,pc+1]].filter(([r,c])=>r>=0&&r<WH&&c>=0&&c<WW);
}

function actionEnter(cells){
  if(inHouse){
    inHouse=false;
    closeMarket();
    showMsg('Saiu da casa.');
    return;
  }

  for(const [r,c] of cells){
    if(world[r][c].t===HOUSE || world[r][c].t===HDOOR){
      inHouse=true;
      showMsg('Dentro da casa!');
      openMarket();
      return;
    }
  }

  showMsg('Nenhuma casa por perto.');
}

function actionChop(cells){
  for(const [r,c] of cells){
    if(world[r][c].t===TREE){
      if(wood >= MAX_INV){
        showMsg('Estoque de madeira cheio!');
        return;
      }

      player.action='chop';
      player.actionTimer=18;
      scythe.on=true;
      scythe.t=0;
      wood = Math.min(MAX_INV, wood + 2);
      world[r][c]={t:STUMP};
      spawnP(c*TILE+TILE/2,r*TILE+TILE/2,'\u{1F333}',26);
      showMsg('+2 madeira!');
      updateHUD();
      return;
    }

    if(world[r][c].t===STUMP){
      if(wood >= MAX_INV){
        showMsg('Estoque de madeira cheio!');
        return;
      }

      wood = Math.min(MAX_INV, wood + 1);
      world[r][c]={t:G};
      spawnP(c*TILE+TILE/2,r*TILE+TILE/2,'\u{1F333}',20);
      showMsg('+1 madeira (toco)');
      updateHUD();
      return;
    }
  }

  showMsg('Nenhuma árvore perto. Chegue mais perto!');
}

function actionMine(cells){
  for(const [r,c] of cells){
    if(world[r][c].t===ROCK || world[r][c].t===MINE || world[r][c].t===BIGROCK){
      if(stone >= MAX_INV){
        showMsg('Estoque de pedra cheio!');
        return;
      }

      player.action='mine';
      player.actionTimer=18;
      stone = Math.min(MAX_INV, stone + 1);
      world[r][c] = {t:G};
      spawnP(c*TILE+TILE/2,r*TILE+TILE/2,'\u26F0\uFE0F',24);
      showMsg('+1 pedra!');
      updateHUD();
      return;
    }
  }

  showMsg('Nenhuma pedra perto.');
}

function actionWater(cells){
  for(const [r,c] of cells){
    if(world[r][c].t===WATER){
      water = Math.min(MAX_INV, water + 3);
      spawnP(c*TILE+TILE/2,r*TILE+TILE/2,'\u{1F535}',22);
      showMsg('+3 água coletada!');
      updateHUD();
      return;
    }
  }

  showMsg('Nenhuma água perto.');
}

function actionPlant(cells){
  for(const [r,c] of cells){
    const t=world[r][c].t;

    if(!isFarmArea(r,c)){
      showMsg('Só pode plantar dentro da área cercada.');
      return;
    }

    if(t===G || t===DIRT){
      if(food<=0){
        showMsg('Sem sementes/comida para plantar!');
        return;
      }

      food--;
      world[r][c]={t:CS,pd:day};
      growTimers[r+','+c]=2;
      showMsg('Plantou! Pronto em 2 dias.');
      updateHUD();
      return;
    }
  }

  showMsg('Nenhum espaço livre na plantação.');
}

function actionHarvest(cells){
  for(const [r,c] of cells){
    if(world[r][c].t===CR){
      scythe.on=true;
      scythe.t=0;
      player.action='attack';
      player.actionTimer=18;

      const bonus=(world[r][c].pd!=null&&(day-world[r][c].pd)>=4)?2:1;
      food = Math.min(MAX_INV, food + (3 * bonus));
      world[r][c]={t:DIRT};
      spawnP(c*TILE+TILE/2,r*TILE+TILE/2,'\u{1F33D}',28);
      showMsg(bonus>1?`+${3*bonus} comida (bonus por esperar!)`:'+3 comida colhida!');
      updateHUD();
      return;
    }

    if(world[r][c].t===CM){
      showMsg('Quase pronto! Mais 1 dia.');
      return;
    }

    if(world[r][c].t===CS){
      showMsg('Ainda crescendo...');
      return;
    }
  }

  showMsg('Nenhuma plantação pronta perto.');
}

function actionEat(){
  if(food<=0){
    showMsg('Sem comida!');
    return;
  }

  if(hp>=MAX_HP){
    showMsg('HP ja cheio!');
    return;
  }

  food--;
  hp=Math.min(MAX_HP,hp+2);
  spawnP(player.x,player.y,'\u2764',22);
  showMsg(`+2 HP! (${Math.ceil(hp)}/${MAX_HP})`);
  updateHUD();
}

function actionDrink(){
  if(water<=0){
    showMsg('Sem água!');
    return;
  }

  if(stamina>=MAX_ST){
    showMsg('Força já cheia!');
    return;
  }

  water--;
  stamina=Math.min(MAX_ST,stamina+2);
  spawnP(player.x,player.y,'\u{1F535}',22);
  showMsg(`+2 Força! (${Math.ceil(stamina)}/${MAX_ST})`);
  updateHUD();
}

function findEnemyTarget(){
  let target=null;
  let minD=PLAYER_RANGE;

  for(const e of enemies){
    const d=Math.sqrt((e.x-player.x)**2+(e.y-player.y)**2);
    if(d<minD){
      minD=d;
      target=e;
    }
  }

  return target;
}

function actionAttack(){
  if(stone<=0){
    showMsg('Sem pedras para atacar!');
    return;
  }

  if(player.atkCd>0){
    showMsg('Aguarde cooldown...');
    return;
  }

  const target=findEnemyTarget();

  if(!target){
    showMsg('Nenhum inimigo no alcance.');
    return;
  }

  stone--;
  player.atkCd=0.7;
  player.action='attack';
  player.actionTimer=18;

  const angle=Math.atan2(target.y-player.y,target.x-player.x);

  arrows.push({
    x:player.x,
    y:player.y,
    angle,
    vx:Math.cos(angle)*8,
    vy:Math.sin(angle)*8,
    life:1.2,
    target,
    type:'stone',
    dmg:2
  });

  spawnP(player.x,player.y,'\u{1FAA8}',18);
  showMsg('Pedra arremessada!');
  updateHUD();
}

function actionTower(){
  if(player.isWalking || joy.on){
    showMsg('Pare para construir a torre.');
    return;
  }

  const pc=Math.floor(player.x/TILE);
  const pr=Math.floor(player.y/TILE);
  const options=[
    [pr-2, pc],
    [pr, pc+2],
    [pr+2, pc],
    [pr, pc-2]
  ];

  let spot=null;

  for(const [r,c] of options){
    if(r<0 || r>=WH || c<0 || c>=WW) continue;
    if(world[r][c].t!==G) continue;
    if(isFixed(r,c)) continue;

    spot=[r,c];
    break;
  }

  if(!spot){
    showMsg('Nenhum bloco livre a 1 espaço de distância.');
    return;
  }

  if(wood<3 || stone<1){
    showMsg(`Precisa 3 madeira e 1 pedra. Você tem: ${wood}m ${stone}p`);
    return;
  }

  const [r,c]=spot;
  wood-=3;
  stone-=1;
  world[r][c]={t:TWR,hp:T_HP,st:0};
  showMsg('Torre construída!');
  updateHUD();
}

function runAction(act, cells){
  if(act==='enter')return actionEnter(cells);
  if(act==='chop')return actionChop(cells);
  if(act==='mine')return actionMine(cells);
  if(act==='water')return actionWater(cells);
  if(act==='plant')return actionPlant(cells);
  if(act==='harvest')return actionHarvest(cells);
  if(act==='eat')return actionEat();
  if(act==='drink')return actionDrink();
  if(act==='attack')return actionAttack();
  if(act==='tower')return actionTower();
}

window.doAction=function(act){
  const cells=nearCells();
  return runAction(act, cells);
};

window.goSleep=function(){
  if(phase==='night'){showMsg('Já é noite! Sobreviva!');return;}
  startNight();
};

let nightStarted=false;
function startNight(){
  if(phase==='night')return;
  phase='night';nightStarted=true;
  phaseTimer=NIGHT_DUR;
  syncPhaseUI();
  const count=day;
  showMsg(`Noite ${day}! ${count} inimigo(s) aparecem!`);
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const dist=350+Math.random()*180;
    const strong=day>5&&Math.random()<0.4;
    enemies.push({
      x:player.x+Math.cos(angle)*dist,
      y:player.y+Math.sin(angle)*dist,
      hp:strong?3:2,
      mhp:strong?3:2,
      spd:(strong?1.1:0.8)+day*0.05,
      strong,
      atkT:0,
      dir:'right'
    });
  }
  window.saveGame();
}

let endingNight=false;
function endNight(){
  if(phase==='day'||endingNight)return;
  endingNight=true;
  phase='day';day++;phaseTimer=DAY_DUR;
  arrows=[];
  food=Math.max(0,food-1);water=Math.max(0,water-1);
  stamina=Math.min(MAX_ST,stamina+4);
  if(food===0){hp=Math.max(0,hp-2);showMsg('Sem comida! -2 HP.');}
  else if(water===0){hp=Math.max(0,hp-1);showMsg('Sem água! -1 HP.');}
  else{hp=Math.min(MAX_HP,hp+2);showMsg('Dia '+day+'! +2 HP de descanso.');}
  updateGrow();

  // ovos das galinhas
  eggs = Math.min(MAX_INV, eggs + chickens.length);
  milk = Math.min(MAX_INV, milk + cows.length);

  showMsg('Produção diária: +' + chickens.length + ' ovo(s) e +' + cows.length + ' leite(s)!');

  if(day%5===0){
    let n=0;
    for(let r=0;r<WH;r++)for(let c=0;c<WW;c++){if(world[r][c].t===TWR){world[r][c].hp=Math.max(0,(world[r][c].hp||0)-2);if(world[r][c].hp<=0){world[r][c]={t:G};n++;}}}
    if(n)showMsg(n+' torre(s) precisam de reparo!');
  }
  if(day%10===0){respawn();showMsg('Recursos renasceram!');}
  syncPhaseUI();updateHUD();
  setTimeout(()=>{endingNight=false;},2000);
  window.saveGame();
}

function syncPhaseUI(){
  const b=document.getElementById('h-phase');
  if(phase==='day'){b.textContent='Dia';b.className='badge';}
  else{b.textContent='Noite';b.className='badge night';}
}

function updateGrow(){
  for(const key in growTimers){
    growTimers[key]--;
    const[r,c]=key.split(',').map(Number);
    if(world[r]?.[c]?.t===CS)world[r][c].t=CM;
    else if(world[r]?.[c]?.t===CM)world[r][c].t=CR;
    if(growTimers[key]<=0)delete growTimers[key];
  }
}

function triggerGameOver(){
  gameRunning=false;
  document.getElementById('go-msg').textContent=`Dia ${day} - Sobreviveu ${day-1} noite(s)`;
  document.getElementById('gameover').style.display='flex';
}

window.restartGame=function(){
  document.getElementById('gameover').style.display='none';
  endingNight=false;
  generateWorld();gameRunning=true;updateHUD();syncPhaseUI();window.saveGame();
};

function updateHUD(){
  document.getElementById('h-food').textContent=food;
  document.getElementById('h-water').textContent=water;
  document.getElementById('h-wood').textContent=wood;
  document.getElementById('h-stone').textContent=stone;

  document.getElementById('h-money').textContent=money;
  document.getElementById('h-eggs').textContent=eggs;
  document.getElementById('h-milk').textContent=milk;

  document.getElementById('h-day').textContent='Dia '+day;

  document.getElementById('hp-fill').style.width=(hp/MAX_HP*100)+'%';
  document.getElementById('st-fill').style.width=(stamina/MAX_ST*100)+'%';

  document.getElementById('hp-txt').textContent=Math.ceil(hp)+'/'+MAX_HP;
  document.getElementById('st-txt').textContent=Math.ceil(stamina)+'/'+MAX_ST;
}

let msgT;
function showMsg(txt){
  const el=document.getElementById('msg-bar');el.textContent=txt;el.style.display='block';
  clearTimeout(msgT);msgT=setTimeout(()=>el.style.display='none',2800);
}
function spawnP(x,y,em,sz=22){
  particles.push({x,y,em,sz,vx:(Math.random()-.5)*1.5,vy:-2,life:0.9,ml:0.9});
}
function updateMusic(){

  if(!musicDay || !musicNight) return;

  if(phase==='day'){

    if(currentMusic!=='day'){

      musicNight.pause();
      musicNight.currentTime = 0;

      musicDay.volume = 0.35;
      musicDay.play().catch(e=>{
        console.log('Musica do dia bloqueada:', e);
      });

      currentMusic='day';
    }

  } else {

    if(currentMusic!=='night'){

      musicDay.pause();
      musicDay.currentTime = 0;

      musicNight.volume = 0.25;
      musicNight.play().catch(e=>{
        console.log('Musica da noite bloqueada:', e);
      });

      currentMusic='night';
    }
  }
}

// ══════════════════════════════════════
// GAME LOOP
// ══════════════════════════════════════
let lastT=0;
let loopStarted=false;

function startLoop(){
  if(loopStarted)return;
  loopStarted=true;
  requestAnimationFrame(ts=>{lastT=ts;loop(ts);});
}

function loop(ts){
  const dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;
  if(gameRunning){
    updatePlayer(dt);
    updateDog(dt);
    updateChickens(dt);
    updateCows();
    updateCamera();
    updateEnemies(dt);
    updateDucks();
    updateMusic();
    updateParticles(dt);updateTimer(dt);updateSkyCycle();updateScythe(dt);
    if(ts-lastAutoSave>60000){lastAutoSave=ts;window.saveGame();}
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawWorld();
  drawDucks();
  drawChickens();
  drawCows();
  if(!inHouse){drawDog();drawPlayer();drawScytheSwing();drawEnemies();drawArrows();}
  drawNight();drawParticles();
  if(inHouse)drawHouseScreen();
  requestAnimationFrame(loop);
}

function startGame(){
  gameRunning=true;
  generateWorld();

  resize();

  startLoop();

  if(!window.controlsReady){
    setupControls({
      doAction: window.doAction,
      handleHouseMarket,
      isInHouse: ()=>inHouse,
      joy,
      keys,
      setRunHeld: value=>{runHeld=value;}
    });
    window.controlsReady = true;
  }

  setTimeout(positionFloatingControls,200);
}

function handleHouseMarket(key){

  // vender
  if(key==='1' && wood>0){ wood--; money+=1; showMsg('Vendeu 1 madeira por 1 moeda.'); updateHUD(); return; }
  if(key==='2' && stone>0){ stone--; money+=1; showMsg('Vendeu 1 pedra por 1 moeda.'); updateHUD(); return; }
  if(key==='3' && food>0){ food--; money+=1; showMsg('Vendeu 1 comida por 1 moeda.'); updateHUD(); return; }
  if(key==='4' && water>0){ water--; money+=1; showMsg('Vendeu 1 água por 1 moeda.'); updateHUD(); return; }
  if(key==='5' && eggs>0){ eggs--; money+=5; showMsg('Vendeu 1 ovo por 5 moedas.'); updateHUD(); return; }
  if(key==='6' && milk>0){ milk--; money+=10; showMsg('Vendeu 1 leite por 10 moedas.'); updateHUD(); return; }

  // comprar recursos
  if(key==='q' || key==='Q'){
    if(money<1 || wood>=MAX_INV)return;
    money--; wood++;
    showMsg('Comprou 1 madeira.');
    updateHUD();
    return;
  }

  if(key==='w' || key==='W'){
    if(money<1 || stone>=MAX_INV)return;
    money--; stone++;
    showMsg('Comprou 1 pedra.');
    updateHUD();
    return;
  }

  if(key==='e' || key==='E'){
    if(money<1 || food>=MAX_INV)return;
    money--; food++;
    showMsg('Comprou 1 comida.');
    updateHUD();
    return;
  }

  if(key==='r' || key==='R'){
    if(money<1 || water>=MAX_INV)return;
    money--; water++;
    showMsg('Comprou 1 água.');
    updateHUD();
    return;
  }

  // comprar galinha
  if(key==='g' || key==='G'){
    if(money<15){
      showMsg('Moedas insuficientes para comprar galinha.');
      return;
    }

    if(chickens.length>=20){
      showMsg('Limite máximo de 20 galinhas.');
      return;
    }

    money-=15;
    addChicken();
    showMsg('Comprou 1 galinha!');
    updateHUD();
    return;
  }

  // comprar vaca
  if(key==='v' || key==='V'){
    if(money<30){
      showMsg('Moedas insuficientes para comprar vaca.');
      return;
    }

    if(cows.length>=10){
      showMsg('Limite máximo de 10 vacas.');
      return;
    }

    money-=30;
    addCow();
    showMsg('Comprou 1 vaca!');
    updateHUD();
    return;
  }
}

const MARKET_ITEMS = [
  {id:'wood', label:'🪵 Madeira', category:'Recursos', priceBuy:1, priceSell:1, max:MAX_INV},
  {id:'stone', label:'🪨 Pedra', category:'Recursos', priceBuy:1, priceSell:1, max:MAX_INV},
  {id:'food', label:'🌽 Comida', category:'Recursos', priceBuy:1, priceSell:1, max:MAX_INV},
  {id:'water', label:'💧 Água', category:'Recursos', priceBuy:1, priceSell:1, max:MAX_INV},
  {id:'eggs', label:'🥚 Ovo', category:'Produção', priceBuy:null, priceSell:5, max:MAX_INV},
  {id:'milk', label:'🥛 Leite', category:'Produção', priceBuy:null, priceSell:10, max:MAX_INV},
  {id:'chicken', label:'🐔 Galinha', category:'Animais', priceBuy:15, priceSell:null, max:20},
  {id:'cow', label:'🐄 Vaca', category:'Animais', priceBuy:30, priceSell:null, max:10}
];

function getItemValue(id){
  if(id==='wood')return wood;
  if(id==='stone')return stone;
  if(id==='food')return food;
  if(id==='water')return water;
  if(id==='eggs')return eggs;
  if(id==='milk')return milk;
  if(id==='chicken')return chickens.length;
  if(id==='cow')return cows.length;
  return 0;
}

function setItemValue(id,val){
  if(id==='wood')wood=val;
  if(id==='stone')stone=val;
  if(id==='food')food=val;
  if(id==='water')water=val;
  if(id==='eggs')eggs=val;
  if(id==='milk')milk=val;
}

function getMarketQty(id){
  return Math.max(1,parseInt(document.getElementById('qty-'+id)?.value)||1);
}

function updateMarketTotal(id){
  const item=MARKET_ITEMS.find(i=>i.id===id);
  const el=document.getElementById('total-'+id);
  if(!item || !el)return;

  const qtd=getMarketQty(id);
  const buyTotal=item.priceBuy!=null ? item.priceBuy*qtd : null;
  const sellTotal=item.priceSell!=null ? item.priceSell*qtd : null;
  const parts=[];

  if(buyTotal!=null)parts.push(`Comprar: 🪙 ${buyTotal}`);
  if(sellTotal!=null)parts.push(`Vender: 🪙 ${sellTotal}`);

  el.textContent=parts.join(' | ');
}

window.updateMarketTotal=updateMarketTotal;

window.marketQty=function(id,delta){
  const input=document.getElementById('qty-'+id);
  if(!input)return;

  const current=getMarketQty(id);
  input.value=Math.max(1,current+delta);
  updateMarketTotal(id);
};

function openMarket(){
  const menu=document.getElementById('market-menu');
  const list=document.getElementById('market-list');

  document.getElementById('market-money').textContent=money;
  list.innerHTML='';

  let currentCategory='';

  MARKET_ITEMS.forEach(item=>{
    if(item.category!==currentCategory){
      currentCategory=item.category;

      const title=document.createElement('div');
      title.className='market-category';
      title.textContent=currentCategory;
      list.appendChild(title);
    }

    const row=document.createElement('div');
    row.className='market-row';

    const current=getItemValue(item.id);

    row.innerHTML=`
      <div class="market-item-info">
        <b>${item.label}</b>
        <small>Você tem: ${current}${item.max ? ' / '+item.max : ''}</small>
        <small>
          ${item.priceBuy!=null ? 'Compra un.: 🪙 '+item.priceBuy : ''}
          ${item.priceBuy!=null && item.priceSell!=null ? ' | ' : ''}
          ${item.priceSell!=null ? 'Venda un.: 🪙 '+item.priceSell : ''}
        </small>
      </div>

      <div class="qty-control">
        <button type="button" onclick="marketQty('${item.id}',-1)">−</button>
        <input id="qty-${item.id}" type="number" min="1" value="1" oninput="updateMarketTotal('${item.id}')">
        <button type="button" onclick="marketQty('${item.id}',1)">+</button>
      </div>

      <div class="market-total" id="total-${item.id}"></div>

      <div class="market-actions">
        <button class="buy-btn" ${item.priceBuy==null?'disabled':''} onclick="marketBuy('${item.id}')">
          Comprar
        </button>

        <button class="sell-btn" ${item.priceSell==null?'disabled':''} onclick="marketSell('${item.id}')">
          Vender
        </button>
      </div>
    `;

    list.appendChild(row);
    updateMarketTotal(item.id);
  });

  menu.style.display='flex';
}

function closeMarket(){
  document.getElementById('market-menu').style.display='none';
}

window.marketBuy=function(id){
  const item=MARKET_ITEMS.find(i=>i.id===id);
  const qtd=getMarketQty(id);

  if(item.priceBuy==null)return;

  const total=item.priceBuy*qtd;

  if(money<total){
    showMsg('Moedas insuficientes.');
    return;
  }

  if(id==='chicken'){
    if(chickens.length+qtd>20){showMsg('Limite máximo de 20 galinhas.');return;}
    money-=total;
    for(let i=0;i<qtd;i++)addChicken();
  }else if(id==='cow'){
    if(cows.length+qtd>10){showMsg('Limite máximo de 10 vacas.');return;}
    money-=total;
    for(let i=0;i<qtd;i++)addCow();
  }else{
    const atual=getItemValue(id);
    if(atual+qtd>MAX_INV){showMsg('Estoque máximo é '+MAX_INV+'.');return;}
    money-=total;
    setItemValue(id,atual+qtd);
  }

  updateHUD();
  openMarket();
};

window.marketSell=function(id){
  const item=MARKET_ITEMS.find(i=>i.id===id);
  const qtd=getMarketQty(id);

  if(item.priceSell==null)return;

  const atual=getItemValue(id);

  if(atual<qtd){
    showMsg('Você não tem quantidade suficiente.');
    return;
  }

  setItemValue(id,atual-qtd);
  money+=item.priceSell*qtd;

  updateHUD();
  openMarket();
};

// ══════════════════════════════════════
// CONTROLS
// ══════════════════════════════════════
// ══════════════════════════════════════
// CUSTOMIZATION
// ══════════════════════════════════════
window.openCustomMenu=function(){gameRunning=false;document.getElementById('custom-menu').style.display='flex';buildCustomMenu();};
window.closeCustomMenu=function(){document.getElementById('custom-menu').style.display='none';try{localStorage.setItem('hdc_ap',JSON.stringify(APPEARANCE));}catch(e){}gameRunning=true;};
try{const s=localStorage.getItem('hdc_ap');if(s)Object.assign(APPEARANCE,JSON.parse(s));}catch(e){}

function buildCustomMenu(){
  const grid=document.getElementById('base-grid');grid.innerHTML='';
  BASES.forEach((b,i)=>{
    const div=document.createElement('div');div.className='base-opt'+(APPEARANCE.base===i?' sel':'');
    div.onclick=()=>{APPEARANCE.base=i;document.querySelectorAll('.base-opt').forEach(el=>el.classList.remove('sel'));div.classList.add('sel');refreshP();};
    const cv=document.createElement('canvas');cv.width=60;cv.height=72;drawMini(cv,30,50,18,{...APPEARANCE,base:i});
    div.appendChild(cv);const lbl=document.createElement('span');lbl.textContent=b.n;div.appendChild(lbl);grid.appendChild(div);
  });
  mkCR('skin-row',SKC,'skin');mkCR('shirt-row',SHC,'shirt');mkCR('hat-row',HAC,'hat');mkCR('hair-row',HRC,'hair');
  updatePreview();
}
function mkCR(id,colors,prop){
  const row=document.getElementById(id);row.innerHTML='';
  colors.forEach(c=>{const sw=document.createElement('div');sw.className='cs'+(APPEARANCE[prop]===c?' sel':'');sw.style.background=c;sw.onclick=()=>{APPEARANCE[prop]=c;row.querySelectorAll('.cs').forEach(el=>el.classList.remove('sel'));sw.classList.add('sel');refreshP();};row.appendChild(sw);});
}
function refreshP(){document.querySelectorAll('.base-opt canvas').forEach((cv,i)=>drawMini(cv,30,50,18,{...APPEARANCE,base:i}));updatePreview();}
function drawMini(cv,cx,cy,s,ap){const c2=cv.getContext('2d');c2.clearRect(0,0,cv.width,cv.height);drawChar(cx,cy,s,ap,c2);}
function updatePreview(){
  const cv=document.getElementById('preview-canvas'),c2=cv.getContext('2d');
  c2.clearRect(0,0,100,120);c2.fillStyle='#1a3a1a';c2.fillRect(0,0,100,120);
  c2.fillStyle='#3a7a2a';c2.fillRect(0,82,100,38);
  drawMini(cv,50,74,22,APPEARANCE);
  c2.fillStyle='#f5c842';c2.font='bold 10px sans-serif';c2.textAlign='center';c2.fillText(BASES[APPEARANCE.base].n,50,112);
}
window.closeIntro = function(){
  document.getElementById('intro-screen').style.display='none';

  currentMusic = '';

  musicDay.muted = false;
  musicNight.muted = false;

  updateMusic();
}
window.logoutGame = async function(){
  await window.saveGame();

  gameRunning = false;

  document.getElementById('hud').style.display='none';
  document.getElementById('action-panel').style.display='none';
  document.getElementById('joystick-zone').style.display='none';
  document.getElementById('attack-btn').style.display='none';
  document.getElementById('auth-screen').style.display='flex';

  await logoutFirebase();
}
