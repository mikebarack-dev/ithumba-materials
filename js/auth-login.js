import { 
    initializeApp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Wait for config to be loaded
let auth;
let db;
async function initializeFirebase() {
    return new Promise((resolve) => {
        const checkConfig = () => {
            if (window.__firebase_config) {
                const firebaseConfig = JSON.parse(window.__firebase_config);
                const app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getFirestore(app);
                resolve();
            } else {
                setTimeout(checkConfig, 100);
            }
        };
        checkConfig();
    });
}

await initializeFirebase();

// Check for redirect result from Google Sign-In
getRedirectResult(auth)
    .then(async (userCredential) => {
        if (userCredential) {
            console.log('✅ Redirect auth result received, user:', userCredential.user.email);
            await saveUserToFirestore(userCredential.user);
            const token = await userCredential.user.getIdToken();
            localStorage.setItem('authToken', token);
            localStorage.setItem('userEmail', userCredential.user.email);
            localStorage.setItem('userDisplayName', userCredential.user.displayName || '');
            
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirect') || '/profile.html';
            console.log('🔄 Redirecting to:', redirectTo);
            window.location.href = redirectTo;
        } else {
            console.log('ℹ️ No redirect result - user not just authenticated via redirect');
        }
    })
    .catch((error) => {
        console.error('❌ Redirect auth error:', error);
        if (error.code === 'auth/unauthorized-domain') {
            console.error('⚠️ CRITICAL: localhost:8081 is NOT authorized in Firebase Google OAuth settings');
            document.getElementById('error-message').textContent = 'Google login not configured. Contact admin.';
            document.getElementById('error-message').style.display = 'block';
        }
    });

/**
 * Save user data to Firestore users collection
 */
async function saveUserToFirestore(user) {
    try {
        // Check if user is admin
        const ADMIN_EMAILS = ['mikebarack5525@gmail.com']; // Add your admin emails here
        const isAdmin = ADMIN_EMAILS.includes(user.email);

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            name: user.displayName || '',
            photoURL: user.photoURL || '',
            isAdmin: isAdmin,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('User data updated in Firestore:', user.uid, '| isAdmin:', isAdmin);
        
        // Also ensure client profile exists
        await createOrUpdateClientProfile(user);
    } catch (error) {
        console.error('Error saving user to Firestore:', error);
    }
}

async function createOrUpdateClientProfile(user) {
    try {
        const clientRef = doc(db, 'clients', user.uid);
        await setDoc(clientRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            phoneNumber: user.phoneNumber || '',
            photoURL: user.photoURL || '',
            lastActive: new Date().toISOString(),
            status: 'active'
        }, { merge: true });
        console.log('Client profile updated/created:', user.uid);
    } catch (error) {
        console.error('Error updating client profile:', error);
    }
}

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const googleBtn = document.getElementById('google-btn');
const errorMsg = document.getElementById('error-message');
const successMsg = document.getElementById('success-message');

// Show message helper
function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    successMsg.style.display = 'none';
}

function showSuccess(message) {
    successMsg.textContent = message;
    successMsg.style.display = 'block';
    errorMsg.style.display = 'none';
}

function clearMessages() {
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
}

// Email/Password Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    try {
        loginBtn.disabled = true;
        const btnText = loginBtn.querySelector('#btn-text');
        btnText.textContent = 'Logging in...';

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Save user to Firestore
        await saveUserToFirestore(userCredential.user);
        
        showSuccess('Login successful! Redirecting...');
        
        // Get ID token for API calls
        const token = await userCredential.user.getIdToken();
        localStorage.setItem('authToken', token);
        localStorage.setItem('userEmail', userCredential.user.email);

        setTimeout(() => {
            // Check for redirect parameter, otherwise go to profile
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirect') || '/profile.html';
            window.location.href = redirectTo;
        }, 1000);

    } catch (error) {
        loginBtn.disabled = false;
        const btnText = loginBtn.querySelector('#btn-text');
        btnText.textContent = 'Log In';

        console.error('Login error:', error);
        
        switch (error.code) {
            case 'auth/user-not-found':
                showError('No account found with this email. Please sign up first.');
                break;
            case 'auth/wrong-password':
                showError('Incorrect password. Please try again.');
                break;
            case 'auth/invalid-email':
                showError('Invalid email address.');
                break;
            case 'auth/user-disabled':
                showError('This account has been disabled.');
                break;
            case 'auth/too-many-requests':
                showError('Too many login attempts. Please try again later.');
                break;
            default:
                showError(error.message || 'Login failed. Please try again.');
        }
    }
});

// Google Sign-In
googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    clearMessages();

    try {
        googleBtn.disabled = true;
        console.log('🔐 Initializing Google Sign-In...');
        console.log('📍 Current URL:', window.location.href);
        const provider = new GoogleAuthProvider();
        
        console.log('📱 Redirecting to Google login...');
        console.log('⚠️ Ensure http://localhost:8081/login.html is authorized in Firebase Console > Authentication > Sign-in method > Google');
        await signInWithRedirect(auth, provider);
        
    } catch (error) {
        googleBtn.disabled = false;
        console.error('❌ Google login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'auth/unauthorized-domain') {
            showError('❌ Google login not authorized for this domain. Admin needs to configure Firebase Console.');
        } else if (error.code === 'auth/invalid-api-key') {
            showError('❌ Invalid Firebase API key. Check config.js');
        } else {
            showError('Google login failed: ' + (error.message || error.code));
        }
    }
});

// Don't auto-redirect logged-in users - let them control login/logout flow
// Users can explicitly log out and log back in if they want

// Forgot Password Handler
const forgotPasswordLink = document.getElementById('forgot-password-link');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        if (!email) {
            showError('Please enter your email address');
            return;
        }
        
        try {
            await sendPasswordResetEmail(auth, email);
            showSuccess('✅ Password reset email sent! Check your inbox (and spam folder)');
            setTimeout(() => {
                showError('');
            }, 5000);
        } catch (error) {
            console.error('Password reset error:', error);
            showError('Error: ' + (error.message || 'Failed to send reset email'));
        }
    });
}
