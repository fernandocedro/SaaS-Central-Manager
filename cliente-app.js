import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app);

let idClienteDoc = null; 
let todosOsVideos = []; 

// --- FUNÇÃO DE APOIO: COMPRESSÃO DE IMAGENS ---
async function otimizarImagem(arquivo) {
    if (!arquivo || !arquivo.type.startsWith('image/')) return arquivo;
    const opcoes = {
        maxSizeMB: 0.8, 
        maxWidthOrHeight: 1024,
        useWebWorker: true
    };
    try {
        // @ts-ignore (Carregado via CDN no HTML: browser-image-compression)
        return await imageCompression(arquivo, opcoes);
    } catch (error) {
        console.error("Erro na compressão, enviando original:", error);
        return arquivo;
    }
}

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

// --- 3. LÓGICA CONDICIONAL ---
window.toggleInscricao = () => {
    const check = document.getElementById('checkInscricao');
    const bloco = document.getElementById('blocoInscricao');
    if(bloco && check) bloco.style.display = check.checked ? 'block' : 'none';
};

window.togglePagamento = () => {
    const check = document.getElementById('checkPago');
    const bloco = document.getElementById('blocoPagamento');
    if(bloco && check) bloco.style.display = check.checked ? 'block' : 'none';
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
        const serieLimpa = (video.serie || "Sem Título").replace(/'/g, "\\'");
        const descLimpa = (video.descricao || "").replace(/'/g, "\\'");
        
        container.innerHTML += `
            <div class="card-video">
                <img src="${thumb}" class="thumb-video">
                <div class="info-video">
                    <span class="badge-serie">${video.serie || 'Geral'}</span>
                    <h4>${video.serie || 'Sem Título'}</h4>
                    <p>${video.descricao || ''}</p>
                    <div class="acoes-video">
                        <button onclick="window.prepararEdicaoVideo('${video.id}', '${serieLimpa}', '${descLimpa}')" class="btn-edit-sm"><i class="fas fa-edit"></i></button>
                        <button onclick="window.excluirVideo('${video.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

document.getElementById('formConteudo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnAcaoPrincipal');
    const inputThumb = document.getElementById('videoThumb');
    const thumbFile = inputThumb?.files?.[0];
    
    if (btn) { btn.disabled = true; btn.innerText = "Processando..."; }

    try {
        let thumbUrl = "";
        if (thumbFile) {
            btn.innerText = "Otimizando Imagem...";
            const arquivoOtimizado = await otimizarImagem(thumbFile);
            const storageRef = ref(storage, `clientes/${idClienteDoc}/conteudos/${Date.now()}_${thumbFile.name}`);
            btn.innerText = "Enviando...";
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
    } catch (err) { console.error(err); alert("Erro ao publicar vídeo."); }
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
    const inputImg = document.getElementById('noticiaImg');
    const imgFile = inputImg?.files?.[0];
    
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
    } catch (err) { console.error(err); alert("Erro ao publicar notícia."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Publicar Notícia"; } }
});

// --- 6. GESTÃO DE EVENTOS ---
document.getElementById('formEvento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarEvento');
    const inputImg = document.getElementById('eventoImg');
    const imgFile = inputImg?.files?.[0];
    
    if (btn) { btn.disabled = true; btn.innerText = "Publicando..."; }

    try {
        let imgUrl = "";
        if (imgFile) {
            const arquivoOtimizado = await otimizarImagem(imgFile);
            const storageRef = ref(storage, `clientes/${idClienteDoc}/eventos/${Date.now()}_${imgFile.name}`);
            const snapshot = await uploadBytes(storageRef, arquivoOtimizado);
            imgUrl = await getDownloadURL(snapshot.ref);
        }

        const temInscricao = document.getElementById('checkInscricao')?.checked || false;
        const eBtnPago = document.getElementById('checkPago')?.checked || false;

        await addDoc(collection(db, "clientes", idClienteDoc, "eventos"), {
            titulo: document.getElementById('eventoTitulo')?.value || "",
            descricao: document.getElementById('eventoDesc')?.value || "",
            capa: imgUrl,
            exigeInscricao: temInscricao,
            pago: eBtnPago,
            linkPagamento: eBtnPago ? document.getElementById('eventoLinkPagamento')?.value : "",
            perguntasObrigatorias: temInscricao ? ["Nome Completo", "CPF", "Igreja"] : [],
            dataCriacao: serverTimestamp()
        });

        alert("Evento publicado!");
        e.target.reset();
        if(document.getElementById('blocoInscricao')) document.getElementById('blocoInscricao').style.display = 'none';
        carregarEventos();
    } catch (err) { console.error(err); alert("Erro ao publicar evento."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Publicar Evento"; } }
});

function carregarEventos() {
    if (!idClienteDoc) return;
    const q = query(collection(db, "clientes", idClienteDoc, "eventos"), orderBy("dataCriacao", "desc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('gradeEventos');
        if (!container) return;
        container.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const ev = docSnap.data();
            const btnInscritos = ev.exigeInscricao 
                ? `<button onclick="window.verInscritos('${docSnap.id}')" class="btn-edit-sm" title="Ver Inscritos" style="background: #22c55e;"><i class="fas fa-users"></i></button>` 
                : '';

            container.innerHTML += `
                <div class="card-video">
                    <img src="${ev.capa || 'https://placehold.co/300x150/222/white?text=Evento'}" class="thumb-video">
                    <div class="info-video">
                        <h4>${ev.titulo || ''}</h4>
                        <span class="badge-serie">${ev.exigeInscricao ? "Com Inscrição" : "Evento Aberto"}</span>
                        <p>${ev.descricao?.substring(0, 60) || ''}...</p>
                        <div class="acoes-video">
                            ${btnInscritos}
                            <button onclick="window.excluirEvento('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

window.verInscritos = async (idEvento) => {
    const tbody = document.getElementById('listaInscritosBody');
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Carregando...</td></tr>";
    const modal = document.getElementById('modalInscritos');
    if (modal) modal.style.display = 'flex';

    try {
        const q = query(collection(db, "clientes", idClienteDoc, "eventos", idEvento, "inscritos"), orderBy("dataInscricao", "desc"));
        const snap = await getDocs(q);
        
        tbody.innerHTML = "";
        if (snap.empty) {
            tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhum inscrito até o momento.</td></tr>";
            return;
        }

        snap.forEach(doc => {
            const d = doc.data();
            const dataFormatada = d.dataInscricao ? d.dataInscricao.toDate().toLocaleDateString('pt-BR') : '---';
            tbody.innerHTML += `
                <tr>
                    <td>${d.nome || '---'}</td>
                    <td>${d.cpf || '---'}</td>
                    <td>${d.igreja || '---'}</td>
                    <td>${dataFormatada}</td>
                </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='4' style='color: red; text-align:center;'>Erro ao buscar dados.</td></tr>";
    }
};

window.fecharModalInscritos = () => { 
    const modal = document.getElementById('modalInscritos');
    if (modal) modal.style.display = 'none'; 
};

// --- 7. GESTÃO DE OFERTAS ---
document.getElementById('formOferta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarOferta');
    const inputImg = document.getElementById('ofertaImg');
    const imgFile = inputImg?.files?.[0];

    if (btn) { btn.disabled = true; btn.innerText = "Salvando..."; }

    try {
        let imgUrl = "https://placehold.co/300x150/222/white?text=Oferta"; 
        if (imgFile) {
            const arquivoOtimizado = await otimizarImagem(imgFile);
            const storageRef = ref(storage, `clientes/${idClienteDoc}/ofertas/${Date.now()}_${imgFile.name}`);
            const snapshot = await uploadBytes(storageRef, arquivoOtimizado);
            imgUrl = await getDownloadURL(snapshot.ref);
        }

        await addDoc(collection(db, "clientes", idClienteDoc, "ofertas"), {
            titulo: document.getElementById('ofertaTitulo')?.value || "",
            link: document.getElementById('ofertaLink')?.value || "",
            capa: imgUrl,
            dataCriacao: serverTimestamp()
        });

        alert("Oferta cadastrada!");
        e.target.reset();
        carregarOfertas();
    } catch (err) { alert("Erro ao cadastrar oferta."); } 
    finally { if (btn) { btn.disabled = false; btn.innerText = "Cadastrar Opção de Oferta"; } }
});

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
                    <img src="${of.capa}" class="thumb-video">
                    <div class="info-video">
                        <h4>${of.titulo || ''}</h4>
                        <p style="font-size: 12px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${of.link || ''}</p>
                        <div class="acoes-video">
                            <a href="${of.link}" target="_blank" class="btn-edit-sm" style="background: #eab308; text-decoration: none; display: flex; align-items: center; justify-content: center;" title="Testar Link Externo">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                            <button onclick="window.excluirOferta('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

window.excluirOferta = async (id) => {
    if (confirm("Deseja remover esta opção de oferta?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "ofertas", id));
};

// --- 8. GESTÃO DE USUÁRIOS DO APP (CORRIGIDO) ---
function carregarUsuariosApp() {
    if (!idClienteDoc) return;
    
    // Removido o orderBy caso o índice ainda não tenha sido criado no Firebase Console
    const q = query(collection(db, "usuarios_app"), where("clienteId", "==", idClienteDoc));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('tabelaUsuariosBody');
        if (!tbody) return;
        tbody.innerHTML = snapshot.empty ? "<tr><td colspan='4' style='text-align:center; padding: 20px; color: #888;'>Nenhum membro encontrado.</td></tr>" : "";

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const dataFmt = user.dataCadastro ? 
                (user.dataCadastro.toDate ? user.dataCadastro.toDate().toLocaleDateString('pt-BR') : '---') 
                : '---';
            const nomeLimpo = (user.nome || "Membro").replace(/'/g, "\\'");
            
            tbody.innerHTML += `
                <tr>
                    <td>${user.nome || 'Membro'}</td>
                    <td>${user.email || ''}</td>
                    <td>${dataFmt}</td>
                    <td>
                        <button onclick="window.abrirModalGerenciarUsuario('${docSnap.id}', '${nomeLimpo}', '${user.email}')" class="btn-edit-sm">
                            <i class="fas fa-user-shield"></i> Gerenciar
                        </button>
                    </td>
                </tr>`;
        });
    });
}

window.abrirModalGerenciarUsuario = (id, nome, email) => {
    const elId = document.getElementById('editUserId');
    const elNome = document.getElementById('editUserNome');
    const elEmail = document.getElementById('editUserEmail');
    const modal = document.getElementById('modalGerenciarUsuario');

    if (elId) elId.value = id;
    if (elNome) elNome.innerText = nome;
    if (elEmail) elEmail.innerText = email;
    if (modal) modal.style.display = 'flex';
};

window.fecharModalGerenciarUsuario = () => {
    const modal = document.getElementById('modalGerenciarUsuario');
    if (modal) modal.style.display = 'none';
};

window.resetarSenhaUsuario = async () => {
    const email = document.getElementById('editUserEmail')?.innerText;
    if (!email) return;
    try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição de senha enviado!");
    } catch (err) { alert("Erro: " + err.message); }
};

window.excluirUsuarioApp = async () => {
    const id = document.getElementById('editUserId')?.value;
    if (id && confirm("Deseja remover o acesso deste membro?")) {
        await deleteDoc(doc(db, "usuarios_app", id));
        alert("Membro removido.");
        window.fecharModalGerenciarUsuario();
    }
};

// --- LEITURA BÍBLICA ---
document.getElementById('formLeitura')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (btn) { btn.disabled = true; btn.innerText = "Salvando..."; }
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "leituras"), {
            dataLeitura: document.getElementById('leituraData')?.value || "",
            versos: document.getElementById('leituraVersos')?.value || "",
            texto: document.getElementById('leituraTexto')?.value || "",
            dataCriacao: serverTimestamp()
        });
        alert("Leitura agendada!");
        e.target.reset();
        carregarLeituras();
    } catch (err) { alert("Erro ao salvar leitura."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Agendar Leitura"; } }
});

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
                        <p>${lei.texto?.substring(0, 100) || ''}...</p>
                        <div class="acoes-video">
                            <button onclick="window.excluirLeitura('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

window.excluirLeitura = async (id) => { if (confirm("Excluir leitura?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "leituras", id)); };

// --- GESTÃO DE ORAÇÕES ---
function carregarOracoes() {
    if (!idClienteDoc) return;
    const tbody = document.getElementById('tabelaOracoesBody');
    if (!tbody) return;

    const q = query(collection(db, "clientes", idClienteDoc, "pedidos_oracao"), orderBy("dataCriacao", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = snapshot.empty ? "<tr><td colspan='4' style='text-align:center; padding: 20px; color: #888;'>Nenhum pedido recebido.</td></tr>" : "";
        snapshot.forEach((docSnap) => {
            const ora = docSnap.data();
            let dataFmt = '---';
            if (ora.dataCriacao) {
                const d = ora.dataCriacao.toDate ? ora.dataCriacao.toDate() : new Date(ora.dataCriacao);
                dataFmt = d.toLocaleDateString('pt-BR') + " " + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            }
            tbody.innerHTML += `
                <tr>
                    <td style="font-size: 0.85rem; color: #888;">${dataFmt}</td>
                    <td><strong>${ora.nome || 'Anônimo'}</strong></td>
                    <td style="max-width: 350px; white-space: normal; line-height: 1.4;">${ora.pedido || 'Sem texto'}</td>
                    <td><button onclick="window.excluirOracao('${docSnap.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button></td>
                </tr>`;
        });
    });
}

window.excluirOracao = async (id) => { if (confirm("Excluir permanentemente?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "pedidos_oracao", id)); };

// --- NOTIFICAÇÕES PUSH ---
document.getElementById('formPush')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm("Enviar notificação para todos?")) return;
    const btn = e.target.querySelector('button');
    if (btn) { btn.disabled = true; btn.innerText = "Enviando..."; }
    try {
        await addDoc(collection(db, "clientes", idClienteDoc, "notificacoes_push"), {
            titulo: document.getElementById('pushTitulo')?.value || "",
            mensagem: document.getElementById('pushMensagem')?.value || "",
            dataEnvio: serverTimestamp()
        });
        alert("Notificação enviada!");
        e.target.reset();
    } catch (err) { alert("Erro ao enviar push."); }
    finally { if (btn) { btn.disabled = false; btn.innerText = "Disparar Notificação"; } }
});

// --- 9. CORE (AUTH E IDENTIDADE) ---
async function buscarDadosCliente(userUid) {
    const q = query(collection(db, "clientes"), where("uid", "==", userUid));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        idClienteDoc = docSnap.id;
        aplicarIdentidadeVisual(docSnap.data());
        carregarVideos(); 
    }
}

function aplicarIdentidadeVisual(dados) {
    document.documentElement.style.setProperty('--cor-primaria', dados.corPrimaria || '#2563eb');
    const logoEl = document.getElementById('logoClienteApp');
    if (logoEl) logoEl.src = dados.logoUrl || 'https://placehold.co/150';
    const nomeEl = document.getElementById('nomeOrgDisplay');
    if (nomeEl) nomeEl.innerText = dados.nome || "Painel Administrativo";
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        if (!window.location.href.includes("login-cliente.html")) window.location.href = "login-cliente.html";
    } else {
        buscarDadosCliente(user.uid);
    }
});

// FUNÇÕES GLOBAIS DE EXCLUSÃO
window.excluirVideo = async (id) => { if (confirm("Excluir vídeo?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "conteudos", id)); };
window.excluirNoticia = async (id) => { if (confirm("Excluir notícia?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "noticias", id)); };
window.excluirEvento = async (id) => { if (confirm("Excluir evento?")) await deleteDoc(doc(db, "clientes", idClienteDoc, "eventos", id)); };

// EDIÇÃO E MODAIS
window.prepararEdicaoVideo = (id, serie, desc) => {
    const elId = document.getElementById('editVideoId');
    const elSerie = document.getElementById('editVideoSerie');
    const elDesc = document.getElementById('editVideoDesc');
    const modal = document.getElementById('modalEditarVideo');
    if (elId) elId.value = id;
    if (elSerie) elSerie.value = serie;
    if (elDesc) elDesc.value = desc;
    if (modal) modal.style.display = 'flex';
};

window.fecharModalEdicao = () => { if(document.getElementById('modalEditarVideo')) document.getElementById('modalEditarVideo').style.display = 'none'; };

document.getElementById('formEditarVideo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editVideoId')?.value;
    if (!id) return;
    try {
        await updateDoc(doc(db, "clientes", idClienteDoc, "conteudos", id), {
            serie: document.getElementById('editVideoSerie')?.value || "",
            descricao: document.getElementById('editVideoDesc')?.value || ""
        });
        window.fecharModalEdicao();
    } catch(err) { alert("Erro ao editar."); }
});

window.abrirModalSenha = () => { if(document.getElementById('modalSenhaCliente')) document.getElementById('modalSenhaCliente').style.display = 'flex'; };
window.fecharModalSenha = () => { if(document.getElementById('modalSenhaCliente')) document.getElementById('modalSenhaCliente').style.display = 'none'; };
window.logoutCliente = () => { if(confirm("Sair?")) signOut(auth).then(() => window.location.href = "login-cliente.html"); };
