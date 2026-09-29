# Testes de falha

## Caso 1 - retorno sem cookie temporário

Preparação:
O login Google foi iniciado em uma janela normal e a URL de autorização
foi aberta em uma janela anônima, sem o cookie temporário da transação.

Pedido enviado:
Retorno OAuth do Google para /oauth/callback/google sem o cookie
__Host-oauth-tx.

Resultado esperado:
A resposta OAuth deve ser recusada e nenhuma sessão deve ser criada.

Resultado observado:
O callback respondeu "OAuth transaction rejected." e /api/me respondeu
401, sem sessão autenticada.

## Caso 2 - state alterado

Preparação:
Foi iniciado um login Google normalmente, criando a transação OAuth e o
cookie temporário.

Pedido enviado:
Foi enviado um callback para /oauth/callback/google com um valor de state
diferente daquele criado no início da transação.

Resultado esperado:
A resposta deve ser recusada antes da troca do código.

Resultado observado:
O callback respondeu "OAuth transaction rejected.", recusando a transação
antes da criação de qualquer sessão.


## Caso 3 - reutilização da transação

Preparação:
Foi realizado um login Google completo e bem-sucedido.

Pedido enviado:
A URL da requisição de retorno OAuth concluída foi copiada pelo painel
Network e aberta novamente após o término da autenticação.

Resultado esperado:
A transação já utilizada deve ser recusada.

Resultado observado:
A tentativa de reutilizar o retorno foi recusada com
"OAuth transaction rejected.".


## Caso 4 - sessão expirada

Preparação:
Foi criada uma sessão válida por meio de um login normal.

Pedido enviado:
No console D1, o campo expires_at das sessões foi alterado para 0 e
/api/me foi consultado novamente.

Resultado esperado:
/api/me deve responder 401.

Resultado observado:
/api/me respondeu 401 e informou que não havia sessão autenticada válida.


## Caso 5 - origem inválida na saída

Preparação:
Foi criada uma sessão válida no endereço de produção e mantida aberta.

Pedido enviado:
A partir de https://example.com foi enviado um POST para /oauth/logout
com credentials configurado como include.

Resultado esperado:
A rota deve recusar a operação e a sessão original deve continuar válida.

Resultado observado:
A tentativa de logout enviada por outra origem foi recusada.
Ao consultar /api/me na origem original, a sessão permaneceu válida.


## Caso 6 - reutilização do cookie revogado

Preparação:
O valor do cookie de uma sessão válida foi copiado temporariamente pelas
ferramentas de desenvolvimento apenas para a execução do teste.

Pedido enviado:
Foi realizado o logout e, em seguida, o cookie antigo foi restaurado no
navegador antes de uma nova consulta a /api/me.

Resultado esperado:
O cookie revogado não deve restaurar a sessão e /api/me deve responder 401.

Resultado observado:
Mesmo após restaurar o cookie antigo, /api/me respondeu 401 e nenhuma
sessão autenticada foi restaurada.

Observação:
A cópia temporária do cookie foi apagada após o teste e não foi incluída
nas evidências.