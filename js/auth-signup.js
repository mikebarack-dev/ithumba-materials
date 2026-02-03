import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Wait for config.js to load
async function waitForConfig() {
    return new Promise((resolve) => {
        const checkConfig = () => {
            if (window.__firebase_config) {
                resolve();
            } else {
                setTimeout(checkConfig, 100);
            }
        };
        checkConfig();
    });
}

// Initialize Firebase
let auth;
let db;
async function initAuth() {
    await waitForConfig();
    
    // Parse the config string
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Check for Google redirect result
    getRedirectResult(auth)
        .then(async (userCredential) => {
            if (userCredential) {
                console.log('✅ Google signup redirect result received');
                await saveUserToFirestore(userCredential.user);
                const token = await userCredential.user.getIdToken();
                localStorage.setItem('authToken', token);
                localStorage.setItem('userEmail', userCredential.user.email);
                localStorage.setItem('userDisplayName', userCredential.user.displayName || '');
                
                showSuccess(`Welcome ${userCredential.user.displayName}! Redirecting to profile...`);
                setTimeout(() => {
                    window.location.href = '/profile.html';
                }, 1500);
            }
        })
        .catch((error) => {
            console.error('Google signup redirect error:', error);
        });
}

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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('✅ User saved to Firestore:', user.uid, '| isAdmin:', isAdmin);
        
        // Also create a client profile in clients collection (non-critical)
        await createClientProfile(user);
    } catch (error) {
        console.error('Error saving user to Firestore:', error);
        throw error; // Re-throw auth errors
    }
}

/**
 * Create a client profile in the clients collection
 * This links the account to the clients list
 */
async function createClientProfile(user) {
    try {
        const clientRef = doc(db, 'clients', user.uid);
        await setDoc(clientRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            phoneNumber: user.phoneNumber || '',
            photoURL: user.photoURL || '',
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            status: 'active',
            totalOrders: 0,
            totalSpent: 0,
            messageCount: 0
        }, { merge: true });
        console.log('✅ Client profile created:', user.uid);
    } catch (error) {
        console.warn('⚠️ Could not create client profile (non-critical):', error.message);
        // Don't throw - this error won't block signup
    }
}

// DOM Elements
const signupForm = document.getElementById('signup-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const signupBtn = document.getElementById('signup-btn');
const googleBtn = document.getElementById('google-btn');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const btnText = document.getElementById('btn-text');

// Show error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

// Show success
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// Email/Password Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (!email || !password) {
        showError('Please fill in all fields.');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
    }

    // Disable button and show loading
    signupBtn.disabled = true;
    btnText.innerHTML = '<span class="loading"></span>Creating account...';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save user to Firestore
        await saveUserToFirestore(user);

        showSuccess('Account created successfully! Redirecting...');
        
        setTimeout(() => {
            window.location.href = '/profile.html';
        }, 1500);
    } catch (error) {
        console.error('Signup error:', error);
        
        let errorMsg = 'Signup failed. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This email is already registered. Please log in instead.';
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMsg = 'Password is too weak. Please use a stronger password.';
        }
        
        showError(errorMsg);
    } finally {
        signupBtn.disabled = false;
        btnText.textContent = 'Create Account';
    }
});

// Google Signup
googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    googleBtn.textContent = '⏳ Signing up with Google...';

    try {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error('Google signup error:', error);
        showError('Failed to sign up with Google. Please try again.');
        googleBtn.disabled = false;
        googleBtn.innerHTML = `
            <svg class="google-icon" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
        `;
    }
});

// Initialize
initAuth().catch(error => {
    console.error('Failed to initialize auth:', error);
    showError('Failed to load authentication. Please refresh the page.');
});
