// Capítulos da 2.0, em sequência: cada um é uma economia com fontes, pesquisas e regiões
// próprias, numa faixa da escala de Kardashev. Chegar ao fim de um libera a Colonização
// do próximo (2ª camada de prestígio). As fontes de um capítulo são uma página da aba
// Geradores; pesquisas sem `chapter` valem em todos (laboratório, automação, rede,
// mercado), as com `chapter` só nele.
// `scale`: o tamanho da economia do capítulo em relação à Terra (preço das fontes dele,
// do laboratório, do transformador e das baterias).
export const CHAPTERS = [
  { id: 'earth', name: 'Terra', from: 0, to: 1, scale: 1 },
  { id: 'solar', name: 'Sistema Solar', from: 1, to: 2, scale: 1e13 },
  { id: 'galaxy', name: 'Galáxia', from: 2, to: 3, scale: 1e24 },
];
export const chapterDef = (id) => CHAPTERS.find((c) => c.id === id);
export const chapterIndex = (id) => CHAPTERS.findIndex((c) => c.id === id);
export const chapterScale = (s) => chapterDef(s.chapter).scale;
