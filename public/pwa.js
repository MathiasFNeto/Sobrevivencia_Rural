if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./service-worker.js')
      .then(()=>console.log('Service Worker registrado'))
      .catch(err=>console.log('Erro SW:',err));
  });
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();

  deferredPrompt = e;

  const btn = document.getElementById('install-btn');

  if(btn){
    btn.style.display = 'block';
  }
});

document.getElementById('install-btn')?.addEventListener('click', async () => {
  if(!deferredPrompt) return;

  deferredPrompt.prompt();

  await deferredPrompt.userChoice;

  deferredPrompt = null;

  document.getElementById('install-btn').style.display='none';
});
