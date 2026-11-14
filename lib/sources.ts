/** Display names for the outlets the API scans. Unknown domains are shown as they are. */
const SOURCE_NAMES: Record<string, string> = {
  "publico.pt": "Público",
  "expresso.pt": "Expresso",
  "sicnoticias.pt": "SIC Notícias",
  "dn.pt": "Diário de Notícias",
  "jn.pt": "Jornal de Notícias",
  "tsf.pt": "TSF",
  "eco.sapo.pt": "ECO",
  "observador.pt": "Observador",
  "rtp.pt": "RTP",
  "noticiasaominuto.com": "Notícias ao Minuto",
  "jornaleconomico.sapo.pt": "Jornal Económico",
  "visao.pt": "Visão",
  "cmjornal.pt": "Correio da Manhã",
  "jornaldenegocios.pt": "Jornal de Negócios",
  "sabado.pt": "Sábado",
  "cnnportugal.iol.pt": "CNN Portugal",
  "sol.iol.pt": "Nascer do SOL",
  "24noticias.sapo.pt": "24 Notícias",
  "dnoticias.pt": "DNOTICIAS.PT",
  "acorianooriental.pt": "Açoriano Oriental",
};

export function sourceName(domain: string): string {
  return SOURCE_NAMES[domain] ?? domain;
}
