import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit, 
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
let unsubscribeOracoes = null;

// VARIÁVEIS PARA CONTROLE DE LEITURA
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
        campoNome.style.display = "block";
        campoSenha.style.display = "block";
        btnPrincipal.innerText = "Cadastrar agora";
        toggleText.innerHTML = 'Já tem conta? <a href="#" onclick="window.mudarModoAuth(\'login\')" style="color:var(--cor-primaria); font-weight:bold;">Fazer Login</a>';
        linkRecuperar.style.display = "none";
        linkVoltar.style.display = "none";
    } else if (modo === 'recuperar') {
        titulo.innerText = "Recuperar Senha";
        subtitulo.innerText = "Digite seu e-mail para receber o link";
        campoNome.style.display = "none";
        campoSenha.style.display = "none";
        btnPrincipal.innerText = "Enviar Link";
        toggleText.style.display = "none";
        linkRecuperar.style.display = "none";
        linkVoltar.style.display = "block";
    } else {
        titulo.innerText = "Bem-vindo";
        subtitulo.innerText = "Acesse sua conta para continuar";
        campoNome.style.display = "none";
        campoSenha.style.display = "block";
        btnPrincipal.innerText = "Entrar";
        toggleText.style.display = "block";
        toggleText.innerHTML = 'Não tem conta? <a href="#" onclick="window.mudarModoAuth(\'cadastro\')" style="color:var(--cor-primaria); font-weight:bold;">Cadastre-se</a>';
        linkRecuperar.style.display = "block";
        linkVoltar.style.display = "none";
    }
};

window.loginGoogle = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error("Erro Google Auth:", error); alert("Erro ao entrar com Google."); }
};

document.getElementById('formAuth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const senha = document.getElementById('authSenha').value;
    const nome = document.getElementById('authNome').value;
    const btnTexto = document.getElementById('btnAuthPrincipal').innerText;

    try {
        if (btnTexto === "Entrar") {
            await signInWithEmailAndPassword(auth, email, senha);
        } else if (btnTexto === "Cadastrar agora") {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            await updateDoc(doc(db, "usuarios_app", userCredential.user.uid), {
                nome: nome, email: email, dataCriacao: new Date()
            }, { merge: true });
        } else if (btnTexto === "Enviar Link") {
            await sendPasswordResetEmail(auth, email);
            alert("E-mail de recuperação enviado!");
            window.mudarModoAuth('login');
        }
    } catch (error) { alert("Erro: " + error.message); }
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
            authContainer.style.display = 'none';
            const userDoc = await getDoc(doc(db, "usuarios_app", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if(nomeDisplay) nomeDisplay.innerText = userData.nome || "Membro";
                if(userData.fotoUrl) {
                    if(fotoDisplay) fotoDisplay.src = userData.fotoUrl;
                    if(fotoMenu) fotoMenu.src = userData.fotoUrl;
                }
            } else {
                if(nomeDisplay) nomeDisplay.innerText = user.displayName || "Membro";
                if(user.photoURL && fotoDisplay) fotoDisplay.src = user.photoURL;
            }
            window.mostrarSessao('home');
        } else {
            authContainer.style.display = 'flex';
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
    }
};

// --- AGENDA DE EVENTOS (VERSÃO ATUALIZADA COM DEBUG) ---
async function carregarAgenda() {
    if (!idCliente) return;
    const container = document.getElementById('listaEventos');
    if (!container) return;

    console.log("AGENDA: Buscando eventos para o cliente:", idCliente);
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando agenda...</p>`;

    try {
        // 1. Buscamos a coleção (Removi o orderBy aqui para evitar erro de índice se você ainda não o criou)
        const colRef = collection(db, "clientes", idCliente, "eventos");
        const snap = await getDocs(colRef);
        
        console.log("AGENDA: Documentos brutos encontrados:", snap.size);

        if (snap.empty) {
            container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhum evento programado.</p>`;
            return;
        }

        // 2. Colocamos em um array para ordenar via Javascript (Garante que funcione sem índice)
        let eventos = [];
        snap.forEach(doc => {
            eventos.push({ id: doc.id, ...doc.data() });
        });

        // 3. Ordenamos por data (YYYY-MM-DD)
        eventos.sort((a, b) => (a.data > b.data ? 1 : -1));

        container.innerHTML = "";
        eventos.forEach((evento) => {
            console.log("AGENDA: Processando evento:", evento.titulo);
            
            // Tratamento de data
            const dataValor = evento.data || "2026-01-01";
            const partes = dataValor.split('-'); 
            const dia = partes[2] || "00";
            
            // Criamos a data localmente para pegar o nome do mês
            const dataLocal = new Date(partes[0], partes[1] - 1, partes[2]);
            const mes = dataLocal.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            
            const corEvento = evento.cor || 'var(--cor-primaria)';

            container.innerHTML += `
                <div class="card-agenda" style="display:flex; background:#1a1a1a; margin-bottom:12px; border-radius:12px; overflow:hidden; border:1px solid #333;">
                    <div style="background:${corEvento}; width:65px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-weight:bold; text-transform:uppercase; flex-shrink:0;">
                        <span style="font-size:1.3rem; line-height:1;">${dia}</span>
                        <span style="font-size:0.75rem;">${mes}</span>
                    </div>
                    <div style="padding:12px; flex:1;">
                        <h4 style="margin:0 0 5px 0; color:#fff; font-size:1rem; font-weight:600;">${evento.titulo || 'Sem Título'}</h4>
                        <div style="display:flex; flex-wrap:wrap; gap:10px; color:#aaa; font-size:0.8rem;">
                            <span><i class="far fa-clock" style="color:${corEvento}"></i> ${evento.hora || '--:--'}</span>
                            ${evento.local ? `<span><i class="fas fa-map-marker-alt" style="color:${corEvento}"></i> ${evento.local}</span>` : ''}
                        </div>
                        ${evento.descricao ? `<p style="margin:8px 0 0 0; color:#888; font-size:0.8rem; line-height:1.4;">${evento.descricao}</p>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error("AGENDA: Erro crítico:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Erro ao carregar agenda. Verifique o console do navegador.</p>`;
    }
}

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
        snap.forEach(doc => {
            leiturasCache.push({ id: doc.id, ...doc.data() });
        });

        leiturasCache.sort((a, b) => (b.dataLeitura > a.dataLeitura ? 1 : -1));
        renderizarLeituras();
    } catch (e) {
        console.error("Erro ao carregar leituras:", e);
        container.innerHTML = `<p style="text-align:center; color:red;">Erro ao carregar dados.</p>`;
    }
}

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
        container.innerHTML = `<p style="text-align:center; color:#666; margin-top:30px; font-size:0.9rem;">Nenhuma leitura encontrada nesta aba.</p>`;
        return;
    }

    filtradas.forEach((dados) => {
        const dataFormatada = dados.dataLeitura ? dados.dataLeitura.split('-').reverse().join('/') : "--/--/--";
        const estaLida = lidasStorage.includes(dados.id);
        const textoBotao = estaLida ? 'Marcar como não lido' : 'Marcar como lido';
        const iconeBotao = estaLida ? 'fa-undo' : 'fa-check';

        container.innerHTML += `
            <div class="card-leitura-diaria" style="background:#1a1a1a; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid #333;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="background:var(--cor-primaria); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.7rem; font-weight:bold; text-transform:uppercase;">
                        ${dataFormatada}
                    </span>
                    <i class="fas fa-book-reader" style="color:var(--cor-primaria); opacity:0.5;"></i>
                </div>
                <h2 style="color:#fff; margin: 0 0 10px 0; font-size:1.4rem;">${dados.referencia || 'Leitura Bíblica'}</h2>
                <div style="color:#bbb; line-height:1.7; text-align:justify; font-size:1rem; border-top:1px solid #222; margin-top:10px; padding-top:10px; margin-bottom:15px;">
                    ${dados.texto ? dados.texto.replace(/\n/g, '<br>') : 'Texto não disponível.'}
                </div>
                
                <button onclick="window.toggleLido('${dados.id}')" style="width:100%; padding:12px; border-radius:10px; border:none; background:#222; color:white; font-weight:bold; cursor:pointer; border: 1px solid #444; display:flex; align-items:center; justify-content:center; gap:10px;">
                    <i class="fas ${iconeBotao}"></i> ${textoBotao}
                </button>
            </div>`;
    });
}

window.filtrarLeitura = (modo) => {
    filtroLeituraAtual = modo;
    const tabP = document.getElementById('tabPendentes');
    const tabL = document.getElementById('tabLidas');
    if(tabP) tabP.classList.toggle('active', modo === 'pendentes');
    if(tabL) tabL.classList.toggle('active', modo === 'lidas');
    renderizarLeituras();
};

window.toggleLido = (id) => {
    const chaveLidos = `leituras_lidas_${idCliente}`;
    let lidas = JSON.parse(localStorage.getItem(chaveLidos) || "[]");
    
    if (lidas.includes(id)) {
        lidas = lidas.filter(itemId => itemId !== id);
    } else {
        lidas.push(id);
    }
    
    localStorage.setItem(chaveLidos, JSON.stringify(lidas));
    renderizarLeituras(); 
};

// --- VÍDEOS ---
function extrairVideoID(url) {
    if (!url) return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : null;
}

window.abrirVideo = (videoId) => {
    const modal = document.getElementById('modalVideo');
    const iframe = document.getElementById('iframeVideo');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    if (modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.fecharVideo = () => {
    const iframe = document.getElementById('iframeVideo');
    if (iframe) iframe.src = "";
    document.getElementById('modalVideo').style.display = 'none';
    document.body.style.overflow = 'auto';
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
            container.innerHTML += `
                <div class="card-video-premium" onclick="window.abrirVideo('${videoId}')">
                    <div class="thumb-container">
                        <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg">
                        <div class="play-overlay"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="video-info">${v.serie || 'Conteúdo'}</div>
                </div>`;
        }
    });
}

async function carregarTodosVideos() {
    if (!idCliente) return;
    const q = query(collection(db, "clientes", idCliente, "conteudos"), orderBy("dataCriacao", "desc"));
    const snap = await getDocs(q);
    const container = document.getElementById('gradeVideosCompleta');
    if(!container) return;
    container.style.display = "grid";
    container.style.gridTemplateColumns = "1fr 1fr";
    container.style.gap = "12px";
    container.innerHTML = "";
    snap.forEach((doc) => {
        const v = doc.data();
        const videoId = extrairVideoID(v.url);
        if(videoId) {
            container.innerHTML += `
                <div class="card-video-premium" onclick="window.abrirVideo('${videoId}')" style="min-width: unset; width: 100%; margin: 0;">
                    <div class="thumb-container">
                        <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="width: 100%;">
                        <div class="play-overlay"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="video-info" style="font-size: 0.85rem;">${v.serie || 'Conteúdo'}</div>
                </div>`;
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
    document.body.style.overflow = 'hidden';
};

window.fecharModalNota = () => {
    document.getElementById('modalNota').style.display = 'none';
    document.body.style.overflow = 'auto';
};

window.salvarNota = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Faça login.");
    const id = document.getElementById('notaId').value;
    const titulo = document.getElementById('notaTitulo').value;
    const texto = document.getElementById('notaTexto').value;
    if (!titulo || !texto) return alert("Preencha tudo.");
    const notaData = { titulo, texto, userId: user.uid, idCliente: idCliente, dataAtualizacao: new Date() };
    try {
        if (id) { await updateDoc(doc(db, "anotacoes_membros", id), notaData); } 
        else { await addDoc(collection(db, "anotacoes_membros"), { ...notaData, dataCriacao: new Date() }); }
        window.fecharModalNota();
    } catch (e) { console.error(e); }
};

window.excluirNota = async () => {
    const id = document.getElementById('notaId').value;
    if (id && confirm("Excluir?")) { await deleteDoc(doc(db, "anotacoes_membros", id)); window.fecharModalNota(); }
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
            const id = doc.id;
            const tEsc = (n.titulo || "").replace(/'/g, "\\'");
            const txtEsc = (n.texto || "").replace(/'/g, "\\'").replace(/\n/g, "\\n");
            container.innerHTML += `
                <div class="card-nota" onclick="window.abrirModalNota('${id}', '${tEsc}', '${txtEsc}')">
                    <h4 class="nota-item-titulo">${n.titulo || "Sem título"}</h4>
                    <p class="nota-item-texto">${n.texto || ""}</p>
                </div>`;
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
    container.innerHTML = `<div style="grid-column:1/-1; padding:10px; font-weight:bold; color:var(--cor-primaria)">${livro}: Capítulo</div>`;
    for(let i = 1; i <= 150; i++) {
        container.innerHTML += `<button onclick="window.finalizarSelecao('${livro}', ${i})" style="background:var(--cor-primaria); color:white;">${i}</button>`;
    }
};

window.finalizarSelecao = (livro, cap) => {
    document.getElementById('containerSelecao').style.display = 'none';
    document.getElementById('resultadoBiblia').style.display = 'block';
    window.buscarBiblia('palavra', `${livro} ${cap}`);
};

window.buscarBiblia = async (tipo, valorManual = null) => {
    const resContainer = document.getElementById('resultadoBiblia');
    const labelNav = document.getElementById('labelNavegacao');
    const inputPalavra = document.getElementById('inputPalavra');
    let busca = valorManual || (inputPalavra ? inputPalavra.value : "");
    if (!busca) return;
    resContainer.innerHTML = "<p style='text-align:center;'>Carregando...</p>";
    try {
        const response = await fetch(`https://bible-api.com/${encodeURIComponent(busca)}?translation=almeida`);
        const data = await response.json();
        if (data.verses) {
            localStorage.setItem('ultima_leitura', busca);
            if(labelNav) labelNav.innerText = data.reference;
            resContainer.innerHTML = data.verses.map(v => `
                <div style="margin-bottom:15px; display:flex; gap:10px;">
                    <span style="color:var(--cor-primaria); font-weight:bold;">${v.verse}</span>
                    <p style="margin:0; color:#fff; text-align:justify;">${v.text}</p>
                </div>`).join('');
        }
    } catch (e) { console.error(e); }
};

// --- NOTÍCIAS ---
async function carregarNoticiasHome() {
    if (!idCliente) return;
    const q = query(collection(db, "clientes", idCliente, "noticias"), orderBy("dataCriacao", "desc"), limit(4));
    const snap = await getDocs(q);
    const container = document.getElementById('gradeNoticias');
    if(!container) return;
    container.innerHTML = "";
    snap.forEach((doc) => {
        const n = doc.data();
        const json = JSON.stringify({titulo: n.titulo, capa: n.capa, texto: n.texto}).replace(/"/g, '&quot;');
        container.innerHTML += `
            <div class="card-video-premium" style="min-width:220px;" onclick="window.abrirReflexao('${json}')">
                <img src="${n.capa || 'https://placehold.co/600x400'}" style="height:140px; object-fit:cover;">
                <div class="video-info"><strong>${n.titulo}</strong></div>
            </div>`;
    });
}

window.abrirReflexao = (jsonStr) => {
    const dados = JSON.parse(jsonStr);
    document.getElementById('modalImagem').src = dados.capa;
    document.getElementById('modalTitulo').innerText = dados.titulo;
    document.getElementById('modalTexto').innerHTML = dados.texto.replace(/\n/g, "<br>");
    document.getElementById('modalReflexao').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.fecharReflexao = () => {
    document.getElementById('modalReflexao').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// --- SISTEMA DE ORAÇÃO ---
window.enviarPedidoOracao = async () => {
    const nomeInput = document.getElementById('oracaoNome');
    const textoInput = document.getElementById('oracaoTexto');
    const btn = document.getElementById('btnEnviarOracao');
    const msg = document.getElementById('msgSucessoOracao');

    if (!nomeInput.value || !textoInput.value) {
        alert("Por favor, preencha seu nome e o motivo da oração.");
        return;
    }

    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando...`;

    try {
        await addDoc(collection(db, "clientes", idCliente, "pedidos_oracao"), {
            nome: nomeInput.value,
            pedido: textoInput.value,
            userId: auth.currentUser ? auth.currentUser.uid : "anonimo",
            status: "pendente",
            visualizado: false,
            idCliente: idCliente,
            dataCriacao: new Date()
        });

        nomeInput.value = "";
        textoInput.value = "";
        btn.style.display = "none";
        msg.style.display = "block";

        setTimeout(() => {
            msg.style.display = "none";
            btn.style.display = "flex";
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }, 5000);

    } catch (e) {
        console.error("Erro ao enviar oração:", e);
        alert("Erro ao enviar. Tente novamente.");
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
};

function escutarMeusPedidosOracao() {
    const user = auth.currentUser;
    const container = document.getElementById('meusPedidosLista');
    if (!user || !container) return;

    const q = query(
        collection(db, "clientes", idCliente, "pedidos_oracao"),
        where("userId", "==", user.uid),
        orderBy("dataCriacao", "desc"),
        limit(10)
    );

    if (unsubscribeOracoes) unsubscribeOracoes();
    unsubscribeOracoes = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        if(snapshot.empty) {
            container.innerHTML = "<p style='color:#666; font-size:0.8rem; text-align:center;'>Nenhum pedido enviado ainda.</p>";
            return;
        }
        snapshot.forEach((doc) => {
            const p = doc.data();
            const statusCor = p.status === 'pendente' ? 'orange' : '#2d6a4f';
            const statusTexto = p.status === 'pendente' ? 'Aguardando' : 'Atendido/Orado';

            container.innerHTML += `
                <div style="background:#222; padding:12px; border-radius:10px; margin-bottom:10px; border-left:4px solid ${statusCor};">
                    <p style="color:#fff; margin:0 0 5px 0; font-size:0.9rem;">${p.pedido}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:#888;">${p.dataCriacao.toDate().toLocaleDateString()}</small>
                        <small style="color:${statusCor}; font-weight:bold;">${statusTexto}</small>
                    </div>
                </div>`;
        });
    });
}

window.logoutCliente = () => { signOut(auth).then(() => { location.reload(); }); };
window.addEventListener('DOMContentLoaded', inicializarApp);