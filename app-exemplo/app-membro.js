import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, 
    addDoc, updateDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDX-zzuYHQ6HQce12CPSke38MuP8k63Zt8",
    authDomain: "saas-central-manager.firebaseapp.com",
    projectId: "saas-central-manager",
    storageBucket: "saas-central-manager.firebasestorage.app",
    messagingSenderId: "249170676982",
    appId: "1:249170676982:web:233d1609b9649135f370d7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const urlParams = new URLSearchParams(window.location.search);
const idCliente = urlParams.get('id');

const livrosBiblia = [
    "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias",
    "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse"
];

let livroSelecionado = "";
let unsubscribeAnotacoes = null;
let filtroLeituraAtual = 'pendentes';
let leiturasCache = [];

// --- SISTEMA DE AUTENTICAÇÃO ---
window.mudarModoAuth = (modo) => {
    const titulo = document.getElementById('authTitulo');
    const subtitulo = document.getElementById('authSubtitulo');
    const campoNome = document.getElementById('authNome');
    const campoSenha = document.getElementById('authSenha');
    const btnPrincipal = document.getElementById('btnAuthPrincipal');
    const toggleText = document.getElementById('toggleAuthText');
    const linkRecuperar = document.getElementById('linkRecuperar');
    const linkVoltar = document.getElementById('linkVoltarLogin');

    if (modo === 'cadastro') {
        titulo.innerText = "Criar Conta";
        subtitulo.innerText = "Preencha os dados abaixo";
        if(campoNome) campoNome.style.display = "block";
        btnPrincipal.innerText = "Cadastrar agora";
        toggleText.innerHTML = 'Já tem conta? <a href="#" onclick="window.mudarModoAuth(\'login\')" style="color:var(--cor-primaria); font-weight:bold;">Fazer Login</a>';
        linkRecuperar.style.display = "none";
        linkVoltar.style.display = "none";
    } else if (modo === 'recuperar') {
        titulo.innerText = "Recuperar Senha";
        subtitulo.innerText = "Digite seu e-mail para receber o link";
        if(campoNome) campoNome.style.display = "none";
        campoSenha.style.display = "none";
        btnPrincipal.innerText = "Enviar Link";
        toggleText.style.display = "none";
        linkRecuperar.style.display = "none";
        linkVoltar.style.display = "block";
    } else {
        titulo.innerText = "Bem-vindo";
        subtitulo.innerText = "Acesse sua conta para continuar";
        if(campoNome) campoNome.style.display = "none";
        campoSenha.style.display = "block";
        btnPrincipal.innerText = "Entrar";
        toggleText.style.display = "block";
        toggleText.innerHTML = 'Não tem conta? <a href="#" onclick="window.mudarModoAuth(\'cadastro\')" style="color:var(--cor-primaria); font-weight:bold;">Cadastre-se</a>';
        linkRecuperar.style.display = "block";
        linkVoltar.style.display = "none";
    }
};

window.loginGoogle = async () => {
    try { 
        const result = await signInWithPopup(auth, googleProvider);
        await setDoc(doc(db, "usuarios_app", result.user.uid), {
            nome: result.user.displayName,
            email: result.user.email,
            fotoUrl: result.user.photoURL,
            idCliente: idCliente,
            ultimaAtividade: new Date()
        }, { merge: true });
    } catch (error) { 
        console.error("Erro Google Auth:", error); 
        alert("Erro ao entrar com Google."); 
    }
};

document.getElementById('formAuth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const senha = document.getElementById('authSenha').value;
    const nome = document.getElementById('authNome')?.value;
    const btnTexto = document.getElementById('btnAuthPrincipal').innerText;

    try {
        if (btnTexto === "Entrar") {
            await signInWithEmailAndPassword(auth, email, senha);
        } else if (btnTexto === "Cadastrar agora") {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, "usuarios_app", userCredential.user.uid), {
                nome: nome, 
                email: email, 
                idCliente: idCliente,
                dataCriacao: new Date()
            });
        } else if (btnTexto === "Enviar Link") {
            await sendPasswordResetEmail(auth, email);
            alert("E-mail de recuperação enviado!");
            window.mudarModoAuth('login');
        }
    } catch (error) { 
        alert("Erro: " + error.message); 
    }
});

// --- INICIALIZAÇÃO ---
async function inicializarApp() {
    if (!idCliente) { alert("Erro: ID do cliente não encontrado."); return; }

    const docRef = doc(db, "clientes", idCliente);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const dados = docSnap.data();
        const cor = dados.corPrimaria || '#d4a373';
        document.documentElement.style.setProperty('--cor-primaria', cor);
        document.documentElement.style.setProperty('--texto-bronze', cor);
        if(document.getElementById('appLogoSide')) document.getElementById('appLogoSide').src = dados.logoUrl || '';
        if(document.getElementById('authLogo')) document.getElementById('authLogo').src = dados.logoUrl || '';
        document.title = dados.nome;
    }

    onAuthStateChanged(auth, async (user) => {
        const authContainer = document.getElementById('authContainer');
        const nomeDisplay = document.getElementById('nomeMembro');
        const fotoDisplay = document.getElementById('fotoMembro');
        const fotoMenu = document.getElementById('fotoMembroMenu');

        if (user) {
            if(authContainer) authContainer.style.display = 'none';
            const userDoc = await getDoc(doc(db, "usuarios_app", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const nomeFinal = userData.nome || user.displayName || "Membro";
                if(nomeDisplay) nomeDisplay.innerText = nomeFinal;
                
                if(document.getElementById('perfilNome')) document.getElementById('perfilNome').value = userData.nome || "";
                if(document.getElementById('perfilEmail')) document.getElementById('perfilEmail').value = userData.email || user.email || "";
                if(document.getElementById('perfilTel')) document.getElementById('perfilTel').value = userData.whatsapp || "";
                if(document.getElementById('perfilNascimento')) document.getElementById('perfilNascimento').value = userData.nascimento || "";
                if(document.getElementById('perfilStatus')) document.getElementById('perfilStatus').value = userData.status || "Visitante";
                if(document.getElementById('perfilConversao')) document.getElementById('perfilConversao').value = userData.conversao || "";
                if(document.getElementById('perfilBatismo')) document.getElementById('perfilBatismo').value = userData.batismo || "";
                if(document.getElementById('perfilCasado')) {
                    document.getElementById('perfilCasado').value = userData.casado || "nao";
                    window.toggleDataCasamento();
                }
                if(document.getElementById('perfilDataCasamento')) document.getElementById('perfilDataCasamento').value = userData.dataCasamento || "";

                if(userData.fotoUrl || user.photoURL) {
                    const urlFinal = userData.fotoUrl || user.photoURL;
                    if(fotoDisplay) fotoDisplay.src = urlFinal;
                    if(fotoMenu) fotoMenu.src = urlFinal;
                }
            }
            window.mostrarSessao('home');
        } else {
            if(authContainer) authContainer.style.display = 'flex';
        }
    });
}

// --- CONTROLE DE SESSÕES ---
window.mostrarSessao = (aba) => {
    if (!auth.currentUser) return;

    document.querySelectorAll('.tab-bar button').forEach(btn => btn.classList.remove('active'));
    const btnAtivo = document.querySelector(`.tab-bar button[onclick*="'${aba}'"]`);
    if(btnAtivo) btnAtivo.classList.add('active');
    
    const sessoes = ['sessaoHome', 'sessaoBiblia', 'sessaoAnotacoes', 'sessaoVideos', 'sessaoOfertas', 'sessaoNotificacoes', 'sessaoLeitura', 'sessaoOracao', 'sessaoDepartamentos', 'sessaoPerfil', 'sessaoAgenda'];
    sessoes.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });

    const alvo = document.getElementById('sessao' + aba.charAt(0).toUpperCase() + aba.slice(1));
    if(alvo) alvo.style.display = 'block';

    if (aba === 'home') {
        carregarVideosHome();
        carregarNoticiasHome();
    } else if (aba === 'biblia') {
        const ultimaLeitura = localStorage.getItem('ultima_leitura');
        window.buscarBiblia('palavra', ultimaLeitura || 'Gênesis 1');
    } else if (aba === 'anotacoes') {
        escutarAnotacoes();
    } else if (aba === 'videos') {
        carregarTodosVideos();
    } else if (aba === 'leitura') {
        carregarLeituraDiaria(); 
    } else if (aba === 'oracao') {
        escutarMeusPedidosOracao();
    } else if (aba === 'agenda') {
        carregarAgenda();
    } else if (aba === 'departamentos') {
        carregarDepartamentos();
    } else if (aba === 'ofertas') {
        window.carregarOfertas();
    }
};

// --- FUNÇÃO DE OFERTAS (AJUSTADA PARA IMAGEM E LINK DA ADM) ---
window.carregarOfertas = async () => {
    const container = document.getElementById('listaOfertasContainer');
    if (!container || !idCliente) return;

    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando ofertas...</p>`;

    try {
        const colRef = collection(db, "clientes", idCliente, "ofertas");
        const snap = await getDocs(colRef);

        if (snap.empty) {
            container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhuma opção de oferta cadastrada.</p>`;
            return;
        }

        container.innerHTML = "";
        snap.forEach((docSnap) => {
            const oferta = docSnap.data();
            
            // Renderiza o card seguindo o estilo visual da sua ADM
            container.innerHTML += `
                <div onclick="window.open('${oferta.link}', '_blank')" class="card-oferta-membro" style="background: #1a1a1a; border-radius: 15px; overflow: hidden; border: 1px solid #333; margin-bottom: 20px; cursor: pointer; transition: 0.3s;">
                    <div style="width: 100%; height: 180px; position: relative; background: #222;">
                        ${oferta.imagem ? 
                            `<img src="${oferta.imagem}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                            `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #444; font-size: 2rem; font-weight: bold;">Oferta</div>`
                        }
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 20px;">
                            <h4 style="color: #fff; margin: 0; font-size: 1.2rem;">${oferta.titulo || 'Oferta'}</h4>
                        </div>
                    </div>
                    <div style="padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: var(--cor-primaria); font-size: 0.85rem; font-weight: bold; text-transform: uppercase;">Contribuir agora</span>
                        <i class="fas fa-external-link-alt" style="color: #666; font-size: 0.9rem;"></i>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar ofertas:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Erro ao conectar com o servidor.</p>`;
    }
};

// --- RESTANTE DO CÓDIGO (DEPARTAMENTOS, AGENDA, ETC) ---
async function carregarDepartamentos() {
    if (!idCliente) return;
    const container = document.getElementById('listaDepartamentosContainer');
    if (!container) return;
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando departamentos...</p>`;
    try {
        const colRef = collection(db, "clientes", idCliente, "departamentos");
        const snap = await getDocs(colRef);
        if (snap.empty) { container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhum departamento cadastrado.</p>`; return; }
        container.innerHTML = "";
        snap.forEach((docSnapshot) => {
            const dep = docSnapshot.data();
            const idDep = docSnapshot.id;
            container.innerHTML += `
                <div class="card-departamento" style="background:#1a1a1a; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #333; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${dep.imagem ? `<img src="${dep.imagem}" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">` : `<div style="width:60px; height:60px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center;"><i class="fas fa-users" style="color:#666;"></i></div>`}
                        <div style="flex:1;">
                            <h4 style="color:#fff; margin:0 0 5px 0;">${dep.nome || 'Departamento'}</h4>
                            <p style="color:#aaa; font-size:0.85rem; margin:0;">${dep.descricao || ''}</p>
                            ${dep.lider ? `<p style="color:var(--cor-primaria); font-size:0.75rem; margin-top:5px; font-weight:bold;">Líder: ${dep.lider}</p>` : ''}
                        </div>
                    </div>
                    <button onclick="window.inscreverDepartamento('${idDep}', '${dep.nome}')" style="width:100%; background:var(--cor-primaria); color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Participar</button>
                </div>`;
        });
    } catch (e) { container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar.</p>`; }
}

window.inscreverDepartamento = async (idDep, nomeDep) => {
    const user = auth.currentUser;
    if (!user) { alert("Faça login."); return; }
    if (!confirm(`Solicitar participação no ${nomeDep}?`)) return;
    try {
        await setDoc(doc(db, "clientes", idCliente, "departamentos", idDep, "membros", user.uid), {
            nome: user.displayName || "Membro", email: user.email, uid: user.uid, dataInscricao: new Date(), status: "pendente"
        });
        alert("Solicitação enviada!");
    } catch (e) { alert("Erro ao inscrever."); }
};

async function carregarAgenda() {
    if (!idCliente) return;
    const container = document.getElementById('listaEventos');
    if (!container) return;
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando...</p>`;
    try {
        const snap = await getDocs(collection(db, "clientes", idCliente, "eventos"));
        if (snap.empty) { container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Sem eventos.</p>`; return; }
        let eventos = [];
        snap.forEach(doc => { eventos.push({ id: doc.id, ...doc.data() }); });
        eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
        container.innerHTML = "";
        eventos.forEach((evento) => {
            const partes = (evento.data || "2026-01-01").split('-');
            const dia = partes[2] || "01";
            const dataLocal = new Date(partes[0], partes[1] - 1, partes[2]);
            const mes = dataLocal.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const corEvento = evento.cor || 'var(--cor-primaria)';
            container.innerHTML += `
                <div class="card-agenda" onclick="window.abrirInscricao('${evento.id}', '${evento.titulo}', '${evento.data}', '${evento.hora}')" style="display:flex; background:#1a1a1a; margin-bottom:12px; border-radius:12px; overflow:hidden; border:1px solid #333; cursor:pointer;">
                    <div style="background:${corEvento}; width:65px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-weight:bold; text-transform:uppercase;">
                        <span style="font-size:1.3rem;">${dia}</span><span style="font-size:0.75rem;">${mes}</span>
                    </div>
                    <div style="padding:12px; flex:1;">
                        <h4 style="margin:0; color:#fff;">${evento.titulo}</h4>
                        <span style="color:#aaa; font-size:0.8rem;"><i class="far fa-clock"></i> ${evento.hora || '--:--'}</span>
                    </div>
                </div>`;
        });
    } catch (e) { container.innerHTML = "Erro."; }
}

window.abrirInscricao = (id, titulo, data, hora) => {
    const modal = document.getElementById('modalInscricao');
    if (!modal) return;
    document.getElementById('ins_evento_id').value = id;
    document.getElementById('ins_evento_titulo').innerText = titulo;
    const dataFormatada = data ? data.split('-').reverse().join('/') : "";
    const infoEvento = document.getElementById('ins_evento_data_hora');
    if(infoEvento) infoEvento.innerText = `${dataFormatada} às ${hora || '--:--'}`;
    modal.style.display = 'flex';
};

window.fecharInscricao = () => { document.getElementById('modalInscricao').style.display = 'none'; };

window.confirmarInscricao = async () => {
    const idEv = document.getElementById('ins_evento_id').value;
    const nome = document.getElementById('ins_nome').value;
    const cpf = document.getElementById('ins_cpf').value;
    if (!nome || !cpf) return alert("Preencha Nome e CPF.");
    try {
        await addDoc(collection(db, "clientes", idCliente, "eventos", idEv, "inscritos"), {
            nomeCompleto: nome, cpf, userId: auth.currentUser ? auth.currentUser.uid : "anonimo", dataInscricao: new Date()
        });
        alert("Inscrição realizada!"); window.fecharInscricao();
    } catch (e) { alert("Erro."); }
};

async function carregarLeituraDiaria() {
    if (!idCliente) return;
    const container = document.getElementById('listaLeituraContainer');
    if(!container) return;
    try {
        const snap = await getDocs(collection(db, "clientes", idCliente, "leituras"));
        leiturasCache = [];
        snap.forEach(doc => { leiturasCache.push({ id: doc.id, ...doc.data() }); });
        leiturasCache.sort((a, b) => (b.dataLeitura > a.dataLeitura ? 1 : -1));
        renderizarLeituras();
    } catch (e) { container.innerHTML = "Erro."; }
}

window.filtrarLeitura = (filtro) => { filtroLeituraAtual = filtro; renderizarLeituras(); };
window.toggleLido = (id) => {
    const chave = `leituras_lidas_${idCliente}`;
    let lidas = JSON.parse(localStorage.getItem(chave) || "[]");
    lidas = lidas.includes(id) ? lidas.filter(i => i !== id) : [...lidas, id];
    localStorage.setItem(chave, JSON.stringify(lidas));
    renderizarLeituras();
};

function renderizarLeituras() {
    const container = document.getElementById('listaLeituraContainer');
    if(!container) return;
    const lidasStorage = JSON.parse(localStorage.getItem(`leituras_lidas_${idCliente}`) || "[]");
    container.innerHTML = "";
    leiturasCache.filter(item => (filtroLeituraAtual === 'lidas' ? lidasStorage.includes(item.id) : !lidasStorage.includes(item.id))).forEach(dados => {
        container.innerHTML += `
            <div class="card-leitura-diaria" style="background:#1a1a1a; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid #333;">
                <h2 style="color:#fff; margin:0 0 10px 0;">${dados.referencia || dados.versos}</h2>
                <div style="color:#bbb; margin-bottom:15px;">${(dados.texto || "").replace(/\n/g, '<br>')}</div>
                <button onclick="window.toggleLido('${dados.id}')" style="width:100%; padding:12px; background:#222; color:white; border-radius:10px; border:1px solid #444; cursor:pointer;">
                    ${lidasStorage.includes(dados.id) ? 'Desmarcar' : 'Marcar como lido'}
                </button>
            </div>`;
    });
}

function extrairVideoID(url) {
    const match = (url || "").match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
    return (match && match[7].length == 11) ? match[7] : null;
}

window.abrirVideo = (videoId) => {
    const iframe = document.getElementById('iframeVideo');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    document.getElementById('modalVideo').style.display = 'flex';
};

window.fecharVideo = () => { if(document.getElementById('iframeVideo')) document.getElementById('iframeVideo').src = ""; document.getElementById('modalVideo').style.display = 'none'; };

async function carregarVideosHome() {
    if (!idCliente) return;
    const snap = await getDocs(query(collection(db, "clientes", idCliente, "conteudos"), orderBy("dataCriacao", "desc"), limit(4)));
    const container = document.getElementById('gradeVideos');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach(doc => {
        const v = doc.data(); const id = extrairVideoID(v.url);
        if(id) container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${id}')"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg"><div class="video-info">${v.serie || 'Vídeo'}</div></div>`;
    });
}

async function carregarTodosVideos() {
    if (!idCliente) return;
    const snap = await getDocs(query(collection(db, "clientes", idCliente, "conteudos"), orderBy("dataCriacao", "desc")));
    const container = document.getElementById('gradeVideosCompleta');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach(doc => {
        const v = doc.data(); const id = extrairVideoID(v.url);
        if(id) container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${id}')"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg"><div class="video-info">${v.serie || 'Vídeo'}</div></div>`;
    });
}

window.abrirModalNota = (id = null, titulo = '', texto = '') => {
    document.getElementById('notaId').value = id || '';
    document.getElementById('notaTitulo').value = titulo || '';
    document.getElementById('notaTexto').value = texto || '';
    document.getElementById('btnExcluirNota').style.display = id ? 'block' : 'none';
    document.getElementById('modalNota').style.display = 'flex';
};

window.fecharModalNota = () => { document.getElementById('modalNota').style.display = 'none'; };

window.salvarNota = async () => {
    const user = auth.currentUser; if (!user) return;
    const id = document.getElementById('notaId').value;
    const data = { titulo: document.getElementById('notaTitulo').value, texto: document.getElementById('notaTexto').value, userId: user.uid, idCliente, dataAtualizacao: new Date() };
    id ? await updateDoc(doc(db, "anotacoes_membros", id), data) : await addDoc(collection(db, "anotacoes_membros"), { ...data, dataCriacao: new Date() });
    window.fecharModalNota();
};

window.excluirNota = async () => { if(confirm("Excluir?")) { await deleteDoc(doc(db, "anotacoes_membros", document.getElementById('notaId').value)); window.fecharModalNota(); } };

function escutarAnotacoes() {
    const user = auth.currentUser; if (!user) return;
    if (unsubscribeAnotacoes) unsubscribeAnotacoes();
    unsubscribeAnotacoes = onSnapshot(query(collection(db, "anotacoes_membros"), where("userId", "==", user.uid), where("idCliente", "==", idCliente), orderBy("dataAtualizacao", "desc")), (snap) => {
        const container = document.getElementById('gradeAnotacoes'); if(!container) return; container.innerHTML = "";
        snap.forEach(doc => { const n = doc.data(); container.innerHTML += `<div class="card-nota" onclick="window.abrirModalNota('${doc.id}', '${n.titulo}', '${n.texto}')"><h4>${n.titulo}</h4><p>${n.texto}</p></div>`; });
    });
}

window.abrirSeletorLivros = () => {
    const container = document.getElementById('containerSelecao');
    document.getElementById('resultadoBiblia').style.display = 'none'; container.style.display = 'grid';
    container.innerHTML = livrosBiblia.map(l => `<button onclick="window.selecionarCapitulo('${l}')">${l}</button>`).join('');
};

window.selecionarCapitulo = (livro) => {
    livroSelecionado = livro; const container = document.getElementById('containerSelecao');
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--cor-primaria)">${livro}</div>`;
    for(let i = 1; i <= 50; i++) container.innerHTML += `<button onclick="window.finalizarSelecao('${livro}', ${i})">${i}</button>`;
};

window.finalizarSelecao = (livro, cap) => {
    document.getElementById('containerSelecao').style.display = 'none';
    document.getElementById('resultadoBiblia').style.display = 'block';
    window.buscarBiblia('palavra', `${livro} ${cap}`);
};

window.buscarBiblia = async (tipo, valorManual = null) => {
    const res = document.getElementById('resultadoBiblia');
    let busca = valorManual || document.getElementById('inputPalavra').value;
    if (!busca) return;
    try {
        const data = await (await fetch(`https://bible-api.com/${encodeURIComponent(busca)}?translation=almeida`)).json();
        if (data.verses) res.innerHTML = data.verses.map(v => `<p><strong>${v.verse}</strong> ${v.text}</p>`).join('');
    } catch (e) { res.innerHTML = "Erro."; }
};

async function carregarNoticiasHome() {
    if (!idCliente) return;
    const snap = await getDocs(query(collection(db, "clientes", idCliente, "noticias"), orderBy("dataCriacao", "desc"), limit(6)));
    const container = document.getElementById('gradeNoticias'); if(!container) return; container.innerHTML = "";
    snap.forEach(doc => {
        const n = doc.data();
        container.innerHTML += `<div class="card-reflexao-premium" onclick="window.abrirReflexao('${JSON.stringify(n).replace(/"/g, '&quot;')}')"><img src="${n.capa}"><div class="video-info">${n.titulo}</div></div>`;
    });
}

window.abrirReflexao = (jsonStr) => {
    const d = JSON.parse(jsonStr);
    document.getElementById('modalImagem').src = d.capa;
    document.getElementById('modalTitulo').innerText = d.titulo;
    document.getElementById('modalTexto').innerHTML = (d.texto || "").replace(/\n/g, "<br>");
    document.getElementById('modalReflexao').style.display = 'flex';
};

window.fecharReflexao = () => { document.getElementById('modalReflexao').style.display = 'none'; };

window.enviarPedidoOracao = async () => {
    const texto = document.getElementById('oracaoTexto').value;
    if (!texto) return;
    await addDoc(collection(db, "clientes", idCliente, "pedidos_oracao"), {
        nome: auth.currentUser.displayName || "Membro", pedido: texto, userId: auth.currentUser.uid, status: "pendente", idCliente, dataCriacao: new Date()
    });
    document.getElementById('oracaoTexto').value = ""; alert("Pedido enviado!");
};

function escutarMeusPedidosOracao() {
    const user = auth.currentUser; if (!user) return;
    onSnapshot(query(collection(db, "clientes", idCliente, "pedidos_oracao"), where("userId", "==", user.uid), orderBy("dataCriacao", "desc"), limit(10)), (snap) => {
        const c = document.getElementById('meusPedidosLista'); if(!c) return; c.innerHTML = "";
        snap.forEach(doc => { const p = doc.data(); c.innerHTML += `<div style="border-left:4px solid ${p.status === 'pendente' ? 'orange' : 'green'}; padding:10px; margin-bottom:10px; background: #1a1a1a;">${p.pedido}</div>`; });
    });
}

window.toggleDataCasamento = () => {
    const s = document.getElementById('perfilCasado').value;
    if(document.getElementById('divDataCasamento')) document.getElementById('divDataCasamento').style.display = (s === 'sim') ? 'block' : 'none';
};

inicializarApp();
