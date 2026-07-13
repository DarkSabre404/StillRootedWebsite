// Quick confirmation alert when users submit the form
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    alert("Thank you for reaching out to Still Rooted! Our school project team will be in touch shortly.");
    this.reset();
});