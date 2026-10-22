// Tudo é função pura do tempo de jogo `s.t` (1 s real = 1 h de jogo), sem
// aleatoriedade: mesmo estado -> mesmo resultado, e os testes ficam determinísticos.
//
// Cada trait tem `factor` (agora) e `avg` (média de longo prazo). A média é usada no
// progresso offline: sem ela, sair à noite zeraria o solar pela hora inteira, e sair
// ao meio-dia daria um bônus que ninguém mereceu.

const TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// O jogo começa às 8h para o primeiro dia não abrir no escuro.
export const START_HOUR = 8;
export const hourOfDay = (s) => (((s.t + START_HOUR) % 24) + 24) % 24;

// Dia das 6h às 18h.
export const sunLevel = (s) => Math.max(0, Math.sin((TAU * (hourOfDay(s) - 6)) / 24));
export const isDay = (s) => sunLevel(s) > 0;

// Vento: soma de duas senoides lentas com períodos "incomensuráveis", para não repetir
// um padrão óbvio. Faixa limitada a 0.6–1.4, média ≈ 1.
export const windLevel = (s) => clamp(1 + 0.25 * Math.sin(s.t / 37) + 0.15 * Math.sin(s.t / 11.3 + 1), 0.6, 1.4);

export const tideLevel = (s, tr) => 1 + tr.amp * Math.sin((TAU * s.t) / tr.period);
export const tideRising = (s, tr) => Math.cos((TAU * s.t) / tr.period) > 0;

// Estações chuvosa/seca.
export const reservoirLevel = (s, tr) => 0.5 + 0.5 * Math.sin((TAU * s.t) / tr.period);

const sumAdd = (techs) => techs.reduce((sum, t) => sum + t.add, 0);

// Vácuo: duas senoides rápidas de períodos incomensuráveis viram um expoente em [-1, 1];
// a produção é exponencial nele, entre min e max (simétrica em escala log: 0.2 e 5).
const vacuumWave = (t) => 0.6 * Math.sin(t / 7) + 0.4 * Math.sin(t / 2.3 + 2);
const vacuumRaw = (t, tr) => Math.sqrt(tr.min * tr.max) * Math.sqrt(tr.max / tr.min) ** vacuumWave(t);
export const vacuumLevel = (s, tr, floor = 0) => Math.max(floor, vacuumRaw(s.t, tr));
// Média de longo prazo (offline), por amostragem, guardada por piso.
const vacuumAvgs = new Map();
function vacuumAvg(tr, floor) {
  const k = `${tr.min}|${tr.max}|${floor}`;
  if (!vacuumAvgs.has(k)) {
    let sum = 0;
    for (let t = 0; t < 20000; t += 0.5) sum += Math.max(floor, vacuumRaw(t, tr));
    vacuumAvgs.set(k, sum / 40000);
  }
  return vacuumAvgs.get(k);
}
const maxFloor = (techs) => techs.reduce((m, t) => Math.max(m, t.floor), 0);

// Janela de lançamento: aberta nos primeiros `window` (+ `extra`) s de cada `period` s.
const phase = (s, tr) => ((s.t % tr.period) + tr.period) % tr.period;
export const launchOpen = (s, tr, extra = 0) => phase(s, tr) < tr.window + extra;
// Segundos até a janela abrir (fechada) ou fechar (aberta).
export const launchLeft = (s, tr, extra = 0) =>
  (launchOpen(s, tr, extra) ? tr.window + extra - phase(s, tr) : tr.period - phase(s, tr));

export const TRAITS = {
  wind: { factor: (s) => windLevel(s), avg: () => 1 },
  daylight: {
    // Baterias sobem o piso noturno: guardam parte do pico do dia.
    factor: (s, tr, ctx) => tr.floor + sumAdd(ctx.battery) + tr.peak * sunLevel(s),
    // Média de max(0, sen) num ciclo completo = 1/π.
    avg: (tr, ctx) => tr.floor + sumAdd(ctx.battery) + tr.peak / Math.PI,
  },
  reservoir: {
    factor: (s, tr) => tr.min + (tr.max - tr.min) * reservoirLevel(s, tr),
    avg: (tr) => (tr.min + tr.max) / 2,
  },
  tide: { factor: (s, tr) => tideLevel(s, tr), avg: () => 1 },
  // Em órbita a produção é fixa: a janela só limita quando se compra.
  launch: { factor: () => 1, avg: () => 1 },
  vacuum: {
    factor: (s, tr, ctx) => vacuumLevel(s, tr, maxFloor(ctx.vacuumFloor)),
    avg: (tr, ctx) => vacuumAvg(tr, maxFloor(ctx.vacuumFloor)),
  },
  // A alimentação depende das outras fontes: calculada no engine (feedFactor).
  feed: { factor: () => 1, avg: () => 1 },
  // upkeep não mexe na produção: é custo, tratado em engine.upkeep().
};

export function envFactor(s, g, ctx, average = false) {
  let f = 1;
  for (const tr of g.traits) {
    const fx = TRAITS[tr.type];
    if (fx) f *= average ? fx.avg(tr, ctx) : fx.factor(s, tr, ctx);
  }
  return f;
}
