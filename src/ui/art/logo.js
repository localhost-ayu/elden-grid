// Logo da tela de título (estilo figlet "standard"), montado letra a letra para que
// todas as linhas tenham a mesma largura — o menu centraliza pela largura da 1ª linha.
const R = [' ____  ', '|  _ \\ ', '| |_) |', '|  _ < ', '|_| \\_\\'];
const E = [' _____ ', '| ____|', '|  _|  ', '| |___ ', '|_____|'];
const A = ['    _    ', '   / \\   ', '  / _ \\  ', ' / ___ \\ ', '/_/   \\_\\'];
const C = ['  ____ ', ' / ___|', '| |    ', '| |___ ', ' \\____|'];
const T = [' _____ ', '|_   _|', '  | |  ', '  | |  ', '  |_|  '];
const O = ['  ___  ', ' / _ \\ ', '| | | |', '| |_| |', ' \\___/ '];

export const LOGO = [R, E, A, C, T, O, R].reduce((rows, letter) => rows.map((r, i) => r + letter[i]), ['', '', '', '', '']);
export const SUBTITLE = '·  A  S  C  I  I  ·';
export const TAGLINE = 'energia limpa, lucro sujo';
