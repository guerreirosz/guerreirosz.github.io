# Guerreiros Z — site da guilda (idleDEX)

Site estático da guilda PvE **Guerreiros Z**. Não precisa de servidor nem de build: é HTML, CSS e JavaScript puro.

## O que tem
- **Início**: apresentação da guilda, boss do dia, agenda (Mega Boss, reset diário, vitrine, loja) e busca global.
- **Boss da guilda**: estratégia automática (debuffers + 1 DPS), time sugerido, rankings e lista do que upar com a rota de captura.
- **Onde pego?**: Pokédex com as rotas ordenadas pela chance de encontro.
- **Itens e farm**: melhor rota para cada item e para cada tipo de Fragmento de Charm.
- **Rotas**, **Mega**, **Shiny** (calculadora da escada) e **Guild War** (resumo).

## Abrir no computador
Dá para abrir o `index.html` direto no navegador. Ou, com Python instalado:

```
python -m http.server 8095
```

e acessar http://localhost:8095

## Atualizar os dados da wiki
```
node scripts/extract-wiki.mjs   # baixa Pokédex, rotas, golpes e Megas para data/wiki.json
node scripts/build-data.mjs     # gera data/wiki.js, o arquivo que o site usa
```
No GitHub, o arquivo `.github/workflows/atualizar-wiki.yml` faz isso sozinho todo dia.

## Adicionar um boss da guilda
- Pelo site: **Boss da guilda → Cadastrar boss do dia**, e depois **Compartilhar** para mandar o link no grupo.
- Para deixar fixo para todo mundo: edite `data/bosses.js` e acrescente o boss na lista.

## Fonte dos dados
Todos os números vêm da [Wiki idleDEX](https://wiki.idledex.com/). Os sprites são carregados do site do jogo.
O cálculo de estratégia é uma estimativa (fórmula de dano clássica, IV médio, sem EV/natureza) para comparar opções.
