// Região atendida: base da capacidade da rede e bônus no preço. Não importa o engine; o
// engine consulta regionMult e regionPrice daqui, e a ação de expandir mora em actions.js.
import { REGIONS, REGION_RULES } from '../data/regions.js';

const ladder = () => REGIONS.earth;
export const regionDef = (s) => ladder()[s.region];
export const nextRegion = (s) => ladder()[s.region + 1] ?? null;
export const regionName = (s, short = false) => (short ? regionDef(s).short ?? regionDef(s).name : regionDef(s).name);
export const lastRegion = (s) => s.region === ladder().length - 1;
export const regionIndex = (name) => ladder().findIndex((r) => r.name === name);

// Base da capacidade (kW): a demanda da região atendida.
export const regionBase = (s) => regionDef(s).base;
export const regionPrice = (s) => 1 + REGION_RULES.pricePerRegion * s.region;
