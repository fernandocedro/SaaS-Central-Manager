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
                
                // PREENCHE CAMPOS DO PERFIL
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

// --- FUNÇÃO DE OFERTAS (Vazia para evitar erro de ReferenceError) ---
window.carregarOfertas = () => {
    // Esta função existe apenas para o onclick do HTML não dar erro.
    // O conteúdo da oferta já está fixo no seu HTML.
    console.log("Sessão de ofertas aberta.");
};

// --- DEPARTAMENTOS ---
async function carregarDepartamentos() {
    if (!idCliente) return;
    const container = document.getElementById('listaDepartamentosContainer');
    if (!container) return;
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando departamentos...</p>`;
    
    try {
        const colRef = collection(db, "clientes", idCliente, "departamentos");
        const snap = await getDocs(colRef);
        
        if (snap.empty) {
            container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhum departamento cadastrado.</p>`;
            return;
        }
        
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
                    <button onclick="window.inscreverDepartamento('${idDep}', '${dep.nome}')" 
                            style="width:100%; background:var(--cor-primaria); color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">
                        Participar deste Departamento
                    </button>
                </div>`;
        });
    } catch (e) { 
        console.error(e);
        container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar departamentos.</p>`; 
    }
}

window.inscreverDepartamento = async (idDep, nomeDep) => {
    const user = auth.currentUser;
    if (!user) { alert("Você precisa estar logado para se inscrever."); return; }
    if (!confirm(`Deseja solicitar participação no departamento: ${nomeDep}?`)) return;

    try {
        const membroRef = doc(db, "clientes", idCliente, "departamentos", idDep, "membros", user.uid);
        await setDoc(membroRef, {
            nome: user.displayName || "Membro",
            email: user.email,
            uid: user.uid,
            dataInscricao: new Date(),
            status: "pendente"
        });
        alert("Solicitação enviada com sucesso!");
    } catch (e) { alert("Erro ao realizar inscrição."); }
};

// --- AGENDA ---
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
    } catch (e) { container.innerHTML = "Erro na agenda."; }
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
    } catch (e) { alert("Erro na inscrição."); }
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
    } catch (e) { container.innerHTML = "Erro ao carregar."; }
}

window.filtrarLeitura = (filtro) => {
    filtroLeituraAtual = filtro; 
    renderizarLeituras();
};

window.toggleLido = (id) => {
    const chaveLidos = `leituras_lidas_${idCliente}`;
    let lidas = JSON.parse(localStorage.getItem(chaveLidos) || "[]");
    if (lidas.includes(id)) { lidas = lidas.filter(i => i !== id); } 
    else { lidas.push(id); }
    localStorage.setItem(chaveLidos, JSON.stringify(lidas));
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
    filtradas.forEach((dados) => {
        const estaLida = lidasStorage.includes(dados.id);
        container.innerHTML += `
            <div class="card-leitura-diaria" style="background:#1a1a1a; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid #333;">
                <h2 style="color:#fff; margin: 0 0 10px 0; font-size:1.4rem;">${dados.referencia || 'Leitura'}</h2>
                <div style="color:#bbb; margin-bottom:15px;">${dados.texto ? dados.texto.replace(/\n/g, '<br>') : ''}</div>
                <button onclick="window.toggleLido('${dados.id}')" style="width:100%; padding:12px; background:#222; color:white; border-radius:10px; border:1px solid #444; cursor:pointer;">
                    ${estaLida ? 'Marcar como não lida' : 'Marcar como lido'}
                </button>
            </div>`;
    });
}

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
    for(let i = 1; i <= 50; i++) { container.innerHTML += `<button onclick="window.finalizarSelecao('${livro}', ${i})">${i}</button>`; }
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
        if (data.verses) { resContainer.innerHTML = data.verses.map(v => `<p><strong>${v.verse}</strong> ${v.text}</p>`).join(''); }
    } catch (e) { resContainer.innerHTML = "Erro ao buscar."; }
};

// --- NOTÍCIAS ---
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

// --- ORAÇÃO (ATUALIZADO COM MENSAGEM DE SUCESSO) ---
window.enviarPedidoOracao = async () => {
    const nome = document.getElementById('oracaoNome').value;
    const texto = document.getElementById('oracaoTexto').value;
    const msgSucesso = document.getElementById('statusOracao'); 

    if (!nome || !texto) return alert("Preencha tudo.");
    
    try {
        await addDoc(collection(db, "clientes", idCliente, "pedidos_oracao"), {
            nome, pedido: texto, userId: auth.currentUser.uid, status: "pendente", idCliente, dataCriacao: new Date()
        });
        
        document.getElementById('oracaoTexto').value = "";
        
        if(msgSucesso) {
            msgSucesso.innerText = "Sua oração foi enviada!";
            msgSucesso.style.display = "block";
            msgSucesso.style.color = "var(--cor-primaria)";
            setTimeout(() => { msgSucesso.style.display = "none"; }, 5000);
        }
    } catch (e) { 
        console.error(e); 
        alert("Erro ao enviar pedido.");
    }
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

// --- PERFIL ---
window.toggleDataCasamento = () => {
    const status = document.getElementById('perfilCasado').value;
    const divCasamento = document.getElementById('divDataCasamento');
    if(divCasamento) divCasamento.style.display = (status === 'sim') ? 'block' : 'none';
};

window.salvarPerfil = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.querySelector('#sessaoPerfil button');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";

    const dados = {
        nome: document.getElementById('perfilNome').value,
        whatsapp: document.getElementById('perfilTel').value,
        nascimento: document.getElementById('perfilNascimento').value,
        status: document.getElementById('perfilStatus').value,
        conversao: document.getElementById('perfilConversao').value,
        batismo: document.getElementById('perfilBatismo').value,
        casado: document.getElementById('perfilCasado').value,
        dataCasamento: document.getElementById('perfilDataCasamento').value,
        ultimaAtualizacao: new Date()
    };

    try {
        await setDoc(doc(db, "usuarios_app", user.uid), dados, { merge: true });
        alert("Perfil atualizado com sucesso!");
        if(document.getElementById('nomeMembro')) document.getElementById('nomeMembro').innerText = dados.nome;
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar perfil.");
    } finally {
        btn.innerText = textoOriginal;
    }
};

window.logout = () => { signOut(auth); };

// Inicializa o App
inicializarApp();
