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

// --- 2. FUNÇÕES DE APOIO ---
const esc = (str) => str ? String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;") : "";

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

// --- 3. FUNÇÕES GLOBAIS (DISPONÍVEIS NO HTML) ---

window.mostrarSessao = (sessao) => {
    const secoesIds = ['secaoAdicionar', 'secaoGerenciar', 'secaoNoticias', 'secaoEventos', 'secaoOfertas', 'secaoUsuarios', 'secaoLeitura', 'secaoNotificacoes', 'secaoOracoes', 'secaoDepartamentos'];
    secoesIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    
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
        'oracoes': { secao: 'secaoOracoes', menu: 'menuPrayers', acao: carregarOracoes },
        'departamentos': { secao: 'secaoDepartamentos', menu: 'menuDepts', acao: carregarDepartamentos } 
    };

    const config = mapeamento[sessao];
    if (config) {
        if (document.getElementById(config.secao)) document.getElementById(config.secao).style.display = 'block';
        if (document.getElementById(config.menu)) document.getElementById(config.menu).classList.add('active');
        if (config.acao) config.acao();
    }
};

window.verInscritos = async (eventoId, titulo) => {
    const modal = document.getElementById('modalVerInscritos');
    const lista = document.getElementById('listaNomesInscritos');
    const tituloModal = document.getElementById('tituloEventoInscritos');
    
    if (tituloModal) tituloModal.innerText = titulo;
    if (lista) lista.innerHTML = "<li style='padding:10px; color:#fff;'>Carregando...</li>";
    if (modal) modal.style.display = 'flex';

    try {
        if (!idClienteDoc) return;
        const q = collection(db, "clientes", idClienteDoc, "eventos", eventoId, "inscritos");
        const snap = await getDocs(q);
        
        if (snap.empty) {
            lista.innerHTML = "<li style='padding:10px; color:#888;'>Nenhuma inscrição.</li>";
        } else {
            lista.innerHTML = "";
            snap.forEach(docSnap => {
                const d = docSnap.data();
                lista.innerHTML += `<li style="border-bottom:1px solid #333; padding:12px; color:#fff;">
                    <b>${d.nome || 'Anônimo'}</b><br><small>${d.email || ''}</small>
                </li>`;
            });
        }
    } catch (err) { lista.innerHTML = "Erro ao carregar."; }
};

window.fecharModalInscritos = () => { 
    const m = document.getElementById('modalVerInscritos');
    if (m) m.style.display = 'none'; 
};

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

// --- 4. CARREGAMENTO DE DADOS (READ) ---

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
    container.innerHTML = lista.length ? "" : "<p style='color: #888; padding: 20px;'>Nenhum vídeo.</p>";
    lista.forEach((v) => {
        container.innerHTML += `
            <div class="card-video">
                <img src="${v.thumbnail || 'https://placehold.co/300x150/222/white?text=Vídeo'}" class="thumb-video">
                <div class="info-video">
                    <h4>${v.serie || 'Sem Título'}</h4>
                    <div class="acoes-video">
                        <button onclick="window.prepararEdicaoVideo('${v.id}', '${esc(v.serie)}', '${esc(v.descricao)}')" class="btn-edit-sm"><i class="fas fa-edit"></i></button>
                        <button onclick="window.excluirVideo('${v.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

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
                    <img src="${n.capa || ''}" class="thumb-video">
                    <div class="info-video">
                        <h4>${n.titulo || ''}</h4>
                        <button onclick="window.excluirNoticia('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}

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
                ? `<button onclick="window.verInscritos('${id}', '${esc(ev.titulo)}')" class="btn-edit-sm" style="background:#22c55e; margin-right:5px; color:white;"><i class="fas fa-users"></i> Inscritos</button>` 
                : '';
            container.innerHTML += `
                <div class="card-video" style="margin-bottom:10px; padding:15px; background:#1a1a1a;">
                    <h4>${ev.titulo || ''}</h4>
                    <p style="font-size:12px; color:var(--cor-primaria);">${ev.data} - ${ev.hora}</p>
                    <div class="acoes-video">
                        ${btnInscritos}
                        <button onclick="window.excluirEvento('${id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    });
}

function carregarOfertas() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "ofertas"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeOfertas');
        if (container) {
            container.innerHTML = "";
            snapshot.forEach(d => {
                const of = d.data();
                container.innerHTML += `
                <div class="card-video" style="padding:10px;">
                    <img src="${of.imagem || 'https://placehold.co/300x150/222/white?text=Oferta'}" class="thumb-video" style="margin-bottom:10px; border-radius:8px; width:100%; height:120px; object-fit:cover;">
                    <div class="info-video">
                        <h4 style="margin-bottom:10px;">${of.titulo}</h4>
                        <button onclick="window.excluirOferta('${d.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i> Excluir</button>
                    </div>
                </div>`;
            });
        }
    });
}

function carregarUsuariosApp() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "usuarios_app"), where("idCliente", "==", idClienteDoc));
    onSnapshot(q, (snap) => {
        const tbody = document.getElementById('tabelaUsuariosBody');
        if (!tbody) return;
        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888; padding:20px;">Nenhum usuário encontrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            tbody.innerHTML += `
                <tr>
                    <td>${u.nome || 'Sem nome'}</td>
                    <td>${u.email || 'Sem e-mail'}</td>
                    <td>
                        <button onclick="window.abrirModalGerenciarUsuario('${d.id}', '${esc(u.nome)}', '${u.email}')" class="btn-edit-sm">
                            <i class="fas fa-user-cog"></i> Gerenciar
                        </button>
                    </td>
                </tr>`;
        });
    });
}

function carregarLeituras() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "leituras"), orderBy("dataLeitura", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('gradeLeituras');
        if (!container) return;
        container.innerHTML = "";
        snap.forEach(d => {
            const l = d.data();
            container.innerHTML += `<div class="card-video" style="padding:10px;">
                <span>${l.dataLeitura}</span>
                <h4>${l.versos}</h4>
                <button onclick="window.excluirLeitura('${d.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
            </div>`;
        });
    });
}

function carregarOracoes() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "pedidos_oracao"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snap) => {
        const tbody = document.getElementById('tabelaOracoesBody');
        if (tbody) {
            tbody.innerHTML = "";
            snap.forEach(d => {
                const o = d.data();
                tbody.innerHTML += `<tr>
                    <td>${o.nome || 'Anônimo'}</td>
                    <td>${o.pedido}</td>
                    <td><button onclick="window.excluirOracao('${d.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            });
        }
    });
}

function carregarDepartamentos() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "departamentos"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('gradeDepartamentos');
        if (!container) return;
        container.innerHTML = "";
        snap.forEach(d => {
            const dept = d.data();
            container.innerHTML += `
            <div class="card-video" style="padding:15px; background:#1a1a1a;">
                <h4>${dept.nome}</h4>
                <p style="font-size:12px; color:var(--cor-primaria);">Líder: ${dept.lider || 'Não definido'}</p>
                <div class="acoes-video">
                    <button onclick="window.verSolicitacoesDept('${d.id}', '${esc(dept.nome)}')" class="btn-edit-sm" style="background:#2563eb; color:#fff; margin-right:5px;">
                        <i class="fas fa-user-clock"></i> Solicitações
                    </button>
                    <button onclick="window.excluirDepartamento('${d.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        });
    });
}

window.verSolicitacoesDept = async (deptId, nomeDept) => {
    const modal = document.getElementById('modalVerInscritos'); 
    const lista = document.getElementById('listaNomesInscritos');
    const tituloModal = document.getElementById('tituloEventoInscritos');
    if (tituloModal) tituloModal.innerText = `Solicitações: ${nomeDept}`;
    if (lista) lista.innerHTML = "<li style='color:#fff; padding:10px;'>Carregando...</li>";
    if (modal) modal.style.display = 'flex';
    try {
        const q = query(collection(db, "clientes", idClienteDoc, "departamentos", deptId, "membros"), where("status", "==", "pendente"));
        const snap = await getDocs(q);
        if (snap.empty) {
            lista.innerHTML = "<li style='padding:15px; color:#888;'>Nenhuma solicitação pendente.</li>";
        } else {
            lista.innerHTML = "";
            snap.forEach(docSnap => {
                const m = docSnap.data();
                lista.innerHTML += `
                    <li style="border-bottom:1px solid #333; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div><b style="color:#fff;">${m.nome}</b><br><small style="color:#888;">${m.email}</small></div>
                        <div>
                            <button onclick="window.decidirMembroDept('${deptId}', '${docSnap.id}', 'aprovado')" class="btn-edit-sm" style="background:#22c55e; color:#fff; margin-right:5px;"><i class="fas fa-check"></i></button>
                            <button onclick="window.decidirMembroDept('${deptId}', '${docSnap.id}', 'recusado')" class="btn-delete-sm" style="background:#ef4444; color:#fff;"><i class="fas fa-times"></i></button>
                        </div>
                    </li>`;
            });
        }
    } catch (err) { lista.innerHTML = "Erro ao carregar."; }
};

window.decidirMembroDept = async (deptId, membroDocId, decisao) => {
    try {
        const refMembro = doc(db, "clientes", idClienteDoc, "departamentos", deptId, "membros", membroDocId);
        if (decisao === 'aprovado') {
            await updateDoc(refMembro, { status: "aprovado" });
            alert("Membro aprovado!");
        } else {
            await deleteDoc(refMembro);
            alert("Solicitação recusada.");
        }
        window.fecharModalInscritos();
    } catch (err) { alert("Erro ao processar."); }
};

// --- 5. GESTÃO DE FORMULÁRIOS (CREATE/UPDATE) ---

// --- CORREÇÃO: FUNÇÃO SALVAR LEITURA EXPOSTA CORRETAMENTE ---
window.salvarLeitura = async () => {
    if (!idClienteDoc) {
        alert("Erro: ID do cliente não carregado.");
        return;
    }
    
    const dataInput = document.getElementById('leituraData');
    const versosInput = document.getElementById('leituraVersos');
    const textoInput = document.getElementById('leituraTexto');

    if (!dataInput.value || !versosInput.value) {
        alert("Preencha a data e os versículos.");
        return;
    }

    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "leituras"), {
            dataLeitura: dataInput.value,
            versos: versosInput.value,
            texto: textoInput.value,
            dataCriacao: serverTimestamp()
        });
        alert("Leitura cadastrada!");
        document.getElementById('formLeitura').reset();
        carregarLeituras();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar leitura.");
    }
};

document.getElementById('formConteudo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnAcaoPrincipal');
    if (btn) { btn.disabled = true; btn.innerText = "Publicando..."; }
    try {
        let thumbUrl = "";
        const file = document.getElementById('videoThumb')?.files[0];
        if (file) {
            const opt = await otimizarImagem(file);
            const sRef = ref(storage, `clientes/${idClienteDoc}/conteudos/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, opt);
            thumbUrl = await getDownloadURL(snap.ref);
        }
        await addDoc(collection(db, "clientes", idClienteDoc, "conteudos"), {
            tipo: "video",
            url: document.getElementById('videoUrl').value,
            serie: document.getElementById('videoSerie').value,
            thumbnail: thumbUrl,
            dataCriacao: serverTimestamp()
        });
        alert("Vídeo publicado!");
        e.target.reset();
        window.mostrarSessao('list');
    } catch (err) { alert("Erro ao publicar."); }
    finally { if(btn){ btn.disabled = false; btn.innerText = "Publicar Vídeo"; } }
});

document.getElementById('formNoticia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        let imgUrl = "";
        const file = document.getElementById('noticiaImg')?.files[0];
        if (file) {
            const opt = await otimizarImagem(file);
            const sRef = ref(storage, `clientes/${idClienteDoc}/noticias/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, opt);
            imgUrl = await getDownloadURL(snap.ref);
        }
        await addDoc(collection(db, "clientes", idClienteDoc, "noticias"), {
            titulo: document.getElementById('noticiaTitulo').value,
            texto: document.getElementById('noticiaTexto').value,
            capa: imgUrl,
            dataCriacao: serverTimestamp()
        });
        alert("Notícia publicada!");
        e.target.reset();
        carregarNoticias();
    } catch (err) { alert("Erro."); }
});

document.getElementById('formEvento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const temInsc = document.getElementById('eventoRequerInscricao').checked;
        const ehPago = document.getElementById('eventoEhPago').checked;
        await addDoc(collection(db, "clientes", idClienteDoc, "eventos"), {
            titulo: document.getElementById('eventoTitulo').value,
            data: document.getElementById('eventoData').value,
            hora: document.getElementById('eventoHora').value,
            exigeInscricao: temInsc,
            pago: ehPago,
            dataCriacao: serverTimestamp()
        });
        alert("Evento criado!");
        e.target.reset();
        window.toggleInscricao();
        window.togglePagamento();
        carregarEventos();
    } catch (err) { alert("Erro ao salvar evento."); }
});

document.getElementById('formOferta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if(btn) { btn.disabled = true; btn.innerText = "Salvando..."; }
    try {
        let imgUrl = "";
        const file = document.getElementById('ofertaImg')?.files[0];
        if (file) {
            const opt = await otimizarImagem(file);
            const sRef = ref(storage, `clientes/${idClienteDoc}/ofertas/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, opt);
            imgUrl = await getDownloadURL(snap.ref);
        }
        await addDoc(collection(db, "clientes", idClienteDoc, "ofertas"), {
            titulo: document.getElementById('ofertaTitulo').value,
            link: document.getElementById('ofertaLink').value,
            imagem: imgUrl,
            dataCriacao: serverTimestamp()
        });
        alert("Oferta publicada!");
        e.target.reset();
        carregarOfertas();
    } catch (err) { alert("Erro ao salvar oferta."); }
    finally { if(btn) { btn.disabled = false; btn.innerText = "Adicionar Opção"; } }
});

document.getElementById('formDepartamento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "departamentos"), {
            nome: document.getElementById('deptNome').value,
            lider: document.getElementById('deptLider').value,
            dataCriacao: serverTimestamp()
        });
        alert("Departamento criado!");
        e.target.reset();
        carregarDepartamentos();
    } catch (err) { alert("Erro ao criar departamento."); }
});

document.getElementById('formPush')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm("Enviar agora?")) return;
    await addDoc(collection(db, "clientes", idClienteDoc, "notificacoes_push"), {
        titulo: document.getElementById('pushTitulo').value,
        mensagem: document.getElementById('pushMensagem').value,
        dataEnvio: serverTimestamp()
    });
    alert("Enviado!");
    e.target.reset();
});

// --- 6. EXCLUSÕES E EDIÇÕES (WINDOW) ---

window.excluirVideo = async (id) => { if (confirm("Excluir vídeo?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "conteudos", id)); };
window.excluirNoticia = async (id) => { if (confirm("Excluir notícia?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "noticias", id)); };
window.excluirEvento = async (id) => { if (confirm("Excluir evento?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "eventos", id)); };
window.excluirOferta = async (id) => { if (confirm("Remover oferta?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "ofertas", id)); };
window.excluirLeitura = async (id) => { if (confirm("Excluir leitura?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "leituras", id)); };
window.excluirOracao = async (id) => { if (confirm("Excluir oração?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "pedidos_oracao", id)); };
window.excluirDepartamento = async (id) => { if (confirm("Excluir departamento?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "departamentos", id)); }; 

window.prepararEdicaoVideo = (id, serie, desc) => {
    document.getElementById('editVideoId').value = id;
    document.getElementById('editVideoSerie').value = serie;
    document.getElementById('editVideoDesc').value = desc;
    document.getElementById('modalEditarVideo').style.display = 'flex';
};

window.fecharModalEdicao = () => { document.getElementById('modalEditarVideo').style.display = 'none'; };

document.getElementById('formEditarVideo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editVideoId').value;
    await updateDoc(doc(db, "clientes", idClienteDoc, "conteudos", id), {
        serie: document.getElementById('editVideoSerie').value,
        descricao: document.getElementById('editVideoDesc').value
    });
    window.fecharModalEdicao();
});

window.logoutCliente = () => { if(confirm("Sair?")) signOut(auth).then(() => window.location.href = "login-cliente.html"); };

window.abrirModalGerenciarUsuario = (id, nome, email) => {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserNome').innerText = nome;
    document.getElementById('editUserEmail').innerText = email;
    document.getElementById('modalGerenciarUsuario').style.display = 'flex';
};

window.abrirModalSenha = () => {
    if(confirm("Enviar e-mail de recuperação de senha?")) {
        sendPasswordResetEmail(auth, auth.currentUser.email).then(() => alert("E-mail enviado!"));
    }
};

// --- 7. CORE: AUTH E IDENTIDADE ---

async function buscarDadosCliente(userUid) {
    const q = query(collection(db, "clientes"), where("uid", "==", userUid));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const docSnap = snap.docs[0];
        idClienteDoc = docSnap.id;
        const dados = docSnap.data();
        document.documentElement.style.setProperty('--cor-primaria', dados.corPrimaria || '#2563eb');
        if (document.getElementById('logoClienteApp')) document.getElementById('logoClienteApp').src = dados.logoUrl || '';
        if (document.getElementById('nomeOrgDisplay')) document.getElementById('nomeOrgDisplay').innerText = dados.nome || "Painel";
        window.mostrarSessao('add');
    }
}

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "login-cliente.html"; } 
    else { buscarDadosCliente(user.uid); }
});
