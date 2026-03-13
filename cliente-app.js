import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
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
const storage = getStorage(app);

let idClienteDoc = null; 
let todosOsVideos = []; 

// --- FUNÇÃO DE APOIO: COMPRESSÃO E ESCAPE ---
async function otimizarImagem(arquivo) {
    if (!arquivo || !arquivo.type.startsWith('image/')) return arquivo;
    const opcoes = { maxSizeMB: 0.8, maxWidthOrHeight: 1024, useWebWorker: true };
    try {
        // @ts-ignore
        return await window.imageCompression(arquivo, opcoes);
    } catch (error) {
        console.error("Erro na compressão:", error);
        return arquivo;
    }
}

const esc = (str) => str ? String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;") : "";

// --- 2. NAVEGAÇÃO ENTRE ABAS ---
window.mostrarSessao = (sessao) => {
    const secoesIds = [
        'secaoAdicionar', 'secaoGerenciar', 'secaoNoticias', 
        'secaoEventos', 'secaoOfertas', 'secaoUsuarios', 
        'secaoLeitura', 'secaoNotificacoes', 'secaoOracoes'
    ];
    
    secoesIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    document.querySelectorAll('.menu-items li').forEach(li => li.classList.remove('active'));

    const mapeamento = {
        'add': { secao: 'secaoAdicionar', menu: 'menuAdd' },
        'list': { secao: 'secaoGerenciar', menu: 'menuList', acao: carregarVideos },
        'noticias': { secao: 'secaoNoticias', menu: 'menuNews', acao: carregarNoticias },
        'eventos': { secao: 'secaoEventos', menu: 'menuEvents', acao: carregarEventos },
        'ofertas': { secao: 'secaoOfertas', menu: 'menuOffers', acao: carregarOfertas },
        'usuarios': { secao: 'secaoUsuarios', menu: 'menuUsers', acao: carregarUsuariosApp },
        'leitura': { secao: 'secaoLeitura', menu: 'menuBible', acao: carregarLeituras },
        'notificacoes': { secao: 'secaoNotificacoes', menu: 'menuPush' },
        'oracoes': { secao: 'secaoOracoes', menu: 'menuPrayers', acao: carregarOracoes }
    };

    const config = mapeamento[sessao];
    if (config) {
        const elSecao = document.getElementById(config.secao);
        const elMenu = document.getElementById(config.menu);
        if (elSecao) elSecao.style.display = 'block';
        if (elMenu) elMenu.classList.add('active');
        if (config.acao) config.acao();
    }
};

// --- 3. LÓGICA CONDICIONAL (EVENTOS) ---
window.toggleInscricao = () => {
    const check = document.getElementById('eventoRequerInscricao');
    const campo = document.getElementById('campoLinkInscricao');
    if(campo && check) campo.style.display = check.checked ? 'block' : 'none';
};

window.togglePagamento = () => {
    const check = document.getElementById('eventoEhPago');
    const campo = document.getElementById('campoValorEvento');
    if(campo && check) campo.style.display = check.checked ? 'block' : 'none';
};

// --- 4. GESTÃO DE VÍDEOS ---
document.getElementById('inputBusca')?.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosOsVideos.filter(v => 
        (v.serie && v.serie.toLowerCase().includes(termo)) || 
        (v.descricao && v.descricao.toLowerCase().includes(termo))
    );
    renderizarGradeVideos(filtrados);
});

function carregarVideos() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "conteudos"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        todosOsVideos = [];
        snapshot.forEach((doc) => todosOsVideos.push({ id: doc.id, ...doc.data() }));
        renderizarGradeVideos(todosOsVideos);
    });
}

function renderizarGradeVideos(lista) {
    const container = document.getElementById('gradeVideos');
    if (!container) return;
    container.innerHTML = lista.length ? "" : "<p style='color: #888; padding: 20px;'>Nenhum vídeo encontrado.</p>";

    lista.forEach((video) => {
        const thumb = video.thumbnail || 'https://placehold.co/300x150/222/white?text=Sem+Thumbnail';
        container.innerHTML += `
            <div class="card-video">
                <img src="${thumb}" class="thumb-video">
                <div class="info-video">
                    <span class="badge-serie">${video.serie || 'Geral'}</span>
                    <h4>${video.serie || 'Sem Título'}</h4>
                    <p>${video.descricao || ''}</p>
                    <div class="acoes-video">
                        <button onclick="window.prepararEdicaoVideo('${video.id}', '${esc(video.serie)}', '${esc(video.descricao)}')" class="btn-edit-sm"><i class="fas fa-edit"></i></button>
                        <button onclick="window.excluirVideo('${video.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

document.getElementById('formConteudo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnAcaoPrincipal');
    const thumbFile = document.getElementById('videoThumb')?.files?.[0];
    if (btn) { btn.disabled = true; btn.innerText = "Processando..."; }
    try {
        let thumbUrl = "";
        if (thumbFile) {
            const arquivoOtimizado = await otimizarImagem(thumbFile);
            const storageRef = ref(storage, `clientes/${idClienteDoc}/conteudos/${Date.now()}_${thumbFile.name}`);
            const snapshot = await uploadBytes(storageRef, arquivoOtimizado);
            thumbUrl = await getDownloadURL(snapshot.ref);
        }
        await addDoc(collection(db, "clientes", idClienteDoc, "conteudos"), {
            tipo: "video",
            url: document.getElementById('videoUrl')?.value || "",
            serie: document.getElementById('videoSerie')?.value || "",
            descricao: document.getElementById('videoDesc')?.value || "",
            thumbnail: thumbUrl,
            dataCriacao: serverTimestamp()
        });
        alert("Vídeo publicado!");
        e.target.reset();
        window.mostrarSessao('list');
    } catch (err) { alert("Erro ao publicar vídeo."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Publicar Vídeo"; } }
});

// --- 5. GESTÃO DE NOTÍCIAS ---
function carregarNoticias() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "noticias"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeNoticias');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const n = docSnap.data();
            container.innerHTML += `
                <div class="card-video">
                    <img src="${n.capa || 'https://placehold.co/300x150/222/white?text=Noticia'}" class="thumb-video">
                    <div class="info-video">
                        <h4>${n.titulo || ''}</h4>
                        <p>${n.texto?.substring(0, 80) || ''}...</p>
                        <div class="acoes-video">
                            <button onclick="window.excluirNoticia('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i> Excluir</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

document.getElementById('formNoticia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarNoticia');
    const imgFile = document.getElementById('noticiaImg')?.files?.[0];
    if (btn) { btn.disabled = true; btn.innerText = "Publicando..."; }
    try {
        let imgUrl = "";
        if (imgFile) {
            const arquivoOtimizado = await otimizarImagem(imgFile);
            const storageRef = ref(storage, `clientes/${idClienteDoc}/noticias/${Date.now()}_${imgFile.name}`);
            const snapshot = await uploadBytes(storageRef, arquivoOtimizado);
            imgUrl = await getDownloadURL(snapshot.ref);
        }
        await addDoc(collection(db, "clientes", idClienteDoc, "noticias"), {
            titulo: document.getElementById('noticiaTitulo')?.value || "",
            texto: document.getElementById('noticiaTexto')?.value || "",
            capa: imgUrl,
            dataCriacao: serverTimestamp()
        });
        alert("Notícia publicada!");
        e.target.reset();
        carregarNoticias();
    } catch (err) { alert("Erro ao publicar notícia."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Publicar Notícia"; } }
});

// --- 6. GESTÃO DE EVENTOS ---
function carregarEventos() {
    if (!idClienteDoc) return;
    const container = document.getElementById('listaEventos');
    if (!container) return;
    const q = query(collection(db, "clientes", idClienteDoc, "eventos"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const ev = docSnap.data();
            const id = docSnap.id;
            const btnInscritos = ev.exigeInscricao 
                ? `<button onclick="window.verInscritos('${id}', '${esc(ev.titulo)}')" class="btn-edit-sm" style="background:#22c55e; margin-right:5px;"><i class="fas fa-users"></i> Inscritos</button>` 
                : '';
            container.innerHTML += `
                <div class="card-video">
                    <div class="info-video">
                        <h4>${ev.titulo || ''}</h4>
                        <span class="badge-serie">${ev.data} - ${ev.hora}</span>
                        <p>${ev.descricao || ''}</p>
                        <div class="acoes-video">
                            ${btnInscritos}
                            <button onclick="window.excluirEvento('${id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

document.getElementById('formEvento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEvento');
    if (btn) { btn.disabled = true; btn.innerText = "Publicando..."; }
    try {
        const temInscricao = document.getElementById('eventoRequerInscricao')?.checked || false;
        const eBtnPago = document.getElementById('eventoEhPago')?.checked || false;
        await addDoc(collection(db, "clientes", idClienteDoc, "eventos"), {
            titulo: document.getElementById('eventoTitulo')?.value || "",
            data: document.getElementById('eventoData')?.value || "",
            hora: document.getElementById('eventoHora')?.value || "",
            local: document.getElementById('eventoLocal')?.value || "",
            descricao: document.getElementById('eventoDesc')?.value || "",
            exigeInscricao: temInscricao,
            pago: eBtnPago,
            linkInscricao: temInscricao ? document.getElementById('eventoLinkInscricao')?.value : "",
            valor: eBtnPago ? document.getElementById('eventoValor')?.value : "",
            dataCriacao: serverTimestamp()
        });
        alert("Evento publicado!");
        e.target.reset();
        window.toggleInscricao();
        window.togglePagamento();
        carregarEventos();
    } catch (err) { alert("Erro ao publicar evento."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Publicar Evento"; } }
});

// --- FUNÇÃO CORRIGIDA: ATRIBUIÇÃO GLOBAL ---
window.verInscritos = async (eventoId, titulo) => {
    const modal = document.getElementById('modalVerInscritos');
    const lista = document.getElementById('listaNomesInscritos');
    const tituloModal = document.getElementById('tituloEventoInscritos');
    
    if (tituloModal) tituloModal.innerText = titulo;
    if (lista) lista.innerHTML = "<li style='padding:10px;'>Carregando inscritos...</li>";
    if (modal) modal.style.display = 'flex';

    try {
        if (!idClienteDoc) return;
        const q = collection(db, "clientes", idClienteDoc, "eventos", eventoId, "inscritos");
        const snap = await getDocs(q);
        
        if (snap.empty) {
            lista.innerHTML = "<li style='padding:10px; color:#888;'>Nenhuma inscrição para este evento.</li>";
        } else {
            lista.innerHTML = "";
            snap.forEach(docSnap => {
                const d = docSnap.data();
                lista.innerHTML += `
                    <li style="border-bottom:1px solid #333; padding:12px; display:flex; flex-direction:column; gap:4px;">
                        <span style="font-weight:bold; color:#fff;">${d.nome || 'Anônimo'}</span>
                        <small style="color:var(--cor-primaria); opacity:0.8;">${d.email || 'Sem e-mail'}</small>
                    </li>`;
            });
        }
    } catch (err) { 
        console.error(err);
        lista.innerHTML = "<li style='padding:10px; color:#ff4444;'>Erro ao carregar lista.</li>"; 
    }
};

window.fecharModalInscritos = () => { 
    const modal = document.getElementById('modalVerInscritos');
    if (modal) modal.style.display = 'none'; 
};

// --- 7. GESTÃO DE OFERTAS ---
function carregarOfertas() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "ofertas"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeOfertas');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const of = docSnap.data();
            container.innerHTML += `
                <div class="card-video">
                    <div class="info-video">
                        <h4>${of.titulo || ''}</h4>
                        <p style="font-size: 12px; color: #888;">${of.link || ''}</p>
                        <div class="acoes-video">
                            <button onclick="window.excluirOferta('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

document.getElementById('formOferta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (btn) { btn.disabled = true; btn.innerText = "Salvando..."; }
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "ofertas"), {
            titulo: document.getElementById('ofertaTitulo')?.value || "",
            link: document.getElementById('ofertaLink')?.value || "",
            dataCriacao: serverTimestamp()
        });
        alert("Oferta cadastrada!");
        e.target.reset();
        carregarOfertas();
    } catch (err) { alert("Erro ao cadastrar."); } 
    finally { if (btn) { btn.disabled = false; btn.innerText = "Adicionar Opção"; } }
});

// --- 8. GESTÃO DE USUÁRIOS ---
function carregarUsuariosApp() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "usuarios_app"), where("clienteId", "==", idClienteDoc));
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('tabelaUsuariosBody');
        if (!tbody) return;
        tbody.innerHTML = snapshot.empty ? "<tr><td colspan='4' style='text-align:center;'>Nenhum membro.</td></tr>" : "";
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const dataFmt = user.dataCadastro?.toDate ? user.dataCadastro.toDate().toLocaleDateString('pt-BR') : '---';
            tbody.innerHTML += `
                <tr>
                    <td>${user.nome || 'Usuário'}</td>
                    <td>${user.email || 'S/ Email'}</td>
                    <td>${dataFmt}</td>
                    <td>
                        <button onclick="window.abrirModalGerenciarUsuario('${docSnap.id}', '${esc(user.nome)}', '${user.email}')" class="btn-edit-sm">
                            <i class="fas fa-user-shield"></i> Gerenciar
                        </button>
                    </td>
                </tr>`;
        });
    });
}

// --- 9. LEITURA BÍBLICA ---
function carregarLeituras() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "leituras"), orderBy("dataLeitura", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeLeituras');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const lei = docSnap.data();
            const dataFmt = lei.dataLeitura ? lei.dataLeitura.split('-').reverse().join('/') : '---';
            container.innerHTML += `
                <div class="card-video">
                    <div class="info-video">
                        <span class="badge-serie">${dataFmt}</span>
                        <h4>${lei.versos || ''}</h4>
                        <p>${lei.texto || ''}</p>
                        <button onclick="window.excluirLeitura('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}

document.getElementById('formLeitura')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "leituras"), {
            dataLeitura: document.getElementById('leituraData')?.value || "",
            versos: document.getElementById('leituraVersos')?.value || "",
            texto: document.getElementById('leituraTexto')?.value || "",
            dataCriacao: serverTimestamp()
        });
        alert("Agendado!");
        e.target.reset();
        carregarLeituras();
    } catch (err) { alert("Erro ao salvar."); }
});

// --- 10. GESTÃO DE ORAÇÕES ---
function carregarOracoes() {
    if (!idClienteDoc) return;
    const tbody = document.getElementById('tabelaOracoesBody');
    if (!tbody) return;
    const q = query(collection(db, "clientes", idClienteDoc, "pedidos_oracao"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = snapshot.empty ? "<tr><td colspan='4' style='text-align:center;'>Nenhum pedido.</td></tr>" : "";
        snapshot.forEach((docSnap) => {
            const ora = docSnap.data();
            const d = ora.dataCriacao?.toDate ? ora.dataCriacao.toDate() : new Date();
            tbody.innerHTML += `
                <tr>
                    <td>${d.toLocaleDateString('pt-BR')}</td>
                    <td>${ora.nome || 'Anônimo'}</td>
                    <td>${ora.pedido || ''}</td>
                    <td><button onclick="window.excluirOracao('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button></td>
                </tr>`;
        });
    });
}

// --- 11. NOTIFICAÇÕES PUSH ---
document.getElementById('formPush')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm("Enviar notificação para todos?")) return;
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "notificacoes_push"), {
            titulo: document.getElementById('pushTitulo')?.value || "",
            mensagem: document.getElementById('pushMensagem')?.value || "",
            dataEnvio: serverTimestamp()
        });
        alert("Enviado!");
        e.target.reset();
    } catch (err) { alert("Erro ao enviar."); }
});

// --- 12. CORE (AUTH E IDENTIDADE) ---
async function buscarDadosCliente(userUid) {
    const q = query(collection(db, "clientes"), where("uid", "==", userUid));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        idClienteDoc = docSnap.id;
        aplicarIdentidadeVisual(docSnap.data());
        window.mostrarSessao('add');
    }
}

function aplicarIdentidadeVisual(dados) {
    document.documentElement.style.setProperty('--cor-primaria', dados.corPrimaria || '#2563eb');
    if (document.getElementById('logoClienteApp')) document.getElementById('logoClienteApp').src = dados.logoUrl || 'https://placehold.co/150';
    if (document.getElementById('nomeOrgDisplay')) document.getElementById('nomeOrgDisplay').innerText = dados.nome || "Painel Administrativo";
}

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "login-cliente.html"; } 
    else { buscarDadosCliente(user.uid); }
});

// --- FUNÇÕES GLOBAIS (WINDOW) ---
window.excluirVideo = async (id) => { if (confirm("Excluir vídeo?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "conteudos", id)); };
window.excluirNoticia = async (id) => { if (confirm("Excluir notícia?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "noticias", id)); };
window.excluirEvento = async (id) => { if (confirm("Excluir evento?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "eventos", id)); };
window.excluirOferta = async (id) => { if (confirm("Remover oferta?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "ofertas", id)); };
window.excluirLeitura = async (id) => { if (confirm("Excluir leitura?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "leituras", id)); };
window.excluirOracao = async (id) => { if (confirm("Excluir oração?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "pedidos_oracao", id)); };

window.prepararEdicaoVideo = (id, serie, desc) => {
    document.getElementById('editVideoId').value = id;
    document.getElementById('editVideoSerie').value = serie;
    document.getElementById('editVideoDesc').value = desc;
    document.getElementById('modalEditarVideo').style.display = 'flex';
};

window.fecharModalEdicao = () => { document.getElementById('modalEditarVideo').style.display = 'none'; };

document.getElementById('formEditarVideo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editVideoId')?.value;
    try {
        await updateDoc(doc(db, "clientes", idClienteDoc, "conteudos", id), {
            serie: document.getElementById('editVideoSerie')?.value || "",
            descricao: document.getElementById('editVideoDesc')?.value || ""
        });
        window.fecharModalEdicao();
    } catch(err) { alert("Erro ao editar."); }
});

window.logoutCliente = () => { if(confirm("Sair?")) signOut(auth).then(() => window.location.href = "login-cliente.html"); };

window.abrirModalGerenciarUsuario = (id, nome, email) => {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserNome').innerText = nome;
    document.getElementById('editUserEmail').innerText = email;
    document.getElementById('modalGerenciarUsuario').style.display = 'flex';
};

window.abrirModalSenha = () => {
    if(confirm("Deseja alterar sua senha? Enviaremos um e-mail de recuperação.")) {
        sendPasswordResetEmail(auth, auth.currentUser.email).then(() => alert("E-mail enviado!"));
    }
};
