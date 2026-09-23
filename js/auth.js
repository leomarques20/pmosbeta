// Importações do Firebase
// Os módulos do Firebase são carregados dinamicamente (ver loadFirebaseModules) para que
// uma falha no CDN ou a ausência de configuração não impeça o PMOS de iniciar em modo convidado.
import { initializeWebOS, showNotification, generateId } from './main.js';

const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/11.9.1";
let initializeApp, getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup;
let getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc;

async function loadFirebaseModules() {
    const [appMod, authMod, firestoreMod] = await Promise.all([
        import(`${FIREBASE_CDN}/firebase-app.js`),
        import(`${FIREBASE_CDN}/firebase-auth.js`),
        import(`${FIREBASE_CDN}/firebase-firestore.js`)
    ]);
    ({ initializeApp } = appMod);
    ({ getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
        sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } = authMod);
    ({ getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc } = firestoreMod);
}

// Configuração da API do Firebase
const env = (window.env && typeof window.env === 'object') ? window.env : {};
const ApiConfig = {
    firebase: {
        apiKey: env.FIREBASE_API_KEY,
        authDomain: env.FIREBASE_AUTH_DOMAIN,
        projectId: env.FIREBASE_PROJECT_ID,
        storageBucket: env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
        appId: env.FIREBASE_APP_ID,
    }
};

function hasFirebaseConfig() {
    return Boolean(ApiConfig.firebase.apiKey && ApiConfig.firebase.projectId && ApiConfig.firebase.appId);
}

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
            document.dispatchEvent(new CustomEvent('pmos:fileschanged'));
            
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
            return true;
        } catch (error) {
             console.error("Erro ao renomear arquivo:", error);
             showNotification("Erro ao renomear arquivo.", 4000);
             return false;
        }
    }
    
    async deleteFile(fileId) {
         try {
            const docRef = doc(this.filesCollection, fileId);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
             console.error("Erro ao excluir arquivo:", error);
             showNotification("Erro ao excluir arquivo.", 4000);
             return false;
        }
    }
}

/**
 * Gerencia a autenticação do Firebase.
 */
class AuthManager {
    toggleCloudButtons(enabled){ document.querySelectorAll(".cloud-required").forEach(btn => btn.disabled = !enabled); }
    openLoginModal(){
        if (this.user) {
            showNotification(`Você já está conectado como ${this.user.email || 'usuário'}.`, 3000);
            return;
        }
        if (!this.firebaseReady) {
            showNotification(this.firebaseError
                ? "Login indisponível no momento. Você pode continuar usando o PMOS como convidado."
                : "Conectando ao serviço de login... tente novamente em instantes.", 4000);
            return;
        }
        document.body.classList.add("show-login");
    }
    closeLoginModal(){ document.body.classList.remove("show-login"); }
    constructor() {
        this.firebaseApp = null;
        this.auth = null;
        this.db = null;
        this.user = null;
        this.googleProvider = null;
        this.firebaseReady = false;
        this.firebaseError = null;
    }

    async setupFirebase() {
        if (!hasFirebaseConfig()) {
            throw new Error("Configuração do Firebase ausente (window.env).");
        }
        await loadFirebaseModules();
        this.firebaseApp = initializeApp(ApiConfig.firebase);
        this.auth = getAuth(this.firebaseApp);
        this.db = getFirestore(this.firebaseApp);
        this.googleProvider = new GoogleAuthProvider();
        this.firebaseReady = true;
        onAuthStateChanged(this.auth, this.handleAuthState.bind(this));
    }

    init() {
        const loginOpenBtn = document.getElementById('loginOpenBtn');
        if (loginOpenBtn) loginOpenBtn.onclick = () => this.openLoginModal();
        document.addEventListener('keydown', (e) => { if(e.key==='Escape') this.closeLoginModal(); });
        const loginContainer = document.getElementById('loginContainer');
        if (loginContainer) {
            // Clique fora do formulário fecha o modal de login
            loginContainer.addEventListener('click', (e) => { if (e.target === loginContainer) this.closeLoginModal(); });
        }

        const bind = (id, handler) => { const el = document.getElementById(id); if (el) el.onclick = handler; };
        bind('loginBtn', () => this.signInWithEmail());
        bind('registerBtn', () => this.registerWithEmail());
        bind('googleLoginBtn', () => this.signInWithGoogle());
        bind('logoutBtn', () => this.signOut());
        bind('forgotPasswordLink', (e) => {
            e.preventDefault();
            this.sendPasswordReset();
        });

        // Começa como convidado; o estado real chega via onAuthStateChanged, se o Firebase carregar.
        this.updateUI(false);
        this.setupFirebase().catch((error) => {
            this.firebaseError = error;
            console.warn("Firebase indisponível; PMOS em modo convidado.", error);
        });
    }

    async signInWithEmail() {
        if (!this.firebaseReady) { showNotification('Serviço de login indisponível.', 3000); return; }
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
        if (!this.firebaseReady) { showNotification('Serviço de login indisponível.', 3000); return; }
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
        if (!this.firebaseReady) { showNotification('Serviço de login indisponível.', 3000); return; }
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
        if (!this.firebaseReady) { showNotification('Serviço de login indisponível.', 3000); return; }
        try {
            await signInWithPopup(this.auth, this.googleProvider);
        } catch (error) {
            console.error('Erro no login com Google:', error.code, error.message);
            showNotification('Erro ao entrar com Google.', 4000);
        }
    }

    signOut() {
        if (!this.firebaseReady || !this.auth) return Promise.resolve();
        return signOut(this.auth).catch((error) => {
            console.error("Erro ao sair:", error);
            showNotification("Erro ao sair da conta.", 3000);
        });
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
        document.dispatchEvent(new CustomEvent('pmos:authchange', { detail: { user: this.user } }));
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
            try { if (!window.webOSInitialized) initializeWebOS(); } catch(e) { console.error(e); }
        } else {
            if (userNameEl) userNameEl.textContent = 'Convidado';
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            this.toggleCloudButtons(false);
        }
}
}
// --- Ponto de Entrada Global para a Lógica de Auth/API ---
function startAuth() {
    if (window.authManager) return;
    try {
        window.authManager = new AuthManager();
        window.authManager.init();
    } catch (e) {
        console.error("Falha ao iniciar autenticação; seguindo em modo convidado.", e);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAuth);
} else {
    startAuth();
}
