// Importações necessárias do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURAÇÃO DO SEU FIREBASE (Copie do seu console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDX-zzuYHQ6HQce12CPSke38MuP8k63Zt8",
  authDomain: "saas-central-manager.firebaseapp.com",
  projectId: "saas-central-manager",
  storageBucket: "saas-central-manager.firebasestorage.app",
  messagingSenderId: "249170676982",
  appId: "1:249170676982:web:233d1609b9649135f370d7",
  measurementId: "G-39NX24J8D3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- FUNÇÕES DO MODAL ---
window.abrirModalNovoCliente = () => {
    document.getElementById('modalCliente').style.display = 'flex';
};

window.fecharModal = () => {
    document.getElementById('modalCliente').style.display = 'none';
};

// --- CADASTRAR NOVO CLIENTE ---
const form = document.getElementById('formNovoCliente');
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nomeOrg').value;
    const email = document.getElementById('emailAdmin').value;
    const slug = document.getElementById('slugCliente').value;

    try {
        await addDoc(collection(db, "clientes"), {
            nome: nome,
            email: email,
            slug: slug,
            status: "ativo",
            dataCriacao: new Date(),
            config: {
                cor_primaria: "#3b82f6", // Cor padrão
                logo_url: ""
            }
        });
        
        fecharModal();
        form.reset();
        alert("Cliente cadastrado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar no Firebase: ", error);
        alert("Erro ao cadastrar cliente.");
    }
});

// --- LISTAR CLIENTES EM TEMPO REAL ---
const listaClientes = document.getElementById('listaClientes');

const q = query(collection(db, "clientes"), orderBy("dataCriacao", "desc"));

onSnapshot(q, (snapshot) => {
    listaClientes.innerHTML = ""; // Limpa a tabela antes de atualizar
    
    snapshot.forEach((doc) => {
        const cliente = doc.data();
        const row = `
            <tr>
                <td>${cliente.nome}</td>
                <td><small>${cliente.slug}</small></td>
                <td><span class="status-ativo">${cliente.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="alert('Editar ID: ${doc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        listaClientes.innerHTML += row;
    });
});