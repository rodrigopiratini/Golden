export function GET() {
  const csv = [
    "Nome;Telefone;Origem;Segmento;Produto;Valor;Cidade;UF;Observações",
    "Maria Rossi;(54) 99999-1111;Cliente loja;cliente;Tábua de churrasco;129,00;Caxias do Sul;RS;Comprou para presente",
    "João Basso;54 98888-2222;Feira Fenavindima 2026;feira;;;Flores da Cunha;RS;Gostou das petisqueiras",
    "Loja Casa & Mesa;(51) 3333-4444;Indicação;empresa;;;Porto Alegre;RS;Lojista - quer preço de atacado",
  ].join("\r\n");
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modelo-contatos-golden.csv"' },
  });
}
