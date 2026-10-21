# Roadmap — Portal Norte Junino

## Em andamento

- [ ] Vagas: repetir teste ponta a ponta (aceites → portão → formulário → envio) após correção do digest/schema e radios de imagem; limpar vaga de teste 77697677-b966-4832-9a21-a1b058699bf5.
- [ ] Vagas: legado /inscricoes/$id deve recusar/redirecionar formulários vinculados a vagas (sem quebrar formulários antigos).
- [ ] Vagas: restrições de publicação no servidor (campos obrigatórios, formulário publicado, termos publicados).

## Novo pedido — Candidatos nas votações

- [ ] Banco: estender poll_options (nome artístico, código, bio, redes sociais, ativo) sem apagar dados; cast_vote deve recusar candidato inativo.
- [ ] Painel: formulário completo de candidato (foto via upload, status ativo/inativo, editar/substituir foto/excluir com confirmação/visualizar); bloquear publicação com menos de 2 candidatos ativos.
- [ ] Público: exibir apenas candidatos ativos, com bio/grupo/estado; voto real já existente.
- [ ] Painel: resultados com ranking, foto, votos, %, total; respeitar visibilidade "oculto".
- [ ] Testes: fluxo criar→2 candidatos→editar→rascunho→reabrir→publicar→votar→contagem→bloqueio de voto inválido.

## Novo pedido — Restaurar atualizações do GitHub e ativar no banco
- [ ] Conferir que todo o código atual está presente e que todas as migrações do projeto estão aplicadas no banco.
