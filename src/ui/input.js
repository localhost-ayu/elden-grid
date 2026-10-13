// Um único 'data' pode trazer várias teclas (digitação rápida, colar texto), então
// sempre devolvemos uma lista.
//
//   CSI = ESC [ <parâmetros> <final>   ex.: ↑ = \x1b[A, Delete = \x1b[3~, Ctrl+↑ = \x1b[1;5A
//   SS3 = ESC O <final>                 ex.: F1 = \x1bOP, ↑ em "modo aplicação" = \x1bOA
// ESC sozinho é a tecla Esc; ESC + caractere é Alt+caractere.

const CSI_RE = /^\x1b\[([0-9;]*)([A-Za-z~])/;
const SS3_RE = /^\x1bO([A-Za-z])/;
const LINUX_F_RE = /^\x1b\[\[([A-E])/; // console do Linux: F1–F5 = \x1b[[A … \x1b[[E

const FINAL = {
  A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', Z: 'shift-tab',
  P: 'f1', Q: 'f2', R: 'f3', S: 'f4',
};
const TILDE = {
  1: 'home', 2: 'insert', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown', 7: 'home', 8: 'end',
  11: 'f1', 12: 'f2', 13: 'f3', 14: 'f4', 15: 'f5', 17: 'f6', 18: 'f7', 19: 'f8',
  20: 'f9', 21: 'f10', 23: 'f11', 24: 'f12',
};
// Segundo parâmetro do CSI codifica modificadores: 1 + (shift=1, alt=2, ctrl=4).
const MOD = {
  2: 'shift-', 3: 'alt-', 4: 'alt-shift-', 5: 'ctrl-', 6: 'ctrl-shift-', 7: 'ctrl-alt-', 8: 'ctrl-alt-shift-',
};

function single(ch) {
  if (ch === '\r' || ch === '\n') return 'enter';
  if (ch === '\t') return 'tab';
  if (ch === ' ') return 'space';
  if (ch === '\x7f' || ch === '\b') return 'backspace';
  const c = ch.charCodeAt(0);
  if (c < 32) return 'ctrl-' + String.fromCharCode(c + 96); // \x03 -> ctrl-c
  return ch; // letras mantêm maiúscula/minúscula: 'G' ≠ 'g'
}

export function parseKeys(data) {
  const keys = [];
  let i = 0;
  while (i < data.length) {
    const rest = data.slice(i);
    if (rest[0] === '\x1b') {
      let m;
      if ((m = LINUX_F_RE.exec(rest))) {
        keys.push('f' + (m[1].charCodeAt(0) - 64));
      } else if ((m = CSI_RE.exec(rest))) {
        const [p1, p2] = m[1].split(';');
        const name = m[2] === '~' ? TILDE[p1] : FINAL[m[2]];
        keys.push(name ? (MOD[p2] ?? '') + name : 'unknown');
      } else if ((m = SS3_RE.exec(rest))) {
        keys.push(FINAL[m[1]] ?? 'unknown');
      } else if (rest.length === 1 || rest[1] === '\x1b') {
        keys.push('escape');
        i += 1;
        continue;
      } else {
        const ch = String.fromCodePoint(rest.codePointAt(1));
        keys.push('alt-' + single(ch));
        i += 1 + ch.length;
        continue;
      }
      i += m[0].length;
      continue;
    }
    const ch = String.fromCodePoint(data.codePointAt(i)); // respeita pares surrogate (emoji)
    keys.push(single(ch));
    i += ch.length;
  }
  return keys;
}
