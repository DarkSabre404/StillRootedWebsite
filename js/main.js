function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}
function safeUrl(url) {
    var u = String(url || '').trim();
    return /^(https?:\/\/|data:image\/)/i.test(u) ? escapeHTML(u) : '';
}

// EmailJS Contact Form Handling
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


// Helper Functions
function showAuthStatus(message, type) {
    const authStatus = document.getElementById('authStatus');
    if (!authStatus) return;

    authStatus.innerText = message;
    if (type === 'success') {
        authStatus.style.backgroundColor = '#d4edda';
        authStatus.style.color = '#155724';
        authStatus.style.border = '1px solid #c3e6cb';
    } else {
        authStatus.style.backgroundColor = '#f8d7da';
        authStatus.style.color = '#721c24';
        authStatus.style.border = '1px solid #f5c6cb';
    }
    authStatus.style.display = 'block';
}

function clearAuthStatus() {
    const authStatus = document.getElementById('authStatus');
    if (!authStatus) return;
    authStatus.style.display = 'none';
    authStatus.innerText = '';
}

function getFriendlyAuthError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'That email address doesn\'t look right. Please check and try again.';
        case 'auth/user-not-found':
            return 'No account found with that email address.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            return 'Incorrect email or password. Please try again.';
        case 'auth/requires-recent-login':
            return 'For security reasons, please log out and log back in before changing your password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact us for help.';
        case 'auth/email-already-in-use':
            return 'An account with that email already exists. Try signing in instead.';
        case 'auth/weak-password':
            return 'Please choose a stronger password (at least 6 characters).';
        default:
            return error.message || 'Something went wrong. Please try again.';
    }
}

function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

// Profile Picture Helper: crop to a square, shrink to 256x256 and return a small JPEG data URL.
// The result is only ~15-40 KB, so it can be stored directly in the user's Firestore document
// (no Firebase Storage bucket or Storage rules required).
function resizeImageToDataURL(file, size, quality) {
    size = size || 256;
    quality = quality || 0.85;

    return new Promise(function(resolve, reject) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            reject(new Error('Please choose a valid image file (JPG or PNG).'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = function() {
            reject(new Error('Could not read the selected image.'));
        };
        reader.onload = function() {
            const img = new Image();
            img.onerror = function() {
                reject(new Error('That image could not be loaded. Please try a JPG or PNG.'));
            };
            img.onload = function() {
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2;
                const sy = (img.height - side) / 2;

                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;

                const ctx = canvas.getContext('2d');
                // White background so transparent PNGs don't turn black when saved as JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}


// Keeps the Edit Profile picture preview linked to the picture shown on the Profile tab.
// Shows a newly chosen (not yet saved) file if there is one, otherwise the saved picture,
// otherwise the initials badge.
function syncEditAvatarPreview() {
    const circle = document.getElementById('editAvatarPreview');
    const preview = document.getElementById('photoPreview');
    const initialEl = document.getElementById('photoPreviewInitial');
    if (!circle || !preview || !initialEl) return;

    const colorInput = document.getElementById('editAvatarColor');
    const nameInput = document.getElementById('editDisplayName');
    const currentUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;

    const src = window.pendingPhotoPreviewURL || localStorage.getItem('cachedPhotoURL') || '';
    const color = (colorInput && colorInput.value) || localStorage.getItem('cachedAvatarColor') || '#243D32';
    const nameForInitials = (nameInput && nameInput.value) || (currentUser && currentUser.displayName) || '';
    const initials = getInitials(nameForInitials);

    circle.style.backgroundColor = color;

    const showInitials = function() {
        preview.style.display = 'none';
        preview.removeAttribute('src');
        initialEl.style.display = 'inline';
        initialEl.innerText = initials;
    };

    if (src) {
        preview.onerror = showInitials;
        preview.src = src;
        preview.style.display = 'block';
        initialEl.style.display = 'none';
    } else {
        showInitials();
    }
}


// Navigation Bar Profile Badge Active State (circular outline instead of gold underline)
function getNavRingStyle(navAuthLink) {
    // Only highlight the profile picture when the account page is the current page
    if (navAuthLink && navAuthLink.classList.contains('active')) {
        return 'outline: 2px solid var(--champagne); outline-offset: 2px;';
    }
    return '';
}

function setNavProfileState(navAuthLink, isLoggedIn) {
    if (!navAuthLink || !navAuthLink.classList.contains('active')) return;

    if (isLoggedIn) {
        // Remember the original logged-out inline style so it can be restored on logout
        if (navAuthLink.dataset.loggedOutStyle === undefined) {
            navAuthLink.dataset.loggedOutStyle = navAuthLink.getAttribute('style') || '';
        }
        // Remove the gold underline beneath the profile picture
        navAuthLink.style.setProperty('box-shadow', 'none', 'important');
    } else if (navAuthLink.dataset.loggedOutStyle !== undefined) {
        // Restore the original Login / Register gold underline
        navAuthLink.setAttribute('style', navAuthLink.dataset.loggedOutStyle);
        delete navAuthLink.dataset.loggedOutStyle;
    }
}

// Renders the circular profile picture (or initials badge) inside the navbar link.
// If the picture fails to load (broken/old URL), it falls back to the initials badge.
function renderNavAvatar(navAuthLink, photoURL, color, initials) {
    const ring = getNavRingStyle(navAuthLink);
    const safeColor = /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#243D32';
    const initialsHtml = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background-color: ${safeColor}; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; ${ring}">${escapeHTML(initials)}</span>`;

    if (photoURL) {
        navAuthLink.innerHTML = `<img src="${safeUrl(photoURL)}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; vertical-align: middle; border: 1px solid #243D32; ${ring}">`;
        const navImg = navAuthLink.querySelector('img');
        if (navImg) {
            navImg.addEventListener('error', function() {
                navAuthLink.innerHTML = initialsHtml;
            });
        }
    } else {
        navAuthLink.innerHTML = initialsHtml;
    }
}


// Navigation Bar Profile Badge & Local Cache
function updateNavbarAuth(user) {
    const navAuthLink = document.getElementById('navAuthLink');
    if (!navAuthLink) return;

    if (user) {
        const initials = getInitials(user.displayName || 'User');
        const color = localStorage.getItem('cachedAvatarColor') || '#243D32';
        // The cached value comes from Firestore (source of truth), so it takes priority
        const photoURL = localStorage.getItem('cachedPhotoURL') || user.photoURL;

        localStorage.setItem('cachedUserInitials', initials);

        renderNavAvatar(navAuthLink, photoURL, color, initials);
        navAuthLink.title = "View Profile";
        setNavProfileState(navAuthLink, true);
    } else {
        localStorage.removeItem('cachedUserInitials');
        localStorage.removeItem('cachedAvatarColor');
        localStorage.removeItem('cachedPhotoURL');
        localStorage.removeItem('cachedUserRole');
        navAuthLink.innerHTML = 'Login / Register';
        navAuthLink.title = "";
        setNavProfileState(navAuthLink, false);
    }
}

// Immediate execution (0ms delay) to prevent page navigation flash
(function checkCachedSession() {
    const cachedInitials = localStorage.getItem('cachedUserInitials');
    const cachedColor = localStorage.getItem('cachedAvatarColor') || '#243D32';
    const cachedPhotoURL = localStorage.getItem('cachedPhotoURL');
    const navAuthLink = document.getElementById('navAuthLink');

    if (cachedInitials && navAuthLink) {
        renderNavAvatar(navAuthLink, cachedPhotoURL, cachedColor, cachedInitials);
        navAuthLink.title = "View Profile";
        setNavProfileState(navAuthLink, true);
    }
})();


// Firebase Auth Event Handlers
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        clearAuthStatus();

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
        clearAuthStatus();

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const role = document.getElementById('signupRole').value;
        const password = document.getElementById('signupPassword').value;

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return user.updateProfile({ displayName: name }).then(() => user);
            })
            .then((user) => {
                if (typeof db !== 'undefined') {
                    return db.collection('users').doc(user.uid).set({
                        fullName: name,
                        email: email,
                        role: role,
                        bio: '',
                        avatarColor: '#243D32',
                        photoURL: '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
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
// Password Reset Logic
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
const resetPasswordBox = document.getElementById('resetPasswordBox');

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function() {
        clearAuthStatus();
        document.getElementById('loginForm').style.display = 'none';
        resetPasswordBox.style.display = 'block';
        document.getElementById('authTitle').innerText = 'Reset Password';
    });
}

if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', function() {
        clearAuthStatus();
        resetPasswordBox.style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('authTitle').innerText = 'Welcome Back';
    });
}

if (sendResetEmailBtn) {
    sendResetEmailBtn.addEventListener('click', function() {
        clearAuthStatus();
        const email = document.getElementById('resetEmail').value.trim();

        if (!email) {
            showAuthStatus('Please enter your email address.', 'error');
            return;
        }

        sendResetEmailBtn.innerText = 'Sending...';
        sendResetEmailBtn.disabled = true;

        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                showAuthStatus('Password reset email sent! Check your inbox.', 'success');
                document.getElementById('resetEmail').value = '';
            })
            .catch((error) => {
                console.error('Password Reset Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            })
            .finally(() => {
                sendResetEmailBtn.innerText = 'Send Reset Link';
                sendResetEmailBtn.disabled = false;
            });
    });
}


// Profile Section Toggles & Separate Views Logic
const editProfileForm = document.getElementById('editProfileForm');
const accountPanel = document.getElementById('accountPanel');
const editProfilePanel = document.getElementById('editProfilePanel');
const settingsPanel = document.getElementById('settingsPanel');
const authTitle = document.getElementById('authTitle');
const changePasswordForm = document.getElementById('changePasswordForm');

function renderRolePrivileges(role) {
    const list = document.getElementById('rolePrivilegesList');
    if (!list) return;

    if (role === 'admin') {
        list.innerHTML = `
            <li><strong>Admin Control:</strong> Full access to manage site data and upload media.</li>
            <li><strong>Content Management:</strong> Upload and delete gallery photos and blog articles.</li>
            <li><strong>System Oversight:</strong> Oversee user roles and community engagement metrics.</li>
        `;
    } else if (role === 'Senior Citizen Participant') {
        list.innerHTML = `
            <li><strong>Workshop Pass:</strong> Free enrollment in digital literacy & health workshops.</li>
            <li><strong>Mentorship Circle:</strong> Direct access to youth volunteer support.</li>
            <li><strong>Social Events:</strong> Priority invitations to local intergenerational meetups.</li>
        `;
    } else if (role === 'Volunteer / Mentor') {
        list.innerHTML = `
            <li><strong>Volunteer Dashboard:</strong> Log community service hours & track impact.</li>
            <li><strong>Mentorship Portal:</strong> Match with senior community members for skill sharing.</li>
            <li><strong>Certificates:</strong> Earn Still Rooted community service certificates.</li>
        `;
    } else if (role === 'Student / Researcher') {
        list.innerHTML = `
            <li><strong>Research Access:</strong> Download survey data & intergenerational study reports.</li>
            <li><strong>Case Studies:</strong> Access anonymized community project metrics.</li>
            <li><strong>Publication Collaboration:</strong> Co-author blog posts and impact insights.</li>
        `;
    } else {
        list.innerHTML = `<li>Access community updates and event invitations.</li>`;
    }
}


// Profile Rendering & Feature Submissions
function showAccountPanel(user) {
    if (!user) return;

    recordLoginHistory(user);
    loadLoginHistory(user);

    const name = user.displayName || 'Still Rooted Member';
    const initials = getInitials(name);

    const accountName = document.getElementById('accountName');
    const accountEmail = document.getElementById('accountEmail');
    const accountInitial = document.getElementById('accountInitial');
    const accountPhoto = document.getElementById('accountPhoto');
    const authTitle = document.getElementById('authTitle');
    const editDisplayName = document.getElementById('editDisplayName');
    const editBio = document.getElementById('editBio');
    const editAvatarColor = document.getElementById('editAvatarColor');
    const accountRoleBadge = document.getElementById('accountRoleBadge');
    const accountBioDisplay = document.getElementById('accountBioDisplay');
    const avatarContainer = document.getElementById('avatarContainer');

    if (accountName) accountName.innerText = name;
    if (accountEmail) accountEmail.innerText = user.email;
    if (authTitle) authTitle.innerText = 'Profile';
    if (editDisplayName) editDisplayName.value = name;

    // If the profile picture fails to load, fall back to the initials badge
    if (accountPhoto) {
        accountPhoto.onerror = function() {
            accountPhoto.style.display = 'none';
            if (accountInitial) {
                accountInitial.style.display = 'inline';
                accountInitial.innerText = initials;
            }
        };
    }

    // Render Avatar Image / Initial & Color
    if (user.photoURL) {
        if (accountPhoto) {
            accountPhoto.src = user.photoURL;
            accountPhoto.style.display = 'block';
        }
        if (accountInitial) accountInitial.style.display = 'none';
        // Only cache the Auth photo if Firestore hasn't already provided one
        if (!localStorage.getItem('cachedPhotoURL')) {
            localStorage.setItem('cachedPhotoURL', user.photoURL);
        }
    } else {
        const cachedPhoto = localStorage.getItem('cachedPhotoURL');
        if (cachedPhoto && accountPhoto) {
            accountPhoto.src = cachedPhoto;
            accountPhoto.style.display = 'block';
            if (accountInitial) accountInitial.style.display = 'none';
        } else {
            if (accountPhoto) accountPhoto.style.display = 'none';
            if (accountInitial) {
                accountInitial.style.display = 'inline';
                accountInitial.innerText = initials;
            }
        }
    }

    syncEditAvatarPreview();

    // Fetch user profile preferences from Firestore to sync avatar color and photo
    if (typeof db !== 'undefined') {
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const data = doc.data();

                    // Apply Avatar Background Color Fallback
                    if (data.avatarColor && avatarContainer) {
                        avatarContainer.style.backgroundColor = data.avatarColor;
                        localStorage.setItem('cachedAvatarColor', data.avatarColor);
                    }

                    // Firestore is the source of truth for the profile picture
                    if (data.photoURL) {
                        localStorage.setItem('cachedPhotoURL', data.photoURL);
                        if (accountPhoto) {
                            accountPhoto.src = data.photoURL;
                            accountPhoto.style.display = 'block';
                        }
                        if (accountInitial) accountInitial.style.display = 'none';
                        updateNavbarAuth(user);
                    }

                    if (data.bio) {
                        if (editBio) editBio.value = data.bio;
                        if (accountBioDisplay) accountBioDisplay.innerText = `"${data.bio}"`;
                    } else {
                        if (accountBioDisplay) accountBioDisplay.innerText = 'No bio added yet.';
                    }

                    if (data.role) {
                        if (accountRoleBadge) accountRoleBadge.innerText = data.role;
                        renderRolePrivileges(data.role);
                        localStorage.setItem('cachedUserRole', data.role);

                        const adminSection = document.getElementById('adminUploadSection');
                        if (adminSection) {
                            adminSection.style.display = (data.role === 'admin') ? 'block' : 'none';
                        }
                    }

                    if (data.avatarColor) {
                        if (editAvatarColor) editAvatarColor.value = data.avatarColor;
                        if (avatarContainer) avatarContainer.style.backgroundColor = data.avatarColor;
                        localStorage.setItem('cachedAvatarColor', data.avatarColor);
                        updateNavbarAuth(user);
                    }
                }
                syncEditAvatarPreview();
            })
            .catch((err) => console.warn("Firestore fetch skipped:", err));
    }

    const dashboardWrapper = document.getElementById('dashboardWrapper');
    const authFormsCard = document.getElementById('authFormsCard');
    const preferencesPanel = document.getElementById('preferencesPanel');

    if (dashboardWrapper) dashboardWrapper.style.display = 'flex';
    if (authFormsCard) authFormsCard.style.display = 'none';
    if (preferencesPanel) preferencesPanel.style.display = 'none';
}

function showAuthForms() {
    const authTitle = document.getElementById('authTitle');
    if (authTitle) authTitle.innerText = 'Welcome Back';

    const dashboardWrapper = document.getElementById('dashboardWrapper');
    const authFormsCard = document.getElementById('authFormsCard');
    const preferencesPanel = document.getElementById('preferencesPanel');

    if (dashboardWrapper) dashboardWrapper.style.display = 'none';
    if (authFormsCard) authFormsCard.style.display = 'block';
    if (preferencesPanel) preferencesPanel.style.display = 'none';

    const adminSection = document.getElementById('adminUploadSection');
    if (adminSection) adminSection.style.display = 'none';
}

if (editProfileForm) {
    editProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        clearAuthStatus();

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const newName = document.getElementById('editDisplayName').value.trim();
        const newBio = document.getElementById('editBio').value.trim();
        const newColor = document.getElementById('editAvatarColor').value;
        const photoInput = document.getElementById('profilePhotoInput');
        const saveBtn = document.getElementById('saveProfileBtn');
        const accountBioDisplay = document.getElementById('accountBioDisplay');
        const avatarContainer = document.getElementById('avatarContainer');
        const accountPhoto = document.getElementById('accountPhoto');
        const accountInitial = document.getElementById('accountInitial');

        saveBtn.innerText = 'Saving profile...';
        saveBtn.disabled = true;

        // Start from the picture already shown to the user (Firestore cache, then Auth)
        let uploadedPhotoURL = localStorage.getItem('cachedPhotoURL') || currentUser.photoURL || '';
        let photoWasChanged = false;

        try {
            if (photoInput && photoInput.files.length > 0) {
                const file = photoInput.files[0];

                if (file.size > 2 * 1024 * 1024) {
                    throw new Error('Please choose an image smaller than 2MB.');
                }

                // Crop + shrink to a small square JPEG data URL (stored in Firestore)
                uploadedPhotoURL = await resizeImageToDataURL(file, 256, 0.85);
                photoWasChanged = true;
            }

            // Firebase Auth only accepts short URLs for photoURL, so a data URL is never stored there.
            // When a new picture is uploaded, clear the old Auth photoURL so Firestore is the single source.
            const authUpdate = { displayName: newName };
            if (photoWasChanged) {
                authUpdate.photoURL = null;
            }
            await currentUser.updateProfile(authUpdate);

            if (typeof db !== 'undefined') {
                await db.collection('users').doc(currentUser.uid).set({
                    fullName: newName,
                    bio: newBio,
                    avatarColor: newColor,
                    photoURL: uploadedPhotoURL
                }, { merge: true });
            }

            // Immediately apply color fallback update to UI
            if (avatarContainer) {
                avatarContainer.style.backgroundColor = newColor;
            }
            localStorage.setItem('cachedAvatarColor', newColor);

            if (uploadedPhotoURL) {
                localStorage.setItem('cachedPhotoURL', uploadedPhotoURL);
                if (accountPhoto) {
                    accountPhoto.src = uploadedPhotoURL;
                    accountPhoto.style.display = 'block';
                }
                if (accountInitial) accountInitial.style.display = 'none';
            } else {
                if (accountPhoto) accountPhoto.style.display = 'none';
                if (accountInitial) {
                    accountInitial.style.display = 'inline';
                    accountInitial.innerText = getInitials(newName);
                }
            }

            // Reset the file picker; the preview now mirrors the saved picture
            if (photoInput) photoInput.value = '';
            window.pendingPhotoPreviewURL = null;
            syncEditAvatarPreview();

            document.getElementById('accountName').innerText = newName;
            if (accountBioDisplay) {
                accountBioDisplay.innerText = newBio ? `"${newBio}"` : 'No bio added yet.';
            }

            showAuthStatus('Profile updated successfully!', 'success');
            updateNavbarAuth(currentUser);

            // Automatically switch back to profile tab on success
            if (typeof switchDashboardTab === 'function') {
                switchDashboardTab('profile');
            }

        } catch (error) {
            console.error('Save Profile Error:', error);
            showAuthStatus(error.message || 'Failed to update profile.', 'error');
        } finally {
            saveBtn.innerText = 'Save Profile Changes';
            saveBtn.disabled = false;
        }
    });
}

// Quick Profile Picture Change (click the avatar on the Profile tab)
const avatarWrapper = document.getElementById('avatarWrapper');
const quickPhotoInput = document.getElementById('quickPhotoInput');

if (avatarWrapper && quickPhotoInput) {
    avatarWrapper.addEventListener('click', function() {
        quickPhotoInput.click();
    });

    quickPhotoInput.addEventListener('change', async function() {
        const file = quickPhotoInput.files && quickPhotoInput.files[0];
        if (!file) return;

        clearAuthStatus();

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const accountPhoto = document.getElementById('accountPhoto');
        const accountInitial = document.getElementById('accountInitial');

        // Show a "saving" state on the avatar while the upload runs
        avatarWrapper.style.opacity = '0.5';
        avatarWrapper.style.pointerEvents = 'none';

        try {
            if (file.size > 2 * 1024 * 1024) {
                throw new Error('Please choose an image smaller than 2MB.');
            }

            const newPhotoURL = await resizeImageToDataURL(file, 256, 0.85);

            // Save to Firestore first (source of truth), then clear the old Auth photoURL
            if (typeof db !== 'undefined') {
                await db.collection('users').doc(currentUser.uid).set({
                    photoURL: newPhotoURL
                }, { merge: true });
            }
            await currentUser.updateProfile({ photoURL: null });

            localStorage.setItem('cachedPhotoURL', newPhotoURL);

            if (accountPhoto) {
                accountPhoto.src = newPhotoURL;
                accountPhoto.style.display = 'block';
            }
            if (accountInitial) accountInitial.style.display = 'none';

            updateNavbarAuth(currentUser);
            // Keep the Edit Profile tab linked: drop any pending file and mirror the new picture
            const editPhotoInput = document.getElementById('profilePhotoInput');
            if (editPhotoInput) editPhotoInput.value = '';
            window.pendingPhotoPreviewURL = null;
            syncEditAvatarPreview();

            showAuthStatus('Profile picture updated!', 'success');
        } catch (error) {
            console.error('Quick Photo Update Error:', error);
            showAuthStatus(error.message || 'Failed to update profile picture.', 'error');
        } finally {
            avatarWrapper.style.opacity = '1';
            avatarWrapper.style.pointerEvents = 'auto';
            quickPhotoInput.value = '';
        }
    });
}

if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        clearAuthStatus();

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const updatePasswordBtn = document.getElementById('updatePasswordBtn');

        if (newPassword !== confirmNewPassword) {
            showAuthStatus('New passwords do not match. Please re-enter.', 'error');
            return;
        }

        updatePasswordBtn.innerText = 'Updating password...';
        updatePasswordBtn.disabled = true;

        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, oldPassword);

        currentUser.reauthenticateWithCredential(credential)
            .then(() => {
                return currentUser.updatePassword(newPassword);
            })
            .then(() => {
                showAuthStatus('Your password has been successfully updated!', 'success');
                changePasswordForm.reset();
            })
            .catch((error) => {
                console.error('Change Password Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            })
            .finally(() => {
                updatePasswordBtn.innerText = 'Update Password';
                updatePasswordBtn.disabled = false;
            });
    });
}

// Function to Record a Login Session in Firestore
function recordLoginHistory(user) {
    if (!user || typeof db === 'undefined') return;
    const historyRef = db.collection('users').doc(user.uid).collection('login_history');
    if (sessionStorage.getItem('loginRecorded')) return;

    historyRef.add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent
    }).then(() => {
        sessionStorage.setItem('loginRecorded', 'true');
    }).catch(err => console.warn("Failed to record login history:", err));
}

// Function to Load Login History into the Settings Panel
function loadLoginHistory(user) {
    const container = document.getElementById('loginHistoryContainer');
    if (!container || !user || typeof db === 'undefined') return;

    db.collection('users').doc(user.uid).collection('login_history')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = '<p style="margin: 0; text-align: center;">No recent login history found.</p>';
                return;
            }

            let html = '<ul style="margin: 0; padding-left: 15px; line-height: 1.5;">';
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Just now';
                const ua = (data.userAgent || '').includes('Mobile') ? 'Mobile Device' : 'Desktop Browser';
                html += `<li><strong>${date}</strong> — ${ua}</li>`;
            });
            html += '</ul>';
            container.innerHTML = html;
        })
        .catch(err => {
            console.warn("Error loading login history:", err);
            container.innerHTML = '<p style="margin: 0; text-align: center; color: #c92a2a;">Could not load history.</p>';
        });
}

// Logout of All Devices Logic
const logoutAllDevicesBtn = document.getElementById('logoutAllDevicesBtn');
if (logoutAllDevicesBtn) {
    logoutAllDevicesBtn.addEventListener('click', function() {
        if (!confirm('Are you sure you want to log out of all devices?')) return;
        clearAuthStatus();

        const currentUser = firebase.auth().currentUser;
        if (!currentUser || typeof db === 'undefined') return;

        logoutAllDevicesBtn.innerText = 'Logging out all devices...';
        logoutAllDevicesBtn.disabled = true;

        db.collection('users').doc(currentUser.uid).set({
            tokenVersion: firebase.firestore.FieldValue.increment(1)
        }, { merge: true })
        .then(() => {
            return firebase.auth().signOut();
        })
        .then(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        })
        .catch(error => {
            console.error('Logout All Error:', error);
            showAuthStatus(getFriendlyAuthError(error), 'error');
            logoutAllDevicesBtn.innerText = 'Log Out of All Devices';
            logoutAllDevicesBtn.disabled = false;
        });
    });
}

if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
        updateNavbarAuth(user);
        if (user && typeof db !== 'undefined') {
            recordLoginHistory(user);
            db.collection('users').doc(user.uid).get().then(doc => {
                showAccountPanel(user);
            }).catch(() => showAccountPanel(user));
        } else {
            showAuthForms();
        }
    });
}

const signOutBtn = document.getElementById('signOutBtn');

if (signOutBtn) {
    signOutBtn.addEventListener('click', function() {
        firebase.auth().signOut()
            .then(() => {
                localStorage.removeItem('cachedUserInitials');
                localStorage.removeItem('cachedAvatarColor');
                localStorage.removeItem('cachedPhotoURL');
                localStorage.removeItem('cachedUserRole');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Sign Out Error:', error);
                showAuthStatus(getFriendlyAuthError(error), 'error');
            });
    });
}

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');

            const icon = navToggle.querySelector('span');
            if (icon) {
                if (navMenu.classList.contains('active')) {
                    icon.innerHTML = '&#9652;';
                } else {
                    icon.innerHTML = '&#9662;';
                }
            }
        });
    }
});

// About Us Section
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('teamMembersContainer') && typeof firebase !== 'undefined') {
        const db = firebase.firestore();
        const auth = firebase.auth();

        const adminPanel = document.getElementById('adminTeamPanel');
        const addTeamForm = document.getElementById('addTeamForm');
        const teamStatus = document.getElementById('teamStatus');
        const container = document.getElementById('teamMembersContainer');

        let isAdmin = false;

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists && userDoc.data().role === 'admin') {
                        isAdmin = true;
                        if (adminPanel) adminPanel.style.display = 'block';
                        loadTeamMembers();
                    }
                } catch (e) {
                    console.log("Admin check error:", e);
                }
            } else {
                isAdmin = false;
                if (adminPanel) adminPanel.style.display = 'none';
                loadTeamMembers();
            }
        });

        if (addTeamForm) {
            addTeamForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                teamStatus.textContent = "Publishing...";
                teamStatus.className = "";

                const name = document.getElementById('memberName').value.trim();
                const role = document.getElementById('memberRole').value.trim();
                const photo = document.getElementById('memberPhoto').value.trim();
                const description = document.getElementById('memberDesc').value.trim();

                try {
                    await db.collection('teamMembers').add({
                        name: name,
                        role: role || null,
                        photo: photo || null,
                        description: description,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    teamStatus.textContent = "Team member added successfully!";
                    teamStatus.className = "auth-status success";
                    addTeamForm.reset();
                    loadTeamMembers();
                } catch (error) {
                    teamStatus.textContent = "Error: " + error.message;
                    teamStatus.className = "auth-status error";
                }
            });
        }

        window.deleteTeamMember = async function(id) {
            if (!confirm("Are you sure you want to remove this team member?")) return;
            try {
                await db.collection('teamMembers').doc(id).delete();
                loadTeamMembers();
            } catch (error) {
                console.error("Error deleting team member:", error);
                alert("Failed to delete team member.");
            }
        };

        async function loadTeamMembers() {
            container.innerHTML = "<p class='center-text'>Loading team members...</p>";
            try {
                const snapshot = await db.collection('teamMembers').orderBy('createdAt', 'asc').get();

                if (snapshot.empty) {
                    container.innerHTML = "<p class='center-text' style='color: var(--text-muted);'>No team members added yet.</p>";
                    return;
                }

                container.innerHTML = "";
                let index = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const docId = doc.id;
                    const name = escapeHTML(data.name);
                    const photoSrc = safeUrl(data.photo);
                    const photoHtml = photoSrc
                        ? `<img class="team-photo" src="${photoSrc}" alt="${name}">`
                        : `<div class="team-photo team-photo--blank" aria-hidden="true">${escapeHTML(String(data.name || '?').charAt(0))}</div>`;
                    const roleHtml = data.role ? `<p class="team-role">${escapeHTML(data.role)}</p>` : '';
                    const deleteBtnHtml = isAdmin
                        ? `<button type="button" onclick="deleteTeamMember('${escapeHTML(docId)}')" class="btn-delete">Delete Member</button>`
                        : '';

                    const rowDiv = document.createElement('article');
                    rowDiv.className = 'team-card';
                    rowDiv.innerHTML = `${photoHtml}<div class="team-body"><h3>${name}</h3>${roleHtml}<p>${escapeHTML(data.description)}</p>${deleteBtnHtml}</div>`;
                    container.appendChild(rowDiv);
                    index++;
                });

            } catch (error) {
                console.error("Error loading team members:", error);
                container.innerHTML = "<p class='center-text' style='color: #8A2E2E;'>Failed to load team members.</p>";
            }
        }

        loadTeamMembers();
    }
});


// Preserve Google Translate Language Selection Across Pages
function setLanguageCookie(langCode) {
    // Google Translate reads cookie format: /auto/langCode or /en/langCode
    const cookieValue = `/en/${langCode}`;
    const domain = window.location.hostname;

    // Set cookie for the entire domain so all pages inherit it
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${domain}`;
    document.cookie = `googtrans=${cookieValue}; path=/;`;
}

// Automatically sync language change events
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('goog-te-combo')) {
        const selectedLang = e.target.value;
        if (selectedLang) {
            setLanguageCookie(selectedLang);
            localStorage.setItem('preferredLanguage', selectedLang);
        }
    }
});

// Restore language cookie on page load if saved in localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
        setLanguageCookie(savedLang);
    }
});

// Remove Google Translate Banner Element Dynamically
const removeGoogleBanner = () => {
    // Target the injected iframe and banner containers
    const banner = document.querySelector('.goog-te-banner-frame') ||
                   document.querySelector('iframe.goog-te-banner-frame') ||
                   document.querySelector('.VIpgJd-Z43Wfe-a223ad-wT322c');

    if (banner) {
        banner.remove();
    }

    // Reset body top position if Google shifted it down
    if (document.body.style.top !== '0px') {
        document.body.style.top = '0px';
    }
};

// Run regularly as Google Translate loads asynchronously
setInterval(removeGoogleBanner, 300);

// Modular Top-Center Back to Top Button

const btn_appear_pos = 200;

document.addEventListener('DOMContentLoaded', () => {
    const backToTopBtn = document.getElementById('backToTopBtn');

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > btn_appear_pos) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

/* =====================================================================
   DASHBOARD EXTENSIONS
   Adds: preferences (email notifications, language, text size),
   data export, deactivate and delete account.
   Firestore layout (all under users/{uid}):
     preferences {notifications{email}, language, fontSize}
     login_history/{id}  {timestamp, userAgent}
===================================================================== */

const FONT_SCALES = { standard: 100, large: 115, larger: 130, largest: 150 };
const NOTIF_KINDS = [['events', 'Event reminders'], ['blog', 'New blog posts'], ['mentorship', 'Mentorship updates']];
const LANGS = [['en', 'English'], ['hi', 'हिन्दी (Hindi)'], ['mr', 'मराठी (Marathi)'], ['gu', 'ગુજરાતી (Gujarati)'],
    ['bn', 'বাংলা (Bengali)'], ['ta', 'தமிழ் (Tamil)'], ['te', 'తెలుగు (Telugu)'], ['kn', 'ಕನ್ನಡ (Kannada)'],
    ['ml', 'മലയാളം (Malayalam)'], ['es', 'Español'], ['fr', 'Français']];
const DEFAULT_PREFS = {
    notifications: { email: { events: true, blog: false, mentorship: true } },
    language: 'en',
    fontSize: 'standard'
};

function applyFontSize(key) {
    document.documentElement.style.fontSize = (FONT_SCALES[key] || 100) + '%';
}
// Apply the cached text size immediately on every page (no flash of small text)
(function () {
    try { applyFontSize((JSON.parse(localStorage.getItem('cachedPrefs') || '{}')).fontSize); } catch (e) { /* ignore */ }
})();

function $id(id) { return document.getElementById(id); }
function userRef(user) { return db.collection('users').doc(user.uid); }
function mergePrefs(saved) {
    saved = saved || {};
    const n = saved.notifications || {};
    return {
        language: saved.language || 'en',
        fontSize: FONT_SCALES[saved.fontSize] ? saved.fontSize : 'standard',
        notifications: {
            email: Object.assign({}, DEFAULT_PREFS.notifications.email, n.email)
        }
    };
}
function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function clearLocalSession() {
    ['cachedUserInitials', 'cachedAvatarColor', 'cachedPhotoURL', 'cachedUserRole', 'cachedPrefs'].forEach(function (k) { localStorage.removeItem(k); });
    sessionStorage.clear();
}

/* ---------- Tab loader (called by switchDashboardTab in auth.html) ---------- */
function loadDashboardTab(tab, user) {
    if (typeof db === 'undefined') return;
    if (tab === 'prefs') loadPreferences(user);
}

/* ---------- Preferences ---------- */
function renderPrefs(prefs) {
    const grid = $id('notifGrid');
    if (!grid) return;
    grid.innerHTML = '<div><h5>Email</h5>' + NOTIF_KINDS.map(function (k) {
        return '<label class="switch-row"><span>' + k[1] + '</span><span class="switch"><input type="checkbox" data-ch="email" data-kind="' +
            k[0] + '"' + (prefs.notifications.email[k[0]] ? ' checked' : '') + '><i></i></span></label>';
    }).join('') + '</div>';

    $id('prefLanguage').innerHTML = LANGS.map(function (l) {
        return '<option value="' + l[0] + '"' + (l[0] === prefs.language ? ' selected' : '') + '>' + escapeHTML(l[1]) + '</option>';
    }).join('');
    $id('prefFontSize').value = prefs.fontSize;
    $id('fontPreview').style.fontSize = FONT_SCALES[prefs.fontSize] + '%';
}

async function loadPreferences(user) {
    try {
        const doc = await userRef(user).get();
        const data = doc.exists ? doc.data() : {};
        const prefs = mergePrefs(data.preferences);
        localStorage.setItem('cachedPrefs', JSON.stringify(prefs));
        applyFontSize(prefs.fontSize);
        renderPrefs(prefs);

        // Signing in again reactivates a deactivated account
        if (data.deactivated) {
            await userRef(user).set({ deactivated: false, reactivatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            showAuthStatus('Welcome back! Your account has been reactivated.', 'success');
        }
    } catch (err) {
        console.warn('Could not load preferences:', err);
        renderPrefs(mergePrefs(JSON.parse(localStorage.getItem('cachedPrefs') || '{}')));
    }
}

(function initPrefsForm() {
    const form = $id('prefsForm');
    if (!form) return;

    $id('prefFontSize').addEventListener('change', function (e) {
        $id('fontPreview').style.fontSize = FONT_SCALES[e.target.value] + '%';
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearAuthStatus();
        const user = firebase.auth().currentUser;
        if (!user) return;

        const prefs = mergePrefs({
            language: $id('prefLanguage').value,
            fontSize: $id('prefFontSize').value
        });
        form.querySelectorAll('input[data-ch]').forEach(function (cb) {
            prefs.notifications[cb.dataset.ch][cb.dataset.kind] = cb.checked;
        });

        const btn = $id('savePrefsBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;
        try {
            const previous = JSON.parse(localStorage.getItem('cachedPrefs') || '{}');
            // mergeFields replaces the whole "preferences" map, so any old SMS/phone
            // values saved earlier are removed from Firestore too.
            await userRef(user).set({ preferences: prefs }, { mergeFields: ['preferences'] });
            localStorage.setItem('cachedPrefs', JSON.stringify(prefs));
            applyFontSize(prefs.fontSize);

            if (prefs.language === 'en') {
                localStorage.removeItem('preferredLanguage');
                const past = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                document.cookie = 'googtrans=; ' + past;
                document.cookie = 'googtrans=; ' + past + '; domain=' + window.location.hostname;
            } else {
                setLanguageCookie(prefs.language);
                localStorage.setItem('preferredLanguage', prefs.language);
            }
            showAuthStatus('Preferences saved.', 'success');
            if ((previous.language || 'en') !== prefs.language) setTimeout(function () { window.location.reload(); }, 700);
        } catch (err) {
            console.error('Save preferences error:', err);
            showAuthStatus('Could not save your preferences. Please try again.', 'error');
        } finally {
            btn.innerText = 'Save Preferences'; btn.disabled = false;
        }
    });
})();

/* ---------- Download my data ---------- */
function plainData(v) {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(plainData);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = plainData(v[k]); }); return o; }
    return v;
}

(function initDataExport() {
    const btn = $id('downloadDataBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
        clearAuthStatus();
        const user = firebase.auth().currentUser;
        if (!user || typeof db === 'undefined') return;
        btn.innerText = 'Preparing your data...'; btn.disabled = true;
        try {
            const ref = userRef(user);
            const results = await Promise.all([ref.get(), ref.collection('login_history').get()]);
            const list = function (snap) { return snap.docs.map(function (d) { const x = plainData(d.data()); x.id = d.id; return x; }); };
            const report = {
                exportedAt: new Date().toISOString(),
                account: {
                    uid: user.uid, email: user.email, displayName: user.displayName,
                    emailVerified: user.emailVerified, createdAt: user.metadata.creationTime, lastSignIn: user.metadata.lastSignInTime
                },
                profile: results[0].exists ? plainData(results[0].data()) : {},
                loginHistory: list(results[1])
            };
            downloadFile('asvattha-my-data-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(report, null, 2), 'application/json');
            showAuthStatus('Your data has been downloaded.', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showAuthStatus('Could not export your data. Please try again.', 'error');
        } finally {
            btn.innerText = 'Download my data'; btn.disabled = false;
        }
    });
})();

/* ---------- Deactivate / delete account ---------- */
(function initAccountRemoval() {
    const deactivateBtn = $id('deactivateBtn');
    if (deactivateBtn) deactivateBtn.addEventListener('click', async function () {
        if (!confirm('Deactivate your account? You\'ll be signed out, and signing in again reactivates it.')) return;
        const user = firebase.auth().currentUser;
        if (!user || typeof db === 'undefined') return;
        deactivateBtn.disabled = true;
        try {
            await userRef(user).set({ deactivated: true, deactivatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            await firebase.auth().signOut();
            clearLocalSession();
            window.location.href = 'index.html';
        } catch (err) {
            deactivateBtn.disabled = false;
            showAuthStatus('Could not deactivate your account. Please try again.', 'error');
        }
    });

    async function deleteSubcollection(colRef) {
        let snap;
        do {
            snap = await colRef.limit(400).get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(function (d) { batch.delete(d.ref); });
            await batch.commit();
        } while (snap.size === 400);
    }

    const form = $id('deleteAccountForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearAuthStatus();
        const user = firebase.auth().currentUser;
        if (!user || typeof db === 'undefined') return;

        if ($id('deleteConfirmText').value.trim() !== 'DELETE') {
            showAuthStatus('Type DELETE in capital letters to confirm.', 'error');
            return;
        }
        if (!confirm('This permanently deletes your account and data. Continue?')) return;

        const btn = $id('deleteAccountBtn');
        btn.innerText = 'Deleting account...'; btn.disabled = true;
        try {
            // 1. Re-verify identity first, so nothing is deleted on a wrong password
            const cred = firebase.auth.EmailAuthProvider.credential(user.email, $id('deletePassword').value);
            await user.reauthenticateWithCredential(cred);

            // 2. Delete data while we can still authenticate to Firestore.
            //    'rsvps' and 'sessions' are legacy subcollections from the removed
            //    Bookings/Mentorship tabs; they're still cleaned up so no data is orphaned.
            const ref = userRef(user);
            for (const sub of ['login_history', 'rsvps', 'sessions']) await deleteSubcollection(ref.collection(sub));
            await ref.delete();

            // 3. Delete the sign-in itself
            await user.delete();
            clearLocalSession();
            localStorage.removeItem('preferredLanguage');
            window.location.href = 'index.html';
        } catch (err) {
            console.error('Delete account error:', err);
            showAuthStatus(getFriendlyAuthError(err), 'error');
            btn.innerText = 'Delete my account permanently'; btn.disabled = false;
        }
    });
})();

// Clear cached preferences on sign-out so a shared computer doesn't keep someone's text size
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function (user) {
        if (!user) { localStorage.removeItem('cachedPrefs'); return; }
        // Syncs text size across devices and reactivates a deactivated account on sign-in
        if (typeof db !== 'undefined') loadPreferences(user);
    });
}