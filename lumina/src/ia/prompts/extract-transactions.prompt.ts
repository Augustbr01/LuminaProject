export const buildExtractTransactionsPrompt = (
  banco: string,
  mesAno: string,
): string =>
  `Você receberá um extrato bancário em PDF do banco "${banco}" referente ao mês "${mesAno}" (formato AAAA-MM).

Sua tarefa é identificar TODAS as transações do extrato e retornar um JSON estruturado.

Para cada transação, retorne os seguintes campos:
- date: data da transação no formato YYYY-MM-DD
- description: descrição original da transação, limpa e sem espaços extras
- amount: valor absoluto da transação (sempre positivo, nunca negativo, sem sinal)
- type: "debit" para saídas (gastos, transferências enviadas, pagamentos) ou "credit" para entradas (salários, recebimentos, transferências recebidas)
- category: uma das categorias listadas abaixo
- confidence: número entre 0.0 e 1.0 indicando sua certeza na categorização

Categorias e seus critérios:
- alimentacao: restaurantes, mercados, lanchonetes, delivery de comida, padarias
- transporte: combustível, Uber, 99, estacionamento, transporte público, pedágio, manutenção de veículo
- moradia: aluguel, condomínio, energia, água, internet residencial, gás, IPTU
- lazer: cinema, streaming não-essencial, viagens, eventos, bares, jogos
- saude: farmácia, plano de saúde, consultas, exames, terapia
- assinaturas: serviços recorrentes que não se encaixam em outra categoria (Spotify, iCloud, software, academia)
- compras: vestuário, eletrônicos, casa, presentes, e-commerce variado
- investimento: TODA transferência de saída para conta de investimento, poupança, corretora ou aplicação financeira — mesmo quando a descrição for genérica como "TED", "PIX" ou "TRANSFERENCIA". Se houver indício forte de aporte (destinatário identificado como instituição financeira de investimento, conta poupança própria, corretora), classifique como investimento.
- outro: tudo que não se encaixa nas categorias acima

Regras importantes:
1. amount é SEMPRE positivo. O sinal (entrada/saída) é representado exclusivamente pelo campo "type".
2. Tarifas, juros, IOF e taxas bancárias são "debit" e categoria "outro" (a menos que claramente associadas a outra categoria).
3. Estornos e devoluções são "credit" na mesma categoria do gasto original quando identificável; caso contrário "outro".
4. NÃO invente transações. NÃO repita transações. Cada linha do extrato vira no máximo uma transação.

Retorne APENAS o JSON abaixo, sem markdown, sem code fences, sem explicações antes ou depois:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "...",
      "amount": 0.00,
      "type": "debit",
      "category": "alimentacao",
      "confidence": 0.0
    }
  ]
}

Se o PDF não contiver transações identificáveis, retorne {"transactions": []}.`;
