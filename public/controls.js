export function setupControls({
  doAction,
  handleHouseMarket,
  isInHouse,
  joy,
  keys,
  setRunHeld
}){
  const gameKeys = new Set([
    ' ',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Shift',
    'w',
    'W',
    'a',
    'A',
    's',
    'S',
    'd',
    'D',
    'e',
    'E'
  ]);

  function resetMovement(){
    Object.keys(keys).forEach(key=>{
      keys[key]=false;
    });

    setRunHeld(false);
    joy.on=false;
    joy.dx=0;
    joy.dy=0;
    joy.id=null;

    const jthumb=document.getElementById('joystick-thumb');
    if(jthumb){
      jthumb.style.transform='translate(-50%,-50%)';
    }
  }

  function clearVerticalKeys(){
    keys['ArrowUp']=false;
    keys['ArrowDown']=false;
    keys['w']=false;
    keys['W']=false;
    keys['s']=false;
    keys['S']=false;
  }

  function clearHorizontalKeys(){
    keys['ArrowLeft']=false;
    keys['ArrowRight']=false;
    keys['a']=false;
    keys['A']=false;
    keys['d']=false;
    keys['D']=false;
  }

  function isUpKey(key){
    return key==='ArrowUp' || key==='w' || key==='W';
  }

  function isDownKey(key){
    return key==='ArrowDown' || key==='s' || key==='S';
  }

  function isLeftKey(key){
    return key==='ArrowLeft' || key==='a' || key==='A';
  }

  function isRightKey(key){
    return key==='ArrowRight' || key==='d' || key==='D';
  }

  window.addEventListener('keydown',e=>{
    if(gameKeys.has(e.key)){
      e.preventDefault();
    }

    if(isInHouse()){
      handleHouseMarket(e.key);
    }

    if(isUpKey(e.key)){
      keys['ArrowDown']=false;
      keys['s']=false;
      keys['S']=false;
    }

    if(isDownKey(e.key)){
      keys['ArrowUp']=false;
      keys['w']=false;
      keys['W']=false;
    }

    if(isLeftKey(e.key)){
      keys['ArrowRight']=false;
      keys['d']=false;
      keys['D']=false;
    }

    if(isRightKey(e.key)){
      keys['ArrowLeft']=false;
      keys['a']=false;
      keys['A']=false;
    }

    keys[e.key]=true;

    if(e.key===' ')setRunHeld(true);
    if(e.key==='e'||e.key==='E')doAction('chop');
  });

  window.addEventListener('keyup',e=>{
    if(gameKeys.has(e.key)){
      e.preventDefault();
    }

    keys[e.key]=false;

    if(e.key===' ' || e.key==='Shift'){
      setRunHeld(false);
      clearVerticalKeys();
      clearHorizontalKeys();
    }
  });

  window.addEventListener('blur',resetMovement);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)resetMovement();
  });

  const jbase=document.getElementById('joystick-base');
  const jthumb=document.getElementById('joystick-thumb');
  const maxR=28;

  document.getElementById('joystick-zone').addEventListener('touchstart',e=>{
    e.preventDefault();

    const touch=e.changedTouches[0];
    const rect=jbase.getBoundingClientRect();
    joy.sx=rect.left+rect.width/2;
    joy.sy=rect.top+rect.height/2;
    joy.on=true;
    joy.id=touch.identifier;
  },{passive:false});

  window.addEventListener('touchmove',e=>{
    if(!joy.on)return;

    e.preventDefault();

    const t=[...e.touches].find(touch=>touch.identifier===joy.id);
    if(!t)return;

    let dx=t.clientX-joy.sx;
    let dy=t.clientY-joy.sy;
    const dd=Math.sqrt(dx*dx+dy*dy);

    if(dd>maxR){
      dx=dx/dd*maxR;
      dy=dy/dd*maxR;
    }

    joy.dx=dx/maxR;
    joy.dy=dy/maxR;
    jthumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  },{passive:false});

  function endJoystickTouch(e){
    const joystickEnded=[...e.changedTouches].some(touch=>touch.identifier===joy.id);
    if(!joystickEnded)return;

    joy.on=false;
    joy.dx=0;
    joy.dy=0;
    joy.id=null;
    jthumb.style.transform='translate(-50%,-50%)';
  }

  window.addEventListener('touchend',endJoystickTouch);
  window.addEventListener('touchcancel',endJoystickTouch);

  const rb=document.getElementById('btn-run');
  rb.addEventListener('mousedown',()=>setRunHeld(true));
  rb.addEventListener('mouseup',()=>setRunHeld(false));
  rb.addEventListener('mouseleave',()=>setRunHeld(false));
  rb.addEventListener('touchstart',()=>setRunHeld(true),{passive:true});
  rb.addEventListener('touchend',()=>setRunHeld(false));
  rb.addEventListener('touchcancel',()=>setRunHeld(false));
}
