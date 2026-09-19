// ==========================================
// 1. EmailJS Contact Form Handling
// ==========================================
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const form = this;
        const submitBtn = document.getElementById('submitBtn');
        const formStatus = document.getElementById('formStatus');

        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Sending message...';
        submitBtn.disabled = true;

        emailjs.sendForm('service_5iuxlrq', 'template_1z9jtgv', form)
            .then(function() {
                if (formStatus) {
                    formStatus.style.display = 'block';
                    formStatus.style.backgroundColor = '#d4edda';
                    formStatus.style.color = '#155724';
                    formStatus.style.border = '1px solid #c3e6cb';
                    formStatus.innerText = 'Thank you for reaching out to Still Rooted! Our school project team will be in touch shortly.';
                } else {
                    alert('Thank you for reaching out to Still Rooted! Our school project team will be in touch shortly.');
                }
                form.reset();
            }, function(error) {
                console.error('EmailJS Error:', error);
                if (formStatus) {
                    formStatus.style.display = 'block';
                    formStatus.style.backgroundColor = '#f8d7da';
                    formStatus.style.color = '#721c24';
                    formStatus.style.border = '1px solid #f5c6cb';
                    formStatus.innerText = 'Oops! Failed to send your message. Please try again later.';
                } else {
                    alert('Failed to send message. Please try again later.');
                }
            })
            .finally(function() {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            });
    });
}


// ==========================================
// 2. Helper Functions
// ==========================================
const authStatus = document.getElementById('authStatus');

function showAuthStatus(message, type) {
    if (!authStatus) return;
    authStatus.innerText = message;
    authStatus.className = 'auth-status ' + type;
    authStatus.style.display = 'block';
}

function clearAuthStatus() {
    if (!authStatus) return;
    authStatus.style.display = 'none';
    authStatus.innerText = '';
}

function getFriendlyAuthError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'That email address doesn\'t look right. Please check and try again.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            return 'Incorrect email or password. Please try again.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact us for help.';
        case 'auth/email-already-in-use':
            return 'An account with that email already exists. Try signing in instead.';
        case 'auth/weak-password':
            return 'Please choose a stronger password (at least 6 characters).';
        case 'auth/missing-password':
            return 'Please enter a password.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
        default:
            return 'Something went wrong. Please try again.';
    }
}

// Extract up to 2 initials (e.g. "Avaneesh" -> "A", "Dark Sabre" -> "DS")
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}


// ==========================================
// 3. Navigation Bar Profile Badge & Local Cache
// ==========================================
function updateNavbarAuth(user) {
    const navAuthLink = document.getElementById('navAuthLink');
    if (!navAuthLink) return;

    if (user) {
        const initials = getInitials(user.displayName || 'User');
        localStorage.setItem('cachedUserInitials', initials);

        navAuthLink.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background-color: #1b4332; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none;">${initials}</span>`;
        navAuthLink.title = "View Profile";
    } else {
        localStorage.removeItem('cachedUserInitials');
        navAuthLink.innerHTML = 'Login / Register';
        navAuthLink.title = "";
    }
}

// Immediate execution (0ms delay) to prevent page navigation flash
(function checkCachedSession() {
    const cachedInitials = localStorage.getItem('cachedUserInitials');
    const navAuthLink = document.getElementById('navAuthLink');
    if (cachedInitials && navAuthLink) {
        navAuthLink.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background-color: #1b4332; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none;">${cachedInitials}</span>`;
        navAuthLink.title = "View Profile";
    }
})();


// ==========================================
// 4. Firebase Auth Form Event Handlers
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(() => {
                loginForm.reset();
            })
            .catch((error) => {
                console.error('Login Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            });
    });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                return userCredential.user.updateProfile({
                    displayName: name
                });
            })
            .then(() => {
                signupForm.reset();
            })
            .catch((error) => {
                console.error('Sign Up Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            });
    });
}


// ==========================================
// 5. Profile Panel & Session State Observer
// ==========================================
const accountPanel = document.getElementById('accountPanel');
const authForms = document.getElementById('authForms');

function showAccountPanel(user) {
    if (!user) return;

    const name = user.displayName || 'Still Rooted Member';
    const initials = getInitials(name);

    const accountName = document.getElementById('accountName');
    const accountEmail = document.getElementById('accountEmail');
    const accountInitial = document.getElementById('accountInitial');
    const authTitle = document.getElementById('authTitle');

    if (accountName) accountName.innerText = name;
    if (accountEmail) accountEmail.innerText = user.email;
    if (accountInitial) accountInitial.innerText = initials;
    if (authTitle) authTitle.innerText = 'Profile';

    if (accountPanel) accountPanel.style.display = 'block';
    if (authForms) authForms.style.display = 'none';
}

function showAuthForms() {
    const authTitle = document.getElementById('authTitle');
    if (authTitle) authTitle.innerText = 'Welcome Back';

    if (accountPanel) accountPanel.style.display = 'none';
    if (authForms) authForms.style.display = 'block';
}

// Global Auth Observer
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
        updateNavbarAuth(user);
        if (user) {
            showAccountPanel(user);
        } else {
            showAuthForms();
        }
    });
}

// Sign Out Action & Redirect
const signOutBtn = document.getElementById('signOutBtn');
if (signOutBtn) {
    signOutBtn.addEventListener('click', function() {
        firebase.auth().signOut()
            .then(() => {
                localStorage.removeItem('cachedUserInitials');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Sign Out Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            });
    });
}