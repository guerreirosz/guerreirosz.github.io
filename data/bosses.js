/* Bosses da guilda já vistos. Para adicionar um novo: copie um bloco, troque os dados
   (espécie, tipos, atributos e os 4 golpes exatamente como aparecem no jogo) e salve.
   O site também deixa cadastrar pelo formulário da página "Boss da guilda". */
window.GUILD_BOSSES = [
  {
    id: 'dragonite-insano',
    species: 'Dragonite',
    mode: 'Insano',
    level: 100,
    pointsMult: 1.5,
    types: ['dragon', 'flying'],
    atk: 1021, def: 706, spa: 660, spd: 735, spe: 282,
    moves: ['Dragon Rush', 'Outrage', 'Dragon Dance', 'Hyper Beam'],
    seen: '2026-11-10',
    notes: 'Até 24 poções e 12 revives por tentativa. Cada tentativa dura no máximo 10 min. Uma tentativa por dia.',
  },
  {
    id: 'gyarados-insano',
    species: 'Gyarados',
    mode: 'Insano',
    level: 100,
    pointsMult: 1.5,
    types: ['water', 'flying'],
    atk: 832, def: 531, spa: 392, spd: 634, spe: 284,
    moves: ['Hydro Pump', 'Hurricane', 'Thrash', 'Hyper Beam'],
    seen: '2026-11-11',
    notes: 'Até 24 poções e 12 revives por tentativa. Cada tentativa dura no máximo 10 min. Uma tentativa por dia.',
  },
];
