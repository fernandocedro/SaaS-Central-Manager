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
                if(document.getElementById('ins_nome')) document.getElementById('ins_nome').value = userData.nome || "";
                if(userData.fotoUrl || user.photoURL) {
                    const urlFinal = userData.fotoUrl || user.photoURL;
                    if(fotoDisplay) fotoDisplay.src = urlFinal;
                    if(fotoMenu) fotoMenu.src = urlFinal;
                }
            } else {
                if(nomeDisplay) nomeDisplay.innerText = user.displayName || "Membro";
                if(user.photoURL && fotoDisplay) fotoDisplay.src = user.photoURL;
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
    } else if (aba === 'ofertas') {
        carregarOfertas();
    }
};

// --- OFERTAS E DÍZIMOS ---
async function carregarOfertas() {
    if (!idCliente) return;
    const container = document.getElementById('listaOfertasContainer');
    if (!container) return;

    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando opções...</p>`;

    try {
        const colRef = collection(db, "clientes", idCliente, "ofertas");
        const snap = await getDocs(colRef);
        
        if (snap.empty) {
            container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhuma informação de dízimo disponível.</p>`;
            return;
        }

        container.innerHTML = "";
        snap.forEach((doc) => {
            const of = doc.data();
            container.innerHTML += `
                <div class="card-oferta" style="background:#1a1a1a; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #333;">
                    ${of.imagem ? `<img src="${of.imagem}" style="width:100%; border-radius:8px; margin-bottom:10px;">` : ''}
                    <h4 style="color:#fff; margin:0 0 5px 0;">${of.titulo || 'Oferta'}</h4>
                    <p style="color:#aaa; font-size:0.85rem; margin-bottom:12px;">${of.descricao || ''}</p>
                    <a href="${of.link}" target="_blank" style="display:block; text-align:center; background:var(--cor-primaria); color:white; padding:10px; border-radius:8px; text-decoration:none; font-weight:bold;">
                        Contribuir Agora
                    </a>
                </div>`;
        });
    } catch (e) {
        container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar ofertas.</p>`;
    }
}

// --- AGENDA DE EVENTOS ---
async function carregarAgenda() {
    if (!idCliente) return;
    const container = document.getElementById('listaEventos');
    if (!container) return;
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando agenda...</p>`;
    try {
        const colRef = collection(db, "clientes", idCliente, "eventos");
        const snap = await getDocs(colRef);
        if (snap.empty) {
            container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhum evento programado.</p>`;
            return;
        }
        let eventos = [];
        snap.forEach(doc => { eventos.push({ id: doc.id, ...doc.data() }); });
        eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
        container.innerHTML = "";
        eventos.forEach((evento) => {
            const dataValor = evento.data || "2026-01-01";
            const partes = dataValor.split('-'); 
            const dia = partes[2] || "01";
            const dataLocal = new Date(partes[0], partes[1] - 1, partes[2]);
            const mes = dataLocal.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const corEvento = evento.cor || 'var(--cor-primaria)';
            container.innerHTML += `
                <div class="card-agenda" onclick="window.abrirInscricao('${evento.id}', '${evento.titulo}', '${evento.data}', '${evento.hora}')" style="display:flex; background:#1a1a1a; margin-bottom:12px; border-radius:12px; overflow:hidden; border:1px solid #333; cursor:pointer;">
                    <div style="background:${corEvento}; width:65px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-weight:bold; text-transform:uppercase; flex-shrink:0;">
                        <span style="font-size:1.3rem; line-height:1;">${dia}</span>
                        <span style="font-size:0.75rem;">${mes}</span>
                    </div>
                    <div style="padding:12px; flex:1;">
                        <h4 style="margin:0 0 5px 0; color:#fff; font-size:1rem; font-weight:600;">${evento.titulo || 'Sem Título'}</h4>
                        <div style="display:flex; flex-wrap:wrap; gap:10px; color:#aaa; font-size:0.8rem;">
                            <span><i class="far fa-clock" style="color:${corEvento}"></i> ${evento.hora || '--:--'}</span>
                        </div>
                    </div>
                </div>`;
        });
    } catch (e) { container.innerHTML = `<p style="color:red; text-align:center;">Erro na agenda.</p>`; }
}

// Funções de Modal de Inscrição
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
    const sobrenome = document.getElementById('ins_sobrenome').value;
    const cpf = document.getElementById('ins_cpf').value;
    if (!nome || !cpf) return alert("Preencha seu Nome e CPF.");
    try {
        await addDoc(collection(db, "clientes", idCliente, "eventos", idEv, "inscritos"), {
            nome, sobrenome, nomeCompleto: `${nome} ${sobrenome}`, cpf,
            userId: auth.currentUser ? auth.currentUser.uid : "anonimo",
            dataInscricao: new Date()
        });
        alert("Inscrição realizada!");
        window.fecharInscricao();
    } catch (e) { alert("Erro na inscription."); }
};

// --- LEITURA DIÁRIA ---
async function carregarLeituraDiaria() {
    if (!idCliente) return;
    const container = document.getElementById('listaLeituraContainer');
    if(!container) return;
    container.innerHTML = `<p style="color:#888; text-align:center;">Buscando leituras...</p>`;
    try {
        const colRef = collection(db, "clientes", idCliente, "leituras");
        const snap = await getDocs(colRef);
        leiturasCache = [];
        snap.forEach(doc => { leiturasCache.push({ id: doc.id, ...doc.data() }); });
        leiturasCache.sort((a, b) => (b.dataLeitura > a.dataLeitura ? 1 : -1));
        renderizarLeituras();
    } catch (e) { container.innerHTML = `<p style="color:red;">Erro ao carregar leituras.</p>`; }
}

window.filtrarLeitura = (filtro) => {
    filtroLeituraAtual = filtro; 
    
    const btnPendentes = document.getElementById('tabPendentes');
    const btnLidas = document.getElementById('tabLidas');
    
    if (btnPendentes && btnLidas) {
        if (filtro === 'pendentes') {
            btnPendentes.classList.add('active');
            btnLidas.classList.remove('active');
        } else {
            btnLidas.classList.add('active');
            btnPendentes.classList.remove('active');
        }
    }
    
    renderizarLeituras();
};

function renderizarLeituras() {
    const container = document.getElementById('listaLeituraContainer');
    if(!container) return;
    const chaveLidos = `leituras_lidas_${idCliente}`;
    const lidasStorage = JSON.parse(localStorage.getItem(chaveLidos) || "[]");
    container.innerHTML = "";
    
    const filtradas = leiturasCache.filter(item => {
        const estaLida = lidasStorage.includes(item.id);
        return filtroLeituraAtual === 'lidas' ? estaLida : !estaLida;
    });

    if (filtradas.length === 0) {
        container.innerHTML = `<p style="color:#666; text-align:center; padding:20px;">Nenhuma leitura encontrada nesta aba.</p>`;
        return;
    }

    filtradas.forEach((dados) => {
        const estaLida = lidasStorage.includes(dados.id);
        container.innerHTML += `
            <div class="card-leitura-diaria" style="background:#1a1a1a; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid #333;">
                <h2 style="color:#fff; margin: 0 0 10px 0; font-size:1.4rem;">${dados.referencia || 'Leitura'}</h2>
                <div style="color:#bbb; margin-bottom:15px;">${dados.texto ? dados.texto.replace(/\n/g, '<br>') : ''}</div>
                <button onclick="window.toggleLido('${dados.id}')" style="width:100%; padding:12px; background:#222; color:white; border-radius:10px; border:1px solid #444;">
                    ${estaLida ? 'Marcar como não lido' : 'Marcar como lido'}
                </button>
            </div>`;
    });
}

window.toggleLido = (id) => {
    const chaveLidos = `leituras_lidas_${idCliente}`;
    let lidas = JSON.parse(localStorage.getItem(chaveLidos) || "[]");
    lidas = lidas.includes(id) ? lidas.filter(i => i !== id) : [...lidas, id];
    localStorage.setItem(chaveLidos, JSON.stringify(lidas));
    renderizarLeituras(); 
};

// --- VÍDEOS ---
function extrairVideoID(url) {
    if (!url) return null;
    const match = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
    return (match && match[7].length == 11) ? match[7] : null;
}

window.abrirVideo = (videoId) => {
    const modal = document.getElementById('modalVideo');
    const iframe = document.getElementById('iframeVideo');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    if (modal) modal.style.display = 'flex';
};

window.fecharVideo = () => {
    const iframe = document.getElementById('iframeVideo');
    if (iframe) iframe.src = "";
    document.getElementById('modalVideo').style.display = 'none';
};

async function carregarVideosHome() {
    if (!idCliente) return;
    const q = query(collection(db, "clientes", idCliente, "conteudos"), orderBy("dataCriacao", "desc"), limit(4));
    const snap = await getDocs(q);
    const container = document.getElementById('gradeVideos');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach((doc) => {
        const v = doc.data();
        const videoId = extrairVideoID(v.url);
        if(videoId) {
            container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${videoId}')"><img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg"><div class="video-info">${v.serie || 'Conteúdo'}</div></div>`;
        }
    });
}

async function carregarTodosVideos() {
    if (!idCliente) return;
    const q = query(collection(db, "clientes", idCliente, "conteudos"), orderBy("dataCriacao", "desc"));
    const snap = await getDocs(q);
    const container = document.getElementById('gradeVideosCompleta');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach((doc) => {
        const v = doc.data();
        const videoId = extrairVideoID(v.url);
        if(videoId) {
            container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${videoId}')"><img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg"><div class="video-info">${v.serie || 'Conteúdo'}</div></div>`;
        }
    });
}

// --- ANOTAÇÕES ---
window.abrirModalNota = (id = null, titulo = '', texto = '') => {
    document.getElementById('notaId').value = id || '';
    document.getElementById('notaTitulo').value = titulo || '';
    document.getElementById('notaTexto').value = texto || '';
    document.getElementById('btnExcluirNota').style.display = id ? 'block' : 'none';
    document.getElementById('modalNota').style.display = 'flex';
};

window.fecharModalNota = () => { document.getElementById('modalNota').style.display = 'none'; };

window.salvarNota = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Faça login.");
    const id = document.getElementById('notaId').value;
    const titulo = document.getElementById('notaTitulo').value;
    const texto = document.getElementById('notaTexto').value;
    const notaData = { titulo, texto, userId: user.uid, idCliente: idCliente, dataAtualizacao: new Date() };
    try {
        if (id) { await updateDoc(doc(db, "anotacoes_membros", id), notaData); } 
        else { await addDoc(collection(db, "anotacoes_membros"), { ...notaData, dataCriacao: new Date() }); }
        window.fecharModalNota();
    } catch (e) { console.error(e); }
};

window.excluirNota = async () => {
    const id = document.getElementById('notaId').value;
    if (id && confirm("Deseja excluir?")) { await deleteDoc(doc(db, "anotacoes_membros", id)); window.fecharModalNota(); }
};

function escutarAnotacoes() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "anotacoes_membros"), where("userId", "==", user.uid), where("idCliente", "==", idCliente), orderBy("dataAtualizacao", "desc"));
    if (unsubscribeAnotacoes) unsubscribeAnotacoes();
    unsubscribeAnotacoes = onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeAnotacoes');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((doc) => {
            const n = doc.data();
            container.innerHTML += `<div class="card-nota" onclick="window.abrirModalNota('${doc.id}', '${n.titulo}', '${n.texto}')"><h4>${n.titulo}</h4><p>${n.texto}</p></div>`;
        });
    });
}

// --- BÍBLIA ---
window.abrirSeletorLivros = () => {
    const container = document.getElementById('containerSelecao');
    document.getElementById('resultadoBiblia').style.display = 'none';
    container.style.display = 'grid';
    container.innerHTML = livrosBiblia.map(livro => `<button onclick="window.selecionarCapitulo('${livro}')">${livro}</button>`).join('');
};

window.selecionarCapitulo = (livro) => {
    livroSelecionado = livro;
    const container = document.getElementById('containerSelecao');
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--cor-primaria)">${livro}: Escolha o Capítulo</div>`;
    for(let i = 1; i <= 50; i++) {
        container.innerHTML += `<button onclick="window.finalizarSelecao('${livro}', ${i})">${i}</button>`;
    }
};

window.finalizarSelecao = (livro, cap) => {
    document.getElementById('containerSelecao').style.display = 'none';
    document.getElementById('resultadoBiblia').style.display = 'block';
    window.buscarBiblia('palavra', `${livro} ${cap}`);
};

window.buscarBiblia = async (tipo, valorManual = null) => {
    const resContainer = document.getElementById('resultadoBiblia');
    let busca = valorManual || document.getElementById('inputPalavra').value;
    if (!busca) return;
    resContainer.innerHTML = "Buscando...";
    try {
        const response = await fetch(`https://bible-api.com/${encodeURIComponent(busca)}?translation=almeida`);
        const data = await response.json();
        if (data.verses) {
            resContainer.innerHTML = data.verses.map(v => `<p><strong>${v.verse}</strong> ${v.text}</p>`).join('');
        }
    } catch (e) { resContainer.innerHTML = "Erro ao buscar."; }
};

// --- NOTÍCIAS / REFLEXÕES ---
async function carregarNoticiasHome() {
    if (!idCliente) return;
    const q = query(collection(db, "clientes", idCliente, "noticias"), orderBy("dataCriacao", "desc"), limit(6));
    const snap = await getDocs(q);
    const container = document.getElementById('gradeNoticias');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach((doc) => {
        const n = doc.data();
        container.innerHTML += `
            <div class="card-reflexao-premium" onclick="window.abrirReflexao('${JSON.stringify(n).replace(/"/g, '&quot;')}')">
                <img src="${n.capa}">
                <div class="video-info">${n.titulo}</div>
            </div>`;
    });
}

window.abrirReflexao = (jsonStr) => {
    const dados = JSON.parse(jsonStr);
    document.getElementById('modalImagem').src = dados.capa;
    document.getElementById('modalTitulo').innerText = dados.titulo;
    document.getElementById('modalTexto').innerHTML = (dados.texto || "").replace(/\n/g, "<br>");
    document.getElementById('modalReflexao').style.display = 'flex';
};

window.fecharReflexao = () => { document.getElementById('modalReflexao').style.display = 'none'; };

// --- ORAÇÃO ---
window.enviarPedidoOracao = async () => {
    const nome = document.getElementById('oracaoNome').value;
    const texto = document.getElementById('oracaoTexto').value;
    if (!nome || !texto) return alert("Preencha tudo.");
    try {
        await addDoc(collection(db, "clientes", idCliente, "pedidos_oracao"), {
            nome, pedido: texto, userId: auth.currentUser.uid, status: "pendente", idCliente, dataCriacao: new Date()
        });
        alert("Pedido enviado!");
    } catch (e) { console.error(e); }
};

function escutarMeusPedidosOracao() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "clientes", idCliente, "pedidos_oracao"), where("userId", "==", user.uid), orderBy("dataCriacao", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('meusPedidosLista');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((doc) => {
            const p = doc.data();
            container.innerHTML += `<div style="border-left:4px solid ${p.status === 'pendente' ? 'orange' : 'green'}; padding:10px; margin-bottom:10px;">${p.pedido}</div>`;
        });
    });
}

window.logoutCliente = () => { signOut(auth).then(() => { location.reload(); }); };
window.addEventListener('DOMContentLoaded', inicializarApp);
