import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Certifique-se de que NÃO existam espaços invisíveis aqui
const firebaseConfig = {
    apiKey: "AIzaSyDX-zzuYHQ6HQce12CPSke38MuP8k63Zt8",
    authDomain: "saas-central-manager.firebaseapp.com",
    projectId: "saas-central-manager",
    storageBucket: "saas-central-manager.firebasestorage.app",
    messagingSenderId: "249170676982",
    appId: "1:249170676982:web:233d1609b9649135f370d7",
    measurementId: "G-39NX24J8D3"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Aguarda o DOM carregar para evitar erro de 'getElementById' nulo
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formLoginCliente');
    const msgErro = document.getElementById('msgErro');

    if (!form) {
        console.error("ERRO: Formulário 'formLoginCliente' não encontrado no HTML!");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Tentando login...");

        const email = document.getElementById('emailLogin').value.trim();
        const senha = document.getElementById('senhaLogin').value;

        try {
            // 1. Autentica
            const userCredential = await signInWithEmailAndPassword(auth, email, senha);
            console.log("Auth OK. Buscando dados do cliente...");

            // 2. Busca o vínculo no Firestore
            const q = query(collection(db, "clientes"), where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const clienteDoc = querySnapshot.docs[0];
                const clienteData = clienteDoc.data();

                if (clienteData.status === 'bloqueado') {
                    alert("Acesso suspenso.");
                    await auth.signOut();
                    return;
                }

                // 3. Sucesso!
                window.location.href = `cliente.html?id=${clienteDoc.id}`;
            } else {
                msgErro.innerText = "E-mail autenticado, mas organização não encontrada.";
                msgErro.style.display = "block";
            }

        } catch (error) {
            console.error("Erro detalhado:", error.code, error.message);
            msgErro.innerText = "Falha no login: " + error.message;
            msgErro.style.display = "block";
        }
    });
});