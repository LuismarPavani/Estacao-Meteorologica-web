// Chaves nunca voltam inteiras para o navegador: só os 4 últimos caracteres, com asteriscos na frente (ex.: ************56f5)
export const maskKey = (k?: string | null) => (k ? '*'.repeat(12) + (k.length > 4 ? k.slice(-4) : '') : null);
