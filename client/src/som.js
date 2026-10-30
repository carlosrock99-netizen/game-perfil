// Aviso sonoro curto e vibração para quando chega a sua vez. Sem arquivos de
// áudio: um oscilador simples do WebAudio. Falha em silêncio se o navegador
// não deixar (sem interação do usuário, sem alto-falante etc.).

let ctx = null;

export function tocarAviso() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx ||= new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    const t = ctx.currentTime;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.start(t);
    osc.stop(t + 0.34);
  } catch {
    /* sem áudio disponível */
  }
}

export function vibrar(ms = 220) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem vibração disponível */
  }
}
