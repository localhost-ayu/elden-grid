// Aconteça o que acontecer, o terminal do jogador volta ao normal.
import fs from 'node:fs';

//   ?1049h/l  tela alternativa: o jogo não suja o histórico do terminal
//   ?25l/h    cursor oculto: evita o cursor "passeando" durante o desenho
//   ?7l/h     sem quebra automática: escrever na última coluna nunca rola a tela
const ENTER = '\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J';
const LEAVE = '\x1b[0m\x1b[?7h\x1b[?25h\x1b[?1049l';

let active = false;

export const isInteractive = () => !!(process.stdin.isTTY && process.stdout.isTTY);

// Alguns pipes/CI não informam o tamanho.
export const size = () => ({ cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 });

// Escrita síncrona: no Windows a escrita em TTY é assíncrona, e um process.exit() logo
// em seguida poderia descartar o quadro (ou, pior, a sequência de restauração).
export function write(s) {
  if (s) fs.writeSync(process.stdout.fd, s);
}

export function enter() {
  write(ENTER);
  // Em raw mode Ctrl+C deixa de gerar SIGINT e vira o byte \x03 (tratado pelo input.js).
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8'); // decodifica UTF-8 mesmo se um caractere vier partido
  process.stdin.resume();
  active = true;
}

// Idempotente: pode ser chamada por q, sinal, exceção e 'exit' sem efeito colateral.
export function restore() {
  if (!active) return;
  active = false;
  try { process.stdin.setRawMode(false); } catch {}
  process.stdin.pause();
  try { write(LEAVE); } catch {}
}

// OSC 52: pede ao terminal para copiar o texto. Quem não suporta ignora a sequência em
// silêncio, então não há como saber se deu certo: retorna só se foi enviado.
export function copy(text) {
  if (!active) return false;
  write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`);
  return true;
}

export function onResize(cb) {
  process.stdout.on('resize', cb);
}

// `onQuit` é a saída "educada" (salvar e sair); `onCrash` roda antes de reportar um
// erro fatal.
export function guard({ onQuit, onCrash }) {
  // SIGINT só chega se alguém mandar o sinal de fora (kill), pois em raw mode Ctrl+C
  // vira tecla. SIGHUP = janela do terminal fechada.
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, onQuit);
  // Última linha de defesa: qualquer process.exit() passa por aqui.
  process.on('exit', restore);
  const fatal = (err) => {
    restore(); // primeiro o terminal, para a mensagem de erro ficar legível
    try { onCrash?.(err); } catch {}
    process.stderr.write(`\nElden Grid encontrou um erro e foi encerrado (terminal restaurado).\n${err?.stack ?? err}\n`);
    process.exit(1);
  };
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
}
