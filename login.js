import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Use as MESMAS chaves do seu app.js
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
const auth = getAuth(app);

const form = document.getElementById('formLogin');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            // Sucesso! Vai para o admin
            window.location.href = "admin.html";
        })
        .catch((error) => {
            console.error(error);
            alert("E-mail ou senha incorretos!");
        });
});