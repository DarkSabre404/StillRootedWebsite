# Asvattha (Still Rooted) 🌱

An interactive, multi-page web application built as a community school project to bridge generations, connect seniors and youth, and foster community through storytelling, shared knowledge, and active engagement.

---

## Project Overview

**Asvattha** is a fully responsive community platform designed to facilitate intergenerational bonding. It combines modern web technologies (HTML5, CSS3, ES6+ JavaScript) with powerful backend services (Firebase Authentication, Cloud Firestore, and Cloud Storage) to offer secure user accounts, dynamic media updates, admin-managed community features, and a built-in virtual assistant.

---

## Key Features & Technical Highlights

### 1. Secure Authentication & Role-Based Access Control (RBAC)
- **Firebase Auth Integration:** Secure user sign-up, login, password reset handling, and session persistence.
- **Role Customization:** Users select and maintain distinct roles upon registration (Admin, Senior Citizen Participant, Volunteer/Mentor, Student/Researcher).
- **Dynamic Privileges:** The user profile page dynamically loads role-specific privileges, badges, and exclusive dashboard views.
- **Smart Navbar Profile Badge:** Generates custom profile pictures or color-coded user initial avatars with local storage caching for zero-latency rendering on page load.

### 2. Interactive Profile & Account Management Dashboard
- **Custom Bio & Avatar Settings:** Members can update their display name, bio, profile color theme, and avatar image with client-side cropping and image compression into data URLs.
- **Security Settings:** In-app password change, login history tracking, active session management, and logout-all-devices capability.
- **Data Privacy Controls:** Allows users to download a complete JSON export of their profile and login history, deactivate their account, or permanently delete their account with cryptographic re-authentication.

### 3. Interactive Ledger Grid Calendar & Events Management
- **Almanac-Style Calendar Grid:** An interactive monthly calendar featuring clean grid layouts, previous/next month navigation, and visual event indicators.
- **Admin Event Management:** Administrators can add, edit, or delete community events in real-time with instant Firestore synchronization.

### 4. AshBot Virtual Assistant (`chatbot.js`)
- **Self-Contained Rule-Based Bot:** A dependency-free assistant built directly into the client-side browser to help visitors navigate programs, eligibility, events, and FAQs without external API costs.
- **Advanced Language Engine:** Features text normalization, singular/plural stemming, conservative spelling correction, quick-reply suggestion chips, and conversation memory persistence.

### 5. Dynamic Content Management (Admin Controls)
- **About Us Team Manager:** Alternating zig-zag layout for team cards with admin controls to dynamically add or delete team members.
- **Community Gallery & Blog:** Media upload panels featuring automated image compression and admin delete functions.
- **Get Involved Submissions:** Review dashboard allowing administrators to filter, review, and delete form submissions for volunteers, senior mentors, and partner organizations.

### 6. Interactive Forms & Contact Integration
- **EmailJS Integration:** Fully configured contact form enabling users to send inquiries directly to the project team with automated success and/or error status feedback.
- **Responsive Navigation:** Mobile-optimized drop-down navigation bar with smooth toggle animations and preserved Google Translate language preferences.

---

## Tech Stack
- **Frontend:** HTML5, CSS3 (Custom variables, Flexbox, responsive design), JavaScript (ES6+).
- **Backend & Database:** Firebase Authentication, Cloud Firestore, Firebase Cloud Storage.
- **Third-Party Services:** EmailJS (for contact form email dispatch).

---

## Project Structure
```text
StillRootedWebsite/
├── css/
│   └── style.css
├── forms/
│   ├── mentor.html
│   ├── partner.html
│   └── volunteer.html
├── functions/
│   └── api/
│       └── secure-action.js
├── js/
│   ├── chatbot.js
│   ├── events.js
│   ├── firebase-config.js
│   └── main.js
├── resources/
├── .assetsignore
├── 404.html
├── about.html
├── auth.html
├── blog.html
├── calendar.html
├── contact.html
├── gallery.html
├── get-involved.html
├── index.html
├── model.html
├── programs.html
├── README.md
└── research.html