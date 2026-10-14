import { h, aviso, icone } from '../ui.js';
import { mudar } from '../estado.js';
import { sessao, post } from '../api.js';
import { iniciarSessao } from '../app.js';

export function telaLogin() {
  let modo = 'entrar';
  const nome = h('input', { name: 'username', autocomplete: 'username', required: true, minlength: 2 });
  const senha = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true, minlength: 4 });
  const lembrar = h('input', { type: 'checkbox', checked: true });
  const titulo = h('h2', {}, 'Entrar');
  const enviar = h('button', { type: 'submit', class: 'primario' }, 'Entrar');
  const alternar = h('button', { type: 'button', class: 'link' }, 'Ainda não tenho conta — criar conta');

  alternar.onclick = () => {
    modo = modo === 'entrar' ? 'registrar' : 'entrar';
    titulo.textContent = enviar.textContent = modo === 'entrar' ? 'Entrar' : 'Criar conta';
    senha.autocomplete = modo === 'entrar' ? 'current-password' : 'new-password';
    alternar.textContent = modo === 'entrar' ? 'Ainda não tenho conta — criar conta' : 'Já tenho conta — entrar';
  };

  const form = h('form', {
    class: 'cartao login',
    onsubmit: async e => {
      e.preventDefault();
      enviar.disabled = true;
      try {
        const s = await post(`/api/${modo}`, { nome: nome.value, senha: senha.value });
        sessao.salvar(s, lembrar.checked);
        iniciarSessao(s);
        mudar({ tela: 'saguao' });
      } catch (err) {
        aviso(err.message, 'erro');
      } finally {
        enviar.disabled = false;
      }
    },
  },
  titulo,
  h('label', {}, h('span', { class: 'rotulo-ic' }, icone('user'), 'Nome'), nome),
  h('label', {}, h('span', { class: 'rotulo-ic' }, icone('lock'), 'Senha'), senha),
  h('label', { class: 'linha' }, lembrar, 'Lembrar neste dispositivo'),
  enviar, alternar);

  return h('div', { class: 'centro' },
    h('div', { class: 'marca' }, h('div', { class: 'marca-icone' }, icone('anchor')), h('h1', {}, 'Ilhas das Ruínas'), h('p', {}, 'MSA — apoio de mesa')),
    form);
}
