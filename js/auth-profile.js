import { 
    initializeApp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// Wait for config to be loaded
let auth;
async function initializeFirebase() {
    return new Promise((resolve) => {
        const checkConfig = () => {
            if (window.__firebase_config) {
                const firebaseConfig = JSON.parse(window.__firebase_config);
                const app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                resolve();
            } else {
                setTimeout(checkConfig, 100);
            }
        };
        checkConfig();
    });
}

await initializeFirebase();

const loadingState = document.getElementById('loading-state');
const notLoggedInState = document.getElementById('not-logged-in');
const profileContent = document.getElementById('profile-content');
const userEmail = document.getElementById('user-email');
const userName = document.getElementById('user-name');
const accountCreated = document.getElementById('account-created');
const lastLogin = document.getElementById('last-login');
const userGreeting = document.getElementById('user-greeting');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const messagesBtn = document.getElementById('messages-btn');

// Format date helper
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Get initials for avatar
function getInitials(name) {
    if (!name) return '👤';
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Logout function
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userDisplayName');
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to log out. Please try again.');
    }
});

// Messages button
messagesBtn.addEventListener('click', () => {
    window.location.href = '/messages';
});

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // User not logged in
        loadingState.style.display = 'none';
        notLoggedInState.style.display = 'block';
        profileContent.style.display = 'none';
        return;
    }

    try {
        // Show loading state
        loadingState.style.display = 'block';
        notLoggedInState.style.display = 'none';
        profileContent.style.display = 'none';

        // Populate user info
        const email = user.email || 'Not provided';
        const displayName = user.displayName || 'User';
        const createdDate = formatDate(user.metadata?.creationTime || user.metadata?.createdAt || new Date());
        const lastSignInDate = formatDate(user.metadata?.lastSignInTime || user.metadata?.lastSignedInAt || new Date());

        // Determine auth method
        let authMethodText = 'Email';
        if (user.providerData && user.providerData.length > 0) {
            const provider = user.providerData[0].providerId;
            if (provider === 'google.com') {
                authMethodText = 'Google';
            } else if (provider === 'password') {
                authMethodText = 'Email';
            }
        }

        // Update UI
        userEmail.textContent = email;
        userName.textContent = displayName;
        accountCreated.textContent = createdDate;
        lastLogin.textContent = lastSignInDate;
        userGreeting.textContent = `Welcome back, ${displayName}!`;

        // Update avatar
        const initials = getInitials(displayName);
        userAvatar.textContent = initials;

        // Get ID token for API calls
        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', displayName);

        // Hide loading, show content
        loadingState.style.display = 'none';
        profileContent.style.display = 'block';

    } catch (error) {
        console.error('Error loading profile:', error);
        loadingState.style.display = 'none';
        notLoggedInState.style.display = 'block';
    }
});
