// Tudo aqui recebe o tempo/dt de fora (nada de Date.now()): as animações ficam
// determinísticas e testáveis, e o jogo pode congelar o relógio nos testes.

export const frame = (now, fps) => Math.floor((now / 1000) * fps);

// Aproximação exponencial: anda a mesma fração do caminho por segundo seja qual for o
// dt, então o contador não acelera nem trava com a taxa de quadros.
export function easeTo(current, target, dt, k = 10) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return target;
  const next = current + (target - current) * (1 - Math.exp(-k * dt));
  // Sem isso a cauda da exponencial deixaria o último dígito "tremendo" para sempre.
  return Math.abs(target - next) <= Math.abs(target) * 1e-4 + 1e-3 ? target : next;
}

// Partículas: posição em "unidades de tela" (x 0..1 da largura, y linhas acima da base),
// velocidade por segundo e vida em segundos. Quem desenha decide onde fica a base.
export const createParticles = (max = 12) => ({ list: [], max });

export function spawn(ps, p) {
  ps.list.push({ vx: 0, vy: 4, life: 1.5, ...p, age: 0 });
  // Rajada de cliques não enche a tela: as mais velhas saem primeiro.
  if (ps.list.length > ps.max) ps.list.splice(0, ps.list.length - ps.max);
}

export function stepParticles(ps, dt) {
  for (const p of ps.list) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  ps.list = ps.list.filter((p) => p.age < p.life);
}
