import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, 
    addDoc, updateDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
    setPersistence, browserLocalPersistence
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

// --- FUNÇÃO DE UPLOAD DE FOTO (ADICIONE AQUI NO TOPO) ---
window.gerenciarUploadFoto = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Limite de 2MB para não travar o banco de dados
    if (file.size > 2 * 1024 * 1024) {
        alert("A foto deve ter no máximo 2MB");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = e.target.result;

        // Atualiza as imagens na tela
        if(document.getElementById('fotoPreviewPerfil')) document.getElementById('fotoPreviewPerfil').src = base64Image;
        if(document.getElementById('fotoMembro')) document.getElementById('fotoMembro').src = base64Image;
        if(document.getElementById('fotoMembroMenu')) document.getElementById('fotoMembroMenu').src = base64Image;

        // Salva temporariamente para enviar ao Firebase depois
        localStorage.setItem('cache_foto_membro', base64Image);
        console.log("Foto carregada no cache.");
    };
    reader.readAsDataURL(file);
};

// Forçar persistência local para APKs (não desloga ao fechar)
setPersistence(auth, browserLocalPersistence);

const urlParams = new URLSearchParams(window.location.search);
const idCliente = urlParams.get('id') || "jLO6R7R15iDKfPg25VTC";

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
        if(titulo) titulo.innerText = "Criar Conta";
        if(subtitulo) subtitulo.innerText = "Preencha os dados abaixo";
        if(campoNome) campoNome.style.display = "block";
        if(campoSenha) campoSenha.style.display = "block";
        if(btnPrincipal) btnPrincipal.innerText = "Cadastrar agora";
        if(toggleText) toggleText.innerHTML = 'Já tem conta? <a href="#" onclick="window.mudarModoAuth(\'login\')" style="color:var(--cor-primaria); font-weight:bold;">Fazer Login</a>';
        if(linkRecuperar) linkRecuperar.style.display = "none";
        if(linkVoltar) linkVoltar.style.display = "none";
    } else if (modo === 'recuperar') {
        if(titulo) titulo.innerText = "Recuperar Senha";
        if(subtitulo) subtitulo.innerText = "Digite seu e-mail para receber o link";
        if(campoNome) campoNome.style.display = "none";
        if(campoSenha) campoSenha.style.display = "none";
        if(btnPrincipal) btnPrincipal.innerText = "Enviar Link";
        if(toggleText) toggleText.style.display = "none";
        if(linkRecuperar) linkRecuperar.style.display = "none";
        if(linkVoltar) linkVoltar.style.display = "block";
    } else {
        if(titulo) titulo.innerText = "Bem-vindo";
        if(subtitulo) subtitulo.innerText = "Acesse sua conta para continuar";
        if(campoNome) campoNome.style.display = "none";
        if(campoSenha) campoSenha.style.display = "block";
        if(btnPrincipal) btnPrincipal.innerText = "Entrar";
        if(toggleText) {
            toggleText.style.display = "block";
            toggleText.innerHTML = 'Não tem conta? <a href="#" onclick="window.mudarModoAuth(\'cadastro\')" style="color:var(--cor-primaria); font-weight:bold;">Cadastre-se</a>';
        }
        if(linkRecuperar) linkRecuperar.style.display = "block";
        if(linkVoltar) linkVoltar.style.display = "none";
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
    const senha = document.getElementById('authSenha')?.value;
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

// --- FUNÇÃO DE SAIR DA CONTA ---
window.logoutCliente = async () => {
    if (confirm("Deseja realmente sair da conta?")) {
        try {
            await signOut(auth);
            // Limpa caches locais se necessário
            localStorage.removeItem('cache_foto_membro');
            alert("Você saiu da conta.");
            window.location.reload(); // Recarrega para mostrar a tela de login
        } catch (error) {
            console.error("Erro ao sair:", error);
            alert("Erro ao sair da conta.");
        }
    }
};

// --- FUNÇÃO DE EXCLUIR CONTA ---
window.excluirConta = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmacao = confirm("ATENÇÃO: Isso excluirá todos os seus dados permanentemente. Deseja continuar?");
    
    if (confirmacao) {
        try {
            // 1. Opcional: Deletar o documento do usuário no Firestore antes de deletar o Auth
            await deleteDoc(doc(db, "usuarios_app", user.uid));
            
            // 2. Deletar o usuário da Autenticação do Firebase
            // Nota: Para deletar o usuário do Auth, o Firebase exige que o login seja recente.
            // Se der erro de "requires-recent-login", o usuário precisará logar de novo antes de excluir.
            await user.delete();
            
            alert("Sua conta foi excluída com sucesso.");
            window.location.reload();
        } catch (error) {
            console.error("Erro ao excluir conta:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Para sua segurança, você precisa sair e logar novamente antes de excluir a conta.");
            } else {
                alert("Erro ao excluir conta: " + error.message);
            }
        }
    }
};

// --- FUNÇÃO DE SALVAR PERFIL (Caso ainda não tenha feito) ---
window.salvarPerfil = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const dados = {
            nome: document.getElementById('perfilNome').value,
            whatsapp: document.getElementById('perfilTel').value,
            nascimento: document.getElementById('perfilNascimento').value,
            status: document.getElementById('perfilStatus').value,
            conversao: document.getElementById('perfilConversao').value,
            batismo: document.getElementById('perfilBatismo').value,
            casado: document.getElementById('perfilCasado').value,
            dataCasamento: document.getElementById('perfilDataCasamento').value,
            // Pega a foto do cache se houver uma nova carregada manualmente
            fotoUrl: localStorage.getItem('cache_foto_membro') || user.photoURL || ""
        };

        await updateDoc(doc(db, "usuarios_app", user.uid), dados);
        alert("Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar alterações.");
    }
};

/// --- INICIALIZAÇÃO ---
async function inicializarApp() {
    const idFinal = idCliente; 

    // Cache visual rápido
    const corSalva = localStorage.getItem('cache_cor');
    const logoSalvo = localStorage.getItem('cache_logo');

    if (corSalva) {
        document.documentElement.style.setProperty('--cor-primaria', corSalva);
        document.documentElement.style.setProperty('--texto-bronze', corSalva);
    }
    if (logoSalvo) {
        if(document.getElementById('appLogoSide')) document.getElementById('appLogoSide').src = logoSalvo;
        if(document.getElementById('authLogo')) document.getElementById('authLogo').src = logoSalvo;
    }

    if (!idFinal) return;

    // Buscar dados do Cliente (Igreja)
    try {
        const docRef = doc(db, "clientes", idFinal);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();
            const cor = dados.corPrimaria || '#d4a373';
            const logoUrl = dados.logoUrl || '';

            document.documentElement.style.setProperty('--cor-primaria', cor);
            document.documentElement.style.setProperty('--texto-bronze', cor);
            localStorage.setItem('cache_cor', cor);
            
            if (logoUrl) {
                if(document.getElementById('appLogoSide')) document.getElementById('appLogoSide').src = logoUrl;
                if(document.getElementById('authLogo')) document.getElementById('authLogo').src = logoUrl;
                localStorage.setItem('cache_logo', logoUrl);
            }
            document.title = dados.nome;
        }
    } catch (e) { console.error("Erro ao carregar dados do cliente", e); }

    // Estado de Autenticação
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
                
                const campos = {
                    'perfilNome': userData.nome || "",
                    'perfilEmail': userData.email || user.email || "",
                    'perfilTel': userData.whatsapp || "",
                    'perfilNascimento': userData.nascimento || "",
                    'perfilStatus': userData.status || "Visitante",
                    'perfilConversao': userData.conversao || "",
                    'perfilBatismo': userData.batismo || "",
                    'perfilDataCasamento': userData.dataCasamento || ""
                };

                for (let id in campos) {
                    const el = document.getElementById(id);
                    if (el) el.value = campos[id];
                }

                if(document.getElementById('perfilCasado')) {
                    document.getElementById('perfilCasado').value = userData.casado || "nao";
                    window.toggleDataCasamento();
                }

                const urlFinal = userData.fotoUrl || user.photoURL;
                if(urlFinal) {
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

    if (aba === 'home') { carregarVideosHome(); carregarNoticiasHome(); }
    else if (aba === 'biblia') {
        const ultimaLeitura = localStorage.getItem('ultima_leitura');
        window.buscarBiblia('palavra', ultimaLeitura || 'Gênesis 1');
    }
    else if (aba === 'anotacoes') escutarAnotacoes();
    else if (aba === 'videos') carregarTodosVideos();
    else if (aba === 'leitura') carregarLeituraDiaria(); 
    else if (aba === 'oracao') escutarMeusPedidosOracao();
    else if (aba === 'agenda') carregarAgenda();
    else if (aba === 'departamentos') carregarDepartamentos();
    else if (aba === 'ofertas') window.carregarOfertas();
};

// --- FUNÇÃO DE OFERTAS ---
window.carregarOfertas = async () => {
    const container = document.getElementById('listaOfertasContainer');
    if (!container || !idCliente) return;
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">Carregando ofertas...</p>`;

    try {
        const colRef = collection(db, "clientes", idCliente, "ofertas");
        const snap = await getDocs(colRef);
        if (snap.empty) { container.innerHTML = `<p style="color:#666; text-align:center; padding:40px;">Nenhuma opção de oferta.</p>`; return; }
        container.innerHTML = "";
        snap.forEach((docSnap) => {
            const oferta = docSnap.data();
            container.innerHTML += `
                <div onclick="window.open('${oferta.link}', '_blank')" class="card-oferta-membro" style="background: #1a1a1a; border-radius: 15px; overflow: hidden; border: 1px solid #333; margin-bottom: 20px; cursor: pointer;">
                    <div style="width: 100%; height: 180px; background: #222;">
                        ${oferta.imagem ? `<img src="${oferta.imagem}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #444;">Oferta</div>`}
                    </div>
                    <div style="padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <h4 style="color: #fff; margin: 0;">${oferta.titulo || 'Contribuir'}</h4>
                        <i class="fas fa-external-link-alt" style="color: var(--cor-primaria);"></i>
                    </div>
                </div>`;
        });
    } catch (e) { container.innerHTML = "Erro."; }
};

// --- DEPARTAMENTOS ---
async function carregarDepartamentos() {
    if (!idCliente) return;
    const container = document.getElementById('listaDepartamentosContainer');
    if (!container) return;
    try {
        const snap = await getDocs(collection(db, "clientes", idCliente, "departamentos"));
        container.innerHTML = "";
        snap.forEach((docSnapshot) => {
            const dep = docSnapshot.data();
            container.innerHTML += `
                <div class="card-departamento" style="background:#1a1a1a; padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid #333;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${dep.imagem ? `<img src="${dep.imagem}" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">` : `<div style="width:60px; height:60px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center;"><i class="fas fa-users"></i></div>`}
                        <div style="flex:1;">
                            <h4 style="color:#fff; margin:0;">${dep.nome}</h4>
                            <p style="color:#aaa; font-size:0.8rem;">${dep.descricao || ''}</p>
                        </div>
                    </div>
                    <button onclick="window.inscreverDepartamento('${docSnapshot.id}', '${dep.nome}')" style="width:100%; background:var(--cor-primaria); color:white; border:none; padding:10px; border-radius:8px; margin-top:10px; font-weight:bold;">Participar</button>
                </div>`;
        });
    } catch (e) { container.innerHTML = "Erro."; }
}

window.inscreverDepartamento = async (idDep, nomeDep) => {
    const user = auth.currentUser;
    if (!user) return alert("Faça login.");
    if (!confirm(`Solicitar participação no ${nomeDep}?`)) return;
    try {
        await setDoc(doc(db, "clientes", idCliente, "departamentos", idDep, "membros", user.uid), {
            nome: user.displayName || "Membro", email: user.email, uid: user.uid, dataInscricao: new Date(), status: "pendente"
        });
        alert("Solicitação enviada!");
    } catch (e) { alert("Erro ao inscrever."); }
};

// --- AGENDA ---
async function carregarAgenda() {
    if (!idCliente) return;
    const container = document.getElementById('listaEventos');
    if (!container) return;
    try {
        const snap = await getDocs(collection(db, "clientes", idCliente, "eventos"));
        let eventos = [];
        snap.forEach(doc => { eventos.push({ id: doc.id, ...doc.data() }); });
        eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
        container.innerHTML = eventos.map(evento => {
            const partes = (evento.data || "2026-01-01").split('-');
            const dataLocal = new Date(partes[0], partes[1] - 1, partes[2]);
            const mes = dataLocal.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            return `
                <div class="card-agenda" onclick="window.abrirInscricao('${evento.id}', '${evento.titulo}', '${evento.data}', '${evento.hora}')" style="display:flex; background:#1a1a1a; margin-bottom:12px; border-radius:12px; overflow:hidden; border:1px solid #333;">
                    <div style="background:${evento.cor || 'var(--cor-primaria)'}; width:65px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-weight:bold;">
                        <span style="font-size:1.3rem;">${partes[2]}</span><span style="font-size:0.75rem;">${mes}</span>
                    </div>
                    <div style="padding:12px; flex:1;">
                        <h4 style="margin:0; color:#fff;">${evento.titulo}</h4>
                        <span style="color:#aaa; font-size:0.8rem;"><i class="far fa-clock"></i> ${evento.hora || '--:--'}</span>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { container.innerHTML = "Erro."; }
}

window.abrirInscricao = (id, titulo, data, hora) => {
    const modal = document.getElementById('modalInscricao');
    if (!modal) return;
    document.getElementById('ins_evento_id').value = id;
    document.getElementById('ins_evento_titulo').innerText = titulo;
    const dataF = data ? data.split('-').reverse().join('/') : "";
    document.getElementById('ins_evento_data_hora').innerText = `${dataF} às ${hora || '--:--'}`;
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
            nomeCompleto: nome, cpf, userId: auth.currentUser?.uid || "anonimo", dataInscricao: new Date()
        });
        alert("Inscrição realizada!"); window.fecharInscricao();
    } catch (e) { alert("Erro."); }
};

// --- LEITURA DIÁRIA ---
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
    const filtradas = leiturasCache.filter(item => (filtroLeituraAtual === 'lidas' ? lidasStorage.includes(item.id) : !lidasStorage.includes(item.id)));
    
    if (filtradas.length === 0) { container.innerHTML = `<p style="text-align:center; color:#888; padding:20px;">Nenhuma leitura.</p>`; return; }

    filtradas.forEach(dados => {
        const titulo = dados.referencia || dados.titulo || "Leitura";
        container.innerHTML += `
            <div class="card-leitura-diaria" style="background:#1a1a1a; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid #333;">
                <h2 style="color:#fff; margin:0 0 10px 0;">${titulo}</h2>
                <div style="color:#bbb; margin-bottom:15px;">${(dados.texto || "").replace(/\n/g, '<br>')}</div>
                <button onclick="window.toggleLido('${dados.id}')" style="width:100%; padding:12px; background:#222; color:white; border-radius:10px; border:1px solid #444;">
                    ${lidasStorage.includes(dados.id) ? 'Desmarcar' : 'Marcar como lido'}
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
        if(id) container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${id}')"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg"><div class="video-info">${v.serie || v.titulo || 'Vídeo'}</div></div>`;
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
        if(id) container.innerHTML += `<div class="card-video-premium" onclick="window.abrirVideo('${id}')"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg"><div class="video-info">${v.serie || v.titulo || 'Vídeo'}</div></div>`;
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
    const user = auth.currentUser; if (!user) return;
    const id = document.getElementById('notaId').value;
    const data = { titulo: document.getElementById('notaTitulo').value, texto: document.getElementById('notaTexto').value, userId: user.uid, idCliente, dataAtualizacao: new Date() };
    try {
        id ? await updateDoc(doc(db, "anotacoes_membros", id), data) : await addDoc(collection(db, "anotacoes_membros"), { ...data, dataCriacao: new Date() });
        window.fecharModalNota();
    } catch (e) { alert("Erro ao salvar."); }
};

window.excluirNota = async () => { if(confirm("Excluir?")) { await deleteDoc(doc(db, "anotacoes_membros", document.getElementById('notaId').value)); window.fecharModalNota(); } };

function escutarAnotacoes() {
    const user = auth.currentUser; if (!user) return;
    if (unsubscribeAnotacoes) unsubscribeAnotacoes();
    unsubscribeAnotacoes = onSnapshot(query(collection(db, "anotacoes_membros"), where("userId", "==", user.uid), where("idCliente", "==", idCliente), orderBy("dataAtualizacao", "desc")), (snap) => {
        const container = document.getElementById('gradeAnotacoes'); if(!container) return;
        container.innerHTML = "";
        snap.forEach(doc => { const n = doc.data(); container.innerHTML += `<div class="card-nota" onclick="window.abrirModalNota('${doc.id}', '${n.titulo}', '${n.texto}')"><h4>${n.titulo}</h4><p>${n.texto}</p></div>`; });
    });
}

// --- BÍBLIA ---
window.abrirSeletorLivros = () => {
    const container = document.getElementById('containerSelecao');
    document.getElementById('resultadoBiblia').style.display = 'none'; 
    container.style.display = 'grid';
    container.innerHTML = livrosBiblia.map(l => `<button onclick="window.selecionarCapitulo('${l}')">${l}</button>`).join('');
};

window.selecionarCapitulo = (livro) => {
    livroSelecionado = livro; 
    const container = document.getElementById('containerSelecao');
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--cor-primaria); font-weight:bold; padding:10px;">${livro} - Escolha o Capítulo</div>`;
    for(let i = 1; i <= 60; i++) container.innerHTML += `<button onclick="window.finalizarSelecao('${livro}', ${i})">${i}</button>`;
};

window.finalizarSelecao = (livro, cap) => {
    document.getElementById('containerSelecao').style.display = 'none';
    document.getElementById('resultadoBiblia').style.display = 'block';
    localStorage.setItem('ultima_leitura', `${livro} ${cap}`);
    window.buscarBiblia('palavra', `${livro} ${cap}`);
};

window.buscarBiblia = async (tipo, valorManual = null) => {
    const res = document.getElementById('resultadoBiblia');
    let busca = valorManual || document.getElementById('inputPalavra').value;
    if (!busca) return;
    res.innerHTML = "Buscando...";
    try {
        const response = await fetch(`https://bible-api.com/${encodeURIComponent(busca)}?translation=almeida`);
        const data = await response.json();
        if (data.verses) {
            res.innerHTML = `<h3 style="color:var(--cor-primaria);">${data.reference}</h3>` + data.verses.map(v => `<p><strong style="color:var(--cor-primaria);">${v.verse}</strong> ${v.text}</p>`).join('');
        } else { res.innerHTML = "Referência não encontrada."; }
    } catch (e) { res.innerHTML = "Erro ao carregar Bíblia."; }
};

// --- NOTÍCIAS/REFLEXÕES ---
async function carregarNoticiasHome() {
    if (!idCliente) return;
    try {
        const snap = await getDocs(query(collection(db, "clientes", idCliente, "noticias"), orderBy("dataCriacao", "desc"), limit(6)));
        const container = document.getElementById('gradeNoticias'); if(!container) return;
        container.innerHTML = "";
        snap.forEach(doc => {
            const n = doc.data();
            container.innerHTML += `<div class="card-reflexao-premium" onclick="window.abrirReflexao('${JSON.stringify(n).replace(/"/g, '&quot;')}')"><img src="${n.capa}"><div class="video-info">${n.titulo}</div></div>`;
        });
    } catch (e) { console.error(e); }
}

window.abrirReflexao = (jsonStr) => {
    const d = JSON.parse(jsonStr);
    document.getElementById('modalImagem').src = d.capa;
    document.getElementById('modalTitulo').innerText = d.titulo;
    document.getElementById('modalTexto').innerHTML = (d.texto || "").replace(/\n/g, "<br>");
    document.getElementById('modalReflexao').style.display = 'flex';
};

window.fecharReflexao = () => { document.getElementById('modalReflexao').style.display = 'none'; };

// --- ORAÇÃO ---
window.enviarPedidoOracao = async () => {
    const texto = document.getElementById('oracaoTexto').value;
    if (!texto) return;
    try {
        await addDoc(collection(db, "clientes", idCliente, "pedidos_oracao"), {
            nome: auth.currentUser?.displayName || "Membro", pedido: texto, userId: auth.currentUser.uid, status: "pendente", idCliente, dataCriacao: new Date()
        });
        document.getElementById('oracaoTexto').value = ""; alert("Pedido enviado!");
    } catch (e) { alert("Erro ao enviar."); }
};

function escutarMeusPedidosOracao() {
    const user = auth.currentUser; if (!user) return;
    onSnapshot(query(collection(db, "clientes", idCliente, "pedidos_oracao"), where("userId", "==", user.uid), orderBy("dataCriacao", "desc"), limit(10)), (snap) => {
        const c = document.getElementById('meusPedidosLista'); if(!c) return;
        c.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            const cor = p.status === 'pendente' ? 'orange' : 'green';
            c.innerHTML += `<div style="border-left:4px solid ${cor}; padding:10px; margin-bottom:10px; background: #1a1a1a; border-radius:4px;">${p.pedido} <br> <small style="color:${cor}">${p.status}</small></div>`;
        });
    });
}

window.toggleDataCasamento = () => {
    const s = document.getElementById('perfilCasado')?.value;
    const div = document.getElementById('divDataCasamento');
    if(div) div.style.display = (s === 'sim') ? 'block' : 'none';
};

// Iniciar
inicializarApp();