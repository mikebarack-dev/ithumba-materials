// login.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged,
    linkWithCredential, 
    EmailAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuration ---
const appId = window.__app_id;
const firebaseConfig = JSON.parse(window.__firebase_config);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State ---
let isRegistering = false;

// --- DOM Elements ---
const loginForm = document.getElementById('login-form');
const dynamicContainer = document.getElementById('dynamic-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageContainer = document.getElementById('message-container');
const linksContainer = document.querySelector('.login-container .links');
const submitBtn = loginForm.querySelector('button');

// --- 1. UI Logic ---

function displayMessage(msg, type) {
    messageContainer.style.display = 'block';
    messageContainer.textContent = msg;
    messageContainer.style.color = type === 'error' ? 'red' : 'green';
}

function renderFormState() {
    messageContainer.style.display = 'none';
    dynamicContainer.innerHTML = ''; // Clear dynamic fields

    if (isRegistering) {
        // Render Register View
        document.querySelector('h1').textContent = 'Create Account';
        submitBtn.textContent = 'Register';
        
        // Add Name Field securely
        dynamicContainer.innerHTML = `
            <label for="name">Full Name</label>
            <input type="text" id="name" placeholder="Enter full name" required>
        `;

        linksContainer.innerHTML = `<a href="#" id="to-login">Back to Login</a>`;
        document.getElementById('to-login').onclick = () => { isRegistering = false; renderFormState(); };
        
        loginForm.onsubmit = handleRegistration;

    } else {
        // Render Login View
        document.querySelector('h1').textContent = 'User Login';
        submitBtn.textContent = 'Login';

        linksContainer.innerHTML = `
            <a href="#" id="forgot-pw">Forgot Password?</a> | 
            <a href="#" id="to-register">Register</a>
        `;
        
        document.getElementById('to-register').onclick = () => { isRegistering = true; renderFormState(); };
        document.getElementById('forgot-pw').onclick = handlePasswordReset;
        
        loginForm.onsubmit = handleLogin;
    }
}

// --- 2. Auth Logic ---

async function handleLogin(e) {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // CAPTURE ANONYMOUS DATA BEFORE LOGGING IN (because login wipes the anon session)
    let tempAnonData = null;
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        console.log("Saving anonymous data before login switch...");
        tempAnonData = await fetchUserData(auth.currentUser.uid);
    }

    displayMessage("Signing in...", "info");

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // If we had anon data, merge it into the existing account
        if (tempAnonData) {
            await mergeAnonDataToUser(user.uid, tempAnonData);
        }

        displayMessage("Success! Redirecting...", "success");
        setTimeout(() => window.location.href = 'profile.html', 1000);

    } catch (error) {
        console.error(error);
        displayMessage(error.message, "error");
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    const name = document.getElementById('name').value;

    displayMessage("Creating account...", "info");

    try {
        let user;

        // OPTION A: If currently Anonymous, CONVERT the account (Keeps Data!)
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            console.log("Upgrading anonymous account...");
            const credential = EmailAuthProvider.credential(email, password);
            const userCred = await linkWithCredential(auth.currentUser, credential);
            user = userCred.user;
        } 
        // OPTION B: Fresh Registration
        else {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            user = userCred.user;
        }

        // Update Name
        await updateProfile(user, { displayName: name });
        
        displayMessage("Account created! Redirecting...", "success");
        setTimeout(() => window.location.href = 'profile.html', 1000);

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            displayMessage("This email is already in use. Please Login instead.", "error");
        } else {
            displayMessage(error.message, "error");
        }
    }
}

async function handlePasswordReset() {
    const email = emailInput.value;
    if (!email) return displayMessage("Enter email first.", "error");
    
    try {
        await sendPasswordResetEmail(auth, email);
        displayMessage("Reset link sent to email.", "success");
    } catch (error) {
        displayMessage(error.message, "error");
    }
}

// --- 3. Data Helpers ---

// Helper: Get data from Firestore
async function fetchUserData(uid) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
        console.error("Error fetching anon data:", e);
        return null;
    }
}

// Helper: Merge data
async function mergeAnonDataToUser(uid, anonData) {
    try {
        const userRef = doc(db, 'users', uid);
        // Use setDoc with { merge: true } to combine anon cart with existing cart
        await setDoc(userRef, anonData, { merge: true });
        console.log("Anonymous data merged successfully.");
    } catch (e) {
        console.error("Merge failed:", e);
    }
}

// --- 4. Initialization ---

// Check Auth State
onAuthStateChanged(auth, (user) => {
    if (user && !user.isAnonymous) {
        // Check if we are freshly loading the page or just finished an action
        // We generally allow the page to load, but if they are already valid, 
        // we might show a "Go to Profile" link instead of the form.
        displayMessage(`Logged in as ${user.email}`, "success");
        submitBtn.textContent = "Go to Profile";
        loginForm.onsubmit = (e) => {
            e.preventDefault();
            window.location.href = 'profile.html';
        };
        // Note: Removing auto-redirect to prevent loops if they manually navigated here
    } else {
        // User is Anon or Null -> Show Form
        renderFormState();
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const email = emailInput.value;
        const password = passwordInput.value;
        await signInWithEmailAndPassword(auth, email, password);
        feedbackContainer.textContent = 'Login successful!';
    } catch (error) {
        feedbackContainer.textContent = `Login failed: ${error.message}`;
    }
});
