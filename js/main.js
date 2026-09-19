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

        // Replace 'YOUR_SERVICE_ID' and 'YOUR_TEMPLATE_ID' with your EmailJS details
        emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', form)
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
// 2. Firebase Authentication Handling
// ==========================================

// Login Form Submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                alert('Welcome back! Login successful.');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Login Error:', error);
                alert('Login failed: ' + error.message);
            });
    });
}

// Sign Up Form Submission
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Attach the user's full name to their profile
                return userCredential.user.updateProfile({
                    displayName: name
                });
            })
            .then(() => {
                alert('Account created successfully! Welcome to Still Rooted.');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Sign Up Error:', error);
                alert('Sign up failed: ' + error.message);
            });
    });
}