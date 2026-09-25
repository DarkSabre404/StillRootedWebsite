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


// Navigation Bar Profile Badge & Local Cache
function updateNavbarAuth(user) {
    const navAuthLink = document.getElementById('navAuthLink');
    if (!navAuthLink) return;

    if (user) {
        const initials = getInitials(user.displayName || 'User');
        const color = localStorage.getItem('cachedAvatarColor') || '#1b4332';
        const photoURL = user.photoURL || localStorage.getItem('cachedPhotoURL');

        localStorage.setItem('cachedUserInitials', initials);

        if (photoURL) {
            navAuthLink.innerHTML = `<img src="${photoURL}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; vertical-align: middle; border: 1px solid #1b4332;">`;
        } else {
            navAuthLink.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background-color: ${color}; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none;">${initials}</span>`;
        }
        navAuthLink.title = "View Profile";
    } else {
        localStorage.removeItem('cachedUserInitials');
        localStorage.removeItem('cachedAvatarColor');
        localStorage.removeItem('cachedPhotoURL');
        localStorage.removeItem('cachedUserRole');
        navAuthLink.innerHTML = 'Login / Register';
        navAuthLink.title = "";
    }
}

// Immediate execution (0ms delay) to prevent page navigation flash
(function checkCachedSession() {
    const cachedInitials = localStorage.getItem('cachedUserInitials');
    const cachedColor = localStorage.getItem('cachedAvatarColor') || '#1b4332';
    const cachedPhotoURL = localStorage.getItem('cachedPhotoURL');
    const navAuthLink = document.getElementById('navAuthLink');

    if (cachedInitials && navAuthLink) {
        if (cachedPhotoURL) {
            navAuthLink.innerHTML = `<img src="${cachedPhotoURL}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; vertical-align: middle; border: 1px solid #1b4332;">`;
        } else {
            navAuthLink.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background-color: ${cachedColor}; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none;">${cachedInitials}</span>`;
        }
        navAuthLink.title = "View Profile";
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
                        avatarColor: '#1b4332',
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


// Profile Section Toggles & Role Privileges
const toggleEditProfileBtn = document.getElementById('toggleEditProfileBtn');
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const editProfileForm = document.getElementById('editProfileForm');
const changePasswordForm = document.getElementById('changePasswordForm');

if (toggleEditProfileBtn && editProfileForm) {
    toggleEditProfileBtn.addEventListener('click', function() {
        if (editProfileForm.style.display === 'none' || editProfileForm.style.display === '') {
            editProfileForm.style.display = 'block';
            changePasswordForm.style.display = 'none';
            toggleEditProfileBtn.innerText = 'Close Edit Menu';
            toggleSettingsBtn.innerText = 'Security Settings';
        } else {
            editProfileForm.style.display = 'none';
            toggleEditProfileBtn.innerText = 'Edit Profile';
        }
    });
}

if (toggleSettingsBtn && changePasswordForm) {
    toggleSettingsBtn.addEventListener('click', function() {
        if (changePasswordForm.style.display === 'none' || changePasswordForm.style.display === '') {
            changePasswordForm.style.display = 'block';
            editProfileForm.style.display = 'none';
            toggleSettingsBtn.innerText = 'Close Settings';
            toggleEditProfileBtn.innerText = 'Edit Profile';
        } else {
            changePasswordForm.style.display = 'none';
            toggleSettingsBtn.innerText = 'Security Settings';
        }
    });
}

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

    if (accountName) accountName.innerText = name;
    if (accountEmail) accountEmail.innerText = user.email;
    if (authTitle) authTitle.innerText = 'Profile';
    if (editDisplayName) editDisplayName.value = name;

    if (user.photoURL) {
        if (accountPhoto) {
            accountPhoto.src = user.photoURL;
            accountPhoto.style.display = 'block';
        }
        if (accountInitial) accountInitial.style.display = 'none';
        localStorage.setItem('cachedPhotoURL', user.photoURL);
    } else {
        if (accountPhoto) accountPhoto.style.display = 'none';
        if (accountInitial) {
            accountInitial.style.display = 'inline';
            accountInitial.innerText = initials;
        }
    }

    if (typeof db !== 'undefined') {
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
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

                    if (data.photoURL && !user.photoURL) {
                        if (accountPhoto) {
                            accountPhoto.src = data.photoURL;
                            accountPhoto.style.display = 'block';
                        }
                        if (accountInitial) accountInitial.style.display = 'none';
                        localStorage.setItem('cachedPhotoURL', data.photoURL);
                    }

                    if (data.avatarColor) {
                        if (editAvatarColor) editAvatarColor.value = data.avatarColor;
                        const avatarContainer = document.getElementById('avatarContainer');
                        if (avatarContainer) avatarContainer.style.backgroundColor = data.avatarColor;
                        localStorage.setItem('cachedAvatarColor', data.avatarColor);
                        updateNavbarAuth(user);
                    }
                }
            })
            .catch((err) => console.warn("Firestore fetch skipped:", err));
    }

    const accountPanel = document.getElementById('accountPanel');
    const authForms = document.getElementById('authForms');

    if (accountPanel) accountPanel.style.display = 'block';
    if (authForms) authForms.style.display = 'none';
}

function showAuthForms() {
    const authTitle = document.getElementById('authTitle');
    if (authTitle) authTitle.innerText = 'Welcome Back';

    const accountPanel = document.getElementById('accountPanel');
    const authForms = document.getElementById('authForms');

    if (accountPanel) accountPanel.style.display = 'none';
    if (authForms) authForms.style.display = 'block';

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

        saveBtn.innerText = 'Saving profile...';
        saveBtn.disabled = true;

        let uploadedPhotoURL = currentUser.photoURL || '';

        try {
            if (photoInput && photoInput.files.length > 0 && typeof storage !== 'undefined') {
                const file = photoInput.files[0];
                if (file.size > 2 * 1024 * 1024) {
                    throw new Error("File size exceeds 2MB limit.");
                }

                const storageRef = storage.ref(`profile_photos/${currentUser.uid}`);
                const snapshot = await storageRef.put(file);
                uploadedPhotoURL = await snapshot.ref.getDownloadURL();
            }

            await currentUser.updateProfile({
                displayName: newName,
                photoURL: uploadedPhotoURL
            });

            if (typeof db !== 'undefined') {
                await db.collection('users').doc(currentUser.uid).set({
                    fullName: newName,
                    bio: newBio,
                    avatarColor: newColor,
                    photoURL: uploadedPhotoURL
                }, { merge: true });
            }

            localStorage.setItem('cachedAvatarColor', newColor);
            if (uploadedPhotoURL) {
                localStorage.setItem('cachedPhotoURL', uploadedPhotoURL);
                const accountPhoto = document.getElementById('accountPhoto');
                const accountInitial = document.getElementById('accountInitial');
                if (accountPhoto) {
                    accountPhoto.src = uploadedPhotoURL;
                    accountPhoto.style.display = 'block';
                }
                if (accountInitial) accountInitial.style.display = 'none';
            }

            document.getElementById('accountName').innerText = newName;
            if (accountBioDisplay) {
                accountBioDisplay.innerText = newBio ? `"${newBio}"` : 'No bio added yet.';
            }

            showAuthStatus('Profile updated successfully!', 'success');
            updateNavbarAuth(currentUser);

            editProfileForm.style.display = 'none';
            if (toggleEditProfileBtn) toggleEditProfileBtn.innerText = 'Edit Profile';

        } catch (error) {
            console.error('Save Profile Error:', error);
            showAuthStatus(error.message || 'Failed to update profile. Saved locally.', 'error');
        } finally {
            saveBtn.innerText = 'Save Profile Changes';
            saveBtn.disabled = false;
        }
    });
}

if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        clearAuthStatus();

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;

        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const updatePasswordBtn = document.getElementById('updatePasswordBtn');

        if (newPassword !== confirmNewPassword) {
            showAuthStatus('Passwords do not match. Please re-enter.', 'error');
            return;
        }

        updatePasswordBtn.innerText = 'Updating password...';
        updatePasswordBtn.disabled = true;

        currentUser.updatePassword(newPassword)
            .then(() => {
                showAuthStatus('Your password has been successfully updated!', 'success');
                changePasswordForm.reset();
                changePasswordForm.style.display = 'none';
                if (toggleSettingsBtn) toggleSettingsBtn.innerText = 'Security Settings';
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

        // Check if logged-in user is an admin via Firestore users collection
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

        // Handle adding a new team member
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

        // Handle deleting a team member (Admin only)
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

        // Load and render team members with alternating zig-zag layout
        async function loadTeamMembers() {
            container.innerHTML = "<p class='center-text'>Loading team members...</p>";
            try {
                const snapshot = await db.collection('teamMembers').orderBy('createdAt', 'desc').get();

                if (snapshot.empty) {
                    container.innerHTML = "<p class='center-text' style='color: var(--text-muted);'>No team members added yet.</p>";
                    return;
                }

                container.innerHTML = "";
                let index = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const docId = doc.id;
                    const isEven = index % 2 === 0;

                    const photoHtml = data.photo
                        ? `<img src="${data.photo}" alt="${data.name}" style="width: 100%; max-width: 280px; height: 280px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 8px 20px var(--shadow-deep);">`
                        : `<div style="width: 100%; max-width: 280px; height: 280px; border-radius: 8px; background: linear-gradient(135deg, var(--teal-primary), var(--peach-soft)); display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: bold; color: var(--bg-dark-2); box-shadow: 0 8px 20px var(--shadow-deep);">${data.name.charAt(0)}</div>`;

                    const roleHtml = data.role ? `<h4 style="color: var(--aqua-highlight); margin-bottom: 10px; font-size: 16px;">${data.role}</h4>` : '';

                    // Uses the matching .btn-delete aesthetic pill style class
                    const deleteBtnHtml = isAdmin
                        ? `<br><button onclick="deleteTeamMember('${docId}')" class="btn-delete">Delete Member</button>`
                        : '';

                    const rowDiv = document.createElement('div');
                    rowDiv.className = "card";
                    rowDiv.style.display = "flex";
                    rowDiv.style.flexDirection = isEven ? "row" : "row-reverse";
                    rowDiv.style.alignItems = "center";
                    rowDiv.style.gap = "30px";
                    rowDiv.style.flexWrap = "wrap";

                    rowDiv.innerHTML = `
                        <div style="flex: 1; min-width: 250px; display: flex; justify-content: center;">
                            ${photoHtml}
                        </div>
                        <div style="flex: 2; min-width: 280px;">
                            <h3 style="font-size: 24px; color: var(--peach-light); margin-bottom: 5px;">${data.name}</h3>
                            ${roleHtml}
                            <p style="color: var(--text-primary); line-height: 1.6; margin-bottom: 0;">${data.description}</p>
                            ${deleteBtnHtml}
                        </div>
                    `;

                    container.appendChild(rowDiv);
                    index++;
                });

            } catch (error) {
                console.error("Error loading team members:", error);
                container.innerHTML = "<p class='center-text' style='color: #f19999;'>Failed to load team members.</p>";
            }
        }

        loadTeamMembers();
    }
});