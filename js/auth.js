// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { initializeWebOS, showNotification, generateId } from './main.js';

// Configuração da API do Firebase
const ApiConfig = {
    firebase: {
        apiKey: window.env.FIREBASE_API_KEY,
        authDomain: window.env.FIREBASE_AUTH_DOMAIN,
        projectId: window.env.FIREBASE_PROJECT_ID,
        storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.env.FIREBASE_APP_ID,
    }
};

/**
 * Gerencia a interação com o Cloud Firestore.
 */
class FirestoreManager {
    constructor(db, userId) {
        if (!db || !userId) {
            throw new Error("Firestore DB e User ID são necessários para o manager.");
        }
        this.db = db;
        this.userId = userId;
        this.filesCollection = collection(db, "users", this.userId, "files");
    }

    async listFiles() {
        try {
            const querySnapshot = await getDocs(this.filesCollection);
            const files = [];
            querySnapshot.forEach((doc) => {
                files.push({ id: doc.id, ...doc.data() });
            });
            files.sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));
            return files;
        } catch (error) {
            console.error("Erro ao listar arquivos do Firestore:", error);
            showNotification("Erro ao listar arquivos da nuvem.", 4000);
            return [];
        }
    }
    
    async readFile(fileId) {
        try {
            const docRef = doc(this.filesCollection, fileId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return JSON.stringify(docSnap.data().content);
            } else {
                throw new Error("Arquivo não encontrado.");
            }
        } catch (error) {
            console.error("Erro ao ler arquivo do Firestore:", error);
            showNotification("Erro ao ler arquivo da nuvem.", 4000);
            throw error;
        }
    }
    
    async saveFile(fileMetadata, content) {
        try {
            const docId = fileMetadata.fileId || generateId('fsDoc');
            const docRef = doc(this.filesCollection, docId);
            const dataToSave = {
                name: fileMetadata.name,
                appDataType: fileMetadata.appDataType || 'pmo-file',
                content: JSON.parse(content), 
                modifiedTime: Date.now()
            };

            await setDoc(docRef, dataToSave, { merge: true });
            
            return { id: docId, name: fileMetadata.name };
        } catch (error) {
            console.error("Erro ao salvar arquivo no Firestore:", error);
            showNotification("Erro ao salvar arquivo na nuvem.", 4000);
            throw error;
        }
    }
    
    async renameFile(fileId, newName) {
         try {
            const docRef = doc(this.filesCollection, fileId);
            await updateDoc(docRef, {
                name: newName,
                modifiedTime: Date.now()
            });
        } catch (error) {
             console.error("Erro ao renomear arquivo:", error);
             showNotification("Erro ao renomear arquivo.", 4000);
        }
    }
    
    async deleteFile(fileId) {
         try {
            const docRef = doc(this.filesCollection, fileId);
            await deleteDoc(docRef);
        } catch (error) {
             console.error("Erro ao excluir arquivo:", error);
             showNotification("Erro ao excluir arquivo.", 4000);
        }
    }
}

/**
 * Gerencia a autenticação do Firebase.
 */
class AuthManager {
    toggleCloudButtons(enabled){ document.querySelectorAll(".cloud-required").forEach(btn => btn.disabled = !enabled); }
    openLoginModal(){ document.body.classList.add("show-login"); }
    closeLoginModal(){ document.body.classList.remove("show-login"); }
    constructor() {
        this.firebaseApp = initializeApp(ApiConfig.firebase);
        this.auth = getAuth(this.firebaseApp);
        this.db = getFirestore(this.firebaseApp);
        this.user = null;
        this.googleProvider = new GoogleAuthProvider();
    }

    init() {
        const loginOpenBtn = document.getElementById('loginOpenBtn');
        if (loginOpenBtn) loginOpenBtn.onclick = () => this.openLoginModal();
        document.addEventListener('keydown', (e) => { if(e.key==='Escape') this.closeLoginModal(); });
        onAuthStateChanged(this.auth, this.handleAuthState.bind(this));
        
        document.getElementById('loginBtn').onclick = () => this.signInWithEmail();
        document.getElementById('registerBtn').onclick = () => this.registerWithEmail();
        document.getElementById('googleLoginBtn').onclick = () => this.signInWithGoogle();
        document.getElementById('logoutBtn').onclick = () => this.signOut();
        document.getElementById('forgotPasswordLink').onclick = (e) => {
            e.preventDefault();
            this.sendPasswordReset();
        };
    }

    async signInWithEmail() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'none';

        try {
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            console.error("Erro no login:", error.code, error.message);
            errorEl.textContent = "E-mail ou senha inválidos.";
            errorEl.style.display = 'block';
        }
    }
    
    async registerWithEmail() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'none';

        if (password.length < 6) {
            errorEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
            errorEl.style.display = 'block';
            return;
        }

        try {
            await createUserWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            console.error("Erro no registro:", error.code, error.message);
            if (error.code === 'auth/email-already-in-use') {
                errorEl.textContent = "Este e-mail já está em uso.";
            } else {
                errorEl.textContent = "Erro ao criar conta. Verifique o e-mail.";
            }
            errorEl.style.display = 'block';
        }
    }

    async sendPasswordReset() {
        const email = document.getElementById('emailInput').value;
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'none';

        if (!email) {
            errorEl.textContent = "Por favor, digite seu e-mail para redefinir a senha.";
            errorEl.style.display = 'block';
            return;
        }

        try {
            await sendPasswordResetEmail(this.auth, email);
            showNotification(`E-mail de redefinição enviado para ${email}. Verifique sua caixa de entrada.`, 5000);
        } catch (error) {
            console.error("Erro ao enviar e-mail de redefinição:", error.code, error.message);
            errorEl.textContent = "Não foi possível enviar o e-mail. Verifique se o endereço está correto.";
            errorEl.style.display = 'block';
        }
    }
    
    async signInWithGoogle() {
        try {
            await signInWithPopup(this.auth, this.googleProvider);
        } catch (error) {
            console.error('Erro no login com Google:', error.code, error.message);
            showNotification('Erro ao entrar com Google.', 4000);
        }
    }

    signOut() {
        signOut(this.auth);
    }
    
    handleAuthState(user) {
        if (user) {
            this.user = user;
            window.firestoreManager = new FirestoreManager(this.db, user.uid);
            document.body.classList.add('logged-in');
            document.body.classList.remove('logged-out');
            this.updateUI(true);
        } else {
            this.user = null;
            window.firestoreManager = null;
            document.body.classList.remove('logged-in');
            document.body.classList.remove('show-login');
            this.updateUI(false);
        }
    }
updateUI(isLoggedIn) {
        const loginBtn = document.getElementById('loginOpenBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userNameEl = document.getElementById('userProfileName');
        if (isLoggedIn && this.user) {
            const userEmail = this.user.email || '';
            if (userNameEl) userNameEl.textContent = userEmail.split('@')[0];
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
            document.body.classList.remove('show-login');
            this.toggleCloudButtons(true);
            try { if (!window.webOSInitialized) initializeWebOS(); } catch(e) {}
        } else {
            if (userNameEl) userNameEl.textContent = 'Convidado';
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            this.toggleCloudButtons(false);
        }
}
}
// --- Ponto de Entrada Global para a Lógica de Auth/API ---
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    window.authManager.init();
});