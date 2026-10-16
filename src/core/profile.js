// Perfil compartilhado: o que vale para todos os slots (e para o slot de Desafio).
// Guardado fora dos saves (~/.elden-grid/profile.json, ver storage/profile.js), então
// apagar ou importar um slot não mexe nele.
//   challenges  { [id]: { tier, best } }  tier = níveis completos (0–5);
//                                         best = { [nível]: segundos da partida mais rápida }
//   daily       { [AAAA-MM-DD]: segundos }  melhor tempo na semente do dia
export const PROFILE_VERSION = 1;
export const MAX_TIER = 5;

export const newProfile = () => ({ profileVersion: PROFILE_VERSION, challenges: {}, daily: {} });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const time = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;
const tier = (x) => Number.isInteger(x) && x >= 0 && x <= MAX_TIER;

// Aceita o que for válido campo a campo e descarta o resto: um profile.json editado à mão
// ou de uma versão futura nunca derruba o jogo nem apaga o que dá para aproveitar.
export function fromProfile(raw) {
  const p = newProfile();
  if (!raw || typeof raw !== 'object') return p;
  for (const [id, c] of Object.entries(raw.challenges ?? {})) {
    if (!c || !tier(c.tier)) continue;
    const best = {};
    for (const [t, sec] of Object.entries(c.best ?? {})) if (tier(Number(t)) && Number(t) > 0 && time(sec)) best[t] = sec;
    p.challenges[id] = { tier: c.tier, best };
  }
  for (const [date, sec] of Object.entries(raw.daily ?? {})) if (DATE.test(date) && time(sec)) p.daily[date] = sec;
  return p;
}

export const challengeTier = (p, id) => p.challenges[id]?.tier ?? 0;

// Registra uma partida de desafio completa. Só sobe um nível por vez (o nível jogado tem
// de ser o próximo) e guarda o melhor tempo. Retorna true se o nível é novo.
export function completeChallenge(p, id, t, seconds) {
  const c = (p.challenges[id] ??= { tier: 0, best: {} });
  if (!(t >= 1 && t <= MAX_TIER)) return false;
  if (!(c.best[t] <= seconds)) c.best[t] = seconds;
  if (t !== c.tier + 1) return false;
  c.tier = t;
  return true;
}

// Melhor tempo da semente do dia; retorna true se é recorde.
export function recordDaily(p, date, seconds) {
  if (p.daily[date] <= seconds) return false;
  p.daily[date] = seconds;
  return true;
}
