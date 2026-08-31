const $ = (id) => document.getElementById(id);
const state = { drawn: [], fixedDrawn: new Set(), fixedMissed: new Set(), games: [] };
const format = (n) => String(n).padStart(2, '0');
const allNumbers = Array.from({ length: 25 }, (_, i) => i + 1);

function setStatus(message, type = 'info') {
  const status = $('status'); status.textContent = message;
  status.style.background = type === 'error' ? '#fff0ef' : type === 'success' ? '#eaf9f0' : '#eff5ff';
  status.style.color = type === 'error' ? '#b42318' : type === 'success' ? '#147a4a' : '#245ac1';
}
function parseNumbers(text) {
  const values = (text.match(/\d+/g) || []).map(Number);
  if (values.length !== 15 || new Set(values).size !== 15 || values.some(n => n < 1 || n > 25)) throw new Error('Informe exatamente 15 dezenas diferentes entre 01 e 25.');
  return values.sort((a,b) => a-b);
}
function missed() { return allNumbers.filter(n => !state.drawn.includes(n)); }
function renderGroup(id, numbers, selected, group) {
  $(id).innerHTML = '';
  numbers.forEach(n => { const b = document.createElement('button'); b.className = `ball ${selected.has(n) ? 'selected' : ''}`; b.type = 'button'; b.textContent = format(n); b.setAttribute('aria-pressed', selected.has(n)); b.onclick = () => { selected.has(n) ? selected.delete(n) : selected.add(n); renderGroup(id, numbers, selected, group); validate(); }; $(id).appendChild(b); });
  $(group === 'drawn' ? 'drawnCount' : 'missedCount').textContent = `${selected.size} fixa${selected.size === 1 ? '' : 's'}`;
}
function validate() {
  const dRandom = Math.max(0, Number($('drawnRandom').value) || 0);
  const mRandom = Math.max(0, Number($('missedRandom').value) || 0);
  const fixed = state.fixedDrawn.size + state.fixedMissed.size;
  const total = fixed + dRandom + mRandom;
  const availableD = state.drawn.length - state.fixedDrawn.size;
  const availableM = missed().length - state.fixedMissed.size;
  let message = `${fixed} fixa${fixed === 1 ? '' : 's'} + ${dRandom + mRandom} aleatória${dRandom + mRandom === 1 ? '' : 's'} = ${total} dezenas por jogo.`;
  let valid = total === 15 && dRandom <= availableD && mRandom <= availableM;
  if (dRandom > availableD || mRandom > availableM) message = 'Há mais dezenas aleatórias solicitadas do que opções disponíveis no grupo.';
  else if (total !== 15) message += ' Ajuste até completar 15.';
  $('validation').textContent = message; $('validation').style.color = valid ? '#147a4a' : '#b42318'; $('generate').disabled = !valid;
  $('composition').textContent = valid ? 'Configuração pronta para gerar quatro combinações.' : 'Faltam ajustes na composição de 15 dezenas.';
}
function applyResult(drawn, contest = '') {
  state.drawn = drawn; state.fixedDrawn.clear(); state.fixedMissed.clear(); state.games = [];
  $('contest').value = contest; $('drawnInput').value = drawn.map(format).join(' ');
  localStorage.setItem('lotofacil-base', JSON.stringify({drawn, contest}));
  $('workspace').classList.remove('hidden'); $('results').classList.add('hidden');
  renderGroup('drawnGrid', state.drawn, state.fixedDrawn, 'drawn'); renderGroup('missedGrid', missed(), state.fixedMissed, 'missed'); validate();
  setStatus(`Resultado do concurso ${contest || 'informado'} está pronto para a estratégia.`, 'success');
}
function pick(list, count) { const copy = [...list]; for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; } return copy.slice(0,count); }
function generate() {
  const dRandom = Number($('drawnRandom').value), mRandom = Number($('missedRandom').value);
  const fixed = [...state.fixedDrawn, ...state.fixedMissed]; const poolD = state.drawn.filter(n => !state.fixedDrawn.has(n)); const poolM = missed().filter(n => !state.fixedMissed.has(n));
  const signatures = new Set(); state.games = [];
  for (let attempts=0; state.games.length < 4 && attempts < 100; attempts++) { const game = [...fixed, ...pick(poolD,dRandom), ...pick(poolM,mRandom)].sort((a,b)=>a-b); const signature = game.join(','); if (!signatures.has(signature)) { signatures.add(signature); state.games.push(game); } }
  $('games').innerHTML = state.games.map((game,i) => `<article class="game"><div class="game-top"><span class="game-name">Jogo ${i+1}</span><small>15 dezenas</small></div><div class="game-numbers">${game.map(n=>`<span class="game-number">${format(n)}</span>`).join('')}</div></article>`).join('');
  $('results').classList.remove('hidden'); $('results').scrollIntoView({behavior:'smooth', block:'start'});
}

$('applyResult').onclick = () => { try { applyResult(parseNumbers($('drawnInput').value), $('contest').value.trim()); } catch(e) { setStatus(e.message, 'error'); } };
$('exampleResult').onclick = () => applyResult([1,2,3,4,5,7,8,10,11,13,14,17,19,21,24], 'exemplo');
$('drawnRandom').oninput = validate; $('missedRandom').oninput = validate; $('generate').onclick = generate;
$('copyGames').onclick = async () => { const text = state.games.map((g,i) => `Jogo ${i+1}: ${g.map(format).join(' ')}`).join('\n'); try { await navigator.clipboard.writeText(text); $('copyGames').textContent = 'Copiado!'; setTimeout(()=>$('copyGames').textContent='Copiar jogos',1500); } catch { setStatus('Não foi possível copiar automaticamente. Selecione os jogos para copiar.', 'error'); } };
$('loadLatest').onclick = async () => { setStatus('Buscando o resultado mais recente…'); try { const response = await fetch('https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil', {headers:{Accept:'application/json, text/plain, */*'}}); if (!response.ok) throw new Error(); const data = await response.json(); const nums = data.listaDezenas || data.dezenas; const contest = data.numero || data.concurso; applyResult(parseNumbers(nums.join(' ')), String(contest || '')); } catch { setStatus('Não foi possível consultar a Caixa agora. Informe o concurso e as 15 dezenas manualmente.', 'error'); } };
try { const saved = JSON.parse(localStorage.getItem('lotofacil-base')); if (saved?.drawn?.length === 15) applyResult(saved.drawn, saved.contest); } catch {}
