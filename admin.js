function abrirModalNovoCliente() {
    document.getElementById('modalCliente').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalCliente').style.display = 'none';
}

// Fechar se clicar fora do conteúdo
window.onclick = function(event) {
    const modal = document.getElementById('modalCliente');
    if (event.target == modal) {
        fecharModal();
    }
}

// Lógica de envio (Exemplo)
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const dados = {
        nome: document.getElementById('nomeOrg').value,
        email: document.getElementById('emailAdmin').value,
        slug: document.getElementById('slugCliente').value
    };

    console.log("Enviando para o Firebase:", dados);
    
    // Aqui chamaremos a função de gravação no Firestore que vimos antes
    // cadastrarCliente(dados.nome, dados.email, dados.slug);
    
    fecharModal();
});