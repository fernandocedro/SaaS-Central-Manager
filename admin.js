import { auth, db } from "./firebase-config.js"; // Garanta que a config está certa
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { setDoc, doc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('formNovoCliente').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 1. Capturar os valores do seu HTML
    const nome = document.getElementById('nomeOrg').value;
    const email = document.getElementById('emailAdmin').value;
    const slug = document.getElementById('slugCliente').value;
    const senha = document.getElementById('senhaInicialCliente').value;
    const plano = document.getElementById('planoCliente').value;
    const vencimento = document.getElementById('vencimentoCliente').value;

    // Gerar um ID amigável (ex: CLI-123456)
    const idUnico = "CLI-" + Math.floor(100000 + Math.random() * 900000);

    try {
        console.log("Iniciando cadastro triplo...");

        // PASSO 1: Criar o Usuário no Firebase Authentication
        // Nota: Isso vai deslogar você (Admin) se não for feito via Firebase Admin SDK, 
        // mas para teste local funciona.
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const uid = userCredential.user.uid;

        // PASSO 2: Criar o documento da IGREJA
        await setDoc(doc(db, "clientes", idUnico), {
            nome: nome,
            slug: slug,
            plano: plano,
            vencimento: vencimento,
            dataCriacao: serverTimestamp(),
            status: "ativo",
            corPrimaria: "#2563eb", // Padrão inicial
            logoUrl: ""
        });

        // PASSO 3: Criar o VÍNCULO do usuário com a igreja
        // Esse é o documento que o login-cliente.js vai ler!
        await setDoc(doc(db, "usuarios_admin", uid), {
            nome: nome,
            email: email,
            idCliente: idUnico,
            tipo: "admin",
            status: "ativo"
        });

        alert("Igreja e Administrador cadastrados com sucesso!");
        fecharModal();
        location.reload(); // Recarrega a tabela

    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert("Erro ao cadastrar: " + error.message);
    }
});
