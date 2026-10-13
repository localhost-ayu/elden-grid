// Limpar + reescrever a tela a cada quadro faz o terminal mostrar, por um instante, a
// tela vazia ou meio desenhada (o "pisca"). Aqui as linhas viram uma grade de células
// {ch, st} e só as células que mudaram são emitidas — também bem menos bytes em SSH/WSL.
// Não escreve no terminal, só devolve a string, para poder ser testado.
import { charWidth } from './format.js';

const SGR_RE = /\x1b\[[0-9;]*m/y;
const RESET = '\x1b[0m';
const BLANK = Object.freeze({ ch: ' ', st: '' });
// Célula de continuação: a metade direita de um caractere largo (⚡, CJK). Nunca é
// desenhada; existe para a grade continuar alinhada em colunas.
const CONT = '';

export function parseLine(line, cols) {
  const cells = [];
  let st = '';
  let i = 0;
  while (i < line.length && cells.length < cols) {
    if (line.charCodeAt(i) === 0x1b) {
      SGR_RE.lastIndex = i;
      const m = SGR_RE.exec(line);
      if (m) {
        // Estilos se acumulam (negrito + verde) até um reset.
        st = m[0] === RESET || m[0] === '\x1b[m' ? '' : st + m[0];
        i += m[0].length;
      } else {
        i++; // escape que não é cor (não deveria vir das telas): ignora
      }
      continue;
    }
    const cp = line.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    i += ch.length;
    if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) continue; // controles quebrariam o layout
    const w = charWidth(cp);
    if (w === 0) {
      // Combinante: gruda no caractere anterior, sem ocupar coluna.
      if (cells.length) cells[cells.length - 1] = { ...cells[cells.length - 1], ch: cells[cells.length - 1].ch + ch };
    } else if (w === 2) {
      if (cells.length + 2 > cols) break; // não cabe meio caractere largo
      cells.push({ ch, st }, { ch: CONT, st });
    } else {
      cells.push({ ch, st });
    }
  }
  while (cells.length < cols) cells.push(BLANK);
  return cells;
}

export function createScreen() {
  let cols = 0;
  let rows = 0;
  let prev = null; // grade do último quadro; null = precisa redesenhar tudo

  return {
    // Chamado a cada quadro: só invalida se o tamanho mudou de fato.
    resize(c, r) {
      if (c !== cols || r !== rows) { cols = c; rows = r; prev = null; }
    },
    // Força redesenho completo (ex.: após resize, quando o terminal pode ter
    // rearranjado o conteúdo por conta própria).
    invalidate() { prev = null; },

    frame(lines) {
      const next = [];
      for (let r = 0; r < rows; r++) next.push(parseLine(lines[r] ?? '', cols));

      const full = prev === null;
      // Redesenho completo começa limpando: assim células em branco podem ser puladas.
      let out = full ? RESET + '\x1b[2J' : '';
      // Estilo ativo no terminal. Todo quadro termina com reset (ver final da função),
      // então cada quadro novo começa garantidamente sem estilo.
      let curSt = '';
      let cr = -1;
      let cc = -1; // onde o cursor do terminal está agora

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = next[r][c];
          if (a.ch === CONT) continue;
          if (full) {
            if (a.ch === ' ' && a.st === '') continue;
          } else {
            const b = prev[r][c];
            if (a.ch === b.ch && a.st === b.st) continue;
          }
          // Células vizinhas alteradas saem em sequência, sem reposicionar o cursor.
          if (r !== cr || c !== cc) out += `\x1b[${r + 1};${c + 1}H`;
          if (a.st !== curSt) { out += RESET + a.st; curSt = a.st; }
          out += a.ch;
          cr = r;
          cc = c + (next[r][c + 1]?.ch === CONT ? 2 : 1);
        }
      }
      prev = next;
      if (out && curSt) out += RESET; // não deixa estilo "vazando" para fora do quadro
      return out;
    },
  };
}
