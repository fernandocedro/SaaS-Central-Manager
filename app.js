import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, updatePassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDX-zzuYHQ6HQce12CPSke38MuP8k63Zt8",
    authDomain: "saas-central-manager.firebaseapp.com",
    projectId: "saas-central-manager",
    storageBucket: "saas-central-manager.firebasestorage.app",
    messagingSenderId: "249170676982",
    appId: "1:249170676982:web:233d1609b9649135f370d7",
    measurementId: "G-39NX24J8D3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- FUNÇÕES GLOBAIS ---
const gerarIdCliente = () => `CLI-${Math.floor(100000 + Math.random() * 900000)}`;
let cacheClientes = []; 
let clienteIdEdicao = null;
let idClientePersonalizacao = null;

// --- 2. SEGURANÇA E PERFIL ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        // Atualiza avatares na tela
        const avatarImgs = document.querySelectorAll('.avatar');
        avatarImgs.forEach(img => {
            if (user.photoURL) img.src = user.photoURL;
        });

        // Atualiza e-mail no modal de perfil
        const emailDisplay = document.getElementById('userEmailDisplay');
        if (emailDisplay) emailDisplay.innerText = user.email;

        iniciarPainel(); 
    }
});

// --- NOVO: FUNÇÕES DE PERFIL, SENHA E FOTO ---

window.abrirModalPerfil = () => {
    document.getElementById('modalPerfil').style.display = 'flex';
};

window.abrirModalSenha = () => {
    document.getElementById('modalSenha').style.display = 'flex';
};

window.fecharModaisPerfil = () => {
    document.getElementById('modalPerfil').style.display = 'none';
    document.getElementById('modalSenha').style.display = 'none';
};

// Alterar Senha
const formTrocarSenha = document.getElementById('formTrocarSenha');
if (formTrocarSenha) {
    formTrocarSenha.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novaSenha = document.getElementById('novaSenha').value;
        const user = auth.currentUser;

        if (novaSenha.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

        try {
            await updatePassword(user, novaSenha);
            alert("Senha atualizada com sucesso!");
            window.fecharModaisPerfil();
            formTrocarSenha.reset();
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar senha. Se você logou há muito tempo, saia e entre novamente por segurança.");
        }
    });
}

// Upload de Foto de Perfil
window.uploadFoto = async () => {
    const fileInput = document.getElementById('inputFotoPerfil');
    const file = fileInput.files[0];
    const user = auth.currentUser;

    if (!file) return alert("Por favor, selecione uma imagem.");

    try {
        const storageRef = ref(storage, `perfis-admin/${user.uid}`);
        await uploadBytes(storageRef, file);
        const photoURL = await getDownloadURL(storageRef);

        await updateProfile(user, { photoURL });
        
        // Atualiza avatares na interface
        document.querySelectorAll('.avatar').forEach(img => img.src = photoURL);
        
        alert("Foto de perfil atualizada!");
        window.fecharModaisPerfil();
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar foto.");
    }
};

// --- 3. FUNÇÕES DE INTERFACE ---
window.fazerLogout = () => {
    if(confirm("Deseja realmente sair?")) {
        signOut(auth).then(() => { window.location.href = "login.html"; });
    }
};

window.abrirModalNovoCliente = () => {
    clienteIdEdicao = null;
    document.getElementById('formNovoCliente').reset();
    document.querySelector('#modalCliente h3').innerText = "Novo Cliente";
    document.getElementById('modalCliente').style.display = 'flex';
};

window.fecharModal = () => document.getElementById('modalCliente').style.display = 'none';

// --- PERSONALIZAÇÃO ---
window.abrirModalPersonalizar = (id, nome, corP, corS, logo) => {
    idClientePersonalizacao = id;
    document.getElementById('nomeClientePersonalizar').innerText = nome;
    document.getElementById('corPrimaria').value = corP || "#2563eb";
    document.getElementById('corSecundaria').value = corS || "#1e293b";
    document.getElementById('previewLogo').src = logo && logo !== 'undefined' ? logo : "https://via.placeholder.com/150?text=Sua+Logo";
    document.getElementById('modalPersonalizar').style.display = 'flex';
};

window.fecharModalPersonalizar = () => {
    document.getElementById('modalPersonalizar').style.display = 'none';
    document.getElementById('formPersonalizar').reset();
};

window.previewImagem = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('previewLogo').src = e.target.result;
        reader.readAsDataURL(input.files[0]);
    }
};

// --- GESTÃO DE CLIENTES ---
window.alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ativo' ? 'bloqueado' : 'ativo';
    try {
        await updateDoc(doc(db, "clientes", id), { status: novoStatus });
    } catch (error) {
        console.error("Erro ao mudar status:", error);
    }
};

window.prepararEdicao = (id, nome, email, slug, plano, vencimento) => {
    clienteIdEdicao = id;
    document.getElementById('nomeOrg').value = nome;
    document.getElementById('emailAdmin').value = email;
    document.getElementById('slugCliente').value = slug;
    if (document.getElementById('planoCliente')) document.getElementById('planoCliente').value = plano || "Bronze";
    if (document.getElementById('vencimentoCliente')) document.getElementById('vencimentoCliente').value = vencimento || "";
    
    document.querySelector('#modalCliente h3').innerText = "Editar Cliente";
    document.getElementById('modalCliente').style.display = 'flex';
};

window.deletarCliente = async (id, nome) => {
    if (confirm(`Excluir "${nome}"? Isso não removerá o login do usuário, apenas os dados do painel.`)) {
        try { await deleteDoc(doc(db, "clientes", id)); } catch (error) { console.error(error); }
    }
};

window.renderizarTabela = (dados) => {
    const listaClientesBody = document.getElementById('listaClientes');
    if (!listaClientesBody) return;
    
    listaClientesBody.innerHTML = ""; 
    const hoje = new Date().toISOString().split('T')[0];

    dados.forEach((cliente) => {
        const statusClass = cliente.status === 'ativo' ? 'status-ativo' : 'status-bloqueado';
        
        let classeVenc = "vencimento-ok";
        if (cliente.vencimento && cliente.vencimento < hoje) {
            classeVenc = "vencimento-atrasado";
        } else if (cliente.vencimento && cliente.vencimento === hoje) {
            classeVenc = "vencimento-alerta";
        }

        const row = `
            <tr>
                <td><small style="font-family: monospace; font-weight: bold; color: #64748b;">${cliente.clienteId || '---'}</small></td>
                <td><strong>${cliente.nome}</strong></td>
                <td><small>${cliente.plano || 'Bronze'}</small></td>
                <td><span class="${classeVenc}">${cliente.vencimento || 'N/A'}</span></td>
                <td>
                    <span class="${statusClass}" onclick="window.alternarStatus('${cliente.id}', '${cliente.status}')" style="cursor:pointer">
                        ${cliente.status}
                    </span>
                </td>
                <td>
                    <button class="btn-edit" style="background-color: #f59e0b; margin-right: 5px;" onclick="window.abrirModalPersonalizar('${cliente.id}', '${cliente.nome}', '${cliente.corPrimaria}', '${cliente.corSecundaria}', '${cliente.logoUrl}')" title="Personalizar App">
                        <i class="fas fa-palette" style="color: white;"></i>
                    </button>
                    <button class="btn-edit" onclick="window.prepararEdicao('${cliente.id}', '${cliente.nome}', '${cliente.email || ''}', '${cliente.slug}', '${cliente.plano}', '${cliente.vencimento}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="window.deletarCliente('${cliente.id}', '${cliente.nome}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        listaClientesBody.innerHTML += row;
    });
};

function iniciarPainel() {
    const inputBusca = document.getElementById('inputBusca');
    const q = query(collection(db, "clientes"), orderBy("dataCriacao", "desc"));

    onSnapshot(q, (snapshot) => {
        cacheClientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.renderizarTabela(cacheClientes);
        
        const total = snapshot.size;
        const ativos = cacheClientes.filter(c => c.status === 'ativo').length;
        if(document.getElementById('totalClientes')) document.getElementById('totalClientes').innerText = total;
        if(document.getElementById('clientesAtivos')) document.getElementById('clientesAtivos').innerText = ativos;
        if(document.getElementById('clientesPendentes')) document.getElementById('clientesPendentes').innerText = total - ativos;
    });

    if (inputBusca) {
        inputBusca.oninput = (e) => {
            const termo = e.target.value.toLowerCase();
            const filtrados = cacheClientes.filter(c => 
                c.nome.toLowerCase().includes(termo) || 
                (c.clienteId && c.clienteId.toLowerCase().includes(termo))
            );
            window.renderizarTabela(filtrados);
        };
    }
}

// FORMULÁRIO PERSONALIZAÇÃO (SUBMIT)
const formPerso = document.getElementById('formPersonalizar');
if (formPerso) {
    formPerso.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSalvarPersonalizacao');
        const file = document.getElementById('inputLogoApp').files[0];
        
        btn.disabled = true;
        btn.innerText = "Salvando...";

        try {
            let logoUrl = document.getElementById('previewLogo').src;

            if (file) {
                const storageRef = ref(storage, `logos-clientes/${idClientePersonalizacao}`);
                await uploadBytes(storageRef, file);
                logoUrl = await getDownloadURL(storageRef);
            }

            await updateDoc(doc(db, "clientes", idClientePersonalizacao), {
                corPrimaria: document.getElementById('corPrimaria').value,
                corSecundaria: document.getElementById('corSecundaria').value,
                logoUrl: logoUrl
            });

            alert("Identidade Visual atualizada!");
            window.fecharModalPersonalizar();
        } catch (error) {
            alert("Erro ao salvar personalização.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Salvar Identidade Visual";
        }
    });
}

// FORMULÁRIO NOVO/EDITAR CLIENTE
const formCliente = document.getElementById('formNovoCliente');
if (formCliente) {
    formCliente.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailAdmin').value;
        const senha = document.getElementById('senhaInicialCliente').value;
        
        const dados = {
            nome: document.getElementById('nomeOrg').value,
            email: email,
            slug: document.getElementById('slugCliente').value,
            plano: document.getElementById('planoCliente').value,
            vencimento: document.getElementById('vencimentoCliente').value
        };

        try {
            if (clienteIdEdicao) {
                await updateDoc(doc(db, "clientes", clienteIdEdicao), dados);
                alert("Dados do cliente atualizados!");
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
                const userUid = userCredential.user.uid;

                await addDoc(collection(db, "clientes"), {
                    ...dados,
                    uid: userUid,
                    clienteId: gerarIdCliente(),
                    status: "ativo",
                    dataCriacao: serverTimestamp(),
                    corPrimaria: "#2563eb",
                    corSecundaria: "#1e293b",
                    logoUrl: ""
                });
                alert("Cliente cadastrado e conta de acesso criada!");
            }
            window.fecharModal();
            clienteIdEdicao = null;
        } catch (error) { 
            console.error(error);
            alert("Erro ao salvar: " + error.message); 
        }
    });
}