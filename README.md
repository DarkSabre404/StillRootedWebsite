# Still Rooted 🌱

An interactive web application built as a school project to bridge generations, connect seniors and youth, and foster community through storytelling, shared knowledge, and active engagement.

---

## Project Overview

**Still Rooted** is a fully responsive community platform designed to facilitate intergenerational bonding. It combines modern web technologies (HTML5, CSS3, JavaScript) with powerful backend services (Firebase Authentication and Cloud Firestore) to offer secure user accounts, dynamic media updates, and admin-managed community features.

---

## Key Features & Technical Highlights

### 1. Secure Authentication & Role-Based Access Control (RBAC)
* **Firebase Auth Integration:** Secure user sign-up, login, password reset handling, and session persistence.
* **Role Customization:** Users select and maintain distinct roles upon registration:
  * Admin
  * Senior Citizen Participant
  * Volunteer / Mentor
  * Student / Researcher
* **Dynamic Privileges:** The user profile page dynamically loads role-specific privileges, badges, and exclusive dashboard views.
* **Smart Navbar Profile Badge:** Generates custom profile pictures or color-coded user initial avatars with local storage caching for zero-latency rendering on page load.

### 2. Interactive Profile & Account Management
* **Custom Bio & Avatar Settings:** Members can update their display name, bio, profile color theme, and avatar image.
* **Cloud Storage:** Profile photos upload directly to Firebase Storage with strict size validation.
* **Security Settings:** In-app password change and update capabilities.

### 3. Dynamic "About Us" Team Manager (Admin Controls)
* **Alternating Zig-Zag Layout:** Team member cards render dynamically with responsive, alternating left-right alignment and styled image placeholders.
* **Admin-Only Content Management:** Logged-in administrators gain access to an exclusive control panel to:
  * **Add Team Members:** Instantly push new team profiles with custom roles, photos, and descriptions into Firestore.
  * **Delete Members:** Use sleek, custom pill-shaped delete buttons (`.btn-delete`) to remove team members with real-time DOM updates and database synchronization.

### 4. Interactive Forms & Contact Integration
* **EmailJS Integration:** Fully configured contact form enabling users to send inquiries directly to the project team with automated success and error status feedback.
* **Responsive Navigation:** Mobile-optimized drop-down navigation bar with smooth toggle animations.

---

## Tech Stack
* **Frontend:** HTML5, CSS3 (Custom variables, Flexbox, responsive design), JavaScript (ES6+).
* **Backend & Database:** Firebase Authentication, Cloud Firestore, Firebase Cloud Storage.
* **Third-Party Services:** EmailJS (for contact form email dispatch).

---

## Project Structure
```text
StillRootedWebsite/
├── css/
│   └── style.css
├── functions/
│   └── api/
│       └── secure-action.js
├── js/
│   ├── chatbot.js
│   └── main.js
├── resources/
├── .assetsignore
├── about.html
├── auth.html
├── blog.html
├── contact.html
├── gallery.html
├── get-involved.html
├── index.html
├── model.html
├── programs.html
├── README.md
└── research.html